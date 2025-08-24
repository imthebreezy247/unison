# Find Phone Link Call API
Write-Host "FINDING PHONE LINK CALL MECHANISM" -ForegroundColor Cyan

# 1. Get Phone Link package
$phoneLinkPkg = Get-AppxPackage -Name Microsoft.YourPhone
if ($phoneLinkPkg) {
    Write-Host "Package Location: $($phoneLinkPkg.InstallLocation)" -ForegroundColor Green
    
    # Look for call-related files
    Write-Host "Searching for CALL-related files:" -ForegroundColor Cyan
    Get-ChildItem -Path $phoneLinkPkg.InstallLocation -Recurse -Include "*call*", "*dial*", "*phone*" -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor White
    }
}

# 2. Check LocalState
$localStatePath = "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState"
if (Test-Path $localStatePath) {
    Write-Host "LocalState found" -ForegroundColor Green
    Get-ChildItem -Path $localStatePath -Include "*.db", "*.sqlite", "*.json" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  File: $($_.Name) - Size: $($_.Length)" -ForegroundColor Cyan
    }
}

# 3. Check protocols
Write-Host "Protocol Handlers:" -ForegroundColor Yellow
@("tel:", "callto:", "ms-call:", "ms-voip-call:") | ForEach-Object {
    $handler = (Get-ItemProperty -Path "HKCR:\$_\shell\open\command" -ErrorAction SilentlyContinue)."(default)"
    if ($handler) {
        Write-Host "  $_ -> $handler" -ForegroundColor Green
    }
}

Write-Host "Done" -ForegroundColor Green