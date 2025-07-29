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


export interface FileTransfer {
  id: string;
  device_id?: string;
  filename: string;
  source_path: string;
  destination_path: string;
  file_size: number;
  file_type?: string;
  mime_type?: string;
  file_extension?: string;
  transfer_type: 'import' | 'export' | 'sync';
  transfer_method: 'usb' | 'wifi' | 'bluetooth' | 'airdrop';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'paused';
  progress: number;
  transfer_speed: number;
  bytes_transferred: number;
  error_message?: string;
  checksum?: string;
  thumbnail_path?: string;
  metadata?: string;
  folder_path?: string;
  original_created_date?: string;
  original_modified_date?: string;
  tags?: string;
  favorite: boolean;
  auto_delete_source: boolean;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  updated_at: string;
}

export interface FileFolder {
  id: string;
  name: string;
  parent_folder_id?: string;
  folder_type: 'custom' | 'photos' | 'videos' | 'documents' | 'downloads' | 'trash';
  color: string;
  icon: string;
  description?: string;
  auto_organize: boolean;
  auto_organize_rules?: string;
  created_at: string;
  updated_at: string;
}

export interface FileShare {
  id: string;
  file_transfer_id: string;
  share_type: 'link' | 'airdrop' | 'email' | 'cloud';
  share_url?: string;
  expires_at?: string;
  password_hash?: string;
  download_count: number;
  max_downloads?: number;
  created_at: string;
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

export interface AppSetting {
  id: string;
  category: string;
  setting_key: string;
  setting_value: string;
  setting_type: 'string' | 'number' | 'boolean' | 'json' | 'color';
  display_name?: string;
  description?: string;
  default_value?: string;
  is_user_configurable: boolean;
  requires_restart: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserPreference {
  id: string;
  preference_group: string;
  preference_key: string;
  preference_value: string;
  preference_type: 'string' | 'number' | 'boolean' | 'json' | 'array';
  is_synced: boolean;
  last_accessed?: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

export interface DeviceConfiguration {
  id: string;
  device_id: string;
  config_category: string;
  config_key: string;
  config_value: string;
  config_type: 'string' | 'number' | 'boolean' | 'json';
  is_device_specific: boolean;
  last_used?: string;
  created_at: string;
  updated_at: string;
}

export interface CrmIntegration {
  id: string;
  crm_provider: string;
  integration_name: string;
  api_endpoint?: string;
  api_key_hash?: string;
  webhook_url?: string;
  sync_settings?: string;
  field_mappings?: string;
  sync_frequency: number;
  last_sync?: string;
  sync_enabled: boolean;
  error_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface CrmSyncLog {
  id: string;
  integration_id: string;
  sync_type: 'contacts' | 'messages' | 'calls' | 'files' | 'full';
  sync_direction: 'push' | 'pull' | 'bidirectional';
  records_processed: number;
  records_successful: number;
  records_failed: number;
  sync_duration?: number;
  sync_status: 'success' | 'partial' | 'failed';
  error_details?: string;
  sync_metadata?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
}

export interface AppTheme {
  id: string;
  theme_name: string;
  theme_type: 'light' | 'dark' | 'auto' | 'custom';
  color_scheme?: string;
  font_settings?: string;
  layout_settings?: string;
  is_built_in: boolean;
  is_active: boolean;
  preview_image?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AppShortcut {
  id: string;
  action_id: string;
  action_name: string;
  action_description?: string;
  default_shortcut?: string;
  current_shortcut?: string;
  shortcut_category?: string;
  is_global: boolean;
  is_customizable: boolean;
  is_enabled: boolean;
  conflict_resolution?: string;
  created_at: string;
  updated_at: string;
}

export interface NotificationRule {
  id: string;
  rule_name: string;
  notification_type: 'message' | 'call' | 'file' | 'sync' | 'system';
  trigger_conditions?: string;
  notification_settings?: string;
  priority_level: 'low' | 'normal' | 'high' | 'urgent';
  delivery_methods?: string;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppBackup {
  id: string;
  backup_name: string;
  backup_type: 'full' | 'settings' | 'data' | 'incremental';
  backup_path: string;
  backup_size?: number;
  backup_metadata?: string;
  includes_data: boolean;
  includes_settings: boolean;
  includes_media: boolean;
  compression_type: string;
  encryption_enabled: boolean;
  auto_generated: boolean;
  restore_count: number;
  created_at: string;
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

export interface CallLog {
  id: string;
  contact_id?: string;
  phone_number: string;
  contact_name?: string;
  direction: 'incoming' | 'outgoing' | 'missed' | 'blocked' | 'voicemail';
  call_type: 'voice' | 'video' | 'facetime' | 'conference';
  duration: number;
  start_time: string;
  end_time?: string;
  call_status: 'completed' | 'failed' | 'busy' | 'declined' | 'no_answer';
  call_quality: 'excellent' | 'good' | 'fair' | 'poor';
  device_used?: string;
  call_notes?: string;
  voicemail_path?: string;
  voicemail_transcription?: string;
  location_data?: any;
  emergency_call: boolean;
  spam_likely: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallRecording {
  id: string;
  call_log_id: string;
  file_path: string;
  file_size?: number;
  duration?: number;
  audio_quality: 'high' | 'medium' | 'low';
  transcription?: string;
  created_at: string;
}

export interface CallParticipant {
  id: string;
  call_log_id: string;
  contact_id?: string;
  phone_number: string;
  participant_name?: string;
  joined_at?: string;
  left_at?: string;
  muted: boolean;
  created_at: string;
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
      await this.runMigrations();
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

    // Message threads table for conversation metadata
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

    // Message attachments table for detailed attachment tracking
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

    // Message reactions/effects table
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
        contact_name TEXT, -- Cached for performance
        direction TEXT CHECK(direction IN ('incoming', 'outgoing', 'missed', 'blocked', 'voicemail')) NOT NULL,
        call_type TEXT CHECK(call_type IN ('voice', 'video', 'facetime', 'conference')) DEFAULT 'voice',
        duration INTEGER DEFAULT 0, -- in seconds
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        call_status TEXT CHECK(call_status IN ('completed', 'failed', 'busy', 'declined', 'no_answer')) DEFAULT 'completed',
        call_quality TEXT CHECK(call_quality IN ('excellent', 'good', 'fair', 'poor')) DEFAULT 'good',
        device_used TEXT, -- iPhone, iPad, Mac, etc.
        call_notes TEXT, -- User notes about the call
        voicemail_path TEXT, -- Path to voicemail file if applicable
        voicemail_transcription TEXT, -- AI transcription of voicemail
        location_data TEXT, -- JSON location when call was made/received
        emergency_call BOOLEAN DEFAULT FALSE,
        spam_likely BOOLEAN DEFAULT FALSE,
        archived BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (contact_id) REFERENCES contacts (id)
      )
    `);

    // Call recordings table for future recording feature
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_recordings (
        id TEXT PRIMARY KEY,
        call_log_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        duration INTEGER, -- in seconds
        audio_quality TEXT CHECK(audio_quality IN ('high', 'medium', 'low')) DEFAULT 'medium',
        transcription TEXT, -- AI transcription of call
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (call_log_id) REFERENCES call_logs (id) ON DELETE CASCADE
      )
    `);

    // Call participants table for conference calls
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS call_participants (
        id TEXT PRIMARY KEY,
        call_log_id TEXT NOT NULL,
        contact_id TEXT,
        phone_number TEXT NOT NULL,
        participant_name TEXT,
        joined_at DATETIME,
        left_at DATETIME,
        muted BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (call_log_id) REFERENCES call_logs (id) ON DELETE CASCADE,
        FOREIGN KEY (contact_id) REFERENCES contacts (id)
      )
    `);

    // File transfers table with comprehensive tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_transfers (
        id TEXT PRIMARY KEY,
        device_id TEXT,
        filename TEXT NOT NULL,
        source_path TEXT NOT NULL,
        destination_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT, -- image, video, document, audio, app, other
        mime_type TEXT,
        file_extension TEXT,
        transfer_type TEXT CHECK(transfer_type IN ('import', 'export', 'sync')) NOT NULL,
        transfer_method TEXT CHECK(transfer_method IN ('usb', 'wifi', 'bluetooth', 'airdrop')) DEFAULT 'usb',
        status TEXT CHECK(status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled', 'paused')) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        transfer_speed INTEGER DEFAULT 0, -- bytes per second
        bytes_transferred INTEGER DEFAULT 0,
        error_message TEXT,
        checksum TEXT, -- for integrity verification
        thumbnail_path TEXT, -- for media files
        metadata TEXT, -- JSON metadata for files
        folder_path TEXT, -- iPhone folder structure
        original_created_date DATETIME, -- original file creation date
        original_modified_date DATETIME, -- original file modification date
        tags TEXT, -- JSON array of user tags
        favorite BOOLEAN DEFAULT FALSE,
        auto_delete_source BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // File folders/albums table for organization
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_folders (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_folder_id TEXT,
        folder_type TEXT CHECK(folder_type IN ('custom', 'photos', 'videos', 'documents', 'downloads', 'trash')) DEFAULT 'custom',
        color TEXT DEFAULT '#3B82F6',
        icon TEXT DEFAULT 'folder',
        description TEXT,
        auto_organize BOOLEAN DEFAULT FALSE,
        auto_organize_rules TEXT, -- JSON rules for auto-organization
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (parent_folder_id) REFERENCES file_folders (id) ON DELETE CASCADE
      )
    `);

    // File folder memberships for organizing files
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_folder_memberships (
        id TEXT PRIMARY KEY,
        file_transfer_id TEXT NOT NULL,
        folder_id TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_transfer_id) REFERENCES file_transfers (id) ON DELETE CASCADE,
        FOREIGN KEY (folder_id) REFERENCES file_folders (id) ON DELETE CASCADE,
        UNIQUE(file_transfer_id, folder_id)
      )
    `);

    // File sharing and permissions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_shares (
        id TEXT PRIMARY KEY,
        file_transfer_id TEXT NOT NULL,
        share_type TEXT CHECK(share_type IN ('link', 'airdrop', 'email', 'cloud')) NOT NULL,
        share_url TEXT,
        expires_at DATETIME,
        password_hash TEXT,
        download_count INTEGER DEFAULT 0,
        max_downloads INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_transfer_id) REFERENCES file_transfers (id) ON DELETE CASCADE
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

    // Sync history table for detailed sync tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        sync_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed BOOLEAN DEFAULT 1,
        error_message TEXT,
        items_synced INTEGER DEFAULT 0,
        total_items INTEGER DEFAULT 0
      )
    `);

    // Backup history table for backup tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backup_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        backup_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed BOOLEAN DEFAULT 0,
        error_message TEXT
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

    // App settings and preferences table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL, -- appearance, sync, notifications, privacy, advanced
        setting_key TEXT NOT NULL,
        setting_value TEXT NOT NULL,
        setting_type TEXT CHECK(setting_type IN ('string', 'number', 'boolean', 'json', 'color')) DEFAULT 'string',
        display_name TEXT,
        description TEXT,
        default_value TEXT,
        is_user_configurable BOOLEAN DEFAULT TRUE,
        requires_restart BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(category, setting_key)
      )
    `);

    // User preferences and customization
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_preferences (
        id TEXT PRIMARY KEY,
        preference_group TEXT NOT NULL, -- ui, sync, notifications, shortcuts, workflows
        preference_key TEXT NOT NULL,
        preference_value TEXT NOT NULL,
        preference_type TEXT CHECK(preference_type IN ('string', 'number', 'boolean', 'json', 'array')) DEFAULT 'string',
        is_synced BOOLEAN DEFAULT FALSE, -- sync across devices
        last_accessed DATETIME,
        access_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(preference_group, preference_key)
      )
    `);

