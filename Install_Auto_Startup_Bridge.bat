@echo off
title The Bermuda Cocktail - Install Silent Auto-Print Service
color 0B

echo ==============================================================
echo   THE BERMUDA COCKTAIL - AUTO-STARTUP PRINT SERVICE INSTALLER
echo ==============================================================
echo.
echo  This script configures the hardware print service to launch
echo  automatically and silently in the background whenever Windows starts.
echo.
echo  PRINTERS CONFIGURED:
echo   - Bar Drinks:   Posiflex USB (BAR BOT -> USB002)
echo   - Kitchen Food: Rugtek RP327 Ethernet (192.168.0.70:9100)
echo   - Billing:      Rugtek RP327 USB (RP327 Printer -> USB001)
echo.
echo ==============================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_FILE=%SCRIPT_DIR%tools\run_bridge_silent.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set STARTUP_SHORTCUT=%STARTUP_DIR%\BermudaPrintBridge.vbs

echo Creating silent background runner: %VBS_FILE%
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run chr(34^) ^& "%SCRIPT_DIR%Start_Print_Bridge.bat" ^& Chr(34^), 0
echo Set WshShell = Nothing
) > "%VBS_FILE%"

echo Installing into Windows Startup: %STARTUP_SHORTCUT%
copy /Y "%VBS_FILE%" "%STARTUP_SHORTCUT%" > nul

echo.
echo [SUCCESS] Hardware Auto-Print Bridge successfully installed!
echo Whenever this PC turns on, printing will run 100%% silently in the background.
echo.
echo Starting the bridge now in the background...
wscript "%VBS_FILE%"
echo Bridge is now running in the background!
echo.
pause
