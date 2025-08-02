import { app, BrowserWindow, ipcMain, Menu, Tray, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import { DatabaseManager } from './database/DatabaseManager';
import { DirectiPhoneManager } from './services/DirectiPhoneManager';
import { NotificationManager } from './services/NotificationManager';
import { ContactSyncService } from './services/ContactSyncService';
import { ContactImportExportService } from './services/ContactImportExportService';
import { MessageSyncService } from './services/MessageSyncService';
import { CallLogService } from './services/CallLogService';
import { FileManagerService } from './services/FileManagerService';
import { SettingsService } from './services/SettingsService';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class UnisonXApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private databaseManager: DatabaseManager;
  private deviceManager: DirectiPhoneManager;
  private notificationManager: NotificationManager;
  private contactSyncService: ContactSyncService;
  private contactImportExportService: ContactImportExportService;
  private messageSyncService: MessageSyncService;
  private callLogService: CallLogService;
  private fileManagerService: FileManagerService;
  private settingsService: SettingsService;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.deviceManager = new DirectiPhoneManager();
    this.notificationManager = new NotificationManager();
    this.contactSyncService = new ContactSyncService(this.databaseManager);
    this.contactImportExportService = new ContactImportExportService(this.databaseManager);
    this.messageSyncService = new MessageSyncService(this.databaseManager);
    this.callLogService = new CallLogService(this.databaseManager);
    this.fileManagerService = new FileManagerService(this.databaseManager);
    this.settingsService = new SettingsService(this.databaseManager);
    
    this.initializeApp();
  }

  private initializeApp(): void {
    // Handle app ready
    app.whenReady().then(() => {
      this.createMainWindow();
      this.setupIPC();
      this.setupSystemTray();
      this.initializeServices();
      
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          this.createMainWindow();
        }
      });
    });

    // Handle app window closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle before quit
    app.on('before-quit', async () => {
      await this.cleanup();
    });
  }

  private createMainWindow(): void {
    this.mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1200,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true
      },
      titleBarStyle: 'default',
      icon: path.join(__dirname, '../../assets/icon.png'),
      show: false
    });

    // Load the app
    if (!app.isPackaged) {
      // Development mode
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
      // Production mode - point to the correct renderer folder
      this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
      log.info('UnisonX main window shown');
    });

    // Handle external links
    this.mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private setupSystemTray(): void {
    if (process.platform === 'win32') {
      try {
        // Try to load tray icon, fallback to nativeImage if file doesn't exist
        const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
        if (fs.existsSync(iconPath)) {
          this.tray = new Tray(iconPath);
        } else {
          // Create a simple tray icon programmatically
          const { nativeImage } = require('electron');
          const icon = nativeImage.createEmpty();
          this.tray = new Tray(icon);
        }
      } catch (error) {
        log.warn('Failed to create system tray:', error);
        return;
      }
      
      const contextMenu = Menu.buildFromTemplate([
        {
          label: 'Open UnisonX',
          click: () => {
            this.mainWindow?.show();
            this.mainWindow?.focus();
          }
        },
        {
          label: 'Device Status',
          click: () => {
            // Show device status
          }
        },
        { type: 'separator' },
        {
          label: 'Quit',
          click: () => {
            app.quit();
          }
        }
      ]);

      this.tray.setContextMenu(contextMenu);
      this.tray.setToolTip('UnisonX - iPhone Integration');
      
      this.tray.on('click', () => {
        this.mainWindow?.show();
        this.mainWindow?.focus();
      });
    }
  }

  private setupIPC(): void {
    // Database operations
    ipcMain.handle('db:query', async (event, query: string, params?: any[]) => {
      try {
        return await this.databaseManager.query(query, params);
      } catch (error) {
        log.error('Database query error:', error);
        throw error;
      }
    });

    ipcMain.handle('db:run', async (event, query: string, params?: any[]) => {
      try {
        return await this.databaseManager.run(query, params);
      } catch (error) {
        log.error('Database run error:', error);
        throw error;
      }
    });

    // Device management
    ipcMain.handle('device:scan', async () => {
      try {
        return await this.deviceManager.scanForDevices();
      } catch (error) {
        log.error('Device scan error:', error);
        throw error;
      }
    });

    ipcMain.handle('device:connect', async (event, deviceId: string) => {
      try {
        return await this.deviceManager.connectDevice(deviceId);
      } catch (error) {
        log.error('Device connect error:', error);
        throw error;
      }
    });

    ipcMain.handle('device:disconnect', async (event, deviceId: string) => {
      try {
        return await this.deviceManager.disconnectDevice(deviceId);
      } catch (error) {
        log.error('Device disconnect error:', error);
        throw error;
      }
    });

    ipcMain.handle('device:pair', async (event, deviceId: string) => {
      try {
        return await this.deviceManager.pairDevice(deviceId);
      } catch (error) {
        log.error('Device pair error:', error);
        throw error;
      }
    });

    ipcMain.handle('device:status', async (event, deviceId: string) => {
      try {
        return this.deviceManager.getDevice(deviceId);
      } catch (error) {
        log.error('Device status error:', error);
        throw error;
      }
    });

    ipcMain.handle('device:files', async (event, deviceId: string, path?: string) => {
      try {
        return await this.deviceManager.getDeviceFiles(deviceId, path);
      } catch (error) {
        log.error('Device files error:', error);
        throw error;
      }
    });

    // File operations
    ipcMain.handle('file:transfer', async (event, source: string, destination: string) => {
      try {
        return await this.deviceManager.transferFile(source, destination);
      } catch (error) {
        log.error('File transfer error:', error);
        throw error;
      }
    });

    // System operations
    ipcMain.handle('system:minimize', () => {
      this.mainWindow?.minimize();
    });

    ipcMain.handle('system:close', () => {
      this.mainWindow?.hide();
    });

    ipcMain.handle('system:quit', () => {
      app.quit();
    });

    // Version information handlers
    ipcMain.handle('system:get-version', () => {
      return app.getVersion();
    });

    ipcMain.on('system:get-versions', (event) => {
      event.returnValue = {
        node: process.versions.node,
        electron: process.versions.electron,
        chrome: process.versions.chrome,
      };
    });

    // Debug iPhone connection
    ipcMain.handle('debug:run-iphone-diagnostics', async () => {
      try {
        const { iPhoneDebugger } = await import('./debug-iphone-connection');
        const diagnostics = new iPhoneDebugger();
        const debugInfo = await diagnostics.collectFullDebugInfo();
        
        // Also test Chris's specific iPhone
        await diagnostics.testSpecificDevice('00008101-000120620AE9001E');
        
        return debugInfo;
      } catch (error) {
        log.error('Debug iPhone diagnostics error:', error);
        throw error;
      }
    });

    // Logging
    ipcMain.handle('log:info', (event, message: string) => {
      log.info(`[Renderer] ${message}`);
    });

    ipcMain.handle('log:error', (event, message: string, error?: any) => {
      log.error(`[Renderer] ${message}`, error);
    });

    // Contact operations
    ipcMain.handle('contacts:sync', async (event, deviceId: string, backupPath?: string) => {
      try {
        return await this.contactSyncService.syncContactsFromDevice(deviceId, backupPath);
      } catch (error) {
        log.error('Contact sync error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:search', async (event, query: string, filters?: any) => {
      try {
        return await this.contactSyncService.searchContacts(query, filters);
      } catch (error) {
        log.error('Contact search error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:update', async (event, contact: any) => {
      try {
        return await this.contactSyncService.updateContact(contact);
      } catch (error) {
        log.error('Contact update error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:delete', async (event, contactId: string) => {
      try {
        return await this.contactSyncService.deleteContact(contactId);
      } catch (error) {
        log.error('Contact delete error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:favorite', async (event, contactId: string) => {
      try {
        return await this.contactSyncService.addToFavorites(contactId);
      } catch (error) {
        log.error('Contact favorite error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:unfavorite', async (event, contactId: string) => {
      try {
        return await this.contactSyncService.removeFromFavorites(contactId);
      } catch (error) {
        log.error('Contact unfavorite error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:get-favorites', async () => {
      try {
        return await this.contactSyncService.getFavoriteContacts();
      } catch (error) {
        log.error('Get favorite contacts error:', error);
        throw error;
      }
    });

    // Contact group operations
    ipcMain.handle('contacts:get-groups', async () => {
      try {
        return await this.databaseManager.query('SELECT * FROM contact_groups ORDER BY name');
      } catch (error) {
        log.error('Get contact groups error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:create-group', async (event, groupData: { name: string; color: string }) => {
      try {
        const groupId = `group-${Date.now()}`;
        await this.databaseManager.run(
          'INSERT INTO contact_groups (id, name, color) VALUES (?, ?, ?)',
          [groupId, groupData.name, groupData.color]
        );
        return { id: groupId, ...groupData };
      } catch (error) {
        log.error('Create contact group error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:add-to-group', async (event, contactId: string, groupId: string) => {
      try {
        await this.databaseManager.run(
          'INSERT OR IGNORE INTO contact_group_memberships (contact_id, group_id) VALUES (?, ?)',
          [contactId, groupId]
        );
        return true;
      } catch (error) {
        log.error('Add contact to group error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:remove-from-group', async (event, contactId: string, groupId: string) => {
      try {
        await this.databaseManager.run(
          'DELETE FROM contact_group_memberships WHERE contact_id = ? AND group_id = ?',
          [contactId, groupId]
        );
        return true;
      } catch (error) {
        log.error('Remove contact from group error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:get-group-members', async (event, groupId: string) => {
      try {
        return await this.databaseManager.query(`
          SELECT c.* FROM contacts c
          JOIN contact_group_memberships cgm ON c.id = cgm.contact_id
          WHERE cgm.group_id = ?
          ORDER BY c.display_name
        `, [groupId]);
      } catch (error) {
        log.error('Get group members error:', error);
        throw error;
      }
    });

    // Contact import/export operations
    ipcMain.handle('contacts:export-csv', async () => {
      try {
        const contacts = await this.databaseManager.query('SELECT * FROM contacts ORDER BY display_name');
        return await this.contactImportExportService.exportToCSV(contacts);
      } catch (error) {
        log.error('CSV export error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:export-vcard', async () => {
      try {
        const contacts = await this.databaseManager.query('SELECT * FROM contacts ORDER BY display_name');
        return await this.contactImportExportService.exportToVCard(contacts);
      } catch (error) {
        log.error('vCard export error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:import-csv', async () => {
      try {
        return await this.contactImportExportService.importFromCSV();
      } catch (error) {
        log.error('CSV import error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:import-vcard', async () => {
      try {
        return await this.contactImportExportService.importFromVCard();
      } catch (error) {
        log.error('vCard import error:', error);
        throw error;
      }
    });

    ipcMain.handle('contacts:export-selected', async (event, contactIds: string[], format: 'csv' | 'vcard') => {
      try {
        const placeholders = contactIds.map(() => '?').join(',');
        const contacts = await this.databaseManager.query(
          `SELECT * FROM contacts WHERE id IN (${placeholders}) ORDER BY display_name`,
          contactIds
        );
        
        if (format === 'csv') {
          return await this.contactImportExportService.exportToCSV(contacts);
        } else {
          return await this.contactImportExportService.exportToVCard(contacts);
        }
      } catch (error) {
        log.error('Selected contacts export error:', error);
        throw error;
      }
    });

    // Message operations
    ipcMain.handle('messages:sync', async (event, deviceId: string, backupPath?: string) => {
      try {
        return await this.messageSyncService.syncMessagesFromDevice(deviceId, backupPath);
      } catch (error) {
        log.error('Message sync error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:get-threads', async (event, limit: number = 50, offset: number = 0) => {
      try {
        return await this.messageSyncService.getMessageThreads(limit, offset);
      } catch (error) {
        log.error('Get message threads error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:get-thread-messages', async (event, threadId: string, limit: number = 100, offset: number = 0) => {
      try {
        return await this.messageSyncService.getThreadMessages(threadId, limit, offset);
      } catch (error) {
        log.error('Get thread messages error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:mark-as-read', async (event, threadId: string) => {
      try {
        await this.messageSyncService.markMessagesAsRead(threadId);
        return true;
      } catch (error) {
        log.error('Mark messages as read error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:send', async (event, threadId: string, content: string, messageType: 'sms' | 'imessage' = 'sms') => {
      try {
        return await this.messageSyncService.sendMessage(threadId, content, messageType);
      } catch (error) {
        log.error('Send message error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:search', async (event, query: string, limit: number = 50) => {
      try {
        return await this.messageSyncService.searchMessages(query, limit);
      } catch (error) {
        log.error('Search messages error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:get-stats', async () => {
      try {
        return await this.messageSyncService.getMessageStats();
      } catch (error) {
        log.error('Get message stats error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:get-detailed-stats', async () => {
      try {
        return await this.messageSyncService.getDetailedStats();
      } catch (error) {
        log.error('Get detailed message stats error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:export', async (event, threadId?: string, format: 'json' | 'csv' | 'txt' = 'json') => {
      try {
        return await this.messageSyncService.exportMessages(threadId, format);
      } catch (error) {
        log.error('Export messages error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:archive-thread', async (event, threadId: string, archived: boolean = true) => {
      try {
        await this.messageSyncService.archiveThread(threadId, archived);
        return true;
      } catch (error) {
        log.error('Archive thread error:', error);
        throw error;
      }
    });

    ipcMain.handle('messages:import-backup', async (event, deviceId?: string) => {
      try {
        log.info('Starting iTunes backup import');
        const result = await this.messageSyncService.importFromBackup(deviceId);
        return result;
      } catch (error) {
        log.error('Backup import failed:', error);
        throw error;
      }
    });

    // Call log operations
    ipcMain.handle('calls:sync', async (event, deviceId: string, backupPath?: string) => {
      try {
        return await this.callLogService.syncCallLogsFromDevice(deviceId, backupPath);
      } catch (error) {
        log.error('Call log sync error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:get-logs', async (event, limit: number = 50, offset: number = 0, filters?: any) => {
      try {
        return await this.callLogService.getCallLogs(limit, offset, filters);
      } catch (error) {
        log.error('Get call logs error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:initiate', async (event, phoneNumber: string, callType: 'voice' | 'video' | 'facetime' = 'voice') => {
      try {
        return await this.callLogService.initiateCall(phoneNumber, callType);
      } catch (error) {
        log.error('Initiate call error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:end', async (event, callId: string) => {
      try {
        return await this.callLogService.endCall(callId);
      } catch (error) {
        log.error('End call error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:get-active', async () => {
      try {
        return this.callLogService.getActiveCalls();
      } catch (error) {
        log.error('Get active calls error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:add-notes', async (event, callId: string, notes: string) => {
      try {
        return await this.callLogService.addCallNotes(callId, notes);
      } catch (error) {
        log.error('Add call notes error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:get-statistics', async () => {
      try {
        return await this.callLogService.getCallStatistics();
      } catch (error) {
        log.error('Get call statistics error:', error);
        throw error;
      }
    });

    ipcMain.handle('calls:export', async (event, format: 'json' | 'csv' | 'txt' = 'csv') => {
      try {
        return await this.callLogService.exportCallLogs(format);
      } catch (error) {
        log.error('Export call logs error:', error);
        throw error;
      }
    });

    // File manager operations
    ipcMain.handle('files:start-transfer', async (event, transferRequest: any) => {
      try {
        return await this.fileManagerService.startTransfer(transferRequest);
      } catch (error) {
        log.error('Start transfer error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:get-transfers', async (event, limit?: number, offset?: number, filters?: any) => {
      try {
        return await this.fileManagerService.getTransfers(limit, offset, filters);
      } catch (error) {
        log.error('Get transfers error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:get-active-transfers', async () => {
      try {
        return this.fileManagerService.getActiveTransfers();
      } catch (error) {
        log.error('Get active transfers error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:pause-transfer', async (event, transferId: string) => {
      try {
        return await this.fileManagerService.pauseTransfer(transferId);
      } catch (error) {
        log.error('Pause transfer error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:resume-transfer', async (event, transferId: string) => {
      try {
        return await this.fileManagerService.resumeTransfer(transferId);
      } catch (error) {
        log.error('Resume transfer error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:cancel-transfer', async (event, transferId: string) => {
      try {
        return await this.fileManagerService.cancelTransfer(transferId);
      } catch (error) {
        log.error('Cancel transfer error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:get-statistics', async () => {
      try {
        return await this.fileManagerService.getTransferStatistics();
      } catch (error) {
        log.error('Get file statistics error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:export', async (event, format: 'json' | 'csv' | 'txt' = 'json') => {
      try {
        return await this.fileManagerService.exportTransfers(format);
      } catch (error) {
        log.error('Export transfers error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:create-folder', async (event, folderData: any) => {
      try {
        return await this.fileManagerService.createFolder(folderData);
      } catch (error) {
        log.error('Create folder error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:get-folders', async () => {
      try {
        return await this.fileManagerService.getFolders();
      } catch (error) {
        log.error('Get folders error:', error);
        throw error;
      }
    });

    ipcMain.handle('files:add-to-folder', async (event, transferId: string, folderId: string) => {
      try {
        return await this.fileManagerService.addFileToFolder(transferId, folderId);
      } catch (error) {
        log.error('Add to folder error:', error);
        throw error;
      }
    });

    // Settings and preferences operations
    ipcMain.handle('settings:get', async (event, category: string, key: string, defaultValue?: any) => {
      try {
        return await this.settingsService.getSetting(category, key, defaultValue);
      } catch (error) {
        log.error('Get setting error:', error);
        throw error;
      }
    });

    ipcMain.handle('settings:set', async (event, category: string, key: string, value: any, settingType?: string) => {
      try {
        return await this.settingsService.setSetting(category, key, value, settingType);
      } catch (error) {
        log.error('Set setting error:', error);
        throw error;
      }
    });

    ipcMain.handle('settings:get-category', async (event, category: string) => {
      try {
        return await this.settingsService.getSettingsByCategory(category);
      } catch (error) {
        log.error('Get settings category error:', error);
        throw error;
      }
    });

    ipcMain.handle('settings:get-all', async () => {
      try {
        return await this.settingsService.getAllSettings();
      } catch (error) {
        log.error('Get all settings error:', error);
        throw error;
      }
    });

    ipcMain.handle('preferences:get', async (event, group: string, key: string, defaultValue?: any) => {
      try {
        return await this.settingsService.getPreference(group, key, defaultValue);
      } catch (error) {
        log.error('Get preference error:', error);
        throw error;
      }
    });

    ipcMain.handle('preferences:set', async (event, group: string, key: string, value: any, isSynced?: boolean) => {
      try {
        return await this.settingsService.setPreference(group, key, value, isSynced);
      } catch (error) {
        log.error('Set preference error:', error);
        throw error;
      }
    });

    ipcMain.handle('themes:get-all', async () => {
      try {
        return await this.settingsService.getThemes();
      } catch (error) {
        log.error('Get themes error:', error);
        throw error;
      }
    });

    ipcMain.handle('themes:get-active', async () => {
      try {
        return await this.settingsService.getActiveTheme();
      } catch (error) {
        log.error('Get active theme error:', error);
        throw error;
      }
    });

    ipcMain.handle('themes:set-active', async (event, themeId: string) => {
      try {
        return await this.settingsService.setActiveTheme(themeId);
      } catch (error) {
        log.error('Set active theme error:', error);
        throw error;
      }
    });

    ipcMain.handle('themes:create-custom', async (event, themeData: any) => {
      try {
        return await this.settingsService.createCustomTheme(themeData);
      } catch (error) {
        log.error('Create custom theme error:', error);
        throw error;
      }
    });

    ipcMain.handle('crm:get-integrations', async () => {
      try {
        return await this.settingsService.getCrmIntegrations();
      } catch (error) {
        log.error('Get CRM integrations error:', error);
        throw error;
      }
    });

    ipcMain.handle('crm:create-integration', async (event, integrationData: any) => {
      try {
        return await this.settingsService.createCrmIntegration(integrationData);
      } catch (error) {
        log.error('Create CRM integration error:', error);
        throw error;
      }
    });

    ipcMain.handle('crm:update-integration', async (event, integrationId: string, updateData: any) => {
      try {
        return await this.settingsService.updateCrmIntegration(integrationId, updateData);
      } catch (error) {
        log.error('Update CRM integration error:', error);
        throw error;
      }
    });

    ipcMain.handle('backup:create', async (event, backupType: string, options?: any) => {
      try {
        const validBackupTypes = ['full', 'settings', 'data', 'incremental'] as const;
        if (!validBackupTypes.includes(backupType as any)) {
          throw new Error(`Invalid backup type: ${backupType}`);
        }
        return await this.settingsService.createBackup(backupType as 'full' | 'settings' | 'data' | 'incremental', options);
      } catch (error) {
        log.error('Create backup error:', error);
        throw error;
      }
    });

    ipcMain.handle('backup:restore', async (event, backupId: string) => {
      try {
        return await this.settingsService.restoreBackup(backupId);
      } catch (error) {
        log.error('Restore backup error:', error);
        throw error;
      }
    });

    ipcMain.handle('backup:get-all', async () => {
      try {
        return await this.settingsService.getBackups();
      } catch (error) {
        log.error('Get backups error:', error);
        throw error;
      }
    });
  }

  private setupDeviceManagerEvents(): void {
    // Forward device manager events to renderer process
    this.deviceManager.on('devices-updated', (devices) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('devices-updated', devices);
      }
    });

    this.deviceManager.on('device-connected', (device) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('device-connected', device);
      }
    });

    this.deviceManager.on('device-disconnected', (device) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('device-disconnected', device);
      }
    });

    this.deviceManager.on('device-status-updated', (device) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('device-status-updated', device);
      }
    });

    this.deviceManager.on('trust-required', (device) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('trust-required', device);
      }
    });

    this.deviceManager.on('pairing-requested', (device) => {
      if (this.mainWindow) {
        this.mainWindow.webContents.send('pairing-requested', device);
      }
    });
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize database
      await this.databaseManager.initialize();
      log.info('Database initialized successfully');

      // Initialize device manager
      await this.deviceManager.initialize();
      log.info('Device manager initialized successfully');

      // Set up device manager event forwarding
      this.setupDeviceManagerEvents();

      // Initialize notification manager
      await this.notificationManager.initialize();
      log.info('Notification manager initialized successfully');

      // Initialize contact sync service
      await this.contactSyncService.initialize();
      log.info('Contact sync service initialized successfully');

      // Initialize message sync service
      await this.messageSyncService.initialize();
      log.info('Message sync service initialized successfully');

      // Initialize call log service
      await this.callLogService.initialize();
      log.info('Call log service initialized successfully');

      // Initialize file manager service
      await this.fileManagerService.initialize();
      log.info('File manager service initialized successfully');

      // Initialize settings service
      await this.settingsService.initialize();
      log.info('Settings service initialized successfully');

      // DirectiPhoneManager automatically starts scanning during initialization
      log.info('DirectiPhoneManager scanning started automatically');

    } catch (error) {
      log.error('Failed to initialize services:', error);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.deviceManager.cleanup();
      this.contactSyncService.cleanup();
      this.messageSyncService.cleanup();
      this.callLogService.cleanup();
      this.fileManagerService.cleanup();
      this.settingsService.cleanup();
      this.databaseManager.close();
      log.info('UnisonX cleanup completed');
    } catch (error) {
      log.error('Error during cleanup:', error);
    }
  }
}

// Create and start the application
new UnisonXApp();