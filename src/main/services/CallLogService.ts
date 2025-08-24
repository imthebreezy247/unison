import log from 'electron-log';
import * as path from 'path';
import * as fs from 'fs';
import { app, dialog } from 'electron';
import { DatabaseManager, CallLog, CallRecording, CallParticipant } from '../database/DatabaseManager';

export interface CallSyncResult {
  success: boolean;
  callsImported: number;
  recordingsProcessed: number;
  errors: string[];
}

export interface CallStatistics {
  totalCalls: number;
  incomingCalls: number;
  outgoingCalls: number;
  missedCalls: number;
  averageCallDuration: number;
  totalTalkTime: number;
  voicemails: number;
  videoCalls: number;
  mostActiveContact: string;
  busiestDay: string;
  callsByHour: any[];
  callsByDay: any[];
  callsByContact: any[];
}

export interface ActiveCall {
  id: string;
  phone_number: string;
  contact_name?: string;
  direction: 'incoming' | 'outgoing';
  call_type: 'voice' | 'video' | 'facetime';
  start_time: string;
  status: 'ringing' | 'connecting' | 'connected' | 'on_hold';
}

export class CallLogService {
  private databaseManager: DatabaseManager;
  private activeCalls: Map<string, ActiveCall> = new Map();

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  async initialize(): Promise<void> {
    log.info('CallLogService initialized');
  }

  /**
   * Sync call logs from iPhone
   */
  async syncCallLogsFromDevice(deviceId: string, backupPath?: string): Promise<CallSyncResult> {
    log.info(`Starting call log sync for device: ${deviceId}`);
    
    const result: CallSyncResult = {
      success: false,
      callsImported: 0,
      recordingsProcessed: 0,
      errors: []
    };

    try {
      // In a real implementation, this would:
      // 1. Parse the iTunes backup CallHistory.storedata
      // 2. Extract call data from plist/sqlite databases
      // 3. Process voicemail files from MediaDomain
      // 4. Handle call recordings if available
      
      // For now, generate mock call data
      const mockCalls = this.generateMockCallLogs();
      
      for (const call of mockCalls) {
        try {
          await this.importCallLog(call);
          result.callsImported++;
        } catch (error) {
          result.errors.push(`Failed to import call ${call.id}: ${error}`);
        }
      }

      result.success = true;
      log.info(`Call log sync completed: ${result.callsImported} calls imported`);
      
    } catch (error) {
      result.errors.push(`Call log sync failed: ${error}`);
      log.error('Call log sync error:', error);
    }

    return result;
  }

