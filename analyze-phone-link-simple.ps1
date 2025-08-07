# Simple Phone Link Analysis
Write-Host "PHONE LINK ANALYSIS RESULTS" -ForegroundColor Green

# 1. Key protocols found
Write-Host "`n=== PROTOCOLS FOUND ===" -ForegroundColor Yellow
Write-Host "ms-phone: - Main Phone Link protocol"
Write-Host "tel: - Telephone protocol"  
Write-Host "sms: - SMS protocol"

# 2. Key DLLs for messaging
Write-Host "`n=== KEY MESSAGING DLLs ===" -ForegroundColor Yellow
Write-Host "YourPhone.Messaging.WinRT.dll - Main messaging runtime"
Write-Host "YourPhone.YPP.ServicesClient.dll - Services client (API calls)"
Write-Host "YourPhone.Connectivity.Protocol.dll - Connectivity protocol"
Write-Host "Microsoft.AspNetCore.SignalR.Client.dll - SignalR for real-time communication"

# 3. Network connections
Write-Host "`n=== NETWORK ANALYSIS ===" -ForegroundColor Yellow
$phoneProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneProcess) {
    Write-Host "Phone Link Process ID: $($phoneProcess.Id)"
    $connections = Get-NetTCPConnection -OwningProcess $phoneProcess.Id -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.State -eq "Established" -and $conn.RemotePort -eq 443) {
            Write-Host "HTTPS Connection: $($conn.RemoteAddress):$($conn.RemotePort)" -ForegroundColor Cyan
            try {
                $hostname = [System.Net.Dns]::GetHostEntry($conn.RemoteAddress).HostName
                Write-Host "  -> Hostname: $hostname" -ForegroundColor Green
            } catch {
                Write-Host "  -> Hostname: Could not resolve"
            }
        }
    }
}

# 4. Check for authentication data
Write-Host "`n=== AUTHENTICATION SEARCH ===" -ForegroundColor Yellow
$tokenPaths = @(
    "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState",
    "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\Settings"
)

foreach ($path in $tokenPaths) {
    if (Test-Path $path) {
        Write-Host "Checking: $path"
        Get-ChildItem $path -Include "*.json" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  Found config file: $($_.Name)"
        }
    }
}

Write-Host "`n=== NEXT STEPS FOR HIJACKING ===" -ForegroundColor Red
Write-Host "1. Use SignalR client to connect to Microsoft's messaging servers"
Write-Host "2. Reverse engineer the authentication tokens in LocalState"
Write-Host "3. Use YourPhone.YPP.ServicesClient.dll methods directly"
Write-Host "4. Implement ms-phone:// protocol handler"