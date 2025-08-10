# Phone Link Shortcut Analyzer
Write-Host "ANALYZING PHONE LINK SHORTCUT..." -ForegroundColor Cyan

# Get the shortcut from desktop
$shortcutPath = "C:\Users\Public\OneDrive-2\OneDrive\Desktop\Phone Link - Shortcut.lnk"

if (-not (Test-Path $shortcutPath)) {
    Write-Host "Phone Link shortcut not found at: $shortcutPath" -ForegroundColor Red
    Write-Host "Please check the path is correct" -ForegroundColor Yellow
    exit
}

Write-Host "Found shortcut at: $shortcutPath" -ForegroundColor Green

# Create Shell COM object to read shortcut
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)

Write-Host ""
Write-Host "SHORTCUT PROPERTIES:" -ForegroundColor Yellow
Write-Host "Target Path: $($shortcut.TargetPath)" -ForegroundColor White
Write-Host "Arguments: $($shortcut.Arguments)" -ForegroundColor White
Write-Host "Working Directory: $($shortcut.WorkingDirectory)" -ForegroundColor White
Write-Host "Window Style: $($shortcut.WindowStyle)" -ForegroundColor White
Write-Host "Icon Location: $($shortcut.IconLocation)" -ForegroundColor White

# If it's a UWP app, extract the package info
if ($shortcut.TargetPath -like "*explorer.exe*" -and $shortcut.Arguments -like "*shell:AppsFolder*") {
    Write-Host ""
    Write-Host "UWP APP DETECTED!" -ForegroundColor Cyan
    
    # Extract the app ID from arguments
    $appId = $shortcut.Arguments -replace "shell:AppsFolder\\", ""
    Write-Host "App ID: $appId" -ForegroundColor Yellow
    
    # Get package information
    $packageName = $appId.Split("!")[0]
    Write-Host "Package Name: $packageName" -ForegroundColor Yellow
    
    # Get full package info
    try {
        $package = Get-AppxPackage | Where-Object { $_.PackageFamilyName -eq $packageName }
        
        if ($package) {
            Write-Host ""
            Write-Host "PACKAGE DETAILS:" -ForegroundColor Cyan
            Write-Host "Full Name: $($package.Name)" -ForegroundColor White
            Write-Host "Publisher: $($package.Publisher)" -ForegroundColor White
            Write-Host "Version: $($package.Version)" -ForegroundColor White
            Write-Host "Install Location: $($package.InstallLocation)" -ForegroundColor Green
            Write-Host "Package Full Name: $($package.PackageFullName)" -ForegroundColor White
            
            # Check manifest
            $manifestPath = Join-Path $package.InstallLocation "AppxManifest.xml"
            if (Test-Path $manifestPath) {
                Write-Host ""
                Write-Host "MANIFEST FOUND AT: $manifestPath" -ForegroundColor Green
                
                # Read key parts of manifest
                [xml]$manifest = Get-Content $manifestPath
                $appEntry = $manifest.Package.Applications.Application | Where-Object { $_.Id -like "*PhoneExperienceHost*" }
                
                if ($appEntry) {
                    Write-Host "Executable: $($appEntry.Executable)" -ForegroundColor Yellow
                    Write-Host "Entry Point: $($appEntry.EntryPoint)" -ForegroundColor Yellow
                }
            }
            
            # List DLLs in the package
            Write-Host ""
            Write-Host "KEY DLLS IN PACKAGE:" -ForegroundColor Cyan
            Get-ChildItem -Path $package.InstallLocation -Filter "*.dll" | Select-Object -First 20 | ForEach-Object {
                Write-Host "  - $($_.Name)" -ForegroundColor White
            }
        }
    } catch {
        Write-Host "Error getting package info: $_" -ForegroundColor Red
    }
}

# Check for Phone Link processes
Write-Host ""
Write-Host "ACTIVE PHONE LINK PROCESSES:" -ForegroundColor Cyan
Get-Process | Where-Object { $_.Name -like "*Phone*" -or $_.Name -like "*YourPhone*" } | ForEach-Object {
    Write-Host "  - $($_.Name) (PID: $($_.Id))" -ForegroundColor White
    Write-Host "    Path: $($_.Path)" -ForegroundColor Gray
}

# Check registry for Phone Link settings
Write-Host ""
Write-Host "REGISTRY SETTINGS:" -ForegroundColor Cyan
$regPaths = @(
    "HKCU:\Software\Microsoft\YourPhone",
    "HKLM:\SOFTWARE\Microsoft\YourPhone",
    "HKCU:\Software\Classes\ms-phone"
)

foreach ($path in $regPaths) {
    if (Test-Path $path) {
        Write-Host "Found: $path" -ForegroundColor Green
        Get-ChildItem $path -Recurse | Select-Object -First 10 | ForEach-Object {
            Write-Host "  $($_.Name)" -ForegroundColor White
        }
    }
}

Write-Host ""
Write-Host "Run this script and share the output!" -ForegroundColor Yellow