import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as log from 'electron-log';
import { DeviceInfo } from './DeviceManager';

const execAsync = promisify(exec);

/**
 * DirectiPhoneManager - Bypasses Windows WMI completely
 * Uses ONLY libimobiledevice tools to prevent duplicate device entries
 * 
 * This fixes the "4 devices showing for 1 iPhone" issue by going directly
 * to the source (libimobiledevice) instead of Windows device enumeration
 */
export class DirectiPhoneManager extends EventEmitter {
  private devices = new Map<string, DeviceInfo>();
  private scanInterval: NodeJS.Timeout | null = null;
  private isScanning = false;

  constructor() {
    super();
    log.info('🎯 DirectiPhoneManager initialized - NO Windows WMI scanning');
  }

  async initialize(): Promise<void> {
    log.info('🚀 Starting direct libimobiledevice scanning...');
    
    // Check if libimobiledevice is available
    const hasLibimobiledevice = await this.checkLibimobiledevice();
    if (!hasLibimobiledevice) {
      log.error('❌ libimobiledevice not found - iPhone connection will not work');
      return;
    }
    
    // Initial scan
    await this.scanForDevices();
    
    // Start periodic scanning (every 3 seconds)
    this.scanInterval = setInterval(() => {
      if (!this.isScanning) {
        this.scanForDevices();
      }
    }, 3000);
    
    log.info('✅ DirectiPhoneManager initialized and scanning started');
  }

  async cleanup(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
    this.devices.clear();
    log.info('🧹 DirectiPhoneManager cleaned up');
  }

  async scanForDevices(): Promise<DeviceInfo[]> {
    if (this.isScanning) {
      return Array.from(this.devices.values());
    }
    
    this.isScanning = true;
    
    try {
      log.info('🔍 Scanning for iOS devices with libimobiledevice...');
      
      const devices = await this.fetchConnectedDevices();
      
      // Clear old devices and update with current ones
      this.devices.clear();
      for (const device of devices) {
        this.devices.set(device.id, device);
      }
      
      // Special logging for Chris's iPhone
      const chrisPhone = devices.find(d => d.udid === '00008101-000120620AE9001E');
      if (chrisPhone) {
        log.info(`🎯 CHRIS'S iPHONE DETECTED: ${chrisPhone.name} (${chrisPhone.model}) - iOS ${chrisPhone.osVersion} - Trusted: ${chrisPhone.trusted}`);
      }
      
      log.info(`📱 Found ${devices.length} iOS device(s)`);
      
      // Emit update
      this.emit('devices-updated', devices);
      
      return devices;
    } catch (error) {
      log.error('Error scanning for devices:', error);
      return [];
    } finally {
      this.isScanning = false;
    }
  }

  private async checkLibimobiledevice(): Promise<boolean> {
    try {
      await execAsync('idevice_id --version', { timeout: 5000 });
      log.info('✅ libimobiledevice tools found');
      return true;
    } catch (error) {
      log.error('❌ libimobiledevice tools not found. Please install from https://github.com/libimobiledevice/libimobiledevice');
      return false;
    }
  }

  private async fetchConnectedDevices(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = [];
    
    try {
      // Get list of connected device UDIDs
      const { stdout } = await execAsync('idevice_id -l', { timeout: 10000 });
      const udids = stdout.trim().split('\n').filter(Boolean);
      
      if (udids.length === 0) {
        log.info('📱 No iOS devices connected');
        return [];
      }
      
      log.info(`📱 Found ${udids.length} connected device UDID(s): ${udids.join(', ')}`);
      
      // Get detailed info for each device
      for (const udid of udids) {
        try {
          const device = await this.getDeviceDetails(udid);
          if (device) {
            devices.push(device);
          }
        } catch (error) {
          log.error(`Failed to get details for device ${udid}:`, error);
          
          // Add minimal device entry
          devices.push({
            id: udid,
            udid: udid,
            name: 'iPhone',
            type: 'iPhone',
            model: 'Unknown',
            osVersion: 'Unknown',
            connected: true,
            connectionType: 'usb',
            lastSeen: new Date().toISOString(),
            trusted: false,
            paired: false,
            serialNumber: udid
          });
        }
      }
      
      return devices;
    } catch (error) {
      log.error('Error getting connected devices:', error);
      return [];
    }
  }

