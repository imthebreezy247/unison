import { EventEmitter } from 'events';
import log from 'electron-log';
import { PhoneLinkBridge } from './PhoneLinkBridge';
import { DatabaseManager } from '../database/DatabaseManager';

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'phone-link';
  model: string;
  osVersion?: string;
  connected: boolean;
  connectionType: 'phone-link' | 'disconnected';
  lastSeen: string;
  trusted: boolean;
  paired: boolean;
}

/**
 * Simplified DeviceManager using ONLY Phone Link bridge
 * No more iTunes, libimobiledevice, USB, or WMI complexity
 */
export class DeviceManager extends EventEmitter {
  private devices: Map<string, DeviceInfo> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private connectedDevices: Set<string> = new Set();
  private phoneLinkBridge: PhoneLinkBridge;
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    super();
    this.databaseManager = databaseManager;
    this.phoneLinkBridge = new PhoneLinkBridge();
  }

  async initialize(): Promise<void> {
    log.info('🔗 Initializing DeviceManager with Phone Link bridge');
    
    try {
      // Start Phone Link status monitoring
      this.startScanning();
      
      log.info('✅ DeviceManager initialized with Phone Link');
    } catch (error) {
      log.error('Failed to initialize DeviceManager:', error);
      throw error;
    }
  }

  private async checkPhoneLinkConnection(): Promise<boolean> {
    try {
      return await this.phoneLinkBridge.isPhoneLinkRunning();
    } catch (error) {
      log.debug('Error checking Phone Link connection:', error);
      return false;
    }
  }

  async scanForDevices(): Promise<DeviceInfo[]> {
    try {
      log.debug('🔍 Checking Phone Link connection status');
      
      const isPhoneLinkConnected = await this.checkPhoneLinkConnection();
      
      if (isPhoneLinkConnected) {
        const device: DeviceInfo = {
          id: 'phone-link-device',
          name: 'iPhone via Phone Link',
          type: 'phone-link',
          model: 'iPhone',
          osVersion: 'iOS',
          connected: true,
          connectionType: 'phone-link',
          lastSeen: new Date().toISOString(),
          trusted: true,
          paired: true
        };
        
        this.devices.clear();
        this.devices.set(device.id, device);
        this.emit('devices-updated', [device]);
        
        return [device];
      } else {
        this.devices.clear();
        this.emit('devices-updated', []);
        return [];
      }
    } catch (error) {
      log.error('Error checking Phone Link status:', error);
      return [];
    }
  }

  startScanning(): void {
    log.info('📱 Starting Phone Link status monitoring');
    
    // Initial scan
    this.scanForDevices();
    
    // Set up periodic scanning with longer interval
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }
    
    this.scanInterval = setInterval(() => {
      this.scanForDevices();
    }, 10000); // Check every 10 seconds
  }

  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    log.info('Stopped Phone Link monitoring');
  }

  async connectDevice(deviceId: string): Promise<boolean> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (!deviceInfo) {
        log.error(`Device not found: ${deviceId}`);
        return false;
      }

      log.info(`🔗 Connecting to ${deviceInfo.name} via Phone Link`);

      // Phone Link devices are always "connected" if detected
      const isConnected = await this.checkPhoneLinkConnection();

      if (isConnected) {
        deviceInfo.connected = true;
        deviceInfo.connectionType = 'phone-link';
        deviceInfo.lastSeen = new Date().toISOString();
        this.connectedDevices.add(deviceId);
        
        this.devices.set(deviceId, deviceInfo);
        
        log.info(`✅ Connected to ${deviceInfo.name} via Phone Link`);
        return true;
      } else {
        log.error(`❌ Phone Link not available`);
        return false;
      }
    } catch (error) {
      log.error('Error connecting to device:', error);
      return false;
    }
  }

  async pairDevice(deviceId: string): Promise<boolean> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (!deviceInfo) {
        log.error(`Device not found: ${deviceId}`);
        return false;
      }

      log.info(`🤝 Pairing ${deviceInfo.name} via Phone Link`);

      // Phone Link handles pairing automatically
      const isConnected = await this.checkPhoneLinkConnection();

      if (isConnected) {
        deviceInfo.paired = true;
        deviceInfo.trusted = true;
        this.devices.set(deviceId, deviceInfo);
        
        log.info(`✅ Device paired via Phone Link`);
        return true;
      } else {
        log.error(`❌ Phone Link not available for pairing`);
        return false;
      }
    } catch (error) {
      log.error('Error pairing device:', error);
      return false;
    }
  }

  async disconnectDevice(deviceId: string): Promise<boolean> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (!deviceInfo) {
        log.error(`Device not found: ${deviceId}`);
        return false;
      }

      log.info(`🔌 Disconnecting from ${deviceInfo.name}`);

      // For Phone Link, we just mark as disconnected
      deviceInfo.connected = false;
      deviceInfo.connectionType = 'disconnected';
      this.connectedDevices.delete(deviceId);
      
      this.devices.set(deviceId, deviceInfo);
      
      log.info(`✅ Disconnected from ${deviceInfo.name}`);
      return true;
    } catch (error) {
      log.error('Error disconnecting from device:', error);
      return false;
    }
  }

  async transferFile(source: string, destination: string): Promise<boolean> {
    try {
      log.info(`📁 File transfer via Phone Link not yet implemented`);
      log.info(`Requested: ${source} to ${destination}`);
      
      // TODO: Implement file transfer via Phone Link APIs when available
      // For now, return false to indicate not supported
      return false;
    } catch (error) {
      log.error('File transfer failed:', error);
      return false;
    }
  }

  getConnectedDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).filter(device => device.connected);
  }

  getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId);
  }

  async getDeviceFiles(deviceId: string, path: string = '/'): Promise<any[]> {
    log.info(`📁 File browsing via Phone Link not yet implemented`);
    return [];
  }

  cleanup(): void {
    this.stopScanning();
    if (this.phoneLinkBridge) {
      this.phoneLinkBridge.cleanup();
    }
  }
}