    // Device-specific configurations
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS device_configurations (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        config_category TEXT NOT NULL, -- sync, notifications, file_handling, security
        config_key TEXT NOT NULL,
        config_value TEXT NOT NULL,
        config_type TEXT CHECK(config_type IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
        is_device_specific BOOLEAN DEFAULT TRUE,
        last_used DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, config_category, config_key)
      )
    `);

    // CRM integration settings and hooks
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crm_integrations (
        id TEXT PRIMARY KEY,
        crm_provider TEXT NOT NULL, -- salesforce, hubspot, pipedrive, custom
        integration_name TEXT NOT NULL,
        api_endpoint TEXT,
        api_key_hash TEXT, -- encrypted API key
        webhook_url TEXT,
        sync_settings TEXT, -- JSON configuration
        field_mappings TEXT, -- JSON field mapping configuration  
        sync_frequency INTEGER DEFAULT 300, -- seconds
        last_sync DATETIME,
        sync_enabled BOOLEAN DEFAULT FALSE,
        error_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CRM sync history and logs
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS crm_sync_logs (
        id TEXT PRIMARY KEY,
        integration_id TEXT NOT NULL,
        sync_type TEXT CHECK(sync_type IN ('contacts', 'messages', 'calls', 'files', 'full')) NOT NULL,
        sync_direction TEXT CHECK(sync_direction IN ('push', 'pull', 'bidirectional')) NOT NULL,
        records_processed INTEGER DEFAULT 0,
        records_successful INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        sync_duration INTEGER, -- milliseconds
        sync_status TEXT CHECK(sync_status IN ('success', 'partial', 'failed')) NOT NULL,
        error_details TEXT, -- JSON error information
        sync_metadata TEXT, -- JSON metadata about sync
        started_at DATETIME NOT NULL,
        completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (integration_id) REFERENCES crm_integrations (id) ON DELETE CASCADE
      )
    `);