  /**
   * Import a single call log entry
   */
  private async importCallLog(callLog: Partial<CallLog>): Promise<void> {
    // Check if call already exists
    const existingCall = await this.databaseManager.query(
      'SELECT id FROM call_logs WHERE id = ?',
      [callLog.id]
    );

    if (existingCall.length > 0) {
      return; // Skip duplicates
    }

    // Get contact info if available
    let contactId = null;
    let contactName = null;
    
    if (callLog.phone_number) {
      const contact = await this.databaseManager.query(`
        SELECT id, display_name FROM contacts 
        WHERE phone_numbers LIKE ?
      `, [`%${callLog.phone_number}%`]);
      
      if (contact.length > 0) {
        contactId = contact[0].id;
        contactName = contact[0].display_name;
      }
    }

    // Insert call log
    await this.databaseManager.run(`
      INSERT INTO call_logs (
        id, contact_id, phone_number, contact_name, direction, call_type,
        duration, start_time, end_time, call_status, call_quality, 
        device_used, emergency_call, spam_likely
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      callLog.id,
      contactId,
      callLog.phone_number,
      contactName,
      callLog.direction,
      callLog.call_type || 'voice',
      callLog.duration || 0,
      callLog.start_time,
      callLog.end_time,
      callLog.call_status || 'completed',
      callLog.call_quality || 'good',
      callLog.device_used || 'iPhone',
      callLog.emergency_call || false,
      callLog.spam_likely || false
    ]);

    log.info(`Call log imported: ${callLog.id} - ${callLog.direction} ${callLog.call_type}`);
  }

  /**
   * Get call logs with pagination and filtering
   */
  async getCallLogs(
    limit: number = 50, 
    offset: number = 0,
    filters?: {
      direction?: string;
      call_type?: string;
      contact_id?: string;
      date_from?: string;
      date_to?: string;
    }
  ): Promise<CallLog[]> {
    let query = `
      SELECT 
        cl.*,
        c.display_name as contact_display_name,
        c.avatar_url as contact_avatar
      FROM call_logs cl
      LEFT JOIN contacts c ON cl.contact_id = c.id
      WHERE cl.archived = FALSE
    `;
    
    const params: any[] = [];
    
    if (filters) {
      if (filters.direction) {
        query += ' AND cl.direction = ?';
        params.push(filters.direction);
      }
      if (filters.call_type) {
        query += ' AND cl.call_type = ?';
        params.push(filters.call_type);
      }
      if (filters.contact_id) {
        query += ' AND cl.contact_id = ?';
        params.push(filters.contact_id);
      }
      if (filters.date_from) {
        query += ' AND cl.start_time >= ?';
        params.push(filters.date_from);
      }
      if (filters.date_to) {
        query += ' AND cl.start_time <= ?';
        params.push(filters.date_to);
      }
    }
    
    query += ' ORDER BY cl.start_time DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    return await this.databaseManager.query(query, params);
  }

  /**
   * Initiate an outgoing call
   */
  async initiateCall(phoneNumber: string, callType: 'voice' | 'video' | 'facetime' = 'voice'): Promise<string> {
    const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = new Date().toISOString();
    
    // Get contact info if available
    let contactId = null;
    let contactName = null;
    
    const contact = await this.databaseManager.query(`
      SELECT id, display_name FROM contacts 
      WHERE phone_numbers LIKE ?
    `, [`%${phoneNumber}%`]);
    
    if (contact.length > 0) {
      contactId = contact[0].id;
      contactName = contact[0].display_name;
    }

    // Add to active calls
    const activeCall: ActiveCall = {
      id: callId,
      phone_number: phoneNumber,
      contact_name: contactName,
      direction: 'outgoing',
      call_type: callType,
      start_time: startTime,
      status: 'ringing'
    };
    
    this.activeCalls.set(callId, activeCall);
    
    // Create initial call log entry
    await this.databaseManager.run(`
      INSERT INTO call_logs (
        id, contact_id, phone_number, contact_name, direction, call_type,
        duration, start_time, call_status, device_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      callId,
      contactId,
      phoneNumber,
      contactName,
      'outgoing',
      callType,
      0,
      startTime,
      'initiating',
      'iPhone'
    ]);

    // Actually initiate call via Phone Link automation
    log.info(`Call initiated: ${callId} to ${phoneNumber} (${callType})`);
    
    // Import the WindowsUIAutomation class
    const { WindowsUIAutomation } = await import('./WindowsUIAutomation');
    const uiAutomation = new WindowsUIAutomation();
    
    // Attempt to make the call through Phone Link
    try {
      const callSuccess = await uiAutomation.makeCallThroughPhoneLink(phoneNumber);
      if (callSuccess) {
        log.info(`✅ Phone Link call automation successful for ${phoneNumber}`);
        // Update to ringing status
        setTimeout(() => {
          this.updateCallStatus(callId, 'ringing');
        }, 1000);
      } else {
        log.error(`❌ Phone Link call automation failed for ${phoneNumber}`);
        // Update to failed status
        setTimeout(async () => {
          await this.updateCallStatusToDatabaseOnly(callId, 'failed');
        }, 1000);
      }
    } catch (error) {
      log.error(`❌ Phone Link call automation error for ${phoneNumber}:`, error);
      // Update to failed status
      setTimeout(async () => {
        await this.updateCallStatusToDatabaseOnly(callId, 'failed');
      }, 1000);
    }
    
    return callId;
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    const activeCall = this.activeCalls.get(callId);
    if (!activeCall) {
      throw new Error(`Call ${callId} not found in active calls`);
    }

    const endTime = new Date().toISOString();
    const duration = Math.floor((new Date(endTime).getTime() - new Date(activeCall.start_time).getTime()) / 1000);

    // Update call log
    await this.databaseManager.run(`
      UPDATE call_logs 
      SET end_time = ?, duration = ?, call_status = ?, updated_at = ?
      WHERE id = ?
    `, [endTime, duration, 'completed', endTime, callId]);

    // Remove from active calls
    this.activeCalls.delete(callId);
    
    log.info(`Call ended: ${callId} - Duration: ${duration}s`);
  }

