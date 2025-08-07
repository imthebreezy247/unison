@echo off
echo === ANALYZING PHONE LINK NETWORK TRAFFIC ===
echo.

echo [1] Finding Phone Link process and connections...
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq PhoneExperienceHost.exe" /FO CSV /NH') do set PHONE_PID=%%i
if defined PHONE_PID (
    echo Phone Link PID: %PHONE_PID%
    echo Current network connections:
    netstat -ano | findstr %PHONE_PID%
    echo.
)

echo [2] Starting network capture for Phone Link...
echo Please send a message through Phone Link now, then press any key to stop capture...
powershell -Command "Start-Process netsh -ArgumentList 'trace start capture=yes maxSize=50MB tracefile=phonelink_traffic.etl provider=Microsoft-Windows-TCPIP' -WindowStyle Hidden"
pause

echo [3] Stopping network capture...
netsh trace stop
echo.

echo [4] Converting capture to readable format...
netsh trace convert phonelink_traffic.etl
echo.

echo [5] Analyzing captured traffic for API endpoints...
powershell -Command "if(Test-Path 'phonelink_traffic.txt') { Get-Content 'phonelink_traffic.txt' | Select-String -Pattern 'graph\.microsoft\.com|api\.|/messaging|/sms|POST|GET|https://' | Select-Object -First 20 }"
echo.

echo [6] Registry analysis - Phone Link OAuth tokens...
reg query "HKCU\Software\Microsoft\YourPhone" /s | findstr /i "token\|auth\|api\|endpoint"
echo.

echo [7] Check Phone Link local storage for auth data...
echo %LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState
dir "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState\*.json" /b 2>nul
echo.

echo [8] Extract authentication data...
powershell -Command "Get-ChildItem '%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState\*.json' | ForEach-Object { Write-Host \"FILE: $($_.Name)\"; $content = Get-Content $_.FullName | ConvertFrom-Json; $content | Format-List | Out-String | Select-String -Pattern 'token|auth|api|endpoint|url' }"

pause