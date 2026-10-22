@echo off
REM Mgroq Defter - Tek tık veri yedeği (güncelleme öncesi / dilediğinizde)
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "scripts\yedek-al.ps1"
pause
