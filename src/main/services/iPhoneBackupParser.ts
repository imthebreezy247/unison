import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

export interface ParsedMessage {
  id: string;
  threadId: string;
  contactId?: string;
  phoneNumber: string;
  content: string;
  messageType: 'sms' | 'imessage' | 'rcs';
  direction: 'incoming' | 'outgoing';
  timestamp: Date;
  attachments?: any[];
  isGroup?: boolean;
  groupInfo?: {
    name?: string;
    participants: string[];
  };
}

export class iPhoneBackupParser {
  private backupPath: string;
  private smsDb: any = null;

  constructor(deviceId: string = '00008101-000120620AE9001E') {
    // For Windows: %APPDATA%\Apple Computer\MobileSync\Backup\{deviceId}
    // For WSL: We'll simulate the Windows path structure
    this.backupPath = path.join(
      process.env.APPDATA || 'C:\\Users\\shann\\AppData\\Roaming',
      'Apple Computer',
      'MobileSync',
      'Backup',
      deviceId
    );
    
    log.info(`Backup parser initialized for device: ${deviceId}`);
    log.info(`Looking for backup at: ${this.backupPath}`);
  }

  async parseMessages(): Promise<ParsedMessage[]> {
    const messages: ParsedMessage[] = [];
    
    try {
      // Path to SMS database (known hash for SMS.db)
      const smsDbPath = path.join(this.backupPath, '3d0d7e5fb2ce288813306e4d4636395e047a3d28');
      
      if (!fs.existsSync(smsDbPath)) {
        log.warn('SMS database not found at:', smsDbPath);
        log.info('iTunes backup may not exist or may be encrypted');
        
        // Return sample messages for testing
        return this.generateSampleMessages();
      }

      log.info('Found SMS database at:', smsDbPath);
      
      try {
        // Try to use better-sqlite3 if available
        const Database = require('better-sqlite3');
        this.smsDb = new Database(smsDbPath, { readonly: true });
        
        // Query for messages with proper iPhone database schema
        const query = `
          SELECT 
            message.ROWID as id,
            message.guid,
            message.text as content,
            message.service,
            CASE WHEN message.is_from_me = 1 THEN 'outgoing' ELSE 'incoming' END as direction,
            datetime(message.date/1000000000 + 978307200, 'unixepoch') as timestamp,
            handle.id as phone_number,
            handle.service as handle_service,
            message.cache_has_attachments,
            message.is_read
          FROM message
          LEFT JOIN handle ON message.handle_id = handle.ROWID
          WHERE message.text IS NOT NULL AND message.text != ''
          ORDER BY message.date DESC
          LIMIT 1000
        `;
        
        const rows = this.smsDb.prepare(query).all();
        
        log.info(`Found ${rows.length} messages in backup database`);
        
        // Process each message
        for (const row of rows) {
          try {
            const phoneNumber = this.normalizePhoneNumber(row.phone_number || 'Unknown');
            const threadId = `thread-${this.hashPhoneNumber(phoneNumber)}`;
            
            messages.push({
              id: `msg-backup-${row.id}`,
              threadId: threadId,
              phoneNumber: phoneNumber,
              content: row.content || '',
              messageType: row.service === 'iMessage' ? 'imessage' : 'sms',
              direction: row.direction,
              timestamp: new Date(row.timestamp),
              contactId: undefined,
              attachments: row.cache_has_attachments ? [] : undefined
            });
          } catch (error) {
            log.error('Error processing message row:', error);
          }
        }
        
        log.info(`Successfully parsed ${messages.length} messages from backup`);
        
      } catch (dbError) {
        log.error('Database error:', dbError);
        log.info('Falling back to sample messages');
        return this.generateSampleMessages();
      } finally {
        if (this.smsDb) {
          this.smsDb.close();
        }
      }
      
    } catch (error) {
      log.error('Error parsing messages:', error);
      log.info('Generating sample messages for testing');
      return this.generateSampleMessages();
    }
    
    return messages;
  }

