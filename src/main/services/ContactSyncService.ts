import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import log from 'electron-log';
import { DatabaseManager, Contact } from '../database/DatabaseManager';
import { BackupParser, ContactData } from './iphone/BackupParser';

export interface ContactSyncOptions {
  autoSync: boolean;
  syncInterval: number;
  mergeStrategy: 'keep_both' | 'prefer_device' | 'prefer_local';
  includeGroups: boolean;
  includeFavorites: boolean;
}

export interface ContactSyncResult {
  deviceId: string;
  totalContacts: number;
  newContacts: number;
  updatedContacts: number;
  duplicatesFound: number;
  errors: string[];
  syncTime: Date;
}

export interface ContactGroup {
  id: string;
  name: string;
  contactIds: string[];
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactConflict {
  id: string;
  localContact: Contact;
  deviceContact: ContactData;
  conflictFields: string[];
  resolution?: 'keep_local' | 'keep_device' | 'merge';
}

export class ContactSyncService extends EventEmitter {
  private databaseManager: DatabaseManager;
  private syncOptions: ContactSyncOptions;
  private activeSyncs: Map<string, boolean> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(databaseManager: DatabaseManager) {
    super();
    this.databaseManager = databaseManager;
    this.syncOptions = {
      autoSync: true,
      syncInterval: 300000, // 5 minutes
      mergeStrategy: 'prefer_device',
      includeGroups: true,
      includeFavorites: true,
    };
  }

  async initialize(): Promise<void> {
    log.info('Initializing ContactSyncService');
    
    // Create contacts tables if they don't exist
    await this.setupContactTables();
    
    // Start auto-sync if enabled
    if (this.syncOptions.autoSync) {
      this.startAutoSync();
    }
  }

  private async setupContactTables(): Promise<void> {
    try {
      // Contact groups table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS contact_groups (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          contact_ids TEXT,
          color TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Contact favorites table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS contact_favorites (
          contact_id TEXT PRIMARY KEY,
          added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (contact_id) REFERENCES contacts (id)
        )
      `);

      // Contact sync history table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS contact_sync_history (
          id TEXT PRIMARY KEY,
          device_id TEXT NOT NULL,
          sync_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          total_contacts INTEGER,
          new_contacts INTEGER,
          updated_contacts INTEGER,
          duplicates_found INTEGER,
          errors TEXT
        )
      `);

      // Contact conflicts table
      await this.databaseManager.run(`
        CREATE TABLE IF NOT EXISTS contact_conflicts (
          id TEXT PRIMARY KEY,
          contact_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          conflict_data TEXT NOT NULL,
          resolution TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          resolved_at DATETIME
        )
      `);

      // Add indexes for better performance - each in separate statement
      await this.databaseManager.run(`
        CREATE INDEX IF NOT EXISTS idx_contact_favorites_contact_id ON contact_favorites(contact_id)
      `);
      
      await this.databaseManager.run(`
        CREATE INDEX IF NOT EXISTS idx_contact_sync_history_device_id ON contact_sync_history(device_id)
      `);
      
      await this.databaseManager.run(`
        CREATE INDEX IF NOT EXISTS idx_contact_conflicts_contact_id ON contact_conflicts(contact_id)
      `);

      log.info('Contact tables setup completed');
    } catch (error) {
      log.error('Failed to setup contact tables:', error);
      throw error;
    }
  }

