import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { app, dialog } from 'electron';
import { DatabaseManager, Message, MessageThread, MessageAttachment } from '../database/DatabaseManager';

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

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  async initialize(): Promise<void> {
    log.info('MessageSyncService initialized');
  }

  /**
   * Sync messages from iPhone backup
   */
  async syncMessagesFromDevice(deviceId: string, backupPath?: string): Promise<MessageSyncResult> {
    log.info(`Starting message sync for device: ${deviceId}`);
    
    const result: MessageSyncResult = {
      success: false,
      messagesImported: 0,
      threadsCreated: 0,
      attachmentsProcessed: 0,
      errors: []
    };

    try {
      // In a real implementation, this would:
      // 1. Parse the iTunes backup SMS.db file
      // 2. Extract message data from SQLite database
      // 3. Parse iMessage data from chat.db
      // 4. Handle attachments from MediaDomain
      
      // For now, we'll simulate with mock data
      const mockMessages = this.generateMockMessages();
      
      for (const parsedMessage of mockMessages) {
        try {
          await this.importMessage(parsedMessage);
          result.messagesImported++;
        } catch (error) {
          result.errors.push(`Failed to import message ${parsedMessage.id}: ${error}`);
        }
      }

      // Update thread metadata
      await this.updateThreadMetadata();
      result.threadsCreated = await this.countThreads();

      result.success = true;
      log.info(`Message sync completed: ${result.messagesImported} messages, ${result.threadsCreated} threads`);
      
    } catch (error) {
      result.errors.push(`Message sync failed: ${error}`);
      log.error('Message sync error:', error);
    }

    return result;
  }

  /**
   * Parse SMS database from iTunes backup
   */
  private async parseSMSDatabase(backupPath: string): Promise<ParsedMessage[]> {
    // This would parse the actual SMS.db file from iTunes backup
    // The SMS database is typically located at:
    // ~/Library/Application Support/MobileSync/Backup/[device]/3d0d7e5fb2ce288813306e4d4636395e047a3d28
    
    // For demonstration, return mock data
    return this.generateMockMessages();
  }

  /**
   * Parse iMessage database from iTunes backup
   */
  private async parseIMessageDatabase(backupPath: string): Promise<ParsedMessage[]> {
    // This would parse the actual chat.db file from iTunes backup
    // The iMessage database is typically located at:
    // ~/Library/Application Support/MobileSync/Backup/[device]/31bb7ba8914766d4ba40d6dfb6113c8b614be442
    
    return [];
  }

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

    // Create or update thread
    await this.createOrUpdateThread(threadId, parsedMessage);

    // Insert message
    await this.databaseManager.run(`
      INSERT INTO messages (
        id, thread_id, contact_id, phone_number, content, message_type, 
        direction, timestamp, read_status, delivered_status, failed_status,
        attachments, group_info, archived
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      messageId,
      threadId,
      parsedMessage.contactId || null,
      parsedMessage.phoneNumber,
      parsedMessage.content,
      parsedMessage.messageType,
      parsedMessage.direction,
      parsedMessage.timestamp instanceof Date ? parsedMessage.timestamp.toISOString() : parsedMessage.timestamp,
      true, // Mark imported messages as read
      parsedMessage.direction === 'outgoing',
      false,
      JSON.stringify(parsedMessage.attachments || []),
      JSON.stringify(parsedMessage.groupInfo || null),
      false
    ]);

    // Process attachments
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
      // Create new thread
      await this.databaseManager.run(`
        INSERT INTO message_threads (
          id, contact_id, phone_number, last_message_timestamp, 
          unread_count, is_group, group_name, group_participants
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        threadId,
        parsedMessage.contactId || null,
        parsedMessage.phoneNumber,
        parsedMessage.timestamp instanceof Date ? parsedMessage.timestamp.toISOString() : parsedMessage.timestamp,
        0, // Will be calculated later
        parsedMessage.isGroup || false,
        parsedMessage.groupInfo?.name || null,
        JSON.stringify(parsedMessage.groupInfo?.participants || [])
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
   * Send a new message (placeholder for future implementation)
   */
  async sendMessage(threadId: string, content: string, messageType: 'sms' | 'imessage' = 'sms'): Promise<string> {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    await this.databaseManager.run(`
      INSERT INTO messages (
        id, thread_id, content, message_type, direction, 
        timestamp, read_status, delivered_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      messageId,
      threadId,
      content,
      messageType,
      'outgoing',
      new Date().toISOString(),
      true,
      false // Will be updated when delivery confirmed
    ]);

    // Update thread timestamp
    await this.databaseManager.run(`
      UPDATE message_threads 
      SET last_message_id = ?, last_message_timestamp = ?
      WHERE id = ?
    `, [messageId, new Date().toISOString(), threadId]);

    // TODO: Actually send the message via iPhone APIs
    
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
    const mockContacts = [
      { id: 'contact-1', phone: '+19415180701', name: 'Chris (Test)' },
      { id: 'contact-2', phone: '+1234567891', name: 'Jane Smith' },
      { id: 'contact-3', phone: '+1234567892', name: 'Mike Johnson' }
    ];

    const messages: ParsedMessage[] = [];
    const now = new Date();

    mockContacts.forEach((contact, contactIndex) => {
      const threadId = `thread-${contact.id}`;
      
      // Generate fewer messages to reduce database load
      const messageCount = 3 + Math.floor(Math.random() * 3); // 3-5 messages per contact
      
      for (let i = 0; i < messageCount; i++) {
        const messageId = `msg-${contact.id}-${i}`;
        const timestamp = new Date(now.getTime() - (messageCount - i) * 3600000); // 1 hour apart
        const isIncoming = Math.random() > 0.5;
        
        messages.push({
          id: messageId,
          threadId,
          contactId: contact.id,
          phoneNumber: contact.phone,
          content: this.generateMockMessageContent(i, isIncoming),
          messageType: Math.random() > 0.3 ? 'imessage' : 'sms',
          direction: isIncoming ? 'incoming' : 'outgoing',
          timestamp,
          attachments: Math.random() > 0.8 ? [{
            filename: 'image.jpg',
            path: `/attachments/${messageId}/image.jpg`,
            type: 'image',
            size: 1024 * 1024
          }] : undefined
        });
      }
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
    `, [archived, threadId]);

    await this.databaseManager.run(`
      UPDATE messages 
      SET archived = ? 
      WHERE thread_id = ?
    `, [archived, threadId]);

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