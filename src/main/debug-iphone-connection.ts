import { exec } from 'child_process';
import { promisify } from 'util';
import * as log from 'electron-log';

const execAsync = promisify(exec);

interface DebugInfo {
  timestamp: string;
  windowsDevices: any[];
  libimobiledeviceInfo: string;
  ideviceIdOutput: string;
  trustedDevices: string[];
  analysis: string;
}

export class iPhoneDebugger {
  async collectFullDebugInfo(): Promise<DebugInfo> {
    const info: DebugInfo = {
      timestamp: new Date().toISOString(),
      windowsDevices: [],
      libimobiledeviceInfo: '',
      ideviceIdOutput: '',
      trustedDevices: [],
      analysis: ''
    };

    console.log('🔍 Starting comprehensive iPhone debug...');
    
    // 1. Get Windows device info
    try {
      console.log('📱 Querying Windows devices...');
      const wmiQuery = `
        Get-WmiObject -Query "SELECT * FROM Win32_PnPEntity WHERE (DeviceID LIKE '%VID_05AC%' OR Name LIKE '%Apple%' OR Name LIKE '%iPhone%')" | 
        Select-Object Name, DeviceID, Status, PNPDeviceID, Description | 
        ConvertTo-Json
      `;
      
      const { stdout } = await execAsync(`powershell -Command "${wmiQuery}"`);
      info.windowsDevices = JSON.parse(stdout || '[]');
      console.log(`Found ${info.windowsDevices.length} Windows device entries`);
      
      // Log each device
      info.windowsDevices.forEach((device, index) => {
        console.log(`\nDevice ${index + 1}:`);
        console.log(`  Name: ${device.Name}`);
        console.log(`  DeviceID: ${device.DeviceID}`);
        console.log(`  Status: ${device.Status}`);
      });
    } catch (error) {
      console.error('Failed to query Windows devices:', error);
    }

    // 2. Get libimobiledevice info
    try {
      console.log('\n🔧 Running idevice_id -l...');
      const { stdout: ideviceOutput } = await execAsync('idevice_id -l');
      info.ideviceIdOutput = ideviceOutput.trim();
      console.log('idevice_id output:', info.ideviceIdOutput || '(no devices)');
      
      if (info.ideviceIdOutput) {
        const udids = info.ideviceIdOutput.split('\n').filter(Boolean);
        
        for (const udid of udids) {
          console.log(`\n📱 Getting info for UDID: ${udid}`);
          try {
            const { stdout: deviceInfo } = await execAsync(`ideviceinfo -u ${udid} -k DeviceName`);
            const { stdout: productType } = await execAsync(`ideviceinfo -u ${udid} -k ProductType`);
            const { stdout: productVersion } = await execAsync(`ideviceinfo -u ${udid} -k ProductVersion`);
            
            console.log(`  Device Name: ${deviceInfo.trim()}`);
            console.log(`  Product Type: ${productType.trim()}`);
            console.log(`  iOS Version: ${productVersion.trim()}`);
            
            // Check if device is trusted
            try {
              await execAsync(`idevicepair -u ${udid} validate`);
              info.trustedDevices.push(udid);
              console.log(`  ✅ Device is TRUSTED`);
            } catch {
              console.log(`  ❌ Device is NOT TRUSTED`);
            }
          } catch (error) {
            console.log(`  ⚠️  Could not get device info: ${error}`);
          }
        }
      }
    } catch (error) {
      console.error('Failed to run idevice_id:', error);
    }

    // 3. Analyze the situation
    console.log('\n📊 Analysis:');
    const analysis = [];
    
    if (info.windowsDevices.length > 1) {
      analysis.push(`⚠️  Windows is showing ${info.windowsDevices.length} device entries for your iPhone`);
      
      // Group devices by root ID
      const deviceGroups = new Map<string, any[]>();
      info.windowsDevices.forEach(device => {
        const rootId = device.DeviceID?.split('&MI_')[0] || device.DeviceID;
        if (!deviceGroups.has(rootId)) {
          deviceGroups.set(rootId, []);
        }
        deviceGroups.get(rootId)!.push(device);
      });
      
      analysis.push(`📱 These appear to be ${deviceGroups.size} actual device(s)`);
    }
    
    if (!info.ideviceIdOutput) {
      analysis.push('❌ libimobiledevice cannot see any iOS devices');
      analysis.push('🔌 Make sure iTunes drivers are installed');
      analysis.push('🔌 Try unplugging and replugging your iPhone');
    } else if (info.trustedDevices.length === 0) {
      analysis.push('❌ iPhone is connected but NOT TRUSTED');
      analysis.push('📱 Unlock your iPhone and tap "Trust This Computer"');
    } else {
      analysis.push('✅ iPhone is connected and trusted!');
      analysis.push(`📱 UDID: ${info.trustedDevices[0]}`);
    }
    
    info.analysis = analysis.join('\n');
    console.log(info.analysis);
    
    // 4. Save debug info to file
    const fs = require('fs');
    const debugFile = `iphone-debug-${Date.now()}.json`;
    fs.writeFileSync(debugFile, JSON.stringify(info, null, 2));
    console.log(`\n💾 Full debug info saved to: ${debugFile}`);
    
    return info;
  }

  async testSpecificDevice(udid: string): Promise<void> {
    console.log(`\n🎯 Testing specific device: ${udid}`);
    
    try {
      // Test if device is visible
      const { stdout: devices } = await execAsync('idevice_id -l');
      if (!devices.includes(udid)) {
        console.log('❌ Device not found by idevice_id');
        return;
      }
      
      console.log('✅ Device found by idevice_id');
      
      // Get device info
      const { stdout: name } = await execAsync(`ideviceinfo -u ${udid} -k DeviceName`);
      console.log(`📱 Device Name: ${name.trim()}`);
      
      // Test pairing
      try {
        await execAsync(`idevicepair -u ${udid} validate`);
        console.log('✅ Device is paired and trusted');
      } catch {
        console.log('❌ Device is not paired');
        console.log('🔐 Attempting to pair...');
        try {
          await execAsync(`idevicepair -u ${udid} pair`);
          console.log('✅ Pairing initiated - check your iPhone');
        } catch (error) {
          console.log('❌ Pairing failed:', error);
        }
      }
      
    } catch (error) {
      console.error('Test failed:', error);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const diagnostics = new iPhoneDebugger();
  
  (async () => {
    await diagnostics.collectFullDebugInfo();
    
    // Test Chris's specific iPhone
    await diagnostics.testSpecificDevice('00008101-000120620AE9001E');
  })();
}