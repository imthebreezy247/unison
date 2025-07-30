import { DatabaseManager, AppSetting, UserPreference, DeviceConfiguration, CrmIntegration, CrmSyncLog, AppTheme, AppShortcut, NotificationRule, AppBackup } from '../database/DatabaseManager';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import log from 'electron-log';
import { app } from 'electron';

interface SettingsCategory {
  name: string;
  displayName: string;
  description: string;
  settings: AppSetting[];
}

interface ThemeDefinition {
  name: string;
  type: 'light' | 'dark' | 'auto' | 'custom';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  fonts: {
    family: string;
    sizes: { [key: string]: string };
  };
  layout: {
    sidebar: { width: string };
    header: { height: string };
    borderRadius: string;
  };
}

interface BackupResult {
  success: boolean;
  backupId?: string;
  backupPath?: string;
  error?: string;
  backupSize?: number;
}

interface RestoreResult {
  success: boolean;
  restoredItems: number;
  error?: string;
  requiresRestart?: boolean;
}

export class SettingsService {
  private databaseManager: DatabaseManager;
  private settingsCache: Map<string, any> = new Map();
  private preferencesCache: Map<string, any> = new Map();
  private readonly encryptionKey: Buffer;
  private readonly defaultSettings: { [key: string]: any };

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
    this.encryptionKey = this.generateEncryptionKey();
    this.defaultSettings = this.getDefaultSettings();
  }

  async initialize(): Promise<void> {
    try {
      log.info('Initializing SettingsService...');
      
      // Initialize default settings
      await this.initializeDefaultSettings();
      
      // Initialize default themes
      await this.initializeDefaultThemes();
      
      // Initialize default shortcuts
      await this.initializeDefaultShortcuts();
      
      // Initialize default notification rules
      await this.initializeDefaultNotificationRules();
      
      // Load settings and preferences into cache
      await this.loadSettingsCache();
      await this.loadPreferencesCache();
      
      log.info('SettingsService initialized successfully');
    } catch (error) {
      log.error('Failed to initialize SettingsService:', error);
      throw error;
    }
  }

  // Settings Management
  async getSetting(category: string, key: string, defaultValue?: any): Promise<any> {
    const cacheKey = `${category}.${key}`;
    
    if (this.settingsCache.has(cacheKey)) {
      return this.settingsCache.get(cacheKey);
    }

    try {
      const result = await this.databaseManager.query(
        'SELECT * FROM app_settings WHERE category = ? AND setting_key = ?',
        [category, key]
      );

      if (result.length > 0) {
        const setting = result[0];
        const value = this.parseSettingValue(setting.setting_value, setting.setting_type);
        this.settingsCache.set(cacheKey, value);
        return value;
      }

      return defaultValue !== undefined ? defaultValue : this.defaultSettings[cacheKey];
    } catch (error) {
      log.error(`Failed to get setting ${category}.${key}:`, error);
      return defaultValue;
    }
  }

  async setSetting(category: string, key: string, value: any, settingType?: string): Promise<void> {
    try {
      const cacheKey = `${category}.${key}`;
      const stringValue = this.stringifySettingValue(value);
      const type = settingType || this.inferSettingType(value);
      
      const settingId = `${category}_${key}`;
      
      await this.databaseManager.run(`
        INSERT OR REPLACE INTO app_settings (
          id, category, setting_key, setting_value, setting_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [settingId, category, key, stringValue, type]);

      this.settingsCache.set(cacheKey, value);
      
      log.info(`Setting updated: ${category}.${key} = ${value}`);
    } catch (error) {
      log.error(`Failed to set setting ${category}.${key}:`, error);
      throw error;
    }
  }

  async getSettingsByCategory(category: string): Promise<SettingsCategory> {
    try {
      const settings = await this.databaseManager.query(
        'SELECT * FROM app_settings WHERE category = ? ORDER BY setting_key',
        [category]
      );

      return {
        name: category,
        displayName: this.getCategoryDisplayName(category),
        description: this.getCategoryDescription(category),
        settings: settings.map(s => ({
          ...s,
          setting_value: this.parseSettingValue(s.setting_value, s.setting_type)
        }))
      };
    } catch (error) {
      log.error(`Failed to get settings for category ${category}:`, error);
      throw error;
    }
  }

  async getAllSettings(): Promise<SettingsCategory[]> {
    try {
      const categories = ['appearance', 'sync', 'notifications', 'privacy', 'advanced'];
      const result: SettingsCategory[] = [];

      for (const category of categories) {
        const categorySettings = await this.getSettingsByCategory(category);
        result.push(categorySettings);
      }

      return result;
    } catch (error) {
      log.error('Failed to get all settings:', error);
      throw error;
    }
  }

  // User Preferences Management
  async getPreference(group: string, key: string, defaultValue?: any): Promise<any> {
    const cacheKey = `${group}.${key}`;
    
    if (this.preferencesCache.has(cacheKey)) {
      return this.preferencesCache.get(cacheKey);
    }

    try {
      const result = await this.databaseManager.query(
        'SELECT * FROM user_preferences WHERE preference_group = ? AND preference_key = ?',
        [group, key]
      );

      if (result.length > 0) {
        const preference = result[0];
        const value = this.parseSettingValue(preference.preference_value, preference.preference_type);
        this.preferencesCache.set(cacheKey, value);
        
        // Update access tracking
        await this.updatePreferenceAccess(preference.id);
        
        return value;
      }

      return defaultValue;
    } catch (error) {
      log.error(`Failed to get preference ${group}.${key}:`, error);
      return defaultValue;
    }
  }

  async setPreference(group: string, key: string, value: any, isSynced: boolean = false): Promise<void> {
    try {
      const cacheKey = `${group}.${key}`;
      const stringValue = this.stringifySettingValue(value);
      const type = this.inferSettingType(value);
      
      const preferenceId = `${group}_${key}`;
      
      await this.databaseManager.run(`
        INSERT OR REPLACE INTO user_preferences (
          id, preference_group, preference_key, preference_value, preference_type, 
          is_synced, access_count, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `, [preferenceId, group, key, stringValue, type, isSynced]);

      this.preferencesCache.set(cacheKey, value);
      
      log.info(`Preference updated: ${group}.${key} = ${value}`);
    } catch (error) {
      log.error(`Failed to set preference ${group}.${key}:`, error);
      throw error;
    }
  }

  // Device Configuration Management
  async getDeviceConfiguration(deviceId: string, category: string, key: string, defaultValue?: any): Promise<any> {
    try {
      const result = await this.databaseManager.query(
        'SELECT * FROM device_configurations WHERE device_id = ? AND config_category = ? AND config_key = ?',
        [deviceId, category, key]
      );

      if (result.length > 0) {
        const config = result[0];
        return this.parseSettingValue(config.config_value, config.config_type);
      }

      return defaultValue;
    } catch (error) {
      log.error(`Failed to get device configuration ${deviceId}.${category}.${key}:`, error);
      return defaultValue;
    }
  }

  async setDeviceConfiguration(deviceId: string, category: string, key: string, value: any): Promise<void> {
    try {
      const stringValue = this.stringifySettingValue(value);
      const type = this.inferSettingType(value);
      
      const configId = `${deviceId}_${category}_${key}`;
      
      await this.databaseManager.run(`
        INSERT OR REPLACE INTO device_configurations (
          id, device_id, config_category, config_key, config_value, config_type, 
          last_used, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `, [configId, deviceId, category, key, stringValue, type]);

      log.info(`Device configuration updated: ${deviceId}.${category}.${key} = ${value}`);
    } catch (error) {
      log.error(`Failed to set device configuration ${deviceId}.${category}.${key}:`, error);
      throw error;
    }
  }

  // Theme Management
  async getThemes(): Promise<AppTheme[]> {
    try {
      return await this.databaseManager.query('SELECT * FROM app_themes ORDER BY is_built_in DESC, theme_name');
    } catch (error) {
      log.error('Failed to get themes:', error);
      throw error;
    }
  }

  async getActiveTheme(): Promise<AppTheme | null> {
    try {
      const result = await this.databaseManager.query('SELECT * FROM app_themes WHERE is_active = TRUE LIMIT 1');
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      log.error('Failed to get active theme:', error);
      return null;
    }
  }

  async setActiveTheme(themeId: string): Promise<void> {
    try {
      // Deactivate all themes
      await this.databaseManager.run('UPDATE app_themes SET is_active = ?', ['false']);

      // Activate selected theme
      await this.databaseManager.run('UPDATE app_themes SET is_active = ? WHERE id = ?', ['true', themeId]);
      
      log.info(`Theme activated: ${themeId}`);
    } catch (error) {
      log.error(`Failed to set active theme ${themeId}:`, error);
      throw error;
    }
  }

  async createCustomTheme(themeData: Omit<AppTheme, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const themeId = `theme-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.databaseManager.run(`
        INSERT INTO app_themes (
          id, theme_name, theme_type, color_scheme, font_settings, layout_settings,
          is_built_in, is_active, preview_image, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        themeId, themeData.theme_name, themeData.theme_type, themeData.color_scheme,
        themeData.font_settings, themeData.layout_settings, themeData.is_built_in,
        themeData.is_active, themeData.preview_image, themeData.created_by
      ]);

      log.info(`Custom theme created: ${themeData.theme_name}`);
      return themeId;
    } catch (error) {
      log.error(`Failed to create custom theme:`, error);
      throw error;
    }
  }

  // CRM Integration Management
  async getCrmIntegrations(): Promise<CrmIntegration[]> {
    try {
      const integrations = await this.databaseManager.query('SELECT * FROM crm_integrations ORDER BY created_at DESC');
      
      // Decrypt API keys for display (partially masked)
      return integrations.map(integration => ({
        ...integration,
        api_key_hash: integration.api_key_hash ? this.maskApiKey(integration.api_key_hash) : undefined
      }));
    } catch (error) {
      log.error('Failed to get CRM integrations:', error);
      throw error;
    }
  }

  async createCrmIntegration(integrationData: Omit<CrmIntegration, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
    try {
      const integrationId = `crm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Encrypt API key if provided
      const encryptedApiKey = integrationData.api_key_hash ? 
        this.encryptApiKey(integrationData.api_key_hash) : null;
      
      await this.databaseManager.run(`
        INSERT INTO crm_integrations (
          id, crm_provider, integration_name, api_endpoint, api_key_hash, webhook_url,
          sync_settings, field_mappings, sync_frequency, sync_enabled, error_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        integrationId, integrationData.crm_provider, integrationData.integration_name,
        integrationData.api_endpoint, encryptedApiKey, integrationData.webhook_url,
        integrationData.sync_settings, integrationData.field_mappings, integrationData.sync_frequency,
        integrationData.sync_enabled, 0
      ]);

      log.info(`CRM integration created: ${integrationData.integration_name}`);
      return integrationId;
    } catch (error) {
      log.error('Failed to create CRM integration:', error);
      throw error;
    }
  }

  async updateCrmIntegration(integrationId: string, updateData: Partial<CrmIntegration>): Promise<void> {
    try {
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      
      Object.entries(updateData).forEach(([key, value]) => {
        if (key !== 'id' && key !== 'created_at' && value !== undefined) {
          if (key === 'api_key_hash' && value) {
            updateFields.push(`${key} = ?`);
            updateValues.push(this.encryptApiKey(value as string));
          } else {
            updateFields.push(`${key} = ?`);
            updateValues.push(typeof value === 'object' ? JSON.stringify(value) : value);
          }
        }
      });
      
      if (updateFields.length === 0) return;
      
      updateFields.push('updated_at = CURRENT_TIMESTAMP');
      updateValues.push(integrationId);
      
      await this.databaseManager.run(
        `UPDATE crm_integrations SET ${updateFields.join(', ')} WHERE id = ?`,
        updateValues
      );

      log.info(`CRM integration updated: ${integrationId}`);
    } catch (error) {
      log.error(`Failed to update CRM integration ${integrationId}:`, error);
      throw error;
    }
  }

  async logCrmSync(syncData: Omit<CrmSyncLog, 'id' | 'created_at'>): Promise<string> {
    try {
      const logId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await this.databaseManager.run(`
        INSERT INTO crm_sync_logs (
          id, integration_id, sync_type, sync_direction, records_processed,
          records_successful, records_failed, sync_duration, sync_status,
          error_details, sync_metadata, started_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logId, syncData.integration_id, syncData.sync_type, syncData.sync_direction,
        syncData.records_processed, syncData.records_successful, syncData.records_failed,
        syncData.sync_duration, syncData.sync_status, syncData.error_details,
        syncData.sync_metadata, syncData.started_at, syncData.completed_at
      ]);

      return logId;
    } catch (error) {
      log.error('Failed to log CRM sync:', error);
      throw error;
    }
  }

  // Backup and Restore
  async createBackup(backupType: 'full' | 'settings' | 'data' | 'incremental', options?: {
    includeData?: boolean;
    includeSettings?: boolean;
    includeMedia?: boolean;
    backupName?: string;
  }): Promise<BackupResult> {
    try {
      const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const backupName = options?.backupName || `${backupType}_backup_${new Date().toISOString().split('T')[0]}`;
      const backupDir = path.join(app.getPath('userData'), 'backups');
      const backupPath = path.join(backupDir, `${backupId}.json`);
      
      // Ensure backup directory exists
      await fs.promises.mkdir(backupDir, { recursive: true });
      
      const backupData: any = {
        metadata: {
          backupId,
          backupType,
          created: new Date().toISOString(),
          version: app.getVersion()
        }
      };
      
      // Include settings if requested
      if (options?.includeSettings !== false) {
        backupData.settings = await this.databaseManager.query('SELECT * FROM app_settings');
        backupData.preferences = await this.databaseManager.query('SELECT * FROM user_preferences');
        backupData.themes = await this.databaseManager.query('SELECT * FROM app_themes');
        backupData.shortcuts = await this.databaseManager.query('SELECT * FROM app_shortcuts');
        backupData.notifications = await this.databaseManager.query('SELECT * FROM notification_rules');
      }
      
      // Include data if requested
      if (options?.includeData !== false && backupType !== 'settings') {
        backupData.contacts = await this.databaseManager.query('SELECT * FROM contacts');
        backupData.messages = await this.databaseManager.query('SELECT * FROM messages LIMIT 1000'); // Limit for size
        backupData.callLogs = await this.databaseManager.query('SELECT * FROM call_logs LIMIT 1000');
      }
      
      // Write backup file
      await fs.promises.writeFile(backupPath, JSON.stringify(backupData, null, 2));
      const stats = await fs.promises.stat(backupPath);
      
      // Record backup in database
      await this.databaseManager.run(`
        INSERT INTO app_backups (
          id, backup_name, backup_type, backup_path, backup_size, backup_metadata,
          includes_data, includes_settings, includes_media, compression_type,
          encryption_enabled, auto_generated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        backupId, backupName, backupType, backupPath, stats.size,
        JSON.stringify({ version: app.getVersion(), tables: Object.keys(backupData).length }),
        options?.includeData !== false ? 'true' : 'false', options?.includeSettings !== false ? 'true' : 'false',
        options?.includeMedia !== false ? 'true' : 'false', 'none', 'false', 'false'
      ]);
      
      log.info(`Backup created: ${backupName} (${stats.size} bytes)`);
      
      return {
        success: true,
        backupId,
        backupPath,
        backupSize: stats.size
      };
    } catch (error) {
      log.error('Failed to create backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async restoreBackup(backupId: string): Promise<RestoreResult> {
    try {
      // Get backup info
      const backupInfo = await this.databaseManager.query(
        'SELECT * FROM app_backups WHERE id = ?',
        [backupId]
      );
      
      if (backupInfo.length === 0) {
        throw new Error('Backup not found');
      }
      
      const backup = backupInfo[0];
      
      // Read backup file
      const backupData = JSON.parse(await fs.promises.readFile(backup.backup_path, 'utf-8'));
      
      let restoredItems = 0;
      let requiresRestart = false;
      
      // Restore settings
      if (backupData.settings && backup.includes_settings) {
        for (const setting of backupData.settings) {
          await this.databaseManager.run(
            'INSERT OR REPLACE INTO app_settings VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            Object.values(setting)
          );
          restoredItems++;
        }
        requiresRestart = true;
      }
      
      // Restore preferences
      if (backupData.preferences && backup.includes_settings) {
        for (const preference of backupData.preferences) {
          await this.databaseManager.run(
            'INSERT OR REPLACE INTO user_preferences VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            Object.values(preference)
          );
          restoredItems++;
        }
      }
      
      // Update restore count
      await this.databaseManager.run(
        'UPDATE app_backups SET restore_count = restore_count + 1 WHERE id = ?',
        [backupId]
      );
      
      // Clear caches
      this.settingsCache.clear();
      this.preferencesCache.clear();
      
      log.info(`Backup restored: ${backup.backup_name} (${restoredItems} items)`);
      
      return {
        success: true,
        restoredItems,
        requiresRestart
      };
    } catch (error) {
      log.error(`Failed to restore backup ${backupId}:`, error);
      return {
        success: false,
        restoredItems: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getBackups(): Promise<AppBackup[]> {
    try {
      return await this.databaseManager.query('SELECT * FROM app_backups ORDER BY created_at DESC');
    } catch (error) {
      log.error('Failed to get backups:', error);
      throw error;
    }
  }

  // Private helper methods
  private async initializeDefaultSettings(): Promise<void> {
    const defaultSettings = [
      // Appearance
      { category: 'appearance', key: 'theme_mode', value: 'auto', type: 'string', display: 'Theme Mode', description: 'Light, dark, or automatic theme' },
      { category: 'appearance', key: 'font_size', value: '14', type: 'number', display: 'Font Size', description: 'Base font size in pixels' },
      { category: 'appearance', key: 'compact_mode', value: 'false', type: 'boolean', display: 'Compact Mode', description: 'Use compact UI layout' },
      { category: 'appearance', key: 'accent_color', value: '#3B82F6', type: 'color', display: 'Accent Color', description: 'Primary accent color' },
      
      // Sync
      { category: 'sync', key: 'auto_sync_enabled', value: 'true', type: 'boolean', display: 'Auto Sync', description: 'Automatically sync when device connects' },
      { category: 'sync', key: 'sync_interval', value: '300', type: 'number', display: 'Sync Interval', description: 'Sync interval in seconds' },
      { category: 'sync', key: 'sync_contacts', value: 'true', type: 'boolean', display: 'Sync Contacts', description: 'Enable contact synchronization' },
      { category: 'sync', key: 'sync_messages', value: 'true', type: 'boolean', display: 'Sync Messages', description: 'Enable message synchronization' },
      { category: 'sync', key: 'sync_calls', value: 'true', type: 'boolean', display: 'Sync Calls', description: 'Enable call log synchronization' },
      
      // Notifications
      { category: 'notifications', key: 'show_notifications', value: 'true', type: 'boolean', display: 'Show Notifications', description: 'Enable desktop notifications' },
      { category: 'notifications', key: 'notification_sound', value: 'true', type: 'boolean', display: 'Notification Sound', description: 'Play sound for notifications' },
      { category: 'notifications', key: 'quiet_hours_enabled', value: 'false', type: 'boolean', display: 'Quiet Hours', description: 'Enable quiet hours' },
      
      // Privacy
      { category: 'privacy', key: 'analytics_enabled', value: 'false', type: 'boolean', display: 'Analytics', description: 'Send anonymous usage analytics' },
      { category: 'privacy', key: 'crash_reports', value: 'true', type: 'boolean', display: 'Crash Reports', description: 'Send crash reports to help improve the app' },
      
      // Advanced
      { category: 'advanced', key: 'debug_mode', value: 'false', type: 'boolean', display: 'Debug Mode', description: 'Enable debug logging' },
      { category: 'advanced', key: 'startup_with_system', value: 'true', type: 'boolean', display: 'Start with System', description: 'Launch UnisonX on system startup' },
      { category: 'advanced', key: 'minimize_to_tray', value: 'true', type: 'boolean', display: 'Minimize to Tray', description: 'Minimize to system tray instead of taskbar' }
    ];

    for (const setting of defaultSettings) {
      try {
        // Ensure all values are properly stringified for SQLite
        const stringValue = String(setting.value);
        const settingId = `${setting.category}_${setting.key}`;

        await this.databaseManager.run(`
          INSERT OR IGNORE INTO app_settings (
            id, category, setting_key, setting_value, setting_type,
            display_name, description, default_value, is_user_configurable
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          settingId,
          setting.category,
          setting.key,
          stringValue,
          setting.type,
          setting.display || setting.key,
          setting.description || '',
          stringValue,
          'true'
        ]);
      } catch (error) {
        log.error(`Failed to initialize setting ${setting.category}.${setting.key}:`, error);
      }
    }
  }

  private async initializeDefaultThemes(): Promise<void> {
    const defaultThemes: ThemeDefinition[] = [
      {
        name: 'Light',
        type: 'light',
        colors: {
          primary: '#3B82F6',
          secondary: '#6B7280',
          background: '#FFFFFF',
          surface: '#F9FAFB',
          text: '#111827',
          accent: '#10B981'
        },
        fonts: {
          family: 'Inter, system-ui, sans-serif',
          sizes: { base: '14px', lg: '16px', xl: '18px' }
        },
        layout: {
          sidebar: { width: '256px' },
          header: { height: '64px' },
          borderRadius: '8px'
        }
      },
      {
        name: 'Dark',
        type: 'dark',
        colors: {
          primary: '#3B82F6',
          secondary: '#9CA3AF',
          background: '#111827',
          surface: '#1F2937',
          text: '#F9FAFB',
          accent: '#10B981'
        },
        fonts: {
          family: 'Inter, system-ui, sans-serif',
          sizes: { base: '14px', lg: '16px', xl: '18px' }
        },
        layout: {
          sidebar: { width: '256px' },
          header: { height: '64px' },
          borderRadius: '8px'
        }
      }
    ];

    for (const theme of defaultThemes) {
      try {
        await this.databaseManager.run(`
          INSERT OR IGNORE INTO app_themes (
            id, theme_name, theme_type, color_scheme, font_settings, layout_settings,
            is_built_in, is_active, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `theme-${theme.name.toLowerCase()}`, theme.name, theme.type,
          JSON.stringify(theme.colors), JSON.stringify(theme.fonts), JSON.stringify(theme.layout),
          'true', theme.name === 'Light' ? 'true' : 'false', 'system'
        ]);
      } catch (error) {
        log.warn(`Failed to initialize default theme ${theme.name}:`, error);
      }
    }
  }

  private async initializeDefaultShortcuts(): Promise<void> {
    const defaultShortcuts = [
      { action: 'new_message', name: 'New Message', shortcut: 'Ctrl+N', category: 'messages' },
      { action: 'search', name: 'Search', shortcut: 'Ctrl+F', category: 'navigation' },
      { action: 'refresh', name: 'Refresh', shortcut: 'F5', category: 'navigation' },
      { action: 'settings', name: 'Settings', shortcut: 'Ctrl+,', category: 'navigation' },
      { action: 'quit', name: 'Quit', shortcut: 'Ctrl+Q', category: 'navigation' }
    ];

    for (const shortcut of defaultShortcuts) {
      try {
        await this.databaseManager.run(`
          INSERT OR IGNORE INTO app_shortcuts (
            id, action_id, action_name, default_shortcut, current_shortcut,
            shortcut_category, is_customizable, is_enabled
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `shortcut-${shortcut.action}`, shortcut.action, shortcut.name,
          shortcut.shortcut, shortcut.shortcut, shortcut.category, 'true', 'true'
        ]);
      } catch (error) {
        log.warn(`Failed to initialize default shortcut ${shortcut.action}:`, error);
      }
    }
  }

  private async initializeDefaultNotificationRules(): Promise<void> {
    const defaultRules = [
      { name: 'New Messages', type: 'message', priority: 'normal' },
      { name: 'Incoming Calls', type: 'call', priority: 'high' },
      { name: 'Sync Complete', type: 'sync', priority: 'low' },
      { name: 'System Errors', type: 'system', priority: 'urgent' }
    ];

    for (const rule of defaultRules) {
      try {
        await this.databaseManager.run(`
          INSERT OR IGNORE INTO notification_rules (
            id, rule_name, notification_type, priority_level, is_enabled
          ) VALUES (?, ?, ?, ?, ?)
        `, [
          `rule-${rule.type}`, rule.name, rule.type, rule.priority, 'true'
        ]);
      } catch (error) {
        log.warn(`Failed to initialize default notification rule ${rule.name}:`, error);
      }
    }
  }

  private async loadSettingsCache(): Promise<void> {
    try {
      const settings = await this.databaseManager.query('SELECT * FROM app_settings');
      for (const setting of settings) {
        const cacheKey = `${setting.category}.${setting.setting_key}`;
        const value = this.parseSettingValue(setting.setting_value, setting.setting_type);
        this.settingsCache.set(cacheKey, value);
      }
    } catch (error) {
      log.error('Failed to load settings cache:', error);
    }
  }

  private async loadPreferencesCache(): Promise<void> {
    try {
      const preferences = await this.databaseManager.query('SELECT * FROM user_preferences');
      for (const preference of preferences) {
        const cacheKey = `${preference.preference_group}.${preference.preference_key}`;
        const value = this.parseSettingValue(preference.preference_value, preference.preference_type);
        this.preferencesCache.set(cacheKey, value);
      }
    } catch (error) {
      log.error('Failed to load preferences cache:', error);
    }
  }

  private async updatePreferenceAccess(preferenceId: string): Promise<void> {
    try {
      await this.databaseManager.run(
        'UPDATE user_preferences SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
        [preferenceId]
      );
    } catch (error) {
      log.warn(`Failed to update preference access for ${preferenceId}:`, error);
    }
  }

  private parseSettingValue(value: string, type: string): any {
    switch (type) {
      case 'boolean':
        return value === 'true';
      case 'number':
        return parseFloat(value);
      case 'json':
      case 'array':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      default:
        return value;
    }
  }

  private stringifySettingValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  private inferSettingType(value: any): string {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'object') return Array.isArray(value) ? 'array' : 'json';
    return 'string';
  }

  private getDefaultSettings(): { [key: string]: any } {
    return {
      'appearance.theme_mode': 'auto',
      'appearance.font_size': 14,
      'appearance.compact_mode': false,
      'sync.auto_sync_enabled': true,
      'sync.sync_interval': 300,
      'notifications.show_notifications': true,
      'privacy.analytics_enabled': false,
      'advanced.debug_mode': false
    };
  }

  private getCategoryDisplayName(category: string): string {
    const displayNames: { [key: string]: string } = {
      'appearance': 'Appearance',
      'sync': 'Synchronization',
      'notifications': 'Notifications',
      'privacy': 'Privacy & Security',
      'advanced': 'Advanced'
    };
    return displayNames[category] || category;
  }

  private getCategoryDescription(category: string): string {
    const descriptions: { [key: string]: string } = {
      'appearance': 'Customize the look and feel of UnisonX',
      'sync': 'Configure data synchronization settings',
      'notifications': 'Manage notification preferences',
      'privacy': 'Control privacy and security settings',
      'advanced': 'Advanced configuration options'
    };
    return descriptions[category] || '';
  }

  private generateEncryptionKey(): Buffer {
    // In production, this should be derived from user credentials or stored securely
    return crypto.scryptSync('unisonx-encryption-key', 'salt', 32);
  }

  private encryptApiKey(apiKey: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  private decryptApiKey(encryptedKey: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length);
    return apiKey.substring(0, 4) + '*'.repeat(apiKey.length - 8) + apiKey.substring(apiKey.length - 4);
  }

  async cleanup(): Promise<void> {
    this.settingsCache.clear();
    this.preferencesCache.clear();
    log.info('SettingsService cleanup completed');
  }
}