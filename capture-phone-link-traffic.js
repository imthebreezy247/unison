const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🕵️ CAPTURING PHONE LINK NETWORK TRAFFIC...\n');

// Method 1: Use netstat to monitor Phone Link connections
console.log('📡 Monitoring Phone Link network connections...');
const monitorConnections = () => {
  exec('netstat -an | findstr PhoneExperienceHost', (error, stdout) => {
    if (stdout) {
      console.log('🔗 Phone Link connections:');
      console.log(stdout);
    }
  });
};

// Monitor every 2 seconds
setInterval(monitorConnections, 2000);

// Method 2: Monitor HTTP/HTTPS traffic using PowerShell
console.log('🌐 Setting up HTTP traffic monitoring...');

const httpTrafficScript = `
# Monitor network traffic for Phone Link process
$phoneLink = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneLink) {
    $processId = $phoneLink.Id
    Write-Output "Found Phone Link process: $processId"
    
    # Use netstat to find connections for this process
    while ($true) {
        $connections = netstat -ano | Select-String $processId
        if ($connections) {
            Write-Output "CONNECTIONS:"
            $connections | ForEach-Object { Write-Output $_.Line }
        }
        Start-Sleep -Seconds 3
    }
} else {
    Write-Output "Phone Link not running"
}
`;

const psMonitor = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-Command', httpTrafficScript], {
  stdio: ['ignore', 'pipe', 'pipe']
});

psMonitor.stdout.on('data', (data) => {
  const output = data.toString().trim();
  if (output.includes('CONNECTIONS:') || output.includes(':443') || output.includes(':80')) {
    console.log('📊 Network activity:', output);
  }
});

// Method 3: Try to capture actual HTTP requests using Windows Event Tracing
console.log('🔍 Setting up ETW HTTP tracing...');

const etwScript = `
# Enable HTTP ETW tracing
try {
    # Start ETW session for HTTP requests
    $session = New-EtwTraceSession -Name "PhoneLinkHTTP" -LogFileMode Circular
    
    # Add HTTP provider
    Add-EtwTraceProvider -SessionName "PhoneLinkHTTP" -Guid "{DD5EF90A-6398-47A4-AD34-4DCECDEF795F}" -Level 0xFF
    
    Write-Output "ETW_STARTED"
    
    # Monitor for 30 seconds
    Start-Sleep -Seconds 30
    
    # Get trace events
    $events = Get-WinEvent -Path $session.LogFileName -Oldest
    foreach ($event in $events) {
        if ($event.Message -like "*graph.microsoft.com*" -or $event.Message -like "*api*" -or $event.Message -like "*https*") {
            Write-Output "HTTP_TRACE: $($event.Message)"
        }
    }
    
    Remove-EtwTraceSession -Name "PhoneLinkHTTP"
} catch {
    Write-Output "ETW_ERROR: $($_.Exception.Message)"
}
`;

exec(`powershell.exe -ExecutionPolicy Bypass -Command "${etwScript}"`, (error, stdout, stderr) => {
  if (stdout) {
    console.log('🔬 ETW trace results:');
    console.log(stdout);
  }
  if (stderr) {
    console.log('⚠️ ETW stderr:', stderr);
  }
});

// Method 4: Create a simple packet capture for Phone Link
console.log('📦 Starting packet capture...');

const packetCaptureScript = `
# Try to capture packets for Phone Link process
$phoneLink = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneLink) {
    Write-Output "PACKET_CAPTURE_START"
    
    # Use built-in packet capture if available
    try {
        $session = New-NetEventSession -Name "PhoneLinkCapture" -CaptureMode SaveToFile -LocalFilePath "$env:TEMP\\phonelink.etl"
        Add-NetEventProvider -SessionName "PhoneLinkCapture" -Name "Microsoft-Windows-TCPIP"
        Start-NetEventSession -Name "PhoneLinkCapture"
        
        Write-Output "Packet capture started, running for 20 seconds..."
        Start-Sleep -Seconds 20
        
        Stop-NetEventSession -Name "PhoneLinkCapture"
        Remove-NetEventSession -Name "PhoneLinkCapture"
        
        Write-Output "PACKET_CAPTURE_COMPLETE: $env:TEMP\\\\phonelink.etl"
    } catch {
        Write-Output "PACKET_CAPTURE_ERROR: $($_.Exception.Message)"
    }
}
`;

setTimeout(() => {
  exec(`powershell.exe -ExecutionPolicy Bypass -Command "${packetCaptureScript}"`, (error, stdout) => {
    if (stdout) {
      console.log('📡 Packet capture:', stdout);
    }
  });
}, 5000);

// Method 5: Registry monitoring for Phone Link settings
console.log('🔑 Monitoring Phone Link registry changes...');

const registryScript = `
# Monitor registry changes for Phone Link
$regPath = "HKCU:\\Software\\Microsoft\\YourPhone"
if (Test-Path $regPath) {
    Write-Output "REGISTRY_MONITORING: Started"
    
    # Get current registry values
    $values = Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue
    if ($values) {
        $values.PSObject.Properties | ForEach-Object {
            if ($_.Name -like "*token*" -or $_.Name -like "*api*" -or $_.Name -like "*endpoint*" -or $_.Name -like "*url*") {
                Write-Output "REGISTRY_KEY: $($_.Name) = $($_.Value)"
            }
        }
    }
}

# Also check Phone Link app settings
$appPath = "HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe"
if (Test-Path $appPath) {
    Write-Output "APP_REGISTRY_FOUND"
}
`;

exec(`powershell.exe -ExecutionPolicy Bypass -Command "${registryScript}"`, (error, stdout) => {
  if (stdout) {
    console.log('🗂️ Registry monitoring:', stdout);
  }
});

console.log('\n🎯 TRAFFIC CAPTURE INSTRUCTIONS:');
console.log('1. Open Phone Link and try to send a message');
console.log('2. This script will capture the network traffic');
console.log('3. Look for API endpoints like:');
console.log('   - graph.microsoft.com');
console.log('   - api.live.com');
console.log('   - outlook.office365.com');
console.log('   - Any OAuth/authentication URLs');
console.log('\n⏱️ Monitoring for 60 seconds...');

// Stop monitoring after 60 seconds
setTimeout(() => {
  console.log('\n✅ Traffic capture complete!');
  process.exit(0);
}, 60000);