  /**
   * Update call status
   */
  async updateCallStatus(callId: string, status: 'ringing' | 'connecting' | 'connected' | 'on_hold'): Promise<void> {
    const activeCall = this.activeCalls.get(callId);
    if (activeCall) {
      activeCall.status = status;
      this.activeCalls.set(callId, activeCall);
    }

    // Update database
    await this.databaseManager.run(`
      UPDATE call_logs 
      SET call_status = ?, updated_at = ?
      WHERE id = ?
    `, [status === 'connected' ? 'completed' : 'ringing', new Date().toISOString(), callId]);
    
    log.info(`Call status updated: ${callId} -> ${status}`);
  }

  /**
   * Update call status directly in database (for failed calls)
   */
  private async updateCallStatusToDatabaseOnly(callId: string, status: 'failed' | 'busy' | 'declined' | 'no_answer'): Promise<void> {
    // Remove from active calls since it failed
    this.activeCalls.delete(callId);

    // Update database
    await this.databaseManager.run(`
      UPDATE call_logs 
      SET call_status = ?, updated_at = ?
      WHERE id = ?
    `, [status, new Date().toISOString(), callId]);
    
    log.info(`Call status updated to database: ${callId} -> ${status}`);
  }

  /**
   * Get active calls
   */
  getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  /**
   * Add notes to a call
   */
  async addCallNotes(callId: string, notes: string): Promise<void> {
    await this.databaseManager.run(`
      UPDATE call_logs 
      SET call_notes = ?, updated_at = ?
      WHERE id = ?
    `, [notes, new Date().toISOString(), callId]);
    
    log.info(`Call notes added: ${callId}`);
  }

