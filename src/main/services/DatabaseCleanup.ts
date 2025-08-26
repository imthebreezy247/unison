import log from 'electron-log';
import { DatabaseManager } from '../database/DatabaseManager';

export class DatabaseCleanup {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  /**
   * Clean up duplicate phone numbers and consolidate them into single conversations
   */
  async cleanupDuplicatePhoneNumbers(): Promise<void> {
    log.info('🧹 Starting database cleanup for duplicate phone numbers...');

    try {
      // Step 1: Find and consolidate message threads with same normalized phone number
      await this.consolidateMessageThreads();
      
      // Step 2: Find and consolidate call logs with same normalized phone number  
      await this.consolidateCallLogs();

      // Step 3: Clean up orphaned messages
      await this.cleanupOrphanedMessages();

      log.info('✅ Database cleanup completed successfully');
    } catch (error) {
      log.error('❌ Database cleanup failed:', error);
      throw error;
    }
  }

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/\D/g, '');
    
    // If it's a US number starting with 1, remove the 1
    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return digitsOnly.slice(1);
    }
    
    return digitsOnly;
  }

  private async consolidateMessageThreads(): Promise<void> {
    log.info('Consolidating message threads...');

    // Get all message threads
    const threads = await this.databaseManager.query('SELECT * FROM message_threads ORDER BY last_message_timestamp DESC');
    
    // Group by normalized phone number
    const phoneGroups: { [key: string]: any[] } = {};
    
    for (const thread of threads) {
      const normalizedNumber = this.normalizePhoneNumber(thread.phone_number);
      if (!phoneGroups[normalizedNumber]) {
        phoneGroups[normalizedNumber] = [];
      }
      phoneGroups[normalizedNumber].push(thread);
    }

    // Process groups with duplicates
    for (const [normalizedNumber, duplicateThreads] of Object.entries(phoneGroups)) {
      if (duplicateThreads.length > 1) {
        log.info(`Found ${duplicateThreads.length} duplicate threads for number: ${normalizedNumber}`);
        
        // Keep the thread with the most recent activity
        const keepThread = duplicateThreads[0];
        const removeThreads = duplicateThreads.slice(1);

        // Move all messages from duplicate threads to the main thread
        for (const removeThread of removeThreads) {
          await this.databaseManager.run(
            'UPDATE messages SET thread_id = ? WHERE thread_id = ?',
            [keepThread.id, removeThread.id]
          );

          // Delete the duplicate thread
          await this.databaseManager.run(
            'DELETE FROM message_threads WHERE id = ?',
            [removeThread.id]
          );

          log.info(`Consolidated thread ${removeThread.id} into ${keepThread.id}`);
        }

        // Update the main thread's phone number to use normalized format
        await this.databaseManager.run(
          'UPDATE message_threads SET phone_number = ? WHERE id = ?',
          [normalizedNumber, keepThread.id]
        );

        // Recalculate thread stats
        const messageCount = await this.databaseManager.query(
          'SELECT COUNT(*) as count FROM messages WHERE thread_id = ?',
          [keepThread.id]
        );

        const unreadCount = await this.databaseManager.query(
          'SELECT COUNT(*) as count FROM messages WHERE thread_id = ? AND read_status = 0',
          [keepThread.id]
        );

        const lastMessage = await this.databaseManager.query(
          'SELECT * FROM messages WHERE thread_id = ? ORDER BY timestamp DESC LIMIT 1',
          [keepThread.id]
        );

        if (lastMessage.length > 0) {
          await this.databaseManager.run(`
            UPDATE message_threads 
            SET last_message_id = ?, last_message_timestamp = ?, 
                last_message_content = ?, unread_count = ?
            WHERE id = ?
          `, [
            lastMessage[0].id,
            lastMessage[0].timestamp,
            lastMessage[0].content,
            unreadCount[0].count,
            keepThread.id
          ]);
        }
      }
    }
  }

  private async consolidateCallLogs(): Promise<void> {
    log.info('Consolidating call logs...');

    // Get all call logs
    const callLogs = await this.databaseManager.query('SELECT * FROM call_logs ORDER BY timestamp DESC');
    
    // Group by normalized phone number
    const phoneGroups: { [key: string]: any[] } = {};
    
    for (const callLog of callLogs) {
      const normalizedNumber = this.normalizePhoneNumber(callLog.phone_number);
      if (!phoneGroups[normalizedNumber]) {
        phoneGroups[normalizedNumber] = [];
      }
      phoneGroups[normalizedNumber].push(callLog);
    }

    // Update all call logs to use normalized phone numbers
    for (const [normalizedNumber, callLogsForNumber] of Object.entries(phoneGroups)) {
      for (const callLog of callLogsForNumber) {
        if (callLog.phone_number !== normalizedNumber) {
          await this.databaseManager.run(
            'UPDATE call_logs SET phone_number = ? WHERE id = ?',
            [normalizedNumber, callLog.id]
          );
        }
      }
      
      if (callLogsForNumber.length > 1) {
        log.info(`Normalized ${callLogsForNumber.length} call logs for number: ${normalizedNumber}`);
      }
    }
  }

  private async cleanupOrphanedMessages(): Promise<void> {
    log.info('Cleaning up orphaned messages...');

    // Find messages without corresponding threads
    const orphanedMessages = await this.databaseManager.query(`
      SELECT m.* FROM messages m
      LEFT JOIN message_threads mt ON m.thread_id = mt.id
      WHERE mt.id IS NULL
    `);

    if (orphanedMessages.length > 0) {
      log.info(`Found ${orphanedMessages.length} orphaned messages`);
      
      // Delete orphaned messages
      await this.databaseManager.run(`
        DELETE FROM messages WHERE id IN (
          SELECT m.id FROM messages m
          LEFT JOIN message_threads mt ON m.thread_id = mt.id
          WHERE mt.id IS NULL
        )
      `);
      
      log.info(`Deleted ${orphanedMessages.length} orphaned messages`);
    }
  }

  /**
   * Get database statistics before and after cleanup
   */
  async getDatabaseStats(): Promise<any> {
    const stats = {
      messageThreads: 0,
      messages: 0,
      callLogs: 0,
      duplicatePhoneNumbers: 0
    };

    // Count threads
    const threadCount = await this.databaseManager.query('SELECT COUNT(*) as count FROM message_threads');
    stats.messageThreads = threadCount[0].count;

    // Count messages
    const messageCount = await this.databaseManager.query('SELECT COUNT(*) as count FROM messages');
    stats.messages = messageCount[0].count;

    // Count call logs
    const callLogCount = await this.databaseManager.query('SELECT COUNT(*) as count FROM call_logs');
    stats.callLogs = callLogCount[0].count;

    // Count potential duplicates (same last 10 digits)
    const duplicates = await this.databaseManager.query(`
      SELECT COUNT(*) as count FROM (
        SELECT RIGHT(REPLACE(phone_number, '-', ''), 10) as normalized, COUNT(*) as thread_count
        FROM message_threads 
        GROUP BY normalized 
        HAVING thread_count > 1
      ) as dup_check
    `);
    stats.duplicatePhoneNumbers = duplicates[0].count;

    return stats;
  }
}