  async parseContacts(): Promise<any[]> {
    const contacts: any[] = [];
    
    try {
      // Path to AddressBook database (known hash for AddressBook.sqlitedb)
      const contactsDbPath = path.join(this.backupPath, '31bb7ba8914766d4ba40d6dfb6113c8b614be442');
      
      if (fs.existsSync(contactsDbPath)) {
        log.info('Found contacts database at:', contactsDbPath);
        // TODO: Parse contacts similarly to messages
      } else {
        log.info('Contacts database not found, will use phone numbers as display names');
      }
    } catch (error) {
      log.error('Error parsing contacts:', error);
    }
    
    return contacts;
  }

  private generateSampleMessages(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const now = new Date();

    // Create messages for Chris's actual phone number
    const chrisThreadId = 'thread-chris-real';
    const chrisPhone = '+19415180701';
    
    const sampleMessages = [
      { content: 'Welcome to UnisonX! Your real messages will appear here once you create an iTunes backup.', isIncoming: false },
      { content: 'This is a test message in your conversation thread', isIncoming: true },
      { content: 'You can send messages and they will be saved locally', isIncoming: false },
      { content: 'Create an iTunes backup to import your real message history', isIncoming: false },
      { content: 'Ready to test messaging! 📱', isIncoming: true }
    ];

    sampleMessages.forEach((msg, i) => {
      const messageId = `msg-sample-${i + 1}`;
      const timestamp = new Date(now.getTime() - (sampleMessages.length - i) * 300000); // 5 minutes apart
      
      messages.push({
        id: messageId,
        threadId: chrisThreadId,
        contactId: 'contact-chris-real',
        phoneNumber: chrisPhone,
        content: msg.content,
        messageType: 'imessage',
        direction: msg.isIncoming ? 'incoming' : 'outgoing',
        timestamp
      });
    });

    // Add a few more conversation threads for testing
    const testContacts = [
      { phone: '+1234567890', name: 'Test Contact 1' },
      { phone: '+1987654321', name: 'Test Contact 2' }
    ];

    testContacts.forEach((contact, contactIndex) => {
      const threadId = `thread-test-${contactIndex + 1}`;
      
      for (let i = 0; i < 3; i++) {
        const messageId = `msg-test-${contactIndex}-${i}`;
        const timestamp = new Date(now.getTime() - (contactIndex * 1000000) - (i * 600000)); // Spread out times
        
        messages.push({
          id: messageId,
          threadId,
          phoneNumber: contact.phone,
          content: `Test message ${i + 1} from ${contact.name}`,
          messageType: Math.random() > 0.5 ? 'imessage' : 'sms',
          direction: Math.random() > 0.5 ? 'incoming' : 'outgoing',
          timestamp
        });
      }
    });

    log.info(`Generated ${messages.length} sample messages for testing`);
    return messages;
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber === 'Unknown') {
      return phoneNumber;
    }
    
    // Remove all non-digit characters except +
    let normalized = phoneNumber.replace(/[^\d+]/g, '');
    
    // If it's a US number without country code, add +1
    if (normalized.length === 10 && !normalized.startsWith('+')) {
      normalized = '+1' + normalized;
    }
    
    return normalized;
  }

  private hashPhoneNumber(phoneNumber: string): string {
    // Simple hash for creating consistent thread IDs
    let hash = 0;
    for (let i = 0; i < phoneNumber.length; i++) {
      const char = phoneNumber.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  checkBackupExists(): boolean {
    return fs.existsSync(this.backupPath);
  }

  getBackupInfo(): any {
    try {
      const infoPath = path.join(this.backupPath, 'Info.plist');
      if (fs.existsSync(infoPath)) {
        // Would parse plist file here
        return { exists: true, path: this.backupPath };
      }
    } catch (error) {
      log.error('Error reading backup info:', error);
    }
    
    return { exists: false, path: this.backupPath };
  }

  cleanup(): void {
    if (this.smsDb) {
      try {
        this.smsDb.close();
      } catch (error) {
        log.error('Error closing database:', error);
      }
    }
  }
}