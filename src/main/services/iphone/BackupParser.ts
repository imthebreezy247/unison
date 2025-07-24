import * as fs from 'fs';
import * as path from 'path';
import * as sqlite3 from 'better-sqlite3';
import * as crypto from 'crypto';
import log from 'electron-log';

export interface BackupManifest {
  version: string;
  date: Date;
  deviceName: string;
  deviceId: string;
  iosVersion: string;
  encrypted: boolean;
}

export interface ContactData {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumbers: Array<{ label: string; number: string }>;
  emails: Array<{ label: string; email: string }>;
  organization?: string;
  notes?: string;
}

export interface MessageData {
  id: string;
  guid: string;
  text: string;
  service: 'iMessage' | 'SMS';
  fromMe: boolean;
  date: Date;
  phoneNumber: string;
  contactName?: string;
  attachments: string[];
}

export interface CallLogData {
  id: string;
  phoneNumber: string;
  date: Date;
  duration: number;
  type: 'incoming' | 'outgoing' | 'missed';
  contactName?: string;
}

export class BackupParser {
  private backupPath: string;
  private manifestDb: sqlite3.Database | null = null;

  constructor(backupPath: string) {
    this.backupPath = backupPath;
  }

  async parseBackup(): Promise<BackupManifest | null> {
    try {
      // Open Manifest.db
      const manifestPath = path.join(this.backupPath, 'Manifest.db');
      if (!fs.existsSync(manifestPath)) {
        log.error('Manifest.db not found in backup');
        return null;
      }

      this.manifestDb = new sqlite3(manifestPath, { readonly: true });

      // Get backup info
      const info = this.manifestDb.prepare(
        'SELECT key, value FROM Preferences'
      ).all() as Array<{ key: string; value: any }>;

      const manifest: BackupManifest = {
        version: this.getValue(info, 'Version') || '0.0',
        date: new Date(this.getValue(info, 'Date') || Date.now()),
        deviceName: this.getValue(info, 'Device Name') || 'Unknown iPhone',
        deviceId: this.getValue(info, 'Unique Identifier') || '',
        iosVersion: this.getValue(info, 'Product Version') || 'Unknown',
        encrypted: this.getValue(info, 'IsEncrypted') === 1,
      };

      return manifest;
    } catch (error) {
      log.error('Failed to parse backup manifest:', error);
      return null;
    } finally {
      this.closeManifest();
    }
  }

  async extractContacts(): Promise<ContactData[]> {
    try {
      const contactsDbPath = await this.findFile('AddressBook.sqlitedb');
      if (!contactsDbPath) {
        log.warn('Contacts database not found in backup');
        return [];
      }

      const db = new sqlite3(contactsDbPath, { readonly: true });
      const contacts: ContactData[] = [];

      try {
        // Query contacts
        const rows = db.prepare(`
          SELECT 
            ABPerson.ROWID as id,
            ABPerson.First as firstName,
            ABPerson.Last as lastName,
            ABPerson.Organization as organization,
            ABPerson.Note as notes
          FROM ABPerson
          WHERE ABPerson.First IS NOT NULL OR ABPerson.Last IS NOT NULL
        `).all() as any[];

        for (const row of rows) {
          const contact: ContactData = {
            id: String(row.id),
            firstName: row.firstName || '',
            lastName: row.lastName || '',
            phoneNumbers: [],
            emails: [],
            organization: row.organization,
            notes: row.notes,
          };

          // Get phone numbers
          const phones = db.prepare(`
            SELECT value, label FROM ABMultiValue 
            WHERE record_id = ? AND property = 3
          `).all(row.id) as any[];

          contact.phoneNumbers = phones.map(p => ({
            label: this.getPhoneLabel(p.label),
            number: p.value,
          }));

          // Get emails
          const emails = db.prepare(`
            SELECT value, label FROM ABMultiValue 
            WHERE record_id = ? AND property = 4
          `).all(row.id) as any[];

          contact.emails = emails.map(e => ({
            label: this.getEmailLabel(e.label),
            email: e.value,
          }));

          contacts.push(contact);
        }

        log.info(`Extracted ${contacts.length} contacts from backup`);
        return contacts;
      } finally {
        db.close();
      }
    } catch (error) {
      log.error('Failed to extract contacts:', error);
      return [];
    }
  }

