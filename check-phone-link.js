const { exec } = require('child_process');

console.log('🔍 Diagnosing Phone Link Connection Issues...\n');

// Check Phone Link status
exec('powershell -Command "Get-Process | Where-Object {$_.ProcessName -like \'*Phone*\'} | Select-Object ProcessName, Responding"', (error, stdout) => {
    console.log('📱 Phone Link Processes:');
    console.log(stdout || 'No Phone Link processes found');
});

// Check Windows Phone Link service
exec('powershell -Command "Get-Service | Where-Object {$_.Name -like \'*Phone*\'} | Select-Object Name, Status"', (error, stdout) => {
    console.log('\n🔧 Phone Link Services:');
    console.log(stdout || 'No Phone Link services found');
});

// Check Phone Link connection logs
exec('powershell -Command "Get-EventLog -LogName Application -Source \'*Phone*\' -Newest 5 2>$null | Select-Object TimeGenerated, EntryType, Message"', (error, stdout) => {
    console.log('\n📋 Recent Phone Link Events:');
    console.log(stdout || 'No recent Phone Link events found');
});

console.log('\n🎯 DIAGNOSIS COMPLETE');
console.log('\nIf you see red error circles (⚠️) in Phone Link next to messages:');
console.log('1. Your iPhone may not be properly connected to Phone Link');
console.log('2. Phone Link may not have SMS permissions');
console.log('3. Your iPhone may need to re-pair with Phone Link');
console.log('\n📱 TRY THESE FIXES:');
console.log('1. Open Phone Link → Settings → Check iPhone connection');
console.log('2. On iPhone: Settings → General → AirPlay & Handoff → Make sure everything is ON');
console.log('3. Restart both Phone Link and iPhone');
console.log('4. Re-pair iPhone with Phone Link if needed');