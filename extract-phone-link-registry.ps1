# Extract Phone Link Registry Data
Write-Host "EXTRACTING PHONE LINK REGISTRY DATA..." -ForegroundColor Cyan

# Registry paths to check
$regPaths = @(
    "HKCU:\Software\Classes\ms-phone",
    "HKCU:\Software\Microsoft\YourPhone", 
    "HKLM:\SOFTWARE\Microsoft\YourPhone",
    "HKCU:\Software\Classes\sms",
    "HKCU:\Software\Classes\tel"
)

foreach ($path in $regPaths) {
    Write-Host ""
    Write-Host "=== CHECKING: $path ===" -ForegroundColor Yellow
    
    if (Test-Path $path) {
        Write-Host "FOUND!" -ForegroundColor Green
        
        try {
            # Get all properties at this level
            $props = Get-ItemProperty $path -ErrorAction SilentlyContinue
            if ($props) {
                Write-Host "Properties:" -ForegroundColor Cyan
                $props.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
                    Write-Host "  $($_.Name) = $($_.Value)" -ForegroundColor White
                }
            }
            
            # Get all subkeys recursively
            Write-Host "Subkeys:" -ForegroundColor Cyan
            Get-ChildItem $path -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
                Write-Host "  SUBKEY: $($_.Name)" -ForegroundColor Yellow
                
                # Get properties of each subkey
                $subProps = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
                if ($subProps) {
                    $subProps.PSObject.Properties | Where-Object { $_.Name -notlike "PS*" } | ForEach-Object {
                        Write-Host "    $($_.Name) = $($_.Value)" -ForegroundColor White
                    }
                }
            }
        } catch {
            Write-Host "Error reading registry: $($_.Exception.Message)" -ForegroundColor Red
        }
    } else {
        Write-Host "NOT FOUND" -ForegroundColor Red
    }
}

# Also check for Phone Link app registration
Write-Host ""
Write-Host "=== PHONE LINK APP REGISTRATION ===" -ForegroundColor Yellow
try {
    $appReg = Get-ChildItem "HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\AppModel\Repository\Packages" | 
              Where-Object { $_.Name -like "*YourPhone*" -or $_.Name -like "*PhoneLink*" }
              
    if ($appReg) {
        $appReg | ForEach-Object {
            Write-Host "Found app package: $($_.Name)" -ForegroundColor Green
            Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue | 
            Select-Object * | Format-List | Out-String | Write-Host -ForegroundColor White
        }
    }
} catch {
    Write-Host "Could not read app registration" -ForegroundColor Red
}

Write-Host ""
Write-Host "Registry extraction complete!" -ForegroundColor Green