# Verify ENTER keystroke is being sent
Write-Host "VERIFYING ENTER KEYSTROKE..." -ForegroundColor Cyan

Add-Type -AssemblyName System.Windows.Forms

# Test ENTER keystroke directly
Write-Host "Step 1: Opening Notepad to test ENTER keystroke..." -ForegroundColor Yellow
Start-Process notepad
Start-Sleep -Milliseconds 2000

Write-Host "Step 2: Typing test text..." -ForegroundColor Yellow
[System.Windows.Forms.SendKeys]::SendWait("Before ENTER")
Start-Sleep -Milliseconds 500

Write-Host "Step 3: Sending ENTER keystroke..." -ForegroundColor Red
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 500

Write-Host "Step 4: Typing after ENTER..." -ForegroundColor Yellow
[System.Windows.Forms.SendKeys]::SendWait("After ENTER")

Write-Host ""
Write-Host "Check Notepad - you should see:" -ForegroundColor Green
Write-Host "Before ENTER" -ForegroundColor White
Write-Host "After ENTER" -ForegroundColor White
Write-Host ""
Write-Host "If the text is on separate lines, ENTER is working." -ForegroundColor Green
Write-Host "If it's all on one line, ENTER is not being sent." -ForegroundColor Red

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Close notepad
Get-Process notepad -ErrorAction SilentlyContinue | Stop-Process -Force