# Deep Phone Link Analysis Script
Write-Host "🔍 DEEP PHONE LINK ANALYSIS" -ForegroundColor Cyan
Write-Host "=" * 50

# 1. Get Phone Link package details
Write-Host "`n[1] Phone Link Package Analysis..." -ForegroundColor Yellow
$phoneLinkPkg = Get-AppxPackage -Name Microsoft.YourPhone
if ($phoneLinkPkg) {
    Write-Host "Package Location: $($phoneLinkPkg.InstallLocation)" -ForegroundColor Green
    Write-Host "Version: $($phoneLinkPkg.Version)" -ForegroundColor Green
    
    # Analyze manifest for protocols and API endpoints
    $manifestPath = Join-Path $phoneLinkPkg.InstallLocation "AppxManifest.xml"
    if (Test-Path $manifestPath) {
        Write-Host "`nManifest Analysis:" -ForegroundColor Cyan
        [xml]$manifest = Get-Content $manifestPath
        
        # Extract protocols
        $protocols = $manifest.Package.Applications.Application.Extensions.Extension | Where-Object { $_.Category -eq "windows.protocol" }
        foreach ($protocol in $protocols) {
            Write-Host "Protocol: $($protocol.Protocol.Name)" -ForegroundColor Magenta
        }
        
        # Extract capabilities
        Write-Host "`nCapabilities:" -ForegroundColor Cyan
        $manifest.Package.Capabilities.Capability | ForEach-Object {
            Write-Host "- $($_.Name)" -ForegroundColor White
        }
    }
}

# 2. Memory analysis of running Phone Link process
Write-Host "`n[2] Process Memory Analysis..." -ForegroundColor Yellow
$phoneLinkProcess = Get-Process -Name "PhoneExperienceHost" -ErrorAction SilentlyContinue
if ($phoneLinkProcess) {
    Write-Host "Process ID: $($phoneLinkProcess.Id)" -ForegroundColor Green
    Write-Host "Memory Usage: $([math]::Round($phoneLinkProcess.WorkingSet64 / 1MB, 2)) MB" -ForegroundColor Green
    
    # Get loaded modules (DLLs) that might contain API endpoints
    Write-Host "`nLoaded Modules with API relevance:" -ForegroundColor Cyan
    $phoneLinkProcess.Modules | Where-Object { 
        $_.ModuleName -like "*http*" -or 
        $_.ModuleName -like "*web*" -or 
        $_.ModuleName -like "*net*" -or
        $_.ModuleName -like "*graph*" -or
        $_.ModuleName -like "*communication*"
    } | ForEach-Object {
        Write-Host "- $($_.ModuleName): $($_.FileName)" -ForegroundColor White
    }
}

# 3. Network connections analysis
Write-Host "`n[3] Network Connections Analysis..." -ForegroundColor Yellow
if ($phoneLinkProcess) {
    $connections = Get-NetTCPConnection -OwningProcess $phoneLinkProcess.Id -ErrorAction SilentlyContinue
    foreach ($conn in $connections) {
        if ($conn.State -eq "Established" -and $conn.RemotePort -eq 443) {
            Write-Host "HTTPS Connection: $($conn.RemoteAddress):$($conn.RemotePort)" -ForegroundColor Green
            
            # Try to resolve hostname
            try {
                $hostname = [System.Net.Dns]::GetHostEntry($conn.RemoteAddress).HostName
                Write-Host "  Hostname: $hostname" -ForegroundColor Cyan
                
                # Check if it's Microsoft Graph or related service
                if ($hostname -like "*microsoft.com*" -or $hostname -like "*office365.com*" -or $hostname -like "*graph*") {
                    Write-Host "  ⭐ POTENTIAL API ENDPOINT!" -ForegroundColor Red
                }
            } catch {
                Write-Host "  Hostname: Could not resolve" -ForegroundColor Gray
            }
        }
    }
}

