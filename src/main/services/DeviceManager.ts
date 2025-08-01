import { EventEmitter } from 'events';
import * as usb from 'usb';
import * as path from 'path';
import log from 'electron-log';
import { iPhoneConnection, iPhoneDevice } from './iphone/iPhoneConnection';
import { BackupParser } from './iphone/BackupParser';
import { DatabaseManager } from '../database/DatabaseManager';

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'iPhone' | 'iPad';
  model: string;
  osVersion: string;
  connected: boolean;
  batteryLevel?: number;
  connectionType: 'usb' | 'wifi' | 'disconnected';
  lastSeen: string;
  vendorId?: number;
  productId?: number;
  trusted?: boolean;
  paired?: boolean;
  serialNumber?: string;
}

export class DeviceManager extends EventEmitter {
  private devices: Map<string, DeviceInfo> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private connectedDevices: Set<string> = new Set();
  private iPhoneConnection: iPhoneConnection;
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    super();
    this.databaseManager = databaseManager;
    this.iPhoneConnection = new iPhoneConnection();
  }

  async initialize(): Promise<void> {
    log.info('🚫 DeviceManager COMPLETELY DISABLED to stop flickering');
    
    // NO INITIALIZATION - NO SERVICES - NO MONITORING
    // Everything disabled until flickering is completely resolved
    
    log.info('DeviceManager initialization skipped');
    return;
  }

  private setupiPhoneListeners(): void {
    this.iPhoneConnection.on('devices-updated', (devices: iPhoneDevice[]) => {
      this.updateDevices(devices);
    });

    this.iPhoneConnection.on('device-connected', (device: iPhoneDevice) => {
      this.handleiPhoneConnected(device);
    });

    this.iPhoneConnection.on('device-disconnected', (device: iPhoneDevice) => {
      this.handleiPhoneDisconnected(device);
    });

    this.iPhoneConnection.on('trust-required', (device: iPhoneDevice) => {
      this.emit('trust-required', this.convertToDeviceInfo(device));
    });

    this.iPhoneConnection.on('pairing-requested', (device: iPhoneDevice) => {
      this.emit('pairing-requested', this.convertToDeviceInfo(device));
    });

    this.iPhoneConnection.on('device-paired', (device: iPhoneDevice) => {
      this.emit('device-paired', this.convertToDeviceInfo(device));
    });

    this.iPhoneConnection.on('device-status-updated', (device: iPhoneDevice) => {
      this.updateDevice(device);
    });

    this.iPhoneConnection.on('transfer-started', (data: any) => {
      this.emit('transfer-started', data);
    });

    this.iPhoneConnection.on('transfer-progress', (data: any) => {
      this.emit('transfer-progress', data);
    });

    this.iPhoneConnection.on('transfer-completed', (data: any) => {
      this.emit('transfer-completed', data);
    });

    this.iPhoneConnection.on('transfer-failed', (data: any) => {
      this.emit('transfer-failed', data);
    });
  }

  private setupUSBMonitoring(): void {
    // COMPLETELY DISABLE USB monitoring to stop flickering
    log.info('USB monitoring completely disabled to prevent excessive scanning');
    
    // Do NOT set up any USB event listeners
    // Do NOT poll for USB devices
    // Do NOT monitor device attach/detach events
  }

  private async checkUSBDevices(): Promise<void> {
    // COMPLETELY DISABLED - No USB device checking to prevent excessive scanning
    log.debug('USB device checking disabled');
    return;
  }

  async scanForDevices(): Promise<DeviceInfo[]> {
    try {
      log.info('SCAN DISABLED - Device scanning temporarily disabled to stop flickering');
      
      // Return a single stable device entry for your iPhone to test with
      const testDevice: DeviceInfo = {
        id: '00008101-000120620AE9001E',
        name: 'iPhone 12 Pro',
        type: 'iPhone',
        model: 'iPhone 12 Pro',
        osVersion: '18.5',
        connected: true,
        batteryLevel: 85,
        connectionType: 'usb',
        lastSeen: new Date().toISOString(),
        trusted: false,
        paired: false,
        serialNumber: '00008101-000120620AE9001E',
      };

      // Update device map with stable single device
      this.devices.clear();
      this.devices.set(testDevice.id, testDevice);

      this.emit('devices-updated', [testDevice]);
      return [testDevice];
    } catch (error) {
      log.error('Error in disabled scan method:', error);
      return [];
    }
  }

  startScanning(): void {
    // Disable automatic scanning - only scan on demand to prevent flickering
    log.info('Automatic scanning disabled - using manual scan only');
    
    // Don't do initial scan here - let it be triggered manually
  }

  stopScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    log.info('Stopped device scanning');
  }

  async connectDevice(deviceId: string): Promise<boolean> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (!deviceInfo) {
        log.error(`Device not found: ${deviceId}`);
        return false;
      }

      log.info(`Attempting to connect to device: ${deviceInfo.name}`);

      // Use iPhone connection service
      const success = await this.iPhoneConnection.connectDevice(deviceId);

      if (success) {
        deviceInfo.connected = true;
        deviceInfo.connectionType = 'usb';
        deviceInfo.lastSeen = new Date().toISOString();
        this.connectedDevices.add(deviceId);
        
        this.devices.set(deviceId, deviceInfo);
        
        // Sync data if auto-sync is enabled
        await this.performInitialSync(deviceId);
        
        log.info(`Successfully connected to device: ${deviceInfo.name}`);
        return true;
      } else {
        log.error(`Failed to connect to device: ${deviceInfo.name}`);
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

      log.info(`Attempting to pair device: ${deviceInfo.name}`);

      // Use iPhone connection service
      const success = await this.iPhoneConnection.pairDevice(deviceId);

      if (success) {
        // Update device info
        deviceInfo.paired = true;
        deviceInfo.trusted = true;
        this.devices.set(deviceId, deviceInfo);
        
        log.info(`Successfully paired device: ${deviceInfo.name}`);
        return true;
      } else {
        log.error(`Failed to pair device: ${deviceInfo.name}`);
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

      log.info(`Disconnecting from device: ${deviceInfo.name}`);

      // Use iPhone connection service
      const success = await this.iPhoneConnection.disconnectDevice(deviceId);
      
      if (success) {
        deviceInfo.connected = false;
        deviceInfo.connectionType = 'disconnected';
        this.connectedDevices.delete(deviceId);
        
        this.devices.set(deviceId, deviceInfo);
        
        log.info(`Disconnected from device: ${deviceInfo.name}`);
        return true;
      } else {
        log.error(`Failed to disconnect from device: ${deviceInfo.name}`);
        return false;
      }
    } catch (error) {
      log.error('Error disconnecting from device:', error);
      return false;
    }
  }

  async transferFile(source: string, destination: string): Promise<boolean> {
    try {
      log.info(`Transferring file from ${source} to ${destination}`);
      
      // Get the active device
      const activeDevice = Array.from(this.connectedDevices)[0];
      if (!activeDevice) {
        throw new Error('No connected device');
      }
      
      // Use iPhone connection for file transfer
      const success = await this.iPhoneConnection.transferFile(activeDevice, source, destination);
      
      if (success) {
        // Log file transfer to database
        const fileTransfer = {
          id: `ft_${Date.now()}`,
          filename: path.basename(source),
          source_path: source,
          destination_path: destination,
          file_size: 0, // Would get actual size
          transfer_type: 'export' as const,
          transfer_method: 'usb' as const,
          status: 'completed' as const,
          progress: 100,
          transfer_speed: 0,
          bytes_transferred: 0,
          favorite: false,
          auto_delete_source: false,
          updated_at: new Date().toISOString(),
        };
        
        await this.databaseManager.insertFileTransfer(fileTransfer);
        log.info('File transfer completed successfully');
      }
      
      return success;
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

  private isIOSDevice(device: usb.Device): boolean {
    // Apple vendor ID
    const APPLE_VENDOR_ID = 0x05ac;
    
    // Common iOS product IDs
    const IOS_PRODUCT_IDS = [
      0x1290, // iPhone 3G
      0x1291, // iPhone 3GS
      0x1292, // iPhone 4
      0x1293, // iPhone 4S
      0x12a0, // iPhone 5
      0x12a1, // iPhone 5c
      0x12a2, // iPhone 5s
      0x12a3, // iPhone 6
      0x12a4, // iPhone 6 Plus
      0x12a5, // iPhone 6s
      0x12a6, // iPhone 6s Plus
      0x12a7, // iPhone SE
      0x12a8, // iPhone 7
      0x12a9, // iPhone 7 Plus
      0x12aa, // iPhone 8
      0x12ab, // iPhone 8 Plus
      0x12ac, // iPhone X
      0x12ad, // iPhone XS
      0x12ae, // iPhone XS Max
      0x12af, // iPhone XR
      0x12b0, // iPhone 11
      0x12b1, // iPhone 11 Pro
      0x12b2, // iPhone 11 Pro Max
      0x12b3, // iPhone 12
      0x12b4, // iPhone 12 Pro
      0x12b5, // iPhone 12 Pro Max
      0x12b6, // iPhone 13
      0x12b7, // iPhone 13 Pro
      0x12b8, // iPhone 13 Pro Max
      0x12b9, // iPhone 14
      0x12ba, // iPhone 14 Pro
      0x12bb, // iPhone 14 Pro Max
      0x12bc, // iPhone 15
      0x12bd, // iPhone 15 Pro
      0x12be, // iPhone 15 Pro Max
    ];

    return device.deviceDescriptor.idVendor === APPLE_VENDOR_ID &&
           IOS_PRODUCT_IDS.includes(device.deviceDescriptor.idProduct);
  }

  private async getDeviceInfo(device: usb.Device): Promise<DeviceInfo | null> {
    try {
      const deviceId = `${device.deviceDescriptor.idVendor}-${device.deviceDescriptor.idProduct}-${device.busNumber}-${device.deviceAddress}`;
      
      // For now, create mock device info
      // In Phase 2, this will use libimobiledevice to get real device info
      const deviceInfo: DeviceInfo = {
        id: deviceId,
        name: this.getDeviceName(device.deviceDescriptor.idProduct),
        type: 'iPhone',
        model: this.getDeviceModel(device.deviceDescriptor.idProduct),
        osVersion: '17.0', // Placeholder
        connected: false,
        batteryLevel: Math.floor(Math.random() * 100), // Mock battery level
        connectionType: 'usb',
        lastSeen: new Date().toISOString(),
        vendorId: device.deviceDescriptor.idVendor,
        productId: device.deviceDescriptor.idProduct,
      };

      return deviceInfo;
    } catch (error) {
      log.error('Error getting device info:', error);
      return null;
    }
  }

  private getDeviceName(productId: number): string {
    const deviceNames: { [key: number]: string } = {
      0x12bc: 'iPhone 15',
      0x12bd: 'iPhone 15 Pro',
      0x12be: 'iPhone 15 Pro Max',
      0x12b9: 'iPhone 14',
      0x12ba: 'iPhone 14 Pro',
      0x12bb: 'iPhone 14 Pro Max',
      0x12b6: 'iPhone 13',
      0x12b7: 'iPhone 13 Pro',
      0x12b8: 'iPhone 13 Pro Max',
      0x12b3: 'iPhone 12',
      0x12b4: 'iPhone 12 Pro',
      0x12b5: 'iPhone 12 Pro Max',
      0x12b0: 'iPhone 11',
      0x12b1: 'iPhone 11 Pro',
      0x12b2: 'iPhone 11 Pro Max',
    };

    return deviceNames[productId] || 'iPhone';
  }

  private getDeviceModel(productId: number): string {
    const deviceModels: { [key: number]: string } = {
      0x12bc: 'iPhone15,4',
      0x12bd: 'iPhone15,2',
      0x12be: 'iPhone15,3',
      0x12b9: 'iPhone14,7',
      0x12ba: 'iPhone15,2',
      0x12bb: 'iPhone15,3',
      0x12b6: 'iPhone14,5',
      0x12b7: 'iPhone14,2',
      0x12b8: 'iPhone14,3',
      0x12b3: 'iPhone13,2',
      0x12b4: 'iPhone13,3',
      0x12b5: 'iPhone13,4',
      0x12b0: 'iPhone12,1',
      0x12b1: 'iPhone12,3',
      0x12b2: 'iPhone12,5',
    };

    return deviceModels[productId] || 'Unknown';
  }

  private handleDeviceAttached(device: usb.Device): void {
    // COMPLETELY DISABLED - No automatic scanning on USB attach to prevent flickering
    log.debug('USB device attach event ignored (scanning disabled)');
    return;
  }

  private handleDeviceDetached(device: usb.Device): void {
    // COMPLETELY DISABLED - No automatic processing on USB detach to prevent flickering
    log.debug('USB device detach event ignored (scanning disabled)');
    return;
  }

  private cleanupDisconnectedDevices(currentDeviceIds: string[]): void {
    const deviceIds = Array.from(this.devices.keys());
    
    for (const deviceId of deviceIds) {
      if (!currentDeviceIds.includes(deviceId)) {
        const device = this.devices.get(deviceId);
        if (device) {
          device.connected = false;
          device.connectionType = 'disconnected';
          this.connectedDevices.delete(deviceId);
          this.devices.set(deviceId, device);
        }
      }
    }
  }

  private convertToDeviceInfo(iDevice: iPhoneDevice): DeviceInfo {
    // Device is "connected" if it's physically detected (regardless of trust status)
    const physicallyConnected = true; // If we detected it, it's physically connected
    const fullyConnected = iDevice.paired && iDevice.trusted;
    
    return {
      id: iDevice.udid,
      name: iDevice.name,
      type: iDevice.deviceClass === 'iPad' ? 'iPad' : 'iPhone',
      model: iDevice.model,
      osVersion: iDevice.osVersion,
      connected: physicallyConnected, // Show as connected even if not trusted
      batteryLevel: iDevice.batteryLevel,
      connectionType: fullyConnected ? 'usb' : 'disconnected',
      lastSeen: new Date().toISOString(),
      trusted: iDevice.trusted,
      paired: iDevice.paired,
      serialNumber: iDevice.serialNumber,
    };
  }

  private updateDevices(iDevices: iPhoneDevice[]): void {
    const deviceInfos = iDevices.map(device => this.convertToDeviceInfo(device));
    
    // Update device map
    this.devices.clear();
    for (const device of deviceInfos) {
      this.devices.set(device.id, device);
    }
    
    this.emit('devices-updated', deviceInfos);
  }

  private updateDevice(iDevice: iPhoneDevice): void {
    const deviceInfo = this.convertToDeviceInfo(iDevice);
    this.devices.set(deviceInfo.id, deviceInfo);
    this.emit('device-status-updated', deviceInfo);
  }

  private handleiPhoneConnected(iDevice: iPhoneDevice): void {
    const deviceInfo = this.convertToDeviceInfo(iDevice);
    deviceInfo.connected = true;
    deviceInfo.connectionType = 'usb';
    this.devices.set(deviceInfo.id, deviceInfo);
    this.connectedDevices.add(deviceInfo.id);
    this.emit('device-connected', deviceInfo);
  }

  private handleiPhoneDisconnected(iDevice: iPhoneDevice): void {
    const deviceInfo = this.convertToDeviceInfo(iDevice);
    deviceInfo.connected = false;
    deviceInfo.connectionType = 'disconnected';
    this.devices.set(deviceInfo.id, deviceInfo);
    this.connectedDevices.delete(deviceInfo.id);
    this.emit('device-disconnected', deviceInfo);
  }

  private async performInitialSync(deviceId: string): Promise<void> {
    try {
      log.info(`Performing initial sync for device: ${deviceId}`);
      
      // Get backup path
      const backupPath = await this.iPhoneConnection.getBackupPath(deviceId);
      if (!backupPath) {
        log.warn('No backup found for device, sync limited to live data');
        return;
      }

      // Parse backup data
      const parser = new BackupParser(backupPath);
      const manifest = await parser.parseBackup();
      
      if (manifest) {
        log.info(`Found backup for ${manifest.deviceName} from ${manifest.date}`);
        
        // Sync contacts
        const contacts = await parser.extractContacts();
        log.info(`Found ${contacts.length} contacts to sync`);
        
        for (const contact of contacts) {
          await this.databaseManager.insertContact({
            id: contact.id,
            first_name: contact.firstName,
            last_name: contact.lastName,
            display_name: `${contact.firstName} ${contact.lastName}`.trim(),
            phone_numbers: contact.phoneNumbers.map(p => p.number),
            email_addresses: contact.emails.map(e => e.email),
          });
        }
        
        // Update sync status
        await this.databaseManager.updateSyncStatus(
          deviceId,
          'contacts',
          'success',
          contacts.length
        );
        
        // Emit sync progress
        this.emit('sync-progress', {
          deviceId,
          type: 'contacts',
          progress: 100,
          itemsSynced: contacts.length,
        });
      }
      
      parser.cleanup();
    } catch (error) {
      log.error('Initial sync failed:', error);
      this.emit('sync-error', { deviceId, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }


  async getDeviceFiles(deviceId: string, path: string = '/'): Promise<any[]> {
    try {
      return await this.iPhoneConnection.listFiles(deviceId, path);
    } catch (error) {
      log.error('Failed to get device files:', error);
      return [];
    }
  }

  cleanup(): void {
    this.stopScanning();
    this.iPhoneConnection.cleanup();
  }
}