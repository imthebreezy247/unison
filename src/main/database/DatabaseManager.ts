import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import log from 'electron-log';

export interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone_numbers: string[];
  email_addresses: string[];
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  contact_id: string;
  content: string;
  message_type: 'sms' | 'imessage' | 'notification';
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  read_status: boolean;
  attachments?: string[];
  created_at: string;
}

export interface CallLog {
  id: string;
  contact_id: string;
  phone_number: string;
  direction: 'incoming' | 'outgoing' | 'missed';
  duration: number;
  timestamp: string;
  created_at: string;
}

export interface FileTransfer {
  id: string;
  filename: string;
  source_path: string;
  destination_path: string;
  file_size: number;
  transfer_type: 'import' | 'export';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  created_at: string;
  completed_at?: string;
}

export interface SyncStatus {
  id: string;
  device_id: string;
  sync_type: 'contacts' | 'messages' | 'calls' | 'files';
  last_sync: string;
  status: 'success' | 'failed' | 'in_progress';
  error_message?: string;
  records_synced: number;
}

export interface Message {
  id: string;
  thread_id: string;
  contact_id?: string;
  phone_number?: string;
  content: string;
  message_type: 'sms' | 'imessage' | 'rcs' | 'notification';
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  read_status: boolean;
  delivered_status: boolean;
  failed_status: boolean;
  attachments?: MessageAttachment[];
  reply_to_id?: string;
  message_effects?: any;
  group_info?: any;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageThread {
  id: string;
  contact_id?: string;
  phone_number?: string;
  last_message_id?: string;
  last_message_timestamp?: string;
  unread_count: number;
  is_group: boolean;
  group_name?: string;
  group_participants?: string[];
  archived: boolean;
  pinned: boolean;
  muted: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  file_path: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  mime_type?: string;
  thumbnail_path?: string;
  download_status: 'pending' | 'downloading' | 'completed' | 'failed';
  created_at: string;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  reaction_type: string;
  sender_id?: string;
  timestamp: string;
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    // Create database directory if it doesn't exist
    const dbDir = path.join(process.cwd(), 'db');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    this.dbPath = path.join(dbDir, 'unisonx.db');
  }