# 4. Registry analysis for authentication
Write-Host "`n[4] Registry Authentication Analysis..." -ForegroundColor Yellow
$regPaths = @(
    "HKCU:\Software\Microsoft\YourPhone",
    "HKLM:\SOFTWARE\Microsoft\YourPhone",
    "HKCU:\Software\Classes\ms-phone"
)

foreach ($regPath in $regPaths) {
    if (Test-Path $regPath) {
        Write-Host "`nRegistry Path: $regPath" -ForegroundColor Cyan
        Get-ItemProperty -Path $regPath -ErrorAction SilentlyContinue | Format-List
        
        # Look for subkeys
        Get-ChildItem -Path $regPath -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  Subkey: $($_.Name)" -ForegroundColor White
        }
    }
}

# 5. Local storage analysis
Write-Host "`n[5] Local Storage Analysis..." -ForegroundColor Yellow
$localStoragePaths = @(
    "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState",
    "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\Settings",
    "$env:LOCALAPPDATA\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\RoamingState"
)

foreach ($path in $localStoragePaths) {
    if (Test-Path $path) {
        Write-Host "`nAnalyzing: $path" -ForegroundColor Cyan
        Get-ChildItem $path -Include "*.json", "*.xml", "*.config", "*.dat" -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
            Write-Host "  File: $($_.Name) ($($_.Length) bytes)" -ForegroundColor White
            
            if ($_.Extension -eq ".json") {
                try {
                    $content = Get-Content $_.FullName | ConvertFrom-Json
                    $content | Get-Member -MemberType NoteProperty | ForEach-Object {
                        if ($_.Name -like "*token*" -or $_.Name -like "*auth*" -or $_.Name -like "*api*" -or $_.Name -like "*endpoint*") {
                            Write-Host "    🔑 Key found: $($_.Name)" -ForegroundColor Red
                        }
                    }
                } catch {
                    Write-Host "    Could not parse JSON" -ForegroundColor Gray
                }
            }
        }
    }
}

# 6. DLL string extraction for API endpoints
Write-Host "`n[6] DLL String Analysis..." -ForegroundColor Yellow
if ($phoneLinkPkg) {
    $dllFiles = Get-ChildItem "$($phoneLinkPkg.InstallLocation)\*.dll" -ErrorAction SilentlyContinue
    foreach ($dll in $dllFiles | Select-Object -First 5) {
        Write-Host "`nAnalyzing DLL: $($dll.Name)" -ForegroundColor Cyan
        
        try {
            # Use .NET reflection to analyze managed DLLs
            $assembly = [System.Reflection.Assembly]::LoadFrom($dll.FullName)
            $types = $assembly.GetTypes() | Where-Object { $_.Name -like "*Api*" -or $_.Name -like "*Http*" -or $_.Name -like "*Message*" }
            
            foreach ($type in $types | Select-Object -First 3) {
                Write-Host "  Class: $($type.Name)" -ForegroundColor Magenta
                $type.GetMethods() | Where-Object { $_.Name -like "*Send*" -or $_.Name -like "*Message*" -or $_.Name -like "*Api*" } | ForEach-Object {
                    Write-Host "    Method: $($_.Name)" -ForegroundColor White
                }
            }
        } catch {
            Write-Host "  Could not analyze managed DLL (might be native)" -ForegroundColor Gray
        }
    }
}

# 7. Event log analysis for API calls
Write-Host "`n[7] Event Log Analysis..." -ForegroundColor Yellow
try {
    $events = Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='Microsoft.YourPhone'} -MaxEvents 10 -ErrorAction SilentlyContinue
    foreach ($event in $events) {
        if ($event.Message -like "*http*" -or $event.Message -like "*api*" -or $event.Message -like "*endpoint*") {
            Write-Host "Event: $($event.Message)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "No Phone Link events found in Application log" -ForegroundColor Gray
}

Write-Host "`n✅ Analysis Complete!" -ForegroundColor Green
Write-Host "Look for entries marked with ⭐ and 🔑 - these are the most important findings!" -ForegroundColor Yellow