  private async getDeviceDetails(udid: string): Promise<DeviceInfo | null> {
    try {
      log.info(`📱 Getting details for device: ${udid}`);
      
      // Get device info in parallel for speed
      const [deviceName, productType, productVersion, serialNumber] = await Promise.allSettled([
        this.getDeviceProperty(udid, 'DeviceName'),
        this.getDeviceProperty(udid, 'ProductType'),
        this.getDeviceProperty(udid, 'ProductVersion'),
        this.getDeviceProperty(udid, 'SerialNumber')
      ]);
      
      // Check if device is trusted
      let trusted = false;
      try {
        await execAsync(`idevicepair -u ${udid} validate`, { timeout: 5000 });
        trusted = true;
        log.info(`✅ Device ${udid} is trusted`);
      } catch {
        log.info(`❌ Device ${udid} is NOT trusted`);
      }
      
      const name = deviceName.status === 'fulfilled' ? deviceName.value : 'iPhone';
      const model = productType.status === 'fulfilled' ? this.parseDeviceModel(productType.value) : 'iPhone';
      const osVersion = productVersion.status === 'fulfilled' ? productVersion.value : 'Unknown';
      const serial = serialNumber.status === 'fulfilled' ? serialNumber.value : udid;
      
      const device: DeviceInfo = {
        id: udid,
        udid: udid,
        name: name,
        type: 'iPhone',
        model: model,
        osVersion: osVersion,
        connected: true,
        connectionType: 'usb',
        lastSeen: new Date().toISOString(),
        trusted: trusted,
        paired: trusted,
        serialNumber: serial
      };
      
      log.info(`📱 Device details: ${name} (${model}) - iOS ${osVersion} - Serial: ${serial}`);
      
      return device;
    } catch (error) {
      log.error(`Failed to get device details for ${udid}:`, error);
      return null;
    }
  }

  private async getDeviceProperty(udid: string, property: string): Promise<string> {
    try {
      const { stdout } = await execAsync(`ideviceinfo -u ${udid} -k ${property}`, { timeout: 5000 });
      return stdout.trim();
    } catch (error) {
      log.debug(`Could not get ${property} for device ${udid}`);
      return '';
    }
  }

  private parseDeviceModel(productType: string): string {
    const modelMap: { [key: string]: string } = {
      'iPhone12,1': 'iPhone 11',
      'iPhone13,1': 'iPhone 12 mini',
      'iPhone13,2': 'iPhone 12',
      'iPhone13,3': 'iPhone 12 Pro',
      'iPhone13,4': 'iPhone 12 Pro Max',
      'iPhone14,4': 'iPhone 13 mini',
      'iPhone14,5': 'iPhone 13',
      'iPhone14,2': 'iPhone 13 Pro',
      'iPhone14,3': 'iPhone 13 Pro Max',
      'iPhone14,6': 'iPhone SE (3rd generation)',
      'iPhone14,7': 'iPhone 14',
      'iPhone14,8': 'iPhone 14 Plus',
      'iPhone15,2': 'iPhone 14 Pro',
      'iPhone15,3': 'iPhone 14 Pro Max',
      'iPhone15,4': 'iPhone 15',
      'iPhone15,5': 'iPhone 15 Plus',
      'iPhone16,1': 'iPhone 15 Pro',
      'iPhone16,2': 'iPhone 15 Pro Max'
    };
    
    return modelMap[productType] || productType || 'iPhone';
  }

