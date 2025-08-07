@echo off
echo === TESTING PHONE LINK ACCESS ===
echo.

echo [1] Checking Phone Link installation path...
set PHONE_LINK_PATH=C:\Program Files\WindowsApps\Microsoft.YourPhone_1.25061.51.0_x64__8wekyb3d8bbwe
echo Phone Link Path: %PHONE_LINK_PATH%

if exist "%PHONE_LINK_PATH%" (
    echo ✅ Phone Link directory exists
) else (
    echo ❌ Phone Link directory not found
)

echo.
echo [2] Checking key DLL files...
set DLL1=%PHONE_LINK_PATH%\YourPhone.YPP.ServicesClient.dll
set DLL2=%PHONE_LINK_PATH%\YourPhone.Messaging.WinRT.dll
set DLL3=%PHONE_LINK_PATH%\Microsoft.AspNetCore.SignalR.Client.dll

if exist "%DLL1%" (echo ✅ YourPhone.YPP.ServicesClient.dll found) else (echo ❌ YourPhone.YPP.ServicesClient.dll missing)
if exist "%DLL2%" (echo ✅ YourPhone.Messaging.WinRT.dll found) else (echo ❌ YourPhone.Messaging.WinRT.dll missing)
if exist "%DLL3%" (echo ✅ Microsoft.AspNetCore.SignalR.Client.dll found) else (echo ❌ Microsoft.AspNetCore.SignalR.Client.dll missing)

echo.
echo [3] Checking LocalState directory...
set LOCALSTATE_PATH=%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState
echo LocalState Path: %LOCALSTATE_PATH%

if exist "%LOCALSTATE_PATH%" (
    echo ✅ LocalState directory exists
    echo Files in LocalState:
    dir "%LOCALSTATE_PATH%" /b
) else (
    echo ❌ LocalState directory not found
)

echo.
echo [4] Testing simple PowerShell execution...
powershell -Command "Write-Output 'PowerShell Test: Success'"

echo.
echo [5] Checking Phone Link process...
tasklist /FI "IMAGENAME eq PhoneExperienceHost.exe" | find "PhoneExperienceHost"
if %ERRORLEVEL%==0 (
    echo ✅ Phone Link process is running
) else (
    echo ❌ Phone Link process not running
)

pause