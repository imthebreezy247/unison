import { app, BrowserWindow, ipcMain, Menu, Tray, shell } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import { DatabaseManager } from './database/DatabaseManager';
import { DeviceManager } from './services/DeviceManager';
import { NotificationManager } from './services/NotificationManager';
import { ContactSyncService } from './services/ContactSyncService';
import { ContactImportExportService } from './services/ContactImportExportService';
import { MessageSyncService } from './services/MessageSyncService';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class UnisonXApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private databaseManager: DatabaseManager;
  private deviceManager: DeviceManager;
  private notificationManager: NotificationManager;
  private contactSyncService: ContactSyncService;
  private contactImportExportService: ContactImportExportService;
  private messageSyncService: MessageSyncService;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.deviceManager = new DeviceManager(this.databaseManager);
    this.notificationManager = new NotificationManager();
    this.contactSyncService = new ContactSyncService(this.databaseManager);
    this.contactImportExportService = new ContactImportExportService(this.databaseManager);
    this.messageSyncService = new MessageSyncService(this.databaseManager);
    
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
    app.on('before-quit', () => {
      this.cleanup();
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
    if (process.env.NODE_ENV === 'development') {
      this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools();
    } else {
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
      this.tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));
      
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
  }

  private async initializeServices(): Promise<void> {
    try {
      // Initialize database
      await this.databaseManager.initialize();
      log.info('Database initialized successfully');

      // Initialize device manager
      await this.deviceManager.initialize();
      log.info('Device manager initialized successfully');

      // Initialize notification manager
      await this.notificationManager.initialize();
      log.info('Notification manager initialized successfully');

      // Initialize contact sync service
      await this.contactSyncService.initialize();
      log.info('Contact sync service initialized successfully');

      // Initialize message sync service
      await this.messageSyncService.initialize();
      log.info('Message sync service initialized successfully');

      // Start device scanning
      this.deviceManager.startScanning();
      log.info('Device scanning started');

    } catch (error) {
      log.error('Failed to initialize services:', error);
    }
  }

  private cleanup(): void {
    try {
      this.deviceManager.stopScanning();
      this.contactSyncService.cleanup();
      this.messageSyncService.cleanup();
      this.databaseManager.close();
      log.info('UnisonX cleanup completed');
    } catch (error) {
      log.error('Error during cleanup:', error);
    }
  }
}

// Create and start the application
new UnisonXApp();