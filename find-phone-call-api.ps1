# Deep Phone Link CALL Analysis Script
Write-Host "📞 FINDING PHONE LINK CALL MECHANISM" -ForegroundColor Cyan
Write-Host "=" * 50

# 1. Get Phone Link package details
Write-Host "`n[1] Phone Link Package Analysis..." -ForegroundColor Yellow
$phoneLinkPkg = Get-AppxPackage -Name Microsoft.YourPhone
if ($phoneLinkPkg) {
    Write-Host "Package Location: $($phoneLinkPkg.InstallLocation)" -ForegroundColor Green
    
    # Look for call-related files
    Write-Host "`nSearching for CALL-related files:" -ForegroundColor Cyan
    Get-ChildItem -Path $phoneLinkPkg.InstallLocation -Recurse -Include "*call*", "*dial*", "*phone*" -ErrorAction SilentlyContinue | Select-Object -First 20 | ForEach-Object {
        Write-Host "  - $($_.Name)" -ForegroundColor White
    }
}

# 2. Check Phone Link LocalState for call data
Write-Host "`n[2] Phone Link LocalState Analysis..." -ForegroundColor Yellow
$localStatePath = "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState"
if (Test-Path $localStatePath) {
    Write-Host "LocalState found at: $localStatePath" -ForegroundColor Green
    
    # Look for databases
    Get-ChildItem -Path $localStatePath -Include "*.db", "*.sqlite", "*.json" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "  Database/Config: $($_.Name) - Size: $($_.Length) bytes" -ForegroundColor Cyan
        
        # If it's a JSON file, try to read it
        if ($_.Extension -eq ".json") {
            try {
                $content = Get-Content $_.FullName -Raw
                if ($content -like "*call*" -or $content -like "*dial*") {
                    Write-Host "    ⭐ CONTAINS CALL DATA!" -ForegroundColor Red
                    Write-Host "    First 500 chars: $($content.Substring(0, [Math]::Min(500, $content.Length)))" -ForegroundColor Gray
                }
            } catch {}
        }
    }
}

# 3. Check running process for call hooks
Write-Host "`n[3] Phone Link Process Analysis..." -ForegroundColor Yellow
$phoneLinkProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneLinkProcess) {
    Write-Host "Process ID: $($phoneLinkProcess.Id)" -ForegroundColor Green
    
    # Get command line arguments
    $wmi = Get-WmiObject Win32_Process -Filter "ProcessId = $($phoneLinkProcess.Id)"
    Write-Host "Command Line: $($wmi.CommandLine)" -ForegroundColor Cyan
    
    # Check loaded modules for call-related DLLs
    Write-Host "`nCall-related modules:" -ForegroundColor Yellow
    $phoneLinkProcess.Modules | Where-Object { 
        $_.ModuleName -like "*call*" -or 
        $_.ModuleName -like "*dial*" -or 
        $_.ModuleName -like "*tele*" -or
        $_.ModuleName -like "*phone*"
    } | ForEach-Object {
        Write-Host "  - $($_.ModuleName)" -ForegroundColor White
    }
}

# 4. Check registry for call settings
Write-Host "`n[4] Registry Call Settings..." -ForegroundColor Yellow
$regPath = "HKCU:\Software\Microsoft\YourPhone"
if (Test-Path $regPath) {
    Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue | Get-Member -MemberType NoteProperty | Where-Object {
        $_.Name -like "*call*" -or $_.Name -like "*dial*" -or $_.Name -like "*phone*"
    } | ForEach-Object {
        $value = (Get-ItemProperty -Path $regPath).$($_.Name)
        Write-Host "  $($_.Name): $value" -ForegroundColor Cyan
    }
}

# 5. Protocol handlers
Write-Host "`n[5] Protocol Handlers..." -ForegroundColor Yellow
$protocols = @("tel:", "callto:", "ms-call:", "ms-voip-call:")
foreach ($protocol in $protocols) {
    $handler = (Get-ItemProperty -Path "HKCR:\$protocol\shell\open\command" -ErrorAction SilentlyContinue)."(default)"
    if ($handler) {
        Write-Host "  $protocol -> $handler" -ForegroundColor Green
    }
}

# 6. Check for Phone Link API endpoints in memory strings
Write-Host "`n[6] Searching for API endpoints in process memory..." -ForegroundColor Yellow
if ($phoneLinkProcess) {
    # Create a memory dump (simplified)
    $tempFile = "$env:TEMP\phonelink_strings.txt"
    
    # Use PowerShell to extract strings from process
    try {
        # This is a simplified approach - in production you'd use proper memory dumping
        $modules = $phoneLinkProcess.Modules | Select-Object -ExpandProperty FileName
        foreach ($module in $modules | Select-Object -First 5) {
            if (Test-Path $module) {
                $strings = & strings.exe $module 2>$null | Select-String -Pattern "call|dial|phone|/api/|http" | Select-Object -First 20
                if ($strings) {
                    Write-Host "  From $([System.IO.Path]::GetFileName($module)):" -ForegroundColor Cyan
                    $strings | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
                }
            }
        }
    } catch {
        Write-Host "  Could not extract memory strings (need strings.exe from Sysinternals)" -ForegroundColor Gray
    }
}

Write-Host "`nAnalysis Complete!" -ForegroundColor Green
Write-Host "Look for entries marked with star - these are the most important findings!" -ForegroundColor Yellow