  async syncContactsFromDevice(deviceId: string, backupPath?: string): Promise<ContactSyncResult> {
    try {
      if (this.activeSyncs.get(deviceId)) {
        throw new Error('Sync already in progress for this device');
      }

      this.activeSyncs.set(deviceId, true);
      this.emit('sync-started', { deviceId });

      log.info(`Starting contact sync for device: ${deviceId}`);

      const result: ContactSyncResult = {
        deviceId,
        totalContacts: 0,
        newContacts: 0,
        updatedContacts: 0,
        duplicatesFound: 0,
        errors: [],
        syncTime: new Date(),
      };

      // Get contacts from device backup
      if (!backupPath) {
        result.errors.push('No backup path provided');
        return result;
      }

      const parser = new BackupParser(backupPath);
      const deviceContacts = await parser.extractContacts();
      result.totalContacts = deviceContacts.length;

      if (deviceContacts.length === 0) {
        log.warn('No contacts found in device backup');
        return result;
      }

      // Get existing contacts from database
      const existingContacts = await this.databaseManager.getContacts();
      const existingContactMap = new Map<string, Contact>();
      
      for (const contact of existingContacts) {
        existingContactMap.set(contact.id, contact);
      }

      // Process each device contact
      for (const deviceContact of deviceContacts) {
        try {
          await this.processDeviceContact(deviceContact, existingContactMap, result);
        } catch (error) {
          log.error(`Failed to process contact ${deviceContact.firstName} ${deviceContact.lastName}:`, error);
          result.errors.push(`Failed to process ${deviceContact.firstName} ${deviceContact.lastName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Save sync history
      await this.saveSyncHistory(result);

      // Update sync status
      await this.databaseManager.updateSyncStatus(
        deviceId,
        'contacts',
        result.errors.length === 0 ? 'success' : 'failed',
        result.newContacts + result.updatedContacts,
        result.errors.length > 0 ? result.errors.join('; ') : undefined
      );

      this.emit('sync-completed', result);
      log.info(`Contact sync completed: ${result.newContacts} new, ${result.updatedContacts} updated, ${result.duplicatesFound} duplicates`);

      parser.cleanup();
      return result;

    } catch (error) {
      log.error('Contact sync failed:', error);
      this.emit('sync-failed', { deviceId, error: error instanceof Error ? error.message : 'Unknown error' });
      throw error;
    } finally {
      this.activeSyncs.delete(deviceId);
    }
  }

  private async processDeviceContact(
    deviceContact: ContactData,
    existingContactMap: Map<string, Contact>,
    result: ContactSyncResult
  ): Promise<void> {
    const existingContact = existingContactMap.get(deviceContact.id);

    if (!existingContact) {
      // New contact
      await this.addNewContact(deviceContact);
      result.newContacts++;
    } else {
      // Check for conflicts and update
      const hasConflicts = await this.checkForConflicts(deviceContact, existingContact);
      
      if (hasConflicts) {
        result.duplicatesFound++;
        await this.handleContactConflict(deviceContact, existingContact);
      } else {
        await this.updateExistingContact(deviceContact, existingContact);
        result.updatedContacts++;
      }
    }
  }

  private async addNewContact(deviceContact: ContactData): Promise<void> {
    const contact: Omit<Contact, 'created_at' | 'updated_at'> = {
      id: deviceContact.id,
      first_name: deviceContact.firstName,
      last_name: deviceContact.lastName,
      display_name: `${deviceContact.firstName} ${deviceContact.lastName}`.trim() || 'Unknown',
      phone_numbers: deviceContact.phoneNumbers.map(p => p.number),
      email_addresses: deviceContact.emails.map(e => e.email),
      avatar_url: undefined, // Will be handled separately
    };

    await this.databaseManager.insertContact(contact);
    this.emit('contact-added', contact);
  }

  private async updateExistingContact(deviceContact: ContactData, existingContact: Contact): Promise<void> {
    // Merge contact data based on strategy
    const updatedContact: Contact = {
      ...existingContact,
      first_name: deviceContact.firstName || existingContact.first_name,
      last_name: deviceContact.lastName || existingContact.last_name,
      display_name: `${deviceContact.firstName} ${deviceContact.lastName}`.trim() || existingContact.display_name,
      phone_numbers: this.mergeArrays(existingContact.phone_numbers, deviceContact.phoneNumbers.map(p => p.number)),
      email_addresses: this.mergeArrays(existingContact.email_addresses, deviceContact.emails.map(e => e.email)),
      updated_at: new Date().toISOString(),
    };

    await this.updateContact(updatedContact);
    this.emit('contact-updated', updatedContact);
  }

  private async checkForConflicts(deviceContact: ContactData, existingContact: Contact): Promise<boolean> {
    const conflictFields: string[] = [];

    // Check for name conflicts
    if (deviceContact.firstName !== existingContact.first_name) {
      conflictFields.push('first_name');
    }
    if (deviceContact.lastName !== existingContact.last_name) {
      conflictFields.push('last_name');
    }

    // Check for phone number conflicts
    const devicePhones = new Set(deviceContact.phoneNumbers.map(p => p.number));
    const existingPhones = new Set(existingContact.phone_numbers);
    if (!this.setsEqual(devicePhones, existingPhones)) {
      conflictFields.push('phone_numbers');
    }

    // Check for email conflicts
    const deviceEmails = new Set(deviceContact.emails.map(e => e.email));
    const existingEmails = new Set(existingContact.email_addresses);
    if (!this.setsEqual(deviceEmails, existingEmails)) {
      conflictFields.push('email_addresses');
    }

    return conflictFields.length > 0;
  }

  private async handleContactConflict(deviceContact: ContactData, existingContact: Contact): Promise<void> {
    const conflictId = crypto.randomUUID();
    const conflict: ContactConflict = {
      id: conflictId,
      localContact: existingContact,
      deviceContact: deviceContact,
      conflictFields: await this.getConflictFields(deviceContact, existingContact),
    };

    // Save conflict to database for manual resolution
    await this.databaseManager.run(`
      INSERT INTO contact_conflicts (id, contact_id, device_id, conflict_data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [
      conflictId,
      existingContact.id,
      'unknown', // Would be passed from caller
      JSON.stringify(conflict),
      new Date().toISOString(),
    ]);

    this.emit('contact-conflict', conflict);
  }

  private async getConflictFields(deviceContact: ContactData, existingContact: Contact): Promise<string[]> {
    const fields: string[] = [];
    
    if (deviceContact.firstName !== existingContact.first_name) fields.push('first_name');
    if (deviceContact.lastName !== existingContact.last_name) fields.push('last_name');
    
    const devicePhones = new Set(deviceContact.phoneNumbers.map(p => p.number));
    const existingPhones = new Set(existingContact.phone_numbers);
    if (!this.setsEqual(devicePhones, existingPhones)) fields.push('phone_numbers');
    
    const deviceEmails = new Set(deviceContact.emails.map(e => e.email));
    const existingEmails = new Set(existingContact.email_addresses);
    if (!this.setsEqual(deviceEmails, existingEmails)) fields.push('email_addresses');
    
    return fields;
  }

  private mergeArrays<T>(existing: T[], device: T[]): T[] {
    const merged = new Set([...existing, ...device]);
    return Array.from(merged);
  }

  private setsEqual<T>(set1: Set<T>, set2: Set<T>): boolean {
    if (set1.size !== set2.size) return false;
    for (const item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  }

  async updateContact(contact: Contact): Promise<void> {
    await this.databaseManager.run(`
      UPDATE contacts 
      SET first_name = ?, last_name = ?, display_name = ?, phone_numbers = ?, email_addresses = ?, updated_at = ?
      WHERE id = ?
    `, [
      contact.first_name,
      contact.last_name,
      contact.display_name,
      JSON.stringify(contact.phone_numbers),
      JSON.stringify(contact.email_addresses),
      new Date().toISOString(),
      contact.id,
    ]);

    this.emit('contact-updated', contact);
  }

  async deleteContact(contactId: string): Promise<void> {
    await this.databaseManager.run('DELETE FROM contacts WHERE id = ?', [contactId]);
    await this.databaseManager.run('DELETE FROM contact_favorites WHERE contact_id = ?', [contactId]);
    this.emit('contact-deleted', { id: contactId });
  }

  async searchContacts(query: string, filters?: { group?: string; favorite?: boolean }): Promise<Contact[]> {
    let sql = `
      SELECT c.* FROM contacts c
      ${filters?.favorite ? 'JOIN contact_favorites cf ON c.id = cf.contact_id' : ''}
      WHERE (c.first_name LIKE ? OR c.last_name LIKE ? OR c.display_name LIKE ?)
    `;
    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (filters?.group) {
      sql += ' AND c.id IN (SELECT contact_id FROM contact_group_members WHERE group_id = ?)';
      params.push(filters.group);
    }

    sql += ' ORDER BY c.display_name';

    const results = await this.databaseManager.query(sql, params);
    return results.map(row => ({
      ...row,
      phone_numbers: JSON.parse(row.phone_numbers || '[]'),
      email_addresses: JSON.parse(row.email_addresses || '[]'),
    }));
  }

  async addToFavorites(contactId: string): Promise<void> {
    await this.databaseManager.run(`
      INSERT OR IGNORE INTO contact_favorites (contact_id) VALUES (?)
    `, [contactId]);
    this.emit('contact-favorited', { contactId });
  }

  async removeFromFavorites(contactId: string): Promise<void> {
    await this.databaseManager.run(`
      DELETE FROM contact_favorites WHERE contact_id = ?
    `, [contactId]);
    this.emit('contact-unfavorited', { contactId });
  }

  async getFavoriteContacts(): Promise<Contact[]> {
    const results = await this.databaseManager.query(`
      SELECT c.* FROM contacts c
      JOIN contact_favorites cf ON c.id = cf.contact_id
      ORDER BY c.display_name
    `);
    
    return results.map(row => ({
      ...row,
      phone_numbers: JSON.parse(row.phone_numbers || '[]'),
      email_addresses: JSON.parse(row.email_addresses || '[]'),
    }));
  }

  private async saveSyncHistory(result: ContactSyncResult): Promise<void> {
    await this.databaseManager.run(`
      INSERT INTO contact_sync_history (id, device_id, total_contacts, new_contacts, updated_contacts, duplicates_found, errors)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      crypto.randomUUID(),
      result.deviceId,
      result.totalContacts,
      result.newContacts,
      result.updatedContacts,
      result.duplicatesFound,
      JSON.stringify(result.errors),
    ]);
  }

  private startAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = setInterval(() => {
      this.emit('auto-sync-requested');
    }, this.syncOptions.syncInterval);

    log.info('Auto-sync started with interval:', this.syncOptions.syncInterval);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    log.info('Auto-sync stopped');
  }

  updateSyncOptions(options: Partial<ContactSyncOptions>): void {
    this.syncOptions = { ...this.syncOptions, ...options };
    
    if (options.autoSync !== undefined) {
      if (options.autoSync) {
        this.startAutoSync();
      } else {
        this.stopAutoSync();
      }
    }
    
    if (options.syncInterval && this.syncOptions.autoSync) {
      this.startAutoSync();
    }
  }

  getSyncOptions(): ContactSyncOptions {
    return { ...this.syncOptions };
  }

  cleanup(): void {
    this.stopAutoSync();
    this.activeSyncs.clear();
  }
}