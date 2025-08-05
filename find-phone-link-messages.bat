@echo off
echo === COMPREHENSIVE PHONE LINK MESSAGE SEARCH ===
echo.

echo [1] Searching all Phone Link folders for message-related files...
cd /d "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe"
dir /s /b *message* *sms* *chat* *conversation* 2>nul
echo.

echo [2] Looking for JSON/XML data files...
dir /s /b *.json *.xml 2>nul | findstr /i "message sms chat conversation notification"
echo.

echo [3] Checking Phone Link process memory location...
echo %LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\AC\Temp
dir "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\AC\Temp" /b 2>nul
echo.

echo [4] Checking AppData Roaming for Phone Link...
dir "%APPDATA%\*Phone*" /b 2>nul
echo.

echo [5] Looking in Windows notification database...
echo %LOCALAPPDATA%\Microsoft\Windows\Notifications
dir "%LOCALAPPDATA%\Microsoft\Windows\Notifications\*.db" /b 2>nul
echo.

echo [6] Checking system event logs for Phone Link activity...
wevtutil qe Application /q:"*[System[Provider[@Name='Microsoft.YourPhone']]]" /f:text /c:5 2>nul
echo.

pause