  // Device management methods
  async connectDevice(udid: string): Promise<boolean> {
    try {
      const device = this.devices.get(udid);
      if (!device) {
        log.error(`Device not found: ${udid}`);
        return false;
      }
      
      log.info(`🔗 Connecting to device: ${device.name} (${udid})`);
      
      // Check if device is trusted first
      try {
        await execAsync(`idevicepair -u ${udid} validate`, { timeout: 5000 });
        log.info(`✅ Device ${udid} is already trusted`);
        
        // Update device status
        device.connected = true;
        device.trusted = true;
        device.paired = true;
        this.devices.set(udid, device);
        
        this.emit('device-connected', device);
        return true;
      } catch {
        log.info(`❌ Device ${udid} is not trusted`);
        return false;
      }
    } catch (error) {
      log.error('Error connecting to device:', error);
      return false;
    }
  }

  async pairDevice(udid: string): Promise<boolean> {
    try {
      const device = this.devices.get(udid);
      if (!device) {
        log.error(`Device not found: ${udid}`);
        return false;
      }
      
      log.info(`🤝 Pairing with device: ${device.name} (${udid})`);
      
      // Attempt to pair
      await execAsync(`idevicepair -u ${udid} pair`, { timeout: 10000 });
      log.info(`✅ Pairing initiated for device ${udid} - check iPhone for trust dialog`);
      
      // Wait a moment and check if pairing succeeded
      setTimeout(async () => {
        try {
          await execAsync(`idevicepair -u ${udid} validate`, { timeout: 5000 });
          log.info(`✅ Device ${udid} is now trusted`);
          
          device.trusted = true;
          device.paired = true;
          this.devices.set(udid, device);
          
          this.emit('device-paired', device);
        } catch {
          log.info(`❌ Device ${udid} pairing may have failed - user may need to accept trust dialog`);
        }
      }, 2000);
      
      return true;
    } catch (error) {
      log.error('Error pairing device:', error);
      return false;
    }
  }

  async disconnectDevice(udid: string): Promise<boolean> {
    try {
      const device = this.devices.get(udid);
      if (!device) {
        log.error(`Device not found: ${udid}`);
        return false;
      }
      
      log.info(`🔌 Disconnecting from device: ${device.name} (${udid})`);
      
      // For USB connections, we can't actually "disconnect" the device
      // But we can mark it as disconnected in our state
      device.connected = false;
      this.devices.set(udid, device);
      
      this.emit('device-disconnected', device);
      return true;
    } catch (error) {
      log.error('Error disconnecting from device:', error);
      return false;
    }
  }

  // Additional methods needed by the UI
  async getDeviceFiles(udid: string, path: string = '/'): Promise<any[]> {
    log.info(`📁 Getting files for device ${udid} at path: ${path}`);
    
    // For now, return empty array - this would be implemented with ifuse or similar
    // in a real implementation
    return [];
  }

  async transferFile(source: string, destination: string): Promise<boolean> {
    log.info(`📁 Transfer file from ${source} to ${destination}`);
    
    // For now, return false - this would be implemented with libimobiledevice file transfer
    // in a real implementation
    log.warn('File transfer not yet implemented in DirectiPhoneManager');
    return false;
  }

  getConnectedDevices(): DeviceInfo[] {
    return Array.from(this.devices.values()).filter(device => device.connected);
  }

  getDevice(udid: string): DeviceInfo | undefined {
    return this.devices.get(udid);
  }

  getAllDevices(): DeviceInfo[] {
    return Array.from(this.devices.values());
  }
}

// Test function to run directly
if (require.main === module) {
  const manager = new DirectiPhoneManager();
  
  (async () => {
    console.log('🧪 Testing DirectiPhoneManager...');
    await manager.initialize();
    
    // Test Chris's specific iPhone
    const devices = await manager.scanForDevices();
    console.log(`Found ${devices.length} devices:`);
    devices.forEach(device => {
      console.log(`  - ${device.name} (${device.udid}) - ${device.model} - iOS ${device.osVersion} - Trusted: ${device.trusted}`);
    });
    
    // Test pairing if Chris's iPhone is found
    const chrisPhone = devices.find(d => d.udid === '00008101-000120620AE9001E');
    if (chrisPhone && !chrisPhone.trusted) {
      console.log('🤝 Attempting to pair with Chris\'s iPhone...');
      await manager.pairDevice(chrisPhone.udid!);
    }
    
    await manager.cleanup();
  })().catch(console.error);
}