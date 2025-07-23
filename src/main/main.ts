import { app, BrowserWindow, ipcMain, Menu, Tray, shell } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import log from 'electron-log';
import { DatabaseManager } from './database/DatabaseManager';
import { DeviceManager } from './services/DeviceManager';
import { NotificationManager } from './services/NotificationManager';

// Configure logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';

class UnisonXApp {
  private mainWindow: BrowserWindow | null = null;
  private tray: Tray | null = null;
  private databaseManager: DatabaseManager;
  private deviceManager: DeviceManager;
  private notificationManager: NotificationManager;

  constructor() {
    this.databaseManager = new DatabaseManager();
    this.deviceManager = new DeviceManager();
    this.notificationManager = new NotificationManager();
    
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
      this.databaseManager.close();
      log.info('UnisonX cleanup completed');
    } catch (error) {
      log.error('Error during cleanup:', error);
    }
  }
}

// Create and start the application
new UnisonXApp();