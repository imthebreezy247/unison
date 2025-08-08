const { exec } = require('child_process');

console.log('🔍 DIAGNOSING WHY PHONE LINK MESSAGES DON\'T SEND TO iPHONE...\n');

console.log('STEP 1: Please manually send a test message through Phone Link now!');
console.log('1. Open Phone Link manually');
console.log('2. Send a test message to your iPhone');  
console.log('3. Press any key here when done...\n');

process.stdin.once('data', () => {
    console.log('🕵️ Now monitoring what Phone Link does when REAL messages are sent...\n');
    
    // Monitor Phone Link network activity during real message sending
    const networkMonitorScript = `
# Monitor Phone Link network connections during real sending
$phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneProcess) {
    $pid = $phoneProcess.Id
    Write-Output "MONITORING_PID: $pid"
    
    # Capture network activity for 30 seconds
    for ($i = 0; $i -lt 30; $i++) {
        $connections = Get-NetTCPConnection -OwningProcess $pid -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Established" }
        
        foreach ($conn in $connections) {
            $timestamp = Get-Date -Format "HH:mm:ss"
            Write-Output "[$timestamp] CONNECTION: $($conn.LocalAddress):$($conn.LocalPort) -> $($conn.RemoteAddress):$($conn.RemotePort)"
            
            # Check for HTTPS traffic (port 443)
            if ($conn.RemotePort -eq 443) {
                try {
                    $hostname = [System.Net.Dns]::GetHostEntry($conn.RemoteAddress).HostName
                    Write-Output "[$timestamp] HTTPS_SERVER: $hostname"
                } catch {
                    Write-Output "[$timestamp] HTTPS_IP: $($conn.RemoteAddress)"
                }
            }
        }
        
        Start-Sleep -Seconds 1
    }
}

Write-Output "NETWORK_MONITORING_COMPLETE"
`;
    
    exec(`powershell.exe -ExecutionPolicy Bypass -Command "${networkMonitorScript}"`,
        { maxBuffer: 5 * 1024 * 1024 },
        (error, stdout, stderr) => {
            console.log('📡 Network monitoring during real message sending:');
            console.log(stdout);
            
            // Now compare with our automation
            console.log('\n🤖 Now testing our automation and comparing network activity...');
            
            const automationTestScript = `
# Test our automation and monitor network
$phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneProcess) {
    $pid = $phoneProcess.Id
    Write-Output "AUTOMATION_TEST_START"
    
    # Launch Phone Link with message (simulating our automation)
    $uri = "ms-phone:?PhoneNumber=9415180701&Body=TEST"
    Start-Process $uri
    Start-Sleep -Seconds 3
    
    # Send ENTER key (like our automation does)
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
    
    Write-Output "AUTOMATION_ENTER_SENT"
    
    # Monitor network for next 10 seconds to see if connections are made
    for ($i = 0; $i -lt 10; $i++) {
        $connections = Get-NetTCPConnection -OwningProcess $pid -ErrorAction SilentlyContinue | Where-Object { $_.State -eq "Established" -and $_.RemotePort -eq 443 }
        
        if ($connections.Count -gt 0) {
            Write-Output "AUTOMATION_HTTPS_ACTIVITY_DETECTED"
            break
        }
        
        Start-Sleep -Seconds 1
    }
    
    Write-Output "AUTOMATION_TEST_COMPLETE"
}
`;
            
            exec(`powershell.exe -ExecutionPolicy Bypass -Command "${automationTestScript}"`,
                (error2, stdout2, stderr2) => {
                    console.log('\n🤖 Automation test results:');
                    console.log(stdout2);
                    
                    console.log('\n=== DIAGNOSIS RESULTS ===');
                    
                    // Check if real sending creates HTTPS activity
                    const realHasHTTPS = stdout.includes('HTTPS_SERVER:') || stdout.includes('HTTPS_IP:');
                    const automationHasHTTPS = stdout2.includes('AUTOMATION_HTTPS_ACTIVITY_DETECTED');
                    
                    console.log(`Real Phone Link HTTPS activity: ${realHasHTTPS ? 'YES' : 'NO'}`);
                    console.log(`Our automation HTTPS activity: ${automationHasHTTPS ? 'YES' : 'NO'}`);
                    
                    if (realHasHTTPS && !automationHasHTTPS) {
                        console.log('\n🎯 PROBLEM FOUND: Our automation doesn\'t trigger HTTPS requests!');
                        console.log('📋 SOLUTION: We need to find the exact UI element/action that triggers the server request.');
                        
                        console.log('\n🔧 Next steps:');
                        console.log('1. The ENTER key alone isn\'t enough');
                        console.log('2. Phone Link needs a specific button click or UI interaction');
                        console.log('3. We need to find the actual "Send" button in the Phone Link UI');
                        
                    } else if (!realHasHTTPS) {
                        console.log('\n⚠️ ISSUE: Even manual Phone Link doesn\'t create HTTPS activity.');
                        console.log('This might mean Phone Link isn\'t properly connected to your iPhone.');
                        
                    } else {
                        console.log('\n✅ Both real and automation create HTTPS activity - different issue.');
                    }
                }
            );
        }
    );
});

console.log('Waiting for you to send a manual message...');