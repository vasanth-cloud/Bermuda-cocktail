@echo off
title The Bermuda Cocktail - Hardware Print Bridge
color 0A

echo ==============================================================
echo   THE BERMUDA COCKTAIL - CLOUD-TO-HARDWARE PRINT BRIDGE
echo ==============================================================
echo  Connecting your POS terminal to Bermuda Cloud / Local Server...
echo.
echo  VERIFIED PRINTER HARDWARE MAPPING:
echo  1. Posiflex (Bar BOT):      USB Type-B -^> BAR BOT (USB002)
echo  2. Rugtek RP327 (Cashier):  USB Type-B -^> RP327 Printer (USB001)
echo  3. Rugtek RP327 (Kitchen):  Ethernet   -^> 192.168.0.70:9100 / KITCHEN KOT
echo ==============================================================
echo.

python -m pip install websockets pywin32 --quiet
python "%~dp0tools\bermuda_print_bridge.py"

pause
