@echo off
REM Defterdar - Sunucuyu kapat
powershell -ExecutionPolicy Bypass -Command "$p = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique; if ($p) { Stop-Process -Id $p -Force; Write-Host 'Defterdar kapatildi.' } else { Write-Host 'Calisan sunucu yok.' }"
pause
