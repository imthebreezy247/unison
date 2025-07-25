# UnisonX NSIS Installer Script
# Advanced Windows installer configuration

!define PRODUCT_NAME "UnisonX"
!define PRODUCT_VERSION "1.0.0"
!define PRODUCT_PUBLISHER "UnisonX Development Team"
!define PRODUCT_WEB_SITE "https://github.com/unisonx/unisonx"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\UnisonX.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

# Installer attributes
Name "${PRODUCT_NAME}"
OutFile "UnisonX-Setup.exe"
InstallDir "$PROGRAMFILES64\UnisonX"
InstallDirRegKey HKLM "${PRODUCT_DIR_REGKEY}" ""
ShowInstDetails show
ShowUnInstDetails show
RequestExecutionLevel admin

# Modern UI
!include "MUI2.nsh"

# UI Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"

# Welcome page
!insertmacro MUI_PAGE_WELCOME

# License page
!insertmacro MUI_PAGE_LICENSE "license.txt"

# Directory page
!insertmacro MUI_PAGE_DIRECTORY

# Components page
!define MUI_COMPONENTSPAGE_SMALLDESC
!insertmacro MUI_PAGE_COMPONENTS

# Start menu page
var ICONS_GROUP
!define MUI_STARTMENUPAGE_NODISABLE
!define MUI_STARTMENUPAGE_DEFAULTFOLDER "UnisonX"
!define MUI_STARTMENUPAGE_REGISTRY_ROOT "${PRODUCT_UNINST_ROOT_KEY}"
!define MUI_STARTMENUPAGE_REGISTRY_KEY "${PRODUCT_UNINST_KEY}"
!define MUI_STARTMENUPAGE_REGISTRY_VALUENAME "NSIS:StartMenuDir"
!insertmacro MUI_PAGE_STARTMENU Application $ICONS_GROUP

# Installation page
!insertmacro MUI_PAGE_INSTFILES

# Finish page
!define MUI_FINISHPAGE_RUN "$INSTDIR\UnisonX.exe"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.md"
!insertmacro MUI_PAGE_FINISH

# Uninstaller pages
!insertmacro MUI_UNPAGE_INSTFILES

# Language files
!insertmacro MUI_LANGUAGE "English"

# Reserve files
!insertmacro MUI_RESERVEFILE_INSTALLOPTIONS

Section "UnisonX Core" SEC01
  SetOutPath "$INSTDIR"
  SetOverwrite ifnewer
  
  # Main application files
  File /r "build\*.*"
  
  # Create shortcuts
  CreateDirectory "$SMPROGRAMS\$ICONS_GROUP"
  CreateShortCut "$SMPROGRAMS\$ICONS_GROUP\UnisonX.lnk" "$INSTDIR\UnisonX.exe"
  CreateShortCut "$DESKTOP\UnisonX.lnk" "$INSTDIR\UnisonX.exe"
  
  # Register file associations
  WriteRegStr HKCR ".unisonx" "" "UnisonXBackup"
  WriteRegStr HKCR "UnisonXBackup" "" "UnisonX Backup File"
  WriteRegStr HKCR "UnisonXBackup\DefaultIcon" "" "$INSTDIR\UnisonX.exe,0"
  WriteRegStr HKCR "UnisonXBackup\shell\open\command" "" "$INSTDIR\UnisonX.exe $\"%1$\""
  
  # Register protocol handler
  WriteRegStr HKCR "unisonx" "" "URL:UnisonX Protocol"
  WriteRegStr HKCR "unisonx" "URL Protocol" ""
  WriteRegStr HKCR "unisonx\DefaultIcon" "" "$INSTDIR\UnisonX.exe,0"
  WriteRegStr HKCR "unisonx\shell\open\command" "" "$INSTDIR\UnisonX.exe $\"%1$\""
SectionEnd

Section "USB Drivers" SEC02
  SetOutPath "$INSTDIR\drivers"
  
  # Install USB drivers for iPhone connectivity
  File /r "drivers\*.*"
  
  # Register drivers
  ExecWait '"$INSTDIR\drivers\install_drivers.bat"'
SectionEnd

Section "Start Menu Shortcuts" SEC03
  !insertmacro MUI_STARTMENU_WRITE_BEGIN Application
  CreateDirectory "$SMPROGRAMS\$ICONS_GROUP"
  CreateShortCut "$SMPROGRAMS\$ICONS_GROUP\UnisonX.lnk" "$INSTDIR\UnisonX.exe"
  CreateShortCut "$SMPROGRAMS\$ICONS_GROUP\Uninstall.lnk" "$INSTDIR\uninst.exe"
  !insertmacro MUI_STARTMENU_WRITE_END
SectionEnd

Section -AdditionalIcons
  WriteIniStr "$INSTDIR\${PRODUCT_NAME}.url" "InternetShortcut" "URL" "${PRODUCT_WEB_SITE}"
  CreateShortCut "$SMPROGRAMS\$ICONS_GROUP\Website.lnk" "$INSTDIR\${PRODUCT_NAME}.url"
SectionEnd

Section -Post
  WriteUninstaller "$INSTDIR\uninst.exe"
  WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\UnisonX.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\UnisonX.exe"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
  WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
SectionEnd

Function un.onUninstSuccess
  HideWindow
  MessageBox MB_ICONINFORMATION|MB_OK "$(^Name) was successfully removed from your computer."
FunctionEnd

Function un.onInit
  MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "Are you sure you want to completely remove $(^Name) and all of its components?" IDYES +2
  Abort
FunctionEnd

Section Uninstall
  !insertmacro MUI_STARTMENU_GETFOLDER "Application" $ICONS_GROUP
  Delete "$INSTDIR\${PRODUCT_NAME}.url"
  Delete "$INSTDIR\uninst.exe"
  Delete "$INSTDIR\UnisonX.exe"
  Delete "$INSTDIR\*.*"
  
  Delete "$SMPROGRAMS\$ICONS_GROUP\Uninstall.lnk"
  Delete "$SMPROGRAMS\$ICONS_GROUP\Website.lnk"
  Delete "$SMPROGRAMS\$ICONS_GROUP\UnisonX.lnk"
  Delete "$DESKTOP\UnisonX.lnk"
  
  RMDir "$SMPROGRAMS\$ICONS_GROUP"
  RMDir "$INSTDIR"
  
  DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
  DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
  DeleteRegKey HKCR ".unisonx"
  DeleteRegKey HKCR "UnisonXBackup"
  DeleteRegKey HKCR "unisonx"
  SetAutoClose true
SectionEnd