    // Application themes and customization
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_themes (
        id TEXT PRIMARY KEY,
        theme_name TEXT NOT NULL UNIQUE,
        theme_type TEXT CHECK(theme_type IN ('light', 'dark', 'auto', 'custom')) NOT NULL,
        color_scheme TEXT, -- JSON color configuration
        font_settings TEXT, -- JSON font configuration
        layout_settings TEXT, -- JSON layout preferences
        is_built_in BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT FALSE,
        preview_image TEXT, -- path to preview image
        created_by TEXT DEFAULT 'system',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Keyboard shortcuts and hotkeys
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_shortcuts (
        id TEXT PRIMARY KEY,
        action_id TEXT NOT NULL UNIQUE,
        action_name TEXT NOT NULL,
        action_description TEXT,
        default_shortcut TEXT, -- default key combination
        current_shortcut TEXT, -- user-customized shortcut
        shortcut_category TEXT, -- navigation, sync, files, calls, messages
        is_global BOOLEAN DEFAULT FALSE, -- system-wide hotkey
        is_customizable BOOLEAN DEFAULT TRUE,
        is_enabled BOOLEAN DEFAULT TRUE,
        conflict_resolution TEXT, -- how to handle conflicts
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notification rules and preferences
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id TEXT PRIMARY KEY,
        rule_name TEXT NOT NULL,
        notification_type TEXT CHECK(notification_type IN ('message', 'call', 'file', 'sync', 'system')) NOT NULL,
        trigger_conditions TEXT, -- JSON conditions for triggering
        notification_settings TEXT, -- JSON notification configuration
        priority_level TEXT CHECK(priority_level IN ('low', 'normal', 'high', 'urgent')) DEFAULT 'normal',
        delivery_methods TEXT, -- JSON array of delivery methods
        quiet_hours_start TIME,
        quiet_hours_end TIME,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // App backups and restore points
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_backups (
        id TEXT PRIMARY KEY,
        backup_name TEXT NOT NULL,
        backup_type TEXT CHECK(backup_type IN ('full', 'settings', 'data', 'incremental')) NOT NULL,
        backup_path TEXT NOT NULL,
        backup_size INTEGER,
        backup_metadata TEXT, -- JSON backup information
        includes_data BOOLEAN DEFAULT TRUE,
        includes_settings BOOLEAN DEFAULT TRUE,
        includes_media BOOLEAN DEFAULT FALSE,
        compression_type TEXT DEFAULT 'gzip',
        encryption_enabled BOOLEAN DEFAULT FALSE,
        auto_generated BOOLEAN DEFAULT FALSE,
        restore_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      CREATE INDEX IF NOT EXISTS idx_call_logs_start_time ON call_logs(start_time);
      CREATE INDEX IF NOT EXISTS idx_call_logs_direction ON call_logs(direction);
      CREATE INDEX IF NOT EXISTS idx_call_logs_phone_number ON call_logs(phone_number);
      CREATE INDEX IF NOT EXISTS idx_call_logs_call_type ON call_logs(call_type);
      CREATE INDEX IF NOT EXISTS idx_call_recordings_call_log_id ON call_recordings(call_log_id);
      CREATE INDEX IF NOT EXISTS idx_call_participants_call_log_id ON call_participants(call_log_id);
      CREATE INDEX IF NOT EXISTS idx_file_transfers_status ON file_transfers(status);
      CREATE INDEX IF NOT EXISTS idx_file_transfers_device_id ON file_transfers(device_id);
      CREATE INDEX IF NOT EXISTS idx_file_transfers_file_type ON file_transfers(file_type);
      CREATE INDEX IF NOT EXISTS idx_file_transfers_transfer_type ON file_transfers(transfer_type);
      CREATE INDEX IF NOT EXISTS idx_file_transfers_created_at ON file_transfers(created_at);
      CREATE INDEX IF NOT EXISTS idx_file_folders_folder_type ON file_folders(folder_type);
      CREATE INDEX IF NOT EXISTS idx_file_folders_parent_id ON file_folders(parent_folder_id);
      CREATE INDEX IF NOT EXISTS idx_file_folder_memberships_folder_id ON file_folder_memberships(folder_id);
      CREATE INDEX IF NOT EXISTS idx_file_folder_memberships_transfer_id ON file_folder_memberships(file_transfer_id);
      CREATE INDEX IF NOT EXISTS idx_file_shares_transfer_id ON file_shares(file_transfer_id);
      CREATE INDEX IF NOT EXISTS idx_contacts_display_name ON contacts(display_name);
      CREATE INDEX IF NOT EXISTS idx_contact_group_memberships_group_id ON contact_group_memberships(group_id);
      CREATE INDEX IF NOT EXISTS idx_app_settings_category ON app_settings(category);
      CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(setting_key);
      CREATE INDEX IF NOT EXISTS idx_user_preferences_group ON user_preferences(preference_group);
      CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);
      CREATE INDEX IF NOT EXISTS idx_device_configurations_device_id ON device_configurations(device_id);
      CREATE INDEX IF NOT EXISTS idx_device_configurations_category ON device_configurations(config_category);
      CREATE INDEX IF NOT EXISTS idx_crm_integrations_provider ON crm_integrations(crm_provider);
      CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_integration_id ON crm_sync_logs(integration_id);
      CREATE INDEX IF NOT EXISTS idx_crm_sync_logs_sync_type ON crm_sync_logs(sync_type);
      CREATE INDEX IF NOT EXISTS idx_app_themes_type ON app_themes(theme_type);
      CREATE INDEX IF NOT EXISTS idx_app_shortcuts_category ON app_shortcuts(shortcut_category);
      CREATE INDEX IF NOT EXISTS idx_notification_rules_type ON notification_rules(notification_type);
      CREATE INDEX IF NOT EXISTS idx_app_backups_type ON app_backups(backup_type);
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
  async insertCallLog(callLog: Omit<CallLog, 'created_at' | 'updated_at'>): Promise<void> {
    const sql = `
      INSERT INTO call_logs (id, contact_id, phone_number, direction, duration, start_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    await this.run(sql, [
      callLog.id,
      callLog.contact_id,
      callLog.phone_number,
      callLog.direction,
      callLog.duration,
      callLog.start_time
    ]);
  }

  async getCallLogs(limit: number = 100): Promise<CallLog[]> {
    return await this.query('SELECT * FROM call_logs ORDER BY start_time DESC LIMIT ?', [limit]);
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

  private async runMigrations(): Promise<void> {
    try {
      // Check if migrations table exists
      await this.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id INTEGER PRIMARY KEY,
          version TEXT NOT NULL,
          applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add missing columns safely
      const addColumnIfNotExists = async (table: string, column: string, definition: string) => {
        try {
          const tableInfo = await this.query(`PRAGMA table_info(${table})`);
          const columnExists = tableInfo.some((col: any) => col.name === column);

          if (!columnExists) {
            await this.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
            log.info(`Added column ${column} to ${table}`);
          }
        } catch (error) {
          // Table might not exist yet, which is fine
          log.debug(`Could not add column ${column} to ${table}:`, error);
        }
      };

      // Apply migrations for missing columns
      await addColumnIfNotExists('sync_history', 'completed', 'BOOLEAN DEFAULT 1');
      await addColumnIfNotExists('file_transfers', 'completed', 'BOOLEAN DEFAULT 0');
      await addColumnIfNotExists('backup_history', 'completed', 'BOOLEAN DEFAULT 0');

      // Create indexes if they don't exist
      try {
        await this.run('CREATE INDEX IF NOT EXISTS idx_sync_history_completed ON sync_history(completed)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_file_transfers_completed ON file_transfers(completed)');
        await this.run('CREATE INDEX IF NOT EXISTS idx_backup_history_completed ON backup_history(completed)');
      } catch (error) {
        log.debug('Index creation skipped (tables may not exist yet):', error);
      }

      log.info('Database migrations completed');
    } catch (error) {
      log.error('Migration error:', error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      log.info('Database connection closed');
    }
  }
}