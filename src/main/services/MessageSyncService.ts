import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { app, dialog } from 'electron';
import { DatabaseManager, Message, MessageThread, MessageAttachment } from '../database/DatabaseManager';
import { PhoneLinkBridge, PhoneLinkMessage } from './PhoneLinkBridge';

export interface MessageSyncResult {
  success: boolean;
  messagesImported: number;
  threadsCreated: number;
  attachmentsProcessed: number;
  errors: string[];
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  contactId?: string;
  phoneNumber: string;
  content: string;
  messageType: 'sms' | 'imessage' | 'rcs';
  direction: 'incoming' | 'outgoing';
  timestamp: Date;
  attachments?: {
    filename: string;
    path: string;
    type: string;
    size?: number;
  }[];
  isGroup?: boolean;
  groupInfo?: {
    name?: string;
    participants: string[];
  };
}

export class MessageSyncService {
  private databaseManager: DatabaseManager;
  private phoneLinkBridge: PhoneLinkBridge;

  constructor(databaseManager: DatabaseManager, phoneLinkBridge: PhoneLinkBridge) {
    this.databaseManager = databaseManager;
    this.phoneLinkBridge = phoneLinkBridge;
  }

  async initialize(): Promise<void> {
    log.info('📱 MessageSyncService initialized with Phone Link bridge only');
    
    // Initialize Phone Link Bridge for real-time messaging
    await this.initializePhoneLinkBridge();
  }

  private async initializePhoneLinkBridge(): Promise<void> {
    try {
      log.info('🔗 Connecting to shared Phone Link Bridge for real-time messaging...');
      
      // Phone Link Bridge is already created and passed in constructor
      if (!this.phoneLinkBridge) {
        throw new Error('Phone Link Bridge not provided!');
      }
      
      // Listen for incoming messages from Phone Link
      this.phoneLinkBridge.on('message-received', async (messageData: PhoneLinkMessage) => {
        log.info('📨 New message received from Phone Link:', messageData);
        
        try {
          await this.handleIncomingPhoneLinkMessage(messageData);
        } catch (error) {
          log.error('Error handling incoming Phone Link message:', error);
        }
      });
      
      log.info('✅ Connected to Phone Link Bridge successfully');
    } catch (error) {
      log.error('❌ Failed to connect to Phone Link Bridge:', error);
      // Continue without Phone Link bridge - app should still work
    }
  }