  /**
   * Get call statistics
   */
  async getCallStatistics(): Promise<CallStatistics> {
    const basicStats = await this.databaseManager.query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN direction = 'incoming' THEN 1 END) as incoming_calls,
        COUNT(CASE WHEN direction = 'outgoing' THEN 1 END) as outgoing_calls,
        COUNT(CASE WHEN direction = 'missed' THEN 1 END) as missed_calls,
        COUNT(CASE WHEN direction = 'voicemail' THEN 1 END) as voicemails,
        COUNT(CASE WHEN call_type = 'video' OR call_type = 'facetime' THEN 1 END) as video_calls,
        AVG(duration) as avg_duration,
        SUM(duration) as total_talk_time
      FROM call_logs
      WHERE archived = FALSE
    `);

    // Get calls by hour
    const callsByHour = await this.databaseManager.query(`
      SELECT 
        strftime('%H', start_time) as hour,
        COUNT(*) as count
      FROM call_logs
      WHERE archived = FALSE
      GROUP BY hour
      ORDER BY hour
    `);

    // Get top contacts by call count
    const callsByContact = await this.databaseManager.query(`
      SELECT 
        contact_name,
        phone_number,
        COUNT(*) as call_count,
        SUM(duration) as total_duration
      FROM call_logs
      WHERE archived = FALSE AND contact_name IS NOT NULL
      GROUP BY contact_id
      ORDER BY call_count DESC
      LIMIT 10
    `);

    // Get calls by day of week
    const callsByDay = await this.databaseManager.query(`
      SELECT 
        strftime('%w', start_time) as day_of_week,
        COUNT(*) as count
      FROM call_logs
      WHERE archived = FALSE
      GROUP BY day_of_week
      ORDER BY day_of_week
    `);

    const stats = basicStats[0] || {};
    
    return {
      totalCalls: stats.total_calls || 0,
      incomingCalls: stats.incoming_calls || 0,
      outgoingCalls: stats.outgoing_calls || 0,
      missedCalls: stats.missed_calls || 0,
      averageCallDuration: Math.round(stats.avg_duration || 0),
      totalTalkTime: stats.total_talk_time || 0,
      voicemails: stats.voicemails || 0,
      videoCalls: stats.video_calls || 0,
      mostActiveContact: callsByContact[0]?.contact_name || 'N/A',
      busiestDay: this.getDayName(callsByDay.reduce((max, day) => day.count > max.count ? day : max, { count: 0 }).day_of_week),
      callsByHour,
      callsByDay,
      callsByContact
    };
  }

  /**
   * Export call logs
   */
  async exportCallLogs(format: 'json' | 'csv' | 'txt' = 'csv'): Promise<any> {
    try {
      const callLogs = await this.databaseManager.query(`
        SELECT 
          cl.*,
          c.display_name as contact_display_name
        FROM call_logs cl
        LEFT JOIN contacts c ON cl.contact_id = c.id
        WHERE cl.archived = FALSE
        ORDER BY cl.start_time DESC
      `);

      const { filePath } = await dialog.showSaveDialog({
        title: `Export Call Logs as ${format.toUpperCase()}`,
        defaultPath: path.join(
          app.getPath('downloads'), 
          `call_logs_${new Date().toISOString().split('T')[0]}.${format}`
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
          content = JSON.stringify(callLogs, null, 2);
          break;
          
        case 'csv':
          const headers = ['Date', 'Time', 'Contact', 'Phone Number', 'Direction', 'Type', 'Duration', 'Status'];
          const csvRows = [headers.join(',')];
          
          callLogs.forEach((call: any) => {
            const startTime = new Date(call.start_time);
            const row = [
              startTime.toLocaleDateString(),
              startTime.toLocaleTimeString(),
              call.contact_display_name || 'Unknown',
              call.phone_number,
              call.direction,
              call.call_type,
              this.formatDuration(call.duration),
              call.call_status
            ];
            csvRows.push(row.join(','));
          });
          
          content = csvRows.join('\n');
          break;
          
        case 'txt':
          callLogs.forEach((call: any) => {
            const startTime = new Date(call.start_time);
            const contact = call.contact_display_name || call.phone_number;
            const duration = this.formatDuration(call.duration);
            content += `${startTime.toLocaleString()} - ${call.direction.toUpperCase()} ${call.call_type} call ${call.direction === 'outgoing' ? 'to' : 'from'} ${contact} (${duration})\n`;
          });
          break;
      }

      await fs.promises.writeFile(filePath, content, 'utf8');
      
      log.info(`Exported ${callLogs.length} call logs to ${filePath}`);
      return {
        success: true,
        exported: callLogs.length,
        filePath
      };
      
    } catch (error) {
      log.error('Call log export error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate mock call logs for testing
   */
  private generateMockCallLogs(): Partial<CallLog>[] {
    const calls: Partial<CallLog>[] = [];
    const now = new Date();
    
    // Get some existing contacts for realistic call logs
    const mockContacts = [
      { id: 'contact-1', phone: '+1234567890', name: 'John Doe' },
      { id: 'contact-2', phone: '+1234567891', name: 'Jane Smith' },
      { id: 'contact-3', phone: '+1234567892', name: 'Mike Johnson' },
      { id: null, phone: '+1555123456', name: null }, // Unknown number
    ];

    // Generate 50 call logs over the last 30 days
    for (let i = 0; i < 50; i++) {
      const contact = mockContacts[Math.floor(Math.random() * mockContacts.length)];
      const daysAgo = Math.floor(Math.random() * 30);
      const startTime = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      // Random call duration (0 for missed calls)
      const isMissed = Math.random() < 0.15; // 15% missed calls
      const duration = isMissed ? 0 : Math.floor(Math.random() * 1800) + 30; // 30s to 30min
      
      const direction = Math.random() > 0.4 ? 'outgoing' : (isMissed ? 'missed' : 'incoming');
      const callType = Math.random() > 0.8 ? 'video' : 'voice';
      
      const endTime = duration > 0 ? new Date(startTime.getTime() + duration * 1000) : undefined;

      calls.push({
        id: `call-${i}-${Date.now()}`,
        phone_number: contact.phone,
        direction: direction as any,
        call_type: callType as any,
        duration,
        start_time: startTime.toISOString(),
        end_time: endTime?.toISOString(),
        call_status: isMissed ? 'no_answer' : 'completed',
        call_quality: ['excellent', 'good', 'fair'][Math.floor(Math.random() * 3)] as any,
        device_used: 'iPhone',
        emergency_call: false,
        spam_likely: Math.random() < 0.05 // 5% spam
      });
    }

    return calls;
  }

  private formatDuration(seconds: number): string {
    if (seconds === 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  private getDayName(dayNumber: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dayNumber] || 'Unknown';
  }

  cleanup(): void {
    this.activeCalls.clear();
    log.info('CallLogService cleanup completed');
  }
}