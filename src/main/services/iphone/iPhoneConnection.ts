import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import log from 'electron-log';

const execAsync = promisify(exec);

export interface iPhoneDevice {
  udid: string;
  name: string;
  model: string;
  osVersion: string;
  deviceClass: string;
  serialNumber: string;
  batteryLevel: number;
  batteryState: 'Charging' | 'Unplugged' | 'Full';
  storageTotal: number;
  storageFree: number;
  trusted: boolean;
  paired: boolean;
}

export interface iPhoneFile {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedDate: Date;
}

export class iPhoneConnection extends EventEmitter {
  private devices: Map<string, iPhoneDevice> = new Map();
  private activeConnections: Map<string, any> = new Map();
  private monitoringProcess: any = null;

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    log.info('Initializing iPhone connection service with proper device detection');
    
    try {
      // Check for Apple support on Windows
      const hasSupport = await this.checkAppleSupport();
      if (!hasSupport) {
        log.warn('Apple Mobile Device Service not found. Please install iTunes or Apple Device Support.');
      }
      
      log.info('iPhone connection service initialized');
    } catch (error) {
      log.error('Failed to initialize iPhone connection:', error);
    }
  }

  private async checkAppleSupport(): Promise<boolean> {
    try {
      // Check for Apple Mobile Device Service on Windows
      const { stdout } = await execAsync('sc query "Apple Mobile Device Service"');
      return stdout.includes('RUNNING');
    } catch (error) {
      // Also check for iTunes installation
      const programFiles = [
        process.env['ProgramFiles'],
        process.env['ProgramFiles(x86)']
      ].filter(Boolean);

      for (const dir of programFiles) {
        const itunesPath = path.join(dir!, 'iTunes', 'iTunes.exe');
        if (fs.existsSync(itunesPath)) {
          return true;
        }
      }
      
      return false;
    }
  }

  async scanDevices(): Promise<iPhoneDevice[]> {
    try {
      log.info('Scanning for iPhone devices via libimobiledevice');
      
      // For now, return empty array until libimobiledevice is integrated
      // This will be implemented in Phase 2
      return [];
    } catch (error) {
      log.error('Error scanning for iPhone devices:', error);
      return [];
    }
  }

  // detectDevicesViaWMI method removed - scanning disabled to prevent flickering

  async connectDevice(udid: string): Promise<boolean> {
    try {
      const device = this.devices.get(udid);
      if (!device) {
        throw new Error('Device not found');
      }

      log.info(`Attempting to connect to device: ${device.name} (${udid})`);

      // Check if device is trusted - if not, try to pair it
      if (!device.trusted) {
        log.info(`Device ${udid} not trusted, attempting to pair...`);
        
        try {
          // Try to pair the device
          const { stdout } = await execAsync(`idevicepair -u ${udid} pair`, { timeout: 30000 });
          log.info(`Pairing result: ${stdout}`);
          
          // Wait a moment for pairing to complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Re-check trust status
          const newTrustStatus = await this.checkDeviceTrustStatus(udid);
          device.trusted = newTrustStatus.trusted;
          device.paired = newTrustStatus.paired;
          this.devices.set(udid, device);
          
          if (!device.trusted) {
            log.warn(`Device ${udid} still not trusted after pairing attempt`);
            this.emit('trust-required', device);
            return false;
          }
          
          log.info(`Device ${udid} successfully paired and trusted!`);
        } catch (pairError) {
          log.error(`Failed to pair device ${udid}:`, pairError);
          this.emit('trust-required', device);
          return false;
        }
      }

      // Create connection
      this.activeConnections.set(udid, { connected: true });
      
      // Update device as connected
      device.trusted = true;
      device.paired = true;
      this.devices.set(udid, device);
      
      // Start monitoring device status
      this.monitorDeviceStatus(udid);

      log.info(`Successfully connected to device: ${device.name} (${udid})`);
      this.emit('device-connected', device);
      return true;
    } catch (error) {
      log.error('Failed to connect device:', error);
      return false;
    }
  }

  async pairDevice(udid: string): Promise<boolean> {
    try {
      const device = this.devices.get(udid);
      if (!device) {
        throw new Error('Device not found');
      }

      log.info(`Attempting to pair device: ${device.name} (${udid})`);
      
      // Try to pair the device
      const { stdout } = await execAsync(`idevicepair -u ${udid} pair`, { timeout: 30000 });
      log.info(`Pairing result: ${stdout}`);
      
      // Wait for pairing to complete
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Re-check trust status
      const newTrustStatus = await this.checkDeviceTrustStatus(udid);
      device.trusted = newTrustStatus.trusted;
      device.paired = newTrustStatus.paired;
      this.devices.set(udid, device);
      
      if (device.trusted && device.paired) {
        log.info(`Device ${udid} successfully paired!`);
        this.emit('device-paired', device);
        this.emit('devices-updated', Array.from(this.devices.values()));
        return true;
      } else {
        log.warn(`Device ${udid} pairing may have failed - still not trusted`);
        return false;
      }
    } catch (error) {
      log.error(`Failed to pair device ${udid}:`, error);
      return false;
    }
  }

  async disconnectDevice(udid: string): Promise<boolean> {
    try {
      const connection = this.activeConnections.get(udid);
      if (!connection) {
        return false;
      }

      // Clean up connection
      this.activeConnections.delete(udid);
      
      const device = this.devices.get(udid);
      if (device) {
        this.emit('device-disconnected', device);
      }

      return true;
    } catch (error) {
      log.error('Failed to disconnect device:', error);
      return false;
    }
  }


  async getDeviceInfo(udid: string): Promise<iPhoneDevice | null> {
    try {
      let device = this.devices.get(udid);
      if (!device) {
        // Try to refresh device list
        await this.scanDevices();
        device = this.devices.get(udid);
      }

      if (!device) {
        return null;
      }

      // Update device info with latest data
      const updatedInfo = await this.queryDeviceInfo(udid);
      if (updatedInfo) {
        Object.assign(device, updatedInfo);
        this.devices.set(udid, device);
      }

      return device;
    } catch (error) {
      log.error('Failed to get device info:', error);
      return null;
    }
  }

  async listFiles(udid: string, dirPath: string = '/'): Promise<iPhoneFile[]> {
    try {
      const device = this.devices.get(udid);
      if (!device) {
        log.warn(`Device ${udid} not found in device list`);
        throw new Error('Device not found');
      }
      
      if (!device.trusted) {
        log.warn(`Device ${udid} not trusted, cannot access files`);
        throw new Error('Device not trusted - please trust the device on your iPhone');
      }

      log.info(`Listing files for device ${udid} at path: ${dirPath}`);

      // In a real implementation, this would use Windows Portable Device API or libimobiledevice
      // For now, return comprehensive mock file structure
      const mockFiles: iPhoneFile[] = [
        {
          name: 'DCIM',
          path: '/DCIM',
          size: 0,
          isDirectory: true,
          modifiedDate: new Date('2024-01-15'),
        },
        {
          name: 'Downloads',
          path: '/Downloads',
          size: 0,
          isDirectory: true,
          modifiedDate: new Date('2024-01-10'),
        },
        {
          name: 'Documents',
          path: '/Documents',
          size: 0,
          isDirectory: true,
          modifiedDate: new Date('2024-01-12'),
        },
        {
          name: 'IMG_001.jpg',
          path: '/DCIM/IMG_001.jpg',
          size: 2048576, // 2MB
          isDirectory: false,
          modifiedDate: new Date('2024-01-20'),
        },
        {
          name: 'Notes.txt',
          path: '/Documents/Notes.txt',
          size: 1024, // 1KB
          isDirectory: false,
          modifiedDate: new Date('2024-01-18'),
        },
        {
          name: 'Music',
          path: '/Music',
          size: 0,
          isDirectory: true,
          modifiedDate: new Date('2024-01-05'),
        },
      ];

      log.info(`Returning ${mockFiles.length} files/folders for device ${udid}`);
      return mockFiles;
    } catch (error) {
      log.error('Failed to list files:', error);
      return [];
    }
  }

  async transferFile(udid: string, sourcePath: string, destPath: string): Promise<boolean> {
    try {
      const device = this.devices.get(udid);
      if (!device || !device.trusted) {
        throw new Error('Device not connected or not trusted');
      }

      log.info(`Transferring file from ${sourcePath} to ${destPath}`);

      // Emit progress events
      this.emit('transfer-started', { udid, sourcePath, destPath });
      
      // Simulate file transfer
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        this.emit('transfer-progress', { udid, progress });
        
        if (progress >= 100) {
          clearInterval(progressInterval);
          this.emit('transfer-completed', { udid, sourcePath, destPath });
        }
      }, 500);

      return true;
    } catch (error) {
      log.error('Failed to transfer file:', error);
      this.emit('transfer-failed', { udid, error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  async getBackupPath(udid: string): Promise<string | null> {
    try {
      // Windows iTunes backup location
      const backupBasePath = path.join(
        process.env.APPDATA || '',
        'Apple Computer',
        'MobileSync',
        'Backup'
      );

      if (!fs.existsSync(backupBasePath)) {
        return null;
      }

      // Look for device backup folder (usually named with device UDID)
      const backupPath = path.join(backupBasePath, udid);
      if (fs.existsSync(backupPath)) {
        return backupPath;
      }

      // Check for hashed UDID (iTunes sometimes uses SHA1 of UDID)
      const crypto = require('crypto');
      const hashedUdid = crypto.createHash('sha1').update(udid).digest('hex');
      const hashedPath = path.join(backupBasePath, hashedUdid);
      
      if (fs.existsSync(hashedPath)) {
        return hashedPath;
      }

      return null;
    } catch (error) {
      log.error('Failed to get backup path:', error);
      return null;
    }
  }

  private startMonitoring(): void {
    log.info('🚫 ALL MONITORING COMPLETELY DISABLED TO STOP FLICKERING');
    // NO MONITORING - NO SCANNING - NO EVENTS
    return;
  }

  private stopMonitoring(): void {
    if (this.monitoringProcess) {
      clearInterval(this.monitoringProcess);
      this.monitoringProcess = null;
    }
    log.info('Stopped device monitoring');
  }

  private monitorDeviceStatus(udid: string): void {
    const statusInterval = setInterval(() => {
      const device = this.devices.get(udid);
      const connection = this.activeConnections.get(udid);
      
      if (!device || !connection) {
        clearInterval(statusInterval);
        return;
      }

      // Update device status (battery, storage, etc.)
      this.queryDeviceStatus(udid).then(status => {
        if (status) {
          Object.assign(device, status);
          this.devices.set(udid, device);
          this.emit('device-status-updated', device);
        }
      });
    }, 10000); // Update every 10 seconds
  }

  private async queryDeviceInfo(_udid: string): Promise<Partial<iPhoneDevice> | null> {
    // In a real implementation, this would query device info via native APIs
    // For now, return mock updated info
    return {
      batteryLevel: Math.floor(Math.random() * 100),
      batteryState: ['Charging', 'Unplugged', 'Full'][Math.floor(Math.random() * 3)] as any,
      storageFree: Math.floor(Math.random() * 64) * 1024 * 1024 * 1024,
    };
  }

  private async queryDeviceStatus(udid: string): Promise<Partial<iPhoneDevice> | null> {
    return this.queryDeviceInfo(udid);
  }

  // extractUDID method removed - not used since scanning is disabled

  // extractModel method removed - not used since scanning is disabled

  // extractSerial method removed - not used since scanning is disabled

  // cleanDeviceName method removed - not used since scanning is disabled

  private async checkDeviceTrustStatus(udid: string): Promise<{ trusted: boolean; paired: boolean }> {
    try {
      // Method 1: Try to get list of connected devices using idevice_id  
      try {
        const { stdout } = await execAsync('idevice_id -l', { timeout: 5000 });
        const connectedDevices = stdout.trim().split('\n').filter(id => id.length > 0);
        
        if (connectedDevices.includes(udid)) {
          log.info(`Device ${udid} found in idevice_id list - attempting info query`);
          
          // Try to get device info - this will fail if device is not trusted
          try {
            const { stdout: deviceInfo } = await execAsync(`ideviceinfo -u ${udid} -k DeviceName`, { timeout: 10000 });
            if (deviceInfo.trim().length > 0) {
              log.info(`Device ${udid} is trusted and accessible`);
              return { trusted: true, paired: true };
            }
          } catch (infoError) {
            log.info(`Device ${udid} detected but not trusted (ideviceinfo failed)`);
            return { trusted: false, paired: false };
          }
        }
      } catch (listError) {
        log.debug('idevice_id command failed:', listError);
      }

      // Method 2: Try idevicepair to check pairing status
      try {
        const { stdout } = await execAsync(`idevicepair -u ${udid} validate`, { timeout: 5000 });
        if (stdout.includes('SUCCESS')) {
          log.info(`Device ${udid} is paired (idevicepair success)`);
          return { trusted: true, paired: true };
        }
      } catch (pairError) {
        log.debug(`idevicepair failed for ${udid}:`, pairError);
      }

      // Method 3: For development, if device appears in USB but can't be accessed,
      // show it as detected but not trusted
      log.info(`Device ${udid} detected via USB but not trusted/paired`);
      return { trusted: false, paired: false };
      
    } catch (error) {
      log.error('Error checking device trust status:', error);
      return { trusted: false, paired: false };
    }
  }

  cleanup(): void {
    this.stopMonitoring();
    
    // Disconnect all devices
    for (const udid of this.activeConnections.keys()) {
      this.disconnectDevice(udid);
    }
    
    this.devices.clear();
    this.activeConnections.clear();
  }
}