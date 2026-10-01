@echo off
title The Bermuda Cocktail - Thermal Print Bridge
color 0A

echo ==============================================================
echo   THE BERMUDA COCKTAIL - CLOUD-TO-LAN PRINT BRIDGE
echo ==============================================================
echo  Connecting your POS terminal to elitedominators.com...
echo  Kitchen Printer: 192.168.0.70:9100
echo  Cashier Printer: 192.168.1.87:9100
echo ==============================================================
echo.

python -m pip install websockets --quiet
python "%~dp0bermuda_print_bridge.py"

pause
