// Comprehensive Device Connection Debug Tool
// This script helps debug iPhone connection issues by providing detailed logging

const fs = require('fs');
const { execSync } = require('child_process');

class ConnectionDebugger {
  constructor() {
    this.logFile = `debug-connection-${Date.now()}.log`;
    this.log('=== UnisonX Connection Debugger Started ===');
  }

  log(message) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    console.log(logEntry.trim());
    fs.appendFileSync(this.logFile, logEntry);
  }

  async checkWindowsUSBDevices() {
    this.log('\n--- Checking Windows USB Devices ---');
    try {
      // Check for Apple devices in Device Manager
      const wmiQuery = `wmic path Win32_PnPEntity where "DeviceID like '%VID_05AC%'" get DeviceID,Name,Status /format:csv`;
      const result = execSync(wmiQuery, { encoding: 'utf8' });
      this.log('WMI Apple Devices Query Result:');
      this.log(result);

      // Check Windows device manager for Apple Mobile Device entries
      const deviceQuery = `wmic path Win32_PnPEntity where "Name like '%Apple%'" get DeviceID,Name,Status,ConfigManagerErrorCode /format:csv`;
      const deviceResult = execSync(deviceQuery, { encoding: 'utf8' });
      this.log('All Apple Devices in Device Manager:');
      this.log(deviceResult);

      // Check iTunes service status
      try {
        const serviceQuery = `sc query "Apple Mobile Device Service"`;
        const serviceResult = execSync(serviceQuery, { encoding: 'utf8' });
        this.log('Apple Mobile Device Service Status:');
        this.log(serviceResult);
      } catch (error) {
        this.log('Apple Mobile Device Service not found or error: ' + error.message);
      }

    } catch (error) {
      this.log('Error checking Windows USB devices: ' + error.message);
    }
  }

  async checkiPhoneTools() {
    this.log('\n--- Checking iPhone Command Line Tools ---');
    
    const tools = ['idevice_id', 'ideviceinfo', 'idevicepair', 'idevicesyslog'];
    
    for (const tool of tools) {
      try {
        const result = execSync(`${tool} --help 2>&1 || echo "Tool not found"`, { encoding: 'utf8', timeout: 5000 });
        this.log(`${tool}: Available`);
        
        if (tool === 'idevice_id') {
          try {
            const devices = execSync('idevice_id -l 2>&1', { encoding: 'utf8', timeout: 10000 });
            this.log(`Connected devices via ${tool}:`);
            this.log(devices);
          } catch (err) {
            this.log(`${tool} list command failed: ${err.message}`);
          }
        }
        
        if (tool === 'ideviceinfo') {
          try {
            const info = execSync('ideviceinfo 2>&1', { encoding: 'utf8', timeout: 10000 });
            this.log(`Device info via ${tool}:`);
            this.log(info.substring(0, 500) + '...');
          } catch (err) {
            this.log(`${tool} command failed: ${err.message}`);
          }
        }
        
      } catch (error) {
        this.log(`${tool}: Not available - ${error.message}`);
      }
    }
  }

  async checkDrivers() {
    this.log('\n--- Checking iPhone Drivers ---');
    try {
      // Check for iPhone drivers
      const driverQuery = `driverquery /v | findstr -i "apple"`;
      const driverResult = execSync(driverQuery, { encoding: 'utf8' });
      this.log('Apple-related drivers:');
      this.log(driverResult);
    } catch (error) {
      this.log('Error checking drivers or no Apple drivers found: ' + error.message);
    }

    try {
      // Check specific iPhone-related registry entries
      const regQuery = `reg query "HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Enum\\USB" /s /f "VID_05AC" 2>nul`;
      const regResult = execSync(regQuery, { encoding: 'utf8' });
      this.log('iPhone USB Registry Entries:');
      this.log(regResult.substring(0, 1000) + '...');
    } catch (error) {
      this.log('Error checking registry or no iPhone entries found: ' + error.message);
    }
  }

  async checkiTunesConnection() {
    this.log('\n--- Checking iTunes/Apple Devices Connection ---');
    try {
      // Check if iTunes can see the device
      const iTunesQuery = `reg query "HKEY_CURRENT_USER\\SOFTWARE\\Apple Computer, Inc.\\iTunes\\DeviceIDs" 2>nul`;
      const iTunesResult = execSync(iTunesQuery, { encoding: 'utf8' });
      this.log('iTunes Device Registry:');
      this.log(iTunesResult);
    } catch (error) {
      this.log('iTunes registry not accessible or no devices: ' + error.message);
    }

    try {
      // Check Apple Mobile Device Support folders
      const amdPath = 'C:\\Program Files\\Common Files\\Apple\\Mobile Device Support';
      if (fs.existsSync(amdPath)) {
        const amdContents = fs.readdirSync(amdPath);
        this.log(`Apple Mobile Device Support folder contents: ${amdContents.join(', ')}`);
      } else {
        this.log('Apple Mobile Device Support folder not found');
      }
    } catch (error) {
      this.log('Error checking Apple Mobile Device Support: ' + error.message);
    }
  }

  async checkProcesses() {
    this.log('\n--- Checking Related Processes ---');
    try {
      const processes = ['iTunes.exe', 'AppleMobileDeviceService.exe', 'iPodService.exe', 'AppleMobileDeviceHelper.exe'];
      
      for (const process of processes) {
        try {
          const result = execSync(`tasklist /FI "IMAGENAME eq ${process}" 2>nul`, { encoding: 'utf8' });
          if (result.includes(process)) {
            this.log(`${process}: Running`);
          } else {
            this.log(`${process}: Not running`);
          }
        } catch (error) {
          this.log(`${process}: Error checking - ${error.message}`);
        }
      }
    } catch (error) {
      this.log('Error checking processes: ' + error.message);
    }
  }

  async generateDeviceReport() {
    this.log('\n--- Generating Device Connection Report ---');
    
    // Summary of detected issues
    this.log('\n=== SUMMARY & RECOMMENDATIONS ===');
    
    try {
      // Check if basic USB detection is working
      const usbCheck = execSync(`wmic path Win32_PnPEntity where "DeviceID like '%VID_05AC%'" get DeviceID /format:csv`, { encoding: 'utf8' });
      if (usbCheck.includes('VID_05AC')) {
        this.log('✓ USB Detection: iPhone detected at USB level');
      } else {
        this.log('✗ USB Detection: iPhone not detected at USB level');
      }
    } catch (error) {
      this.log('✗ USB Detection: Error checking USB devices');
    }

    try {
      // Check iTunes service
      const serviceCheck = execSync(`sc query "Apple Mobile Device Service"`, { encoding: 'utf8' });
      if (serviceCheck.includes('RUNNING')) {
        this.log('✓ Apple Mobile Device Service: Running');
      } else {
        this.log('✗ Apple Mobile Device Service: Not running or not installed');
      }
    } catch (error) {
      this.log('✗ Apple Mobile Device Service: Not installed or accessible');
    }

    this.log('\n=== NEXT STEPS ===');
    this.log('1. If iPhone is detected at USB level but not trusted:');
    this.log('   - Unlock iPhone and tap "Trust" when prompted');
    this.log('   - Try reconnecting USB cable');
    this.log('   - Check Windows Device Manager for driver issues');
    
    this.log('2. If Apple Mobile Device Service is not running:');
    this.log('   - Install iTunes or Apple Devices app from Microsoft Store');
    this.log('   - Restart the Apple Mobile Device Service');
    
    this.log('3. If USB detection fails:');
    this.log('   - Try different USB cable or port');
    this.log('   - Check iPhone cable/port for damage');
    this.log('   - Update iPhone drivers in Device Manager');

    this.log('\n=== DEBUG LOG COMPLETE ===');
    this.log(`Full log saved to: ${this.logFile}`);
  }

  async runFullDiagnosis() {
    try {
      await this.checkWindowsUSBDevices();
      await this.checkiPhoneTools();
      await this.checkDrivers();
      await this.checkiTunesConnection();
      await this.checkProcesses();
      await this.generateDeviceReport();
    } catch (error) {
      this.log('Error during diagnosis: ' + error.message);
    }
  }
}

// Run the debugger
const connectionDebugger = new ConnectionDebugger();
connectionDebugger.runFullDiagnosis().then(() => {
  console.log(`\nDebug complete! Check ${connectionDebugger.logFile} for full details.`);
}).catch(error => {
  console.error('Debug failed:', error);
});