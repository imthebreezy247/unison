# Simple Phone Link Call Automation via Keyboard
Write-Host "Testing Simple Call Method" -ForegroundColor Cyan

# Start Phone Link
Start-Process "ms-phone:" -WindowStyle Normal
Start-Sleep -Seconds 2

# Load Windows Forms for SendKeys
Add-Type -AssemblyName System.Windows.Forms

# Try keyboard shortcut for calls
Write-Host "Trying Ctrl+D for dial pad..." -ForegroundColor Yellow
[System.Windows.Forms.SendKeys]::SendWait("^d")
Start-Sleep -Milliseconds 1500

# Type the phone number
$phoneNumber = "9415180701"
Write-Host "Typing phone number: $phoneNumber" -ForegroundColor Cyan
[System.Windows.Forms.SendKeys]::SendWait($phoneNumber)
Start-Sleep -Milliseconds 1000

# Press Enter to call
Write-Host "Pressing Enter to initiate call..." -ForegroundColor Green
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")

Write-Host "Call automation attempted!" -ForegroundColor Green