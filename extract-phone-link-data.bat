@echo off
echo === EXTRACTING PHONE LINK DATA ===
echo.

echo [1] Analyzing Phone Link shortcut properties...
powershell -Command "Get-ItemProperty '%USERPROFILE%\Desktop\*Phone Link*' | Format-List *"
echo.

echo [2] Phone Link installation location...
echo %ProgramFiles%\WindowsApps\Microsoft.YourPhone*
dir "%ProgramFiles%\WindowsApps\Microsoft.YourPhone*" /b 2>nul
echo.

echo [3] Extracting Phone Link package information...
powershell -Command "Get-AppxPackage -Name Microsoft.YourPhone | Select-Object Name, PackageFullName, InstallLocation, SignatureKind, Status | Format-List"
echo.

echo [4] Phone Link manifest (contains API endpoints and protocols)...
powershell -Command "$pkg = Get-AppxPackage -Name Microsoft.YourPhone; if($pkg) { Get-Content \"$($pkg.InstallLocation)\AppxManifest.xml\" | Select-String -Pattern 'Protocol|EntryPoint|Executable|PhoneNumber|SMS|Message|API|http' }"
echo.

echo [5] Checking Phone Link DLLs for API references...
powershell -Command "$pkg = Get-AppxPackage -Name Microsoft.YourPhone; if($pkg) { Get-ChildItem \"$($pkg.InstallLocation)\*.dll\" | ForEach-Object { Write-Host \"DLL: $($_.Name)\"; strings $_.FullName 2>nul | Select-String -Pattern 'graph.microsoft.com|api|endpoint|message|sms' | Select-Object -First 5 }}"
echo.

echo [6] Phone Link configuration files...
powershell -Command "$pkg = Get-AppxPackage -Name Microsoft.YourPhone; if($pkg) { Get-ChildItem \"$($pkg.InstallLocation)\" -Include '*.json','*.xml','*.config' -Recurse | ForEach-Object { Write-Host \"FILE: $($_.Name)\"; Get-Content $_.FullName | Select-String -Pattern 'api|endpoint|url|server' | Select-Object -First 3 }}"
echo.

echo [7] Extracting strings from Phone Link executable...
echo Searching for API endpoints in PhoneExperienceHost.exe...
powershell -Command "$pkg = Get-AppxPackage -Name Microsoft.YourPhone; if($pkg) { $exe = Join-Path $pkg.InstallLocation 'PhoneExperienceHost.exe'; if(Test-Path $exe) { Write-Host 'Extracting strings from executable...'; [System.IO.File]::ReadAllBytes($exe) | ForEach-Object { [char]$_ } -join '' | Select-String -Pattern 'https://[^\s]+|graph\.microsoft\.com[^\s]*|/api/[^\s]+' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique }}"
echo.

pause