  private async handleIncomingPhoneLinkMessage(messageData: PhoneLinkMessage): Promise<void> {
    try {
      // Find or create thread for this phone number/contact
      let threadId = await this.findThreadByPhoneNumber(messageData.from);
      
      if (!threadId) {
        // Create new thread
        threadId = await this.createThreadForPhoneNumber(messageData.from);
      }
      
      // Save the incoming message to database
      const messageId = `msg-phonelink-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.databaseManager.run(`
        INSERT INTO messages (
          id, thread_id, phone_number, content, message_type, 
          direction, timestamp, read_status, delivered_status, failed_status,
          archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        messageId,
        threadId,
        messageData.from,
        messageData.content,
        messageData.messageType || 'sms',
        'incoming',
        messageData.timestamp.toISOString(),
        0, // Mark as unread initially
        1, // Delivered (we received it)
        0, // Not failed
        0  // Not archived
      ]);
      
      // Update thread with latest message
      await this.databaseManager.run(`
        UPDATE message_threads 
        SET last_message_id = ?, last_message_timestamp = ?, last_message_content = ?, unread_count = unread_count + 1
        WHERE id = ?
      `, [messageId, messageData.timestamp.toISOString(), messageData.content, threadId]);
      
      log.info(`✅ Saved incoming message from ${messageData.from} to thread ${threadId}`);
      
      // TODO: Emit event to update UI in real-time
      // this.emit('new-message', { threadId, messageId, messageData });
      
    } catch (error) {
      log.error('Error saving incoming Phone Link message:', error);
    }
  }

  private async findThreadByPhoneNumber(phoneNumber: string): Promise<string | null> {
    try {
      const result = await this.databaseManager.query(
        'SELECT id FROM message_threads WHERE phone_number = ? LIMIT 1',
        [phoneNumber]
      );
      
      return result.length > 0 ? result[0].id : null;
    } catch (error) {
      log.error('Error finding thread by phone number:', error);
      return null;
    }
  }

  private async createThreadForPhoneNumber(phoneNumber: string): Promise<string> {
    const threadId = `thread-${phoneNumber.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}`;
    
    await this.databaseManager.run(`
      INSERT INTO message_threads (
        id, phone_number, last_message_timestamp, 
        unread_count, is_group, archived, pinned, muted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      threadId,
      phoneNumber,
      new Date().toISOString(),
      0, // unread_count
      0, // is_group
      0, // archived
      0, // pinned  
      0  // muted
    ]);
    
    log.info(`✅ Created new thread ${threadId} for phone number ${phoneNumber}`);
    return threadId;
  }

  /**
   * Create initial test data for Phone Link messaging
   */
  async syncMessagesFromDevice(deviceId: string, backupPath?: string): Promise<MessageSyncResult> {
    log.info(`📱 Creating initial Phone Link test data for device: ${deviceId}`);
    
    const result: MessageSyncResult = {
      success: false,
      messagesImported: 0,
      threadsCreated: 0,
      attachmentsProcessed: 0,
      errors: []
    };

    try {
      // Create a welcome message for Chris's phone number
      const chrisWelcomeMessage = {
        id: 'msg-welcome-chris',
        threadId: 'thread-chris-phone',
        contactId: 'contact-chris-real',
        phoneNumber: '+19415180701', // Chris's actual number
        content: 'Welcome to UnisonX with Phone Link! Send and receive messages directly through your PC! 📱✨',
        messageType: 'sms' as const,
        direction: 'incoming' as const,
        timestamp: new Date()
      };
      
      // Create simple test conversation
      const testMessages = this.generateMockMessages();
      const allMessages = [chrisWelcomeMessage, ...testMessages];
      
      // Import all messages
      for (const parsedMessage of allMessages) {
        try {
          await this.importMessage(parsedMessage);
          result.messagesImported++;
        } catch (error) {
          log.error(`Failed to import message ${parsedMessage.id}:`, error);
          result.errors.push(`Failed to import message: ${error}`);
        }
      }

      // Update thread metadata
      await this.updateThreadMetadata();
      result.threadsCreated = await this.countThreads();

      result.success = true;
      log.info(`✅ Phone Link test data created: ${result.messagesImported} messages, ${result.threadsCreated} threads`);
      
    } catch (error) {
      result.errors.push(`Message sync failed: ${error}`);
      log.error('Message sync error:', error);
    }

    return result;
  }

  /**
   * Create initial Phone Link test data
   */
  async importFromBackup(deviceId?: string): Promise<MessageSyncResult> {
    const targetDeviceId = deviceId || 'phone-link-device';
    log.info(`📱 Creating Phone Link test data for device: ${targetDeviceId}`);
    
    return await this.syncMessagesFromDevice(targetDeviceId);
  }

  // Removed iTunes backup parsing - using Phone Link only

  /**
   * Import a single parsed message into the database
   */
  private async importMessage(parsedMessage: ParsedMessage): Promise<void> {
    const messageId = parsedMessage.id;
    const threadId = parsedMessage.threadId;

    // Check if message already exists
    const existingMessage = await this.databaseManager.query(
      'SELECT id FROM messages WHERE id = ?',
      [messageId]
    );

    if (existingMessage.length > 0) {
      return; // Skip duplicates
    }

    // Create or update thread first (without contact_id to avoid foreign key issues)
    await this.createOrUpdateThread(threadId, parsedMessage);

    // Insert message without contact_id to avoid foreign key constraint failures
    await this.databaseManager.run(`
      INSERT INTO messages (
        id, thread_id, phone_number, content, message_type, 
        direction, timestamp, read_status, delivered_status, failed_status,
        archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(messageId),
      String(threadId),
      String(parsedMessage.phoneNumber),
      String(parsedMessage.content),
      String(parsedMessage.messageType),
      String(parsedMessage.direction),
      parsedMessage.timestamp instanceof Date ? parsedMessage.timestamp.toISOString() : String(parsedMessage.timestamp),
      1, // read_status
      parsedMessage.direction === 'outgoing' ? 1 : 0, // delivered_status
      0, // failed_status
      0  // archived
    ]);

    // Process attachments if any
    if (parsedMessage.attachments && parsedMessage.attachments.length > 0) {
      await this.processMessageAttachments(messageId, parsedMessage.attachments);
    }
  }

  /**
   * Create or update message thread
   */
  private async createOrUpdateThread(threadId: string, parsedMessage: ParsedMessage): Promise<void> {
    const existingThread = await this.databaseManager.query(
      'SELECT id FROM message_threads WHERE id = ?',
      [threadId]
    );

    if (existingThread.length === 0) {
      // Create new thread without contact_id to avoid foreign key issues
      await this.databaseManager.run(`
        INSERT INTO message_threads (
          id, phone_number, last_message_timestamp, 
          unread_count, is_group, group_name, group_participants,
          archived, pinned, muted
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        String(threadId),
        String(parsedMessage.phoneNumber),
        parsedMessage.timestamp instanceof Date ? parsedMessage.timestamp.toISOString() : String(parsedMessage.timestamp),
        0, // Will be calculated later
        parsedMessage.isGroup ? 1 : 0, // SQLite boolean as integer
        parsedMessage.groupInfo?.name ? String(parsedMessage.groupInfo.name) : null,
        JSON.stringify(parsedMessage.groupInfo?.participants || []),
        0, // archived
        0, // pinned  
        0  // muted
      ]);
    }
  }

  /**
   * Process message attachments
   */
  private async processMessageAttachments(messageId: string, attachments: any[]): Promise<void> {
    for (const attachment of attachments) {
      const attachmentId = `attachment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.databaseManager.run(`
        INSERT INTO message_attachments (
          id, message_id, file_path, file_name, file_type, 
          file_size, mime_type, download_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        attachmentId,
        messageId,
        attachment.path,
        attachment.filename,
        attachment.type,
        attachment.size || null,
        this.getMimeType(attachment.filename),
        'completed'
      ]);
    }
  }

  /**
   * Update thread metadata (unread counts, last message, etc.)
   */
  private async updateThreadMetadata(): Promise<void> {
    // Update last message and timestamp for each thread
    await this.databaseManager.run(`
      UPDATE message_threads 
      SET 
        last_message_id = (
          SELECT id FROM messages 
          WHERE thread_id = message_threads.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ),
        last_message_timestamp = (
          SELECT timestamp FROM messages 
          WHERE thread_id = message_threads.id 
          ORDER BY timestamp DESC 
          LIMIT 1
        ),
        unread_count = (
          SELECT COUNT(*) FROM messages 
          WHERE thread_id = message_threads.id 
          AND read_status = FALSE
        )
    `);
  }

  /**
   * Get all message threads
   */
  async getMessageThreads(limit: number = 50, offset: number = 0): Promise<any[]> {
    return await this.databaseManager.query(`
      SELECT 
        mt.*,
        c.display_name as contact_name,
        c.avatar_url as contact_avatar,
        m.content as last_message_content,
        m.message_type as last_message_type
      FROM message_threads mt
      LEFT JOIN contacts c ON mt.contact_id = c.id
      LEFT JOIN messages m ON mt.last_message_id = m.id
      WHERE mt.archived = FALSE
      ORDER BY mt.last_message_timestamp DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
  }

  /**
   * Get messages for a specific thread
   */
  async getThreadMessages(threadId: string, limit: number = 100, offset: number = 0): Promise<any[]> {
    return await this.databaseManager.query(`
      SELECT 
        m.*,
        c.display_name as contact_name,
        c.avatar_url as contact_avatar
      FROM messages m
      LEFT JOIN contacts c ON m.contact_id = c.id
      WHERE m.thread_id = ?
      ORDER BY m.timestamp ASC
      LIMIT ? OFFSET ?
    `, [threadId, limit, offset]);
  }

  /**
   * Mark messages as read
   */
  async markMessagesAsRead(threadId: string): Promise<void> {
    await this.databaseManager.run(`
      UPDATE messages 
      SET read_status = TRUE 
      WHERE thread_id = ? AND read_status = FALSE
    `, [threadId]);

    // Update thread unread count
    await this.databaseManager.run(`
      UPDATE message_threads 
      SET unread_count = 0 
      WHERE id = ?
    `, [threadId]);
  }

  /**
   * Send a new message via Phone Link bridge
   */
  async sendMessage(threadId: string, content: string, messageType: 'sms' | 'imessage' = 'sms'): Promise<string> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Get thread info to find phone number
    const thread = await this.databaseManager.query(
      'SELECT phone_number FROM message_threads WHERE id = ?',
      [threadId]
    );
    
    if (!thread.length) {
      throw new Error('Thread not found');
    }
    
    const phoneNumber = thread[0].phone_number;
    
    // Try to send via Phone Link first
    let deliveryStatus = 0; // Assume failed initially
    
    if (this.phoneLinkBridge && messageType === 'sms') {
      try {
        log.info(`🚀 Attempting to send message via Phone Link to ${phoneNumber}`);
        const success = await this.phoneLinkBridge.sendMessage(phoneNumber, content);
        
        if (success) {
          deliveryStatus = 1; // Mark as delivered
          log.info('✅ Message sent successfully via Phone Link');
        } else {
          log.warn('⚠️  Phone Link send failed, message saved locally only');
        }
      } catch (error) {
        log.error('❌ Phone Link send error:', error);
      }
    } else {
      log.info('📝 Phone Link not available, saving message locally only');
    }
    
    // Save to database regardless of send success
    await this.databaseManager.run(`
      INSERT INTO messages (
        id, thread_id, phone_number, content, message_type, direction, 
        timestamp, read_status, delivered_status, failed_status,
        attachments, group_info, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      String(messageId),
      String(threadId),
      String(phoneNumber),
      String(content),
      String(messageType),
      'outgoing',
      new Date().toISOString(),
      1, // read_status (our own message is read)
      deliveryStatus, // delivered_status (1 if sent via Phone Link, 0 if failed)
      deliveryStatus === 0 ? 1 : 0, // failed_status (opposite of delivered)
      JSON.stringify([]),
      JSON.stringify(null),
      0 // archived
    ]);

    // Update thread timestamp and last message
    await this.databaseManager.run(`
      UPDATE message_threads 
      SET last_message_id = ?, last_message_timestamp = ?, last_message_content = ?
      WHERE id = ?
    `, [messageId, new Date().toISOString(), content, threadId]);

    if (deliveryStatus === 1) {
      log.info(`✅ MESSAGE SENT SUCCESSFULLY: To: ${phoneNumber}, Content: "${content}", Via: Phone Link`);
    } else {
      log.warn(`⚠️  MESSAGE SAVED LOCALLY: To: ${phoneNumber}, Content: "${content}", Status: Not sent`);
    }
    
    return messageId;
  }

  /**
   * Search messages
   */
  async searchMessages(query: string, limit: number = 50): Promise<any[]> {
    return await this.databaseManager.query(`
      SELECT 
        m.*,
        mt.contact_id,
        c.display_name as contact_name
      FROM messages m
      JOIN message_threads mt ON m.thread_id = mt.id
      LEFT JOIN contacts c ON mt.contact_id = c.id
      WHERE m.content LIKE ?
      ORDER BY m.timestamp DESC
      LIMIT ?
    `, [`%${query}%`, limit]);
  }

  /**
   * Get message statistics
   */
  async getMessageStats(): Promise<any> {
    const stats = await this.databaseManager.query(`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN direction = 'incoming' THEN 1 END) as incoming_messages,
        COUNT(CASE WHEN direction = 'outgoing' THEN 1 END) as outgoing_messages,
        COUNT(CASE WHEN message_type = 'imessage' THEN 1 END) as imessages,
        COUNT(CASE WHEN message_type = 'sms' THEN 1 END) as sms_messages,
        COUNT(DISTINCT thread_id) as total_threads
      FROM messages
    `);

    return stats[0] || {};
  }

  /**
   * Generate mock messages for testing
   */
  private generateMockMessages(): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    const now = new Date();

    // Create a simple test conversation with Chris
    const threadId = 'thread-chris-test';
    const contactId = 'contact-chris';
    const phoneNumber = '+19415180701';
    
    // Create exactly 5 simple messages
    const testMessages = [
      { content: 'Hey! Testing UnisonX app', isIncoming: true },
      { content: 'This is a test message from my iPhone', isIncoming: true },
      { content: 'Great! I can see your message', isIncoming: false },
      { content: 'Perfect! The app is working', isIncoming: false },
      { content: 'Ready to send more texts!', isIncoming: true }
    ];

    testMessages.forEach((msg, i) => {
      const messageId = `msg-test-${i + 1}`;
      const timestamp = new Date(now.getTime() - (testMessages.length - i) * 300000); // 5 minutes apart
      
      messages.push({
        id: messageId,
        threadId,
        contactId,
        phoneNumber,
        content: msg.content,
        messageType: 'imessage',
        direction: msg.isIncoming ? 'incoming' : 'outgoing',
        timestamp
        // Removed attachments to simplify
      });
    });

    return messages;
  }

  private generateMockMessageContent(index: number, isIncoming: boolean): string {
    const incomingMessages = [
      "Hey! How are you doing?",
      "Did you see the game last night?",
      "Want to grab lunch tomorrow?",
      "Thanks for your help earlier!",
      "Can you call me when you get this?",
      "Hope you're having a great day!",
      "Looking forward to seeing you soon",
      "That's awesome news!",
      "Let me know what you think",
      "See you there!"
    ];

    const outgoingMessages = [
      "Hey there! I'm doing well, thanks for asking!",
      "Yes! What an incredible game!",
      "Absolutely! How about 12:30?",
      "No problem, happy to help!",
      "Sure thing, calling you now",
      "Thanks! You too!",
      "Me too, it's been too long",
      "I know right? So exciting!",
      "Looks great to me!",
      "Perfect, see you then!"
    ];

    const messages = isIncoming ? incomingMessages : outgoingMessages;
    return messages[index % messages.length];
  }

  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.mov': 'video/quicktime',
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  private async countThreads(): Promise<number> {
    const result = await this.databaseManager.query('SELECT COUNT(*) as count FROM message_threads');
    return result[0]?.count || 0;
  }

  /**
   * Export messages to various formats
   */
  async exportMessages(threadId?: string, format: 'json' | 'csv' | 'txt' = 'json'): Promise<any> {
    try {
      let query = `
        SELECT 
          m.*,
          c.display_name as contact_name,
          mt.group_name,
          mt.is_group
        FROM messages m
        LEFT JOIN message_threads mt ON m.thread_id = mt.id
        LEFT JOIN contacts c ON mt.contact_id = c.id
      `;
      
      const params: any[] = [];
      if (threadId) {
        query += ' WHERE m.thread_id = ?';
        params.push(threadId);
      }
      
      query += ' ORDER BY m.timestamp ASC';
      
      const messages = await this.databaseManager.query(query, params);
      
      const { filePath } = await dialog.showSaveDialog({
        title: `Export Messages as ${format.toUpperCase()}`,
        defaultPath: path.join(
          app.getPath('downloads'), 
          `messages_${threadId || 'all'}_${new Date().toISOString().split('T')[0]}.${format}`
        ),
        filters: [
          { name: `${format.toUpperCase()} Files`, extensions: [format] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (!filePath) {
        return { success: false, error: 'Export cancelled' };
      }

      let content = '';
      
      switch (format) {
        case 'json':
          content = JSON.stringify(messages, null, 2);
          break;
          
        case 'csv':
          const headers = ['Timestamp', 'Contact', 'Direction', 'Type', 'Content'];
          const csvRows = [headers.join(',')];
          
          messages.forEach((msg: any) => {
            const row = [
              msg.timestamp,
              msg.contact_name || msg.phone_number || 'Unknown',
              msg.direction,
              msg.message_type,
              `"${(msg.content || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
          });
          
          content = csvRows.join('\n');
          break;
          
        case 'txt':
          messages.forEach((msg: any) => {
            const timestamp = new Date(msg.timestamp).toLocaleString();
            const sender = msg.direction === 'outgoing' ? 'You' : (msg.contact_name || msg.phone_number || 'Unknown');
            content += `[${timestamp}] ${sender}: ${msg.content}\n`;
          });
          break;
      }

      await fs.promises.writeFile(filePath, content, 'utf8');
      
      log.info(`Exported ${messages.length} messages to ${filePath}`);
      return {
        success: true,
        exported: messages.length,
        filePath
      };
      
    } catch (error) {
      log.error('Message export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Archive/unarchive thread
   */
  async archiveThread(threadId: string, archived: boolean = true): Promise<void> {
    await this.databaseManager.run(`
      UPDATE message_threads 
      SET archived = ? 
      WHERE id = ?
    `, [archived ? 1 : 0, threadId]); // Convert boolean to integer

    await this.databaseManager.run(`
      UPDATE messages 
      SET archived = ? 
      WHERE thread_id = ?
    `, [archived ? 1 : 0, threadId]); // Convert boolean to integer

    log.info(`Thread ${threadId} ${archived ? 'archived' : 'unarchived'}`);
  }

  /**
   * Get message statistics with analytics
   */
  async getDetailedStats(): Promise<any> {
    const basicStats = await this.getMessageStats();
    
    // Get daily message counts for the last 30 days
    const dailyStats = await this.databaseManager.query(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as count,
        COUNT(CASE WHEN direction = 'incoming' THEN 1 END) as incoming,
        COUNT(CASE WHEN direction = 'outgoing' THEN 1 END) as outgoing
      FROM messages 
      WHERE timestamp >= datetime('now', '-30 days')
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
    `);

    // Get top contacts by message count
    const topContacts = await this.databaseManager.query(`
      SELECT 
        c.display_name as contact_name,
        mt.phone_number,
        COUNT(m.id) as message_count,
        MAX(m.timestamp) as last_message
      FROM message_threads mt
      LEFT JOIN contacts c ON mt.contact_id = c.id
      LEFT JOIN messages m ON mt.id = m.thread_id
      WHERE mt.is_group = FALSE
      GROUP BY mt.id
      ORDER BY message_count DESC
      LIMIT 10
    `);

    // Get message type distribution
    const typeStats = await this.databaseManager.query(`
      SELECT 
        message_type,
        COUNT(*) as count,
        COUNT(*) * 100.0 / (SELECT COUNT(*) FROM messages) as percentage
      FROM messages
      GROUP BY message_type
    `);

    return {
      ...basicStats,
      dailyStats,
      topContacts,
      typeStats,
      generatedAt: new Date().toISOString()
    };
  }

  cleanup(): void {
    log.info('MessageSyncService cleanup completed');
  }
}