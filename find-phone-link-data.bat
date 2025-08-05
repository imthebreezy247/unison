@echo off
echo === FINDING PHONE LINK DATA ===
echo.

echo [1] Phone Link Package Location:
echo %LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe
echo.

echo [2] Searching for databases...
cd /d "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe"
dir /s /b *.db *.sqlite *.sqlite3 2>nul
echo.

echo [3] Phone Link Local State folder:
cd /d "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalState"
dir /b 2>nul
echo.

echo [4] Phone Link Settings folder:
cd /d "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\Settings"
dir /b 2>nul
echo.

echo [5] Phone Link LocalCache folder:
cd /d "%LOCALAPPDATA%\Packages\Microsoft.YourPhone_8wekyb3d8bbwe\LocalCache"
dir /b 2>nul
echo.

echo [6] Phone Link processes:
powershell -Command "Get-Process | Where-Object {$_.ProcessName -like '*Phone*' -or $_.ProcessName -like '*YourPhone*'} | Format-Table ProcessName, Id, Path -AutoSize"
echo.

pause