  async extractMessages(limit: number = 1000): Promise<MessageData[]> {
    try {
      const smsDbPath = await this.findFile('sms.db');
      if (!smsDbPath) {
        log.warn('Messages database not found in backup');
        return [];
      }

      const db = new sqlite3(smsDbPath, { readonly: true });
      const messages: MessageData[] = [];

      try {
        // Query messages
        const rows = db.prepare(`
          SELECT 
            message.ROWID as id,
            message.guid,
            message.text,
            message.service,
            message.is_from_me,
            message.date,
            handle.id as handle_id
          FROM message
          LEFT JOIN handle ON message.handle_id = handle.ROWID
          WHERE message.text IS NOT NULL
          ORDER BY message.date DESC
          LIMIT ?
        `).all(limit) as any[];

        for (const row of rows) {
          const message: MessageData = {
            id: String(row.id),
            guid: row.guid,
            text: row.text || '',
            service: row.service === 'iMessage' ? 'iMessage' : 'SMS',
            fromMe: Boolean(row.is_from_me),
            date: this.convertAppleTime(row.date),
            phoneNumber: this.extractPhoneNumber(row.handle_id),
            attachments: [],
          };

          // Get attachments
          const attachments = db.prepare(`
            SELECT 
              attachment.filename,
              attachment.mime_type
            FROM message_attachment_join
            JOIN attachment ON message_attachment_join.attachment_id = attachment.ROWID
            WHERE message_attachment_join.message_id = ?
          `).all(row.id) as any[];

          message.attachments = attachments.map(a => a.filename).filter(Boolean);
          messages.push(message);
        }

        log.info(`Extracted ${messages.length} messages from backup`);
        return messages;
      } finally {
        db.close();
      }
    } catch (error) {
      log.error('Failed to extract messages:', error);
      return [];
    }
  }

  async extractCallLogs(): Promise<CallLogData[]> {
    try {
      const callDbPath = await this.findFile('CallHistory.storedata');
      if (!callDbPath) {
        log.warn('Call history database not found in backup');
        return [];
      }

      const db = new sqlite3(callDbPath, { readonly: true });
      const calls: CallLogData[] = [];

      try {
        // Query call logs
        const rows = db.prepare(`
          SELECT 
            Z_PK as id,
            ZADDRESS as phoneNumber,
            ZDATE as date,
            ZDURATION as duration,
            ZORIGINATED as originated,
            ZANSWERED as answered
          FROM ZCALLRECORD
          ORDER BY ZDATE DESC
        `).all() as any[];

        for (const row of rows) {
          let type: 'incoming' | 'outgoing' | 'missed';
          
          if (row.originated === 1) {
            type = 'outgoing';
          } else if (row.answered === 0) {
            type = 'missed';
          } else {
            type = 'incoming';
          }

          const call: CallLogData = {
            id: String(row.id),
            phoneNumber: row.phoneNumber || 'Unknown',
            date: this.convertAppleTime(row.date),
            duration: Math.round(row.duration || 0),
            type: type,
          };

          calls.push(call);
        }

        log.info(`Extracted ${calls.length} call logs from backup`);
        return calls;
      } finally {
        db.close();
      }
    } catch (error) {
      log.error('Failed to extract call logs:', error);
      return [];
    }
  }

  private async findFile(filename: string): Promise<string | null> {
    try {
      if (!this.manifestDb) {
        const manifestPath = path.join(this.backupPath, 'Manifest.db');
        this.manifestDb = new sqlite3(manifestPath, { readonly: true });
      }

      // Query for file in manifest
      const result = this.manifestDb.prepare(`
        SELECT fileID FROM Files 
        WHERE relativePath LIKE ? OR relativePath LIKE ?
      `).get(`%${filename}`, `%${filename.toLowerCase()}`) as any;

      if (!result || !result.fileID) {
        return null;
      }

      // The actual file is stored with first 2 chars as subdirectory
      const fileId = result.fileID;
      const subdir = fileId.substring(0, 2);
      const filePath = path.join(this.backupPath, subdir, fileId);

      if (fs.existsSync(filePath)) {
        return filePath;
      }

      return null;
    } catch (error) {
      log.error(`Failed to find file ${filename}:`, error);
      return null;
    }
  }

  private getValue(info: Array<{ key: string; value: any }>, key: string): any {
    const item = info.find(i => i.key === key);
    return item ? item.value : null;
  }

  private convertAppleTime(appleTime: number): Date {
    // Apple time is seconds since 2001-01-01
    const appleEpoch = new Date('2001-01-01T00:00:00Z').getTime();
    return new Date(appleEpoch + (appleTime * 1000));
  }

  private extractPhoneNumber(handleId: string): string {
    if (!handleId) return 'Unknown';
    
    // Remove country code prefixes
    let number = handleId.replace(/^\+1/, '').replace(/^\+/, '');
    
    // Remove any non-numeric characters
    number = number.replace(/[^0-9]/g, '');
    
    // Format as US phone number if 10 digits
    if (number.length === 10) {
      return `(${number.slice(0, 3)}) ${number.slice(3, 6)}-${number.slice(6)}`;
    }
    
    return number || 'Unknown';
  }

  private getPhoneLabel(label: number): string {
    const labels: { [key: number]: string } = {
      1: 'mobile',
      2: 'home',
      3: 'work',
      4: 'main',
      5: 'home fax',
      6: 'work fax',
      7: 'pager',
      8: 'other',
    };
    return labels[label] || 'other';
  }

  private getEmailLabel(label: number): string {
    const labels: { [key: number]: string } = {
      1: 'home',
      2: 'work',
      3: 'other',
    };
    return labels[label] || 'other';
  }

  private closeManifest(): void {
    if (this.manifestDb) {
      this.manifestDb.close();
      this.manifestDb = null;
    }
  }

  cleanup(): void {
    this.closeManifest();
  }
}