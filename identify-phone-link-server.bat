@echo off
echo === IDENTIFYING PHONE LINK SERVER ===
echo.

echo [1] Resolving IP address 40.84.76.75...
nslookup 40.84.76.75
echo.

echo [2] Getting detailed network connections for Phone Link...
for /f "tokens=5" %%i in ('tasklist /FI "IMAGENAME eq PhoneExperienceHost.exe" /FO CSV /NH') do (
    echo Phone Link PID: %%i
    netstat -ano | findstr %%i
)
echo.

echo [3] Checking if this is Microsoft Graph API...
ping graph.microsoft.com
echo.

echo [4] Checking Microsoft services...
ping api.live.com
echo.

echo [5] Looking for Phone Link registry endpoints...
reg query "HKCU\Software\Microsoft\YourPhone" /s | findstr /i "endpoint\|api\|url\|server"
echo.

pause