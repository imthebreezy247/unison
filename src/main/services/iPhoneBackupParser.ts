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
      if (!fs.existsSync(this.backupPath)) {
        log.error(`Backup directory not found: ${this.backupPath}`);
        return this.generateSampleMessages();
      }

      // List all files in backup directory
      const files = fs.readdirSync(this.backupPath);
      log.info(`Found ${files.length} files in backup directory`);
      
      let smsDbPath = null;
      
      // Look for any file starting with '3d0d7e5fb2ce2888' (SMS database prefix)
      for (const file of files) {
        if (file.startsWith('3d0d7e5fb2ce2888')) {
          const filePath = path.join(this.backupPath, file);
          const stats = fs.statSync(filePath);
          log.info(`Found potential SMS database: ${file} (${Math.round(stats.size / 1024 / 1024)} MB)`);
          
          // If it's a large file (>1MB), it's likely the SMS database
          if (stats.size > 1000000) {
            smsDbPath = filePath;
            break;
          }
        }
      }
      
      if (!smsDbPath) {
        // Look for any large file that might be the SMS database
        log.info('Exact SMS database not found, searching for large SQLite files...');
        const largeFiles = files.filter(f => {
          try {
            const filePath = path.join(this.backupPath, f);
            const stats = fs.statSync(filePath);
            return stats.size > 10000000; // > 10MB
          } catch {
            return false;
          }
        });
        
        if (largeFiles.length > 0) {
          // Sort by size and take largest
          largeFiles.sort((a, b) => {
            const sizeA = fs.statSync(path.join(this.backupPath, a)).size;
            const sizeB = fs.statSync(path.join(this.backupPath, b)).size;
            return sizeB - sizeA;
          });
          
          smsDbPath = path.join(this.backupPath, largeFiles[0]);
          log.info(`Using largest file as potential SMS database: ${largeFiles[0]}`);
        }
      }
      
      if (!smsDbPath || !fs.existsSync(smsDbPath)) {
        log.error('SMS database not found in backup');
        log.info('Available files starting with 3d:', files.filter(f => f.startsWith('3d')).slice(0, 5));
        log.info('Generating sample messages for testing');
        return this.generateSampleMessages();
      }

      log.info(`Opening SMS database at: ${smsDbPath}`);
      
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
            datetime(message.date/1000000000 + 978307200, 'unixepoch', 'localtime') as timestamp,
            handle.id as phone_number,
            handle.service as handle_service,
            chat.chat_identifier,
            chat.display_name as chat_name
          FROM message
          LEFT JOIN handle ON message.handle_id = handle.ROWID
          LEFT JOIN chat_message_join ON message.ROWID = chat_message_join.message_id
          LEFT JOIN chat ON chat_message_join.chat_id = chat.ROWID
          WHERE message.text IS NOT NULL AND message.text != ''
          ORDER BY message.date DESC
          LIMIT 2000
        `;
        
        const rows = this.smsDb.prepare(query).all();
        log.info(`Found ${rows.length} messages in backup database`);
        
        // Group messages by conversation
        for (const row of rows) {
          try {
            const phoneNumber = this.normalizePhoneNumber(row.phone_number || row.chat_identifier || 'Unknown');
            const threadId = `thread-${phoneNumber.replace(/[^a-zA-Z0-9]/g, '')}`;
            
            messages.push({
              id: `msg-backup-${row.id}`,
              threadId: threadId,
              phoneNumber: phoneNumber,
              content: row.content || '',
              messageType: row.service === 'iMessage' ? 'imessage' : 'sms',
              direction: row.direction,
              timestamp: new Date(row.timestamp),
              contactId: undefined,
              attachments: []
            });
          } catch (error) {
            log.error('Error processing message row:', error);
          }
        }
        
        log.info(`Successfully parsed ${messages.length} messages from backup`);
        
      } catch (dbError) {
        log.error('Database error:', dbError);
        log.info('Database may be corrupted or encrypted. Falling back to sample messages');
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