  async initialize(): Promise<void> {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');
      
      await this.createTables();
      log.info('Database initialized successfully');
    } catch (error) {
      log.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Contacts table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        display_name TEXT NOT NULL,
        phone_numbers TEXT, -- JSON array
        email_addresses TEXT, -- JSON array
        avatar_url TEXT,
        organization TEXT,
        last_contacted DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL, -- Groups messages into conversations
        contact_id TEXT,
        phone_number TEXT, -- For messages from unknown contacts
        content TEXT NOT NULL,
        message_type TEXT CHECK(message_type IN ('sms', 'imessage', 'rcs', 'notification')) NOT NULL,
        direction TEXT CHECK(direction IN ('incoming', 'outgoing')) NOT NULL,
        timestamp DATETIME NOT NULL,
        read_status BOOLEAN DEFAULT FALSE,
        delivered_status BOOLEAN DEFAULT FALSE,
        failed_status BOOLEAN DEFAULT FALSE,
        attachments TEXT, -- JSON array of attachment objects
        reply_to_id TEXT, -- For threaded replies
        message_effects TEXT, -- JSON for iMessage effects, reactions
        group_info TEXT, -- JSON for group message info
        archived BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts (id),
        FOREIGN KEY (reply_to_id) REFERENCES messages (id)
      )
    `);

    -- Message threads table for conversation metadata
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_threads (
        id TEXT PRIMARY KEY,
        contact_id TEXT,
        phone_number TEXT,
        last_message_id TEXT,
        last_message_timestamp DATETIME,
        unread_count INTEGER DEFAULT 0,
        is_group BOOLEAN DEFAULT FALSE,
        group_name TEXT,
        group_participants TEXT, -- JSON array of participants
        archived BOOLEAN DEFAULT FALSE,
        pinned BOOLEAN DEFAULT FALSE,
        muted BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts (id),
        FOREIGN KEY (last_message_id) REFERENCES messages (id)
      )
    `);

    -- Message attachments table for detailed attachment tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_attachments (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT,
        file_type TEXT, -- image, video, audio, document, etc.
        file_size INTEGER,
        mime_type TEXT,
        thumbnail_path TEXT,
        download_status TEXT CHECK(download_status IN ('pending', 'downloading', 'completed', 'failed')) DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `);

    -- Message reactions/effects table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id TEXT PRIMARY KEY,
        message_id TEXT NOT NULL,
        reaction_type TEXT NOT NULL, -- heart, thumbs_up, laugh, etc.
        sender_id TEXT, -- Who sent the reaction
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (message_id) REFERENCES messages (id) ON DELETE CASCADE
      )
    `);

    // Call logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id TEXT PRIMARY KEY,
        contact_id TEXT,
        phone_number TEXT NOT NULL,
        direction TEXT CHECK(direction IN ('incoming', 'outgoing', 'missed')) NOT NULL,
        duration INTEGER DEFAULT 0, -- in seconds
        timestamp DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts (id)
      )
    `);

    // File transfers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_transfers (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        transfer_type TEXT CHECK(transfer_type IN ('import', 'export')) NOT NULL,
        status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      )
    `);

    // Sync status table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_status (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        sync_type TEXT CHECK(sync_type IN ('contacts', 'messages', 'calls', 'files')) NOT NULL,
        last_sync DATETIME NOT NULL,
        status TEXT CHECK(status IN ('success', 'failed', 'in_progress')) NOT NULL,
        error_message TEXT,
        records_synced INTEGER DEFAULT 0,
        UNIQUE(device_id, sync_type)
      )
    `);

    // Contact groups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT DEFAULT '#3B82F6',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Contact group membership table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_group_memberships (
        contact_id TEXT,
        group_id TEXT,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (contact_id, group_id),
        FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES contact_groups (id) ON DELETE CASCADE
      )
    `);

    // Contact favorites table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS contact_favorites (
        contact_id TEXT PRIMARY KEY,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE CASCADE
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_contact_id ON messages(contact_id);
      CREATE INDEX IF NOT EXISTS idx_messages_thread_id ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
      CREATE INDEX IF NOT EXISTS idx_messages_read_status ON messages(read_status);
      CREATE INDEX IF NOT EXISTS idx_message_threads_contact_id ON message_threads(contact_id);
      CREATE INDEX IF NOT EXISTS idx_message_threads_last_timestamp ON message_threads(last_message_timestamp);
      CREATE INDEX IF NOT EXISTS idx_message_threads_unread ON message_threads(unread_count);
      CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
      CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_contact_id ON call_logs(contact_id);
      CREATE INDEX IF NOT EXISTS idx_call_logs_timestamp ON call_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_file_transfers_status ON file_transfers(status);
      CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name);
      CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_group_id ON contact_group_memberships(group_id);
    `);

    log.info('Database tables created successfully');
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(params);
    } catch (error) {
      log.error('Database query error:', error);
      throw error;
    }
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    try {
      const stmt = this.db.prepare(sql);
      return stmt.run(params);
    } catch (error) {
      log.error('Database run error:', error);
      throw error;
    }
  }

  // Contact methods
  async insertContact(contact: Omit<Contact, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT INTO contacts (id, first_name, last_name, display_name, phone_numbers, email_addresses, avatar_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      contact.id,
      contact.first_name,
      contact.last_name,
      contact.display_name,
      JSON.stringify(contact.phone_numbers),
      JSON.stringify(contact.email_addresses),
      contact.avatar_url
    ]);
  }

  async getContacts(): Promise<Contact[]> {
    const contacts = await this.query('SELECT * FROM contacts ORDER BY display_name');
    return contacts.map(contact => ({
      ...contact,
      phone_numbers: JSON.parse(contact.phone_numbers || '[]'),
      email_addresses: JSON.parse(contact.email_addresses || '[]')
    }));
  }

  // Message methods
  async insertMessage(message: Omit<Message, 'created_at'>): Promise<void> {
    const sql = `
      INSERT INTO messages (id, contact_id, content, message_type, direction, timestamp, read_status, attachments)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      message.id,
      message.contact_id,
      message.content,
      message.message_type,
      message.direction,
      message.timestamp,
      message.read_status,
      JSON.stringify(message.attachments || [])
    ]);
  }

  async getMessages(contactId?: string, limit: number = 100): Promise<Message[]> {
    let sql = 'SELECT * FROM messages';
    let params: any[] = [];
    
    if (contactId) {
      sql += ' WHERE contact_id = ?';
      params.push(contactId);
    }
    
    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    const messages = await this.query(sql, params);
    return messages.map(message => ({
      ...message,
      attachments: JSON.parse(message.attachments || '[]'),
      read_status: Boolean(message.read_status)
    }));
  }

  // Call log methods
  async insertCallLog(callLog: Omit<CallLog, 'created_at'>): Promise<void> {
    const sql = `
      INSERT INTO call_logs (id, contact_id, phone_number, direction, duration, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      callLog.id,
      callLog.contact_id,
      callLog.phone_number,
      callLog.direction,
      callLog.duration,
      callLog.timestamp
    ]);
  }

  async getCallLogs(limit: number = 100): Promise<CallLog[]> {
    return await this.query('SELECT * FROM call_logs ORDER BY timestamp DESC LIMIT ?', [limit]);
  }

  // File transfer methods
  async insertFileTransfer(transfer: Omit<FileTransfer, 'created_at' | 'completed_at'>): Promise<void> {
    const sql = `
      INSERT INTO file_transfers (id, filename, source_path, destination_path, file_size, transfer_type, status, progress)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      transfer.id,
      transfer.filename,
      transfer.source_path,
      transfer.destination_path,
      transfer.file_size,
      transfer.transfer_type,
      transfer.status,
      transfer.progress
    ]);
  }

  async updateFileTransferProgress(id: string, progress: number, status: string): Promise<void> {
    const sql = `
      UPDATE file_transfers 
      SET progress = ?, status = ?, completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = ?
    `;
    await this.run(sql, [progress, status, status, id]);
  }

  // Sync status methods
  async updateSyncStatus(deviceId: string, syncType: string, status: string, recordsSynced: number = 0, errorMessage?: string): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO sync_status (id, device_id, sync_type, last_sync, status, error_message, records_synced)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `;
    const id = `${deviceId}_${syncType}`;
    await this.run(sql, [id, deviceId, syncType, status, errorMessage, recordsSynced]);
  }

  async getSyncStatus(deviceId: string): Promise<SyncStatus[]> {
    return await this.query('SELECT * FROM sync_status WHERE device_id = ?', [deviceId]);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('Database connection closed');
    }
  }
}