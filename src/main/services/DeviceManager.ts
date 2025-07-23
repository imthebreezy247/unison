import { EventEmitter } from 'events';
import * as usb from 'usb';
import log from 'electron-log';

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
  vendorId: number;
  productId: number;
}

export class DeviceManager extends EventEmitter {
  private devices: Map<string, DeviceInfo> = new Map();
  private scanInterval: NodeJS.Timeout | null = null;
  private connectedDevices: Set<string> = new Set();

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    log.info('Initializing DeviceManager');
    
    // Set up USB device monitoring
    usb.on('attach', (device) => {
      this.handleDeviceAttached(device);
    });

    usb.on('detach', (device) => {
      this.handleDeviceDetached(device);
    });

    // Initial scan
    await this.scanForDevices();
  }

  async scanForDevices(): Promise<DeviceInfo[]> {
    try {
      log.debug('Scanning for iOS devices');
      
      const usbDevices = usb.getDeviceList();
      const iosDevices: DeviceInfo[] = [];

      for (const device of usbDevices) {
        if (this.isIOSDevice(device)) {
          const deviceInfo = await this.getDeviceInfo(device);
          if (deviceInfo) {
            this.devices.set(deviceInfo.id, deviceInfo);
            iosDevices.push(deviceInfo);
            log.info(`Found iOS device: ${deviceInfo.name} (${deviceInfo.id})`);
          }
        }
      }

      // Clean up disconnected devices
      this.cleanupDisconnectedDevices(iosDevices.map(d => d.id));

      this.emit('devices-updated', iosDevices);
      return iosDevices;
    } catch (error) {
      log.error('Error scanning for devices:', error);
      return [];
    }
  }

  startScanning(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
    }

    // Scan every 5 seconds
    this.scanInterval = setInterval(() => {
      this.scanForDevices();
    }, 5000);

    log.info('Started device scanning');
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

      // For now, simulate connection success
      // In Phase 2, this will use libimobiledevice
      const success = true;

      if (success) {
        deviceInfo.connected = true;
        deviceInfo.connectionType = 'usb';
        deviceInfo.lastSeen = new Date().toISOString();
        this.connectedDevices.add(deviceId);
        
        this.devices.set(deviceId, deviceInfo);
        this.emit('device-connected', deviceInfo);
        
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

  async disconnectDevice(deviceId: string): Promise<boolean> {
    try {
      const deviceInfo = this.devices.get(deviceId);
      if (!deviceInfo) {
        log.error(`Device not found: ${deviceId}`);
        return false;
      }

      log.info(`Disconnecting from device: ${deviceInfo.name}`);

      deviceInfo.connected = false;
      deviceInfo.connectionType = 'disconnected';
      this.connectedDevices.delete(deviceId);
      
      this.devices.set(deviceId, deviceInfo);
      this.emit('device-disconnected', deviceInfo);
      
      log.info(`Disconnected from device: ${deviceInfo.name}`);
      return true;
    } catch (error) {
      log.error('Error disconnecting from device:', error);
      return false;
    }
  }

  async transferFile(source: string, destination: string): Promise<boolean> {
    try {
      log.info(`Transferring file from ${source} to ${destination}`);
      
      // Placeholder for file transfer implementation
      // This will be implemented in Phase 6
      
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate transfer
      
      log.info('File transfer completed successfully');
      return true;
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
    if (this.isIOSDevice(device)) {
      log.info('iOS device attached');
      this.scanForDevices();
    }
  }

  private handleDeviceDetached(device: usb.Device): void {
    if (this.isIOSDevice(device)) {
      log.info('iOS device detached');
      
      // Find and update the corresponding device
      const deviceId = `${device.deviceDescriptor.idVendor}-${device.deviceDescriptor.idProduct}-${device.busNumber}-${device.deviceAddress}`;
      const deviceInfo = this.devices.get(deviceId);
      
      if (deviceInfo) {
        deviceInfo.connected = false;
        deviceInfo.connectionType = 'disconnected';
        this.connectedDevices.delete(deviceId);
        this.devices.set(deviceId, deviceInfo);
        this.emit('device-disconnected', deviceInfo);
      }
    }
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
}