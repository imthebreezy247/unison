const { exec } = require('child_process');

console.log('🔍 TESTING PHONE LINK SIGNALR HIJACKER...\n');

// Test 1: Check if Phone Link DLLs exist
console.log('[1] Testing Phone Link DLL access...');
const dllScript = `
$phoneLinkPath = "C:\\Program Files\\WindowsApps\\Microsoft.YourPhone_1.25061.51.0_x64__8wekyb3d8bbwe"
Write-Output "DLL_PATH_CHECK: $phoneLinkPath"

if (Test-Path $phoneLinkPath) {
    Write-Output "DLL_PATH_EXISTS: True"
    
    $dlls = @(
        "YourPhone.YPP.ServicesClient.dll",
        "YourPhone.Messaging.WinRT.dll",
        "Microsoft.AspNetCore.SignalR.Client.dll"
    )
    
    foreach ($dll in $dlls) {
        $fullPath = Join-Path $phoneLinkPath $dll
        if (Test-Path $fullPath) {
            Write-Output "DLL_FOUND: $dll"
        } else {
            Write-Output "DLL_MISSING: $dll"
        }
    }
} else {
    Write-Output "DLL_PATH_EXISTS: False"
}
`;

exec(`powershell.exe -ExecutionPolicy Bypass -Command "${dllScript}"`, (error, stdout, stderr) => {
    console.log('DLL Test Output:', stdout);
    if (stderr) console.log('DLL Test Errors:', stderr);
    
    // Test 2: Check Phone Link LocalState
    console.log('\n[2] Testing Phone Link LocalState access...');
    const localStateScript = `
$localStatePath = "$env:LOCALAPPDATA\\Packages\\Microsoft.YourPhone_8wekyb3d8bbwe\\LocalState"
Write-Output "LOCALSTATE_PATH: $localStatePath"

if (Test-Path $localStatePath) {
    Write-Output "LOCALSTATE_EXISTS: True"
    
    $jsonFiles = Get-ChildItem $localStatePath -Include "*.json" -Recurse -ErrorAction SilentlyContinue
    Write-Output "JSON_FILES_COUNT: $($jsonFiles.Count)"
    
    foreach ($file in $jsonFiles) {
        Write-Output "JSON_FILE: $($file.Name) - Size: $($file.Length) bytes"
    }
} else {
    Write-Output "LOCALSTATE_EXISTS: False"
}
`;
    
    exec(`powershell.exe -ExecutionPolicy Bypass -Command "${localStateScript}"`, (error, stdout2, stderr2) => {
        console.log('LocalState Test Output:', stdout2);
        if (stderr2) console.log('LocalState Test Errors:', stderr2);
        
        // Test 3: Check if we can load DLLs
        console.log('\n[3] Testing DLL loading...');
        const loadTestScript = `
try {
    $phoneLinkPath = "C:\\Program Files\\WindowsApps\\Microsoft.YourPhone_1.25061.51.0_x64__8wekyb3d8bbwe"
    Add-Type -Path "$phoneLinkPath\\YourPhone.YPP.Common.dll" -ErrorAction SilentlyContinue
    Write-Output "COMMON_DLL_LOADED: Success"
} catch {
    Write-Output "COMMON_DLL_LOADED: Failed - $($_.Exception.Message)"
}

try {
    Add-Type -Path "$phoneLinkPath\\YourPhone.Messaging.WinRT.dll" -ErrorAction SilentlyContinue  
    Write-Output "MESSAGING_DLL_LOADED: Success"
} catch {
    Write-Output "MESSAGING_DLL_LOADED: Failed - $($_.Exception.Message)"
}
`;
        
        exec(`powershell.exe -ExecutionPolicy Bypass -Command "${loadTestScript}"`, (error, stdout3, stderr3) => {
            console.log('DLL Loading Test Output:', stdout3);
            if (stderr3) console.log('DLL Loading Test Errors:', stderr3);
            
            console.log('\n=== DIAGNOSIS COMPLETE ===');
            console.log('Check the output above to see what\'s blocking the SignalR hijacker.');
        });
    });
});