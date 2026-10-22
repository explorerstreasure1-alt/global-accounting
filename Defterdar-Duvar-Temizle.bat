@echo off
REM Defterdar - Firewall kurallarini temizle (YONETICI GEREKIYOR)
REM Eskiden her masaustu tiklamasinda yeni bir "Defterdar" kurali ekleniyordu;
REM boylece kopya kural sayisi birikiyordu. Bu betik kopyalari siler, tek kural birakir.
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Yonetici yetkisi isteniyor...
  powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo onceki "Defterdar" kural sayisi:
powershell -Command "Write-Host ('  ' + (Get-NetFirewallRule -DisplayName 'Defterdar' -ErrorAction SilentlyContinue | Measure-Object).Count)"
netsh advfirewall firewall delete rule name="Defterdar" >nul 2>&1
netsh advfirewall firewall add rule name="Defterdar" dir=in action=allow protocol=TCP localport=3001 >nul
echo.
echo Kalan "Defterdar" kural sayisi:
powershell -Command "Write-Host ('  ' + (Get-NetFirewallRule -DisplayName 'Defterdar' -ErrorAction SilentlyContinue | Measure-Object).Count)"
echo.
echo Simdi masaustundeki Defterdar ikonu firewall'a tekrar dokunmuyor.
pause