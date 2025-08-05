const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 MONITORING PHONE LINK ACTIVITY...\n');

// Monitor file system activity
console.log('📁 Monitoring Phone Link file activity...');
exec('powershell.exe -Command "Get-Process PhoneExperienceHost | Select-Object -ExpandProperty Id"', (err, stdout) => {
  if (!err && stdout.trim()) {
    const pid = stdout.trim();
    console.log(`   Phone Link PID: ${pid}`);
    
    // Use Process Monitor equivalent
    exec(`powershell.exe -Command "Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Kernel-File/Analytic'; ID=12,14} | Where-Object {$_.Message -like '*PhoneExperienceHost*'} | Select-Object -First 10 | Format-List"`, (err, stdout) => {
      if (stdout) {
        console.log('   Recent file activity:');
        console.log(stdout);
      }
    });
  }
});

// Check Windows notification store
console.log('\n📬 Checking Windows notification database...');
const notifDb = 'C:\\Users\\shann\\AppData\\Local\\Microsoft\\Windows\\Notifications\\wpndatabase.db';
if (fs.existsSync(notifDb)) {
  console.log(`   Found notification database: ${notifDb}`);
  console.log('   This likely contains Phone Link message notifications!');
}

// Monitor registry for Phone Link settings
console.log('\n🔑 Checking Phone Link registry...');
exec('powershell.exe -Command "Get-ItemProperty -Path \'HKCU:\\Software\\Microsoft\\YourPhone\' -ErrorAction SilentlyContinue | Format-List"', (err, stdout) => {
  if (stdout) {
    console.log('   Registry settings:');
    console.log(stdout);
  }
});

// Check for Phone Link web cache
console.log('\n🌐 Searching for Phone Link web cache...');
const webCachePaths = [
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\AC\\INetCache',
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\AC\\INetCookies',
  'C:\\Users\\shann\\AppData\\Local\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\AC\\INetHistory'
];

webCachePaths.forEach(cachePath => {
  if (fs.existsSync(cachePath)) {
    console.log(`   Found cache: ${cachePath}`);
    try {
      const files = fs.readdirSync(cachePath);
      if (files.length > 0) {
        console.log(`      Files: ${files.slice(0, 5).join(', ')}...`);
      }
    } catch (e) {
      // Ignore errors
    }
  }
});

// Network monitoring suggestion
console.log('\n\n🌐 NETWORK MONITORING STRATEGY:');
console.log('Phone Link likely uses HTTP/WebSocket to communicate with Microsoft servers.');
console.log('To intercept messages, we need to:');
console.log('1. Use Fiddler or mitmproxy to capture Phone Link HTTPS traffic');
console.log('2. Find the API endpoints (likely graph.microsoft.com or similar)');
console.log('3. Reverse engineer the authentication tokens');
console.log('4. Implement the protocol directly in UnisonX');

// Alternative approach
console.log('\n\n💡 ALTERNATIVE APPROACH - ACCESSIBILITY API:');
console.log('Instead of UI automation or hijacking, we can use:');
console.log('1. Windows UI Automation Accessibility API to read Phone Link UI');
console.log('2. Monitor accessibility events for new messages');
console.log('3. Use accessibility API to send messages programmatically');
console.log('4. This is more reliable than SendKeys!');

console.log('\n✅ Monitoring complete!');