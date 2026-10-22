@echo off
REM Defterdar - Uygulama olarak baslat (kendi penceresi + gorev cubugu simgesiyle)
cd /d "%~dp0"
set PORT=3001
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js bulunamadi! https://nodejs.org adresinden kurun.
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo Ilk kurulum: paketler yukleniyor...
  call npm install --no-audit --no-fund
)
if not exist ".next" (
  echo Ilk derleme yapiliyor...
  call npm run build
)
REM Sunucu calisiyor mu? Hayirsa gizli baslat.
powershell -ExecutionPolicy Bypass -Command "try { $h = Invoke-RestMethod 'http://localhost:%PORT%/api/health' -TimeoutSec 3; if ($h.ok) { exit 0 } } catch {}; exit 1"
if errorlevel 1 (
  echo Defterdar sunucusu baslatiliyor...
  REM Ayni Wi-Fi'den telefonda acilsin diye tum aglara dinle + duvar izni dene:
  netsh advfirewall firewall add rule name="Defterdar" dir=in action=allow protocol=TCP localport=%PORT% >nul 2>&1
  start "" /min cmd /c "node node_modules\next\dist\bin\next start -p %PORT% -H 0.0.0.0 > server.log 2>&1"
  powershell -ExecutionPolicy Bypass -Command "$i=0; while ($i -lt 40) { try { $h = Invoke-RestMethod 'http://localhost:%PORT%/api/health' -TimeoutSec 3; if ($h.ok) { exit 0 } } catch {}; Start-Sleep 1; $i++ }; exit 1"
  if errorlevel 1 (
    echo Sunucu acilamadi, pencereyi kapatip tekrar deneyin.
    pause
    exit /b 1
  )
)
REM Uygulama penceresi: Edge uygulama modu (yoksa Chrome, o da yoksa sekme)
set EDGE64=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe
set EDGE32=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe
set CHR64=%ProgramFiles%\Google\Chrome\Application\chrome.exe
set CHR32=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
set PROFIL=%APPDATA%\Defterdar\PencereProfili
if exist "%EDGE64%" (
  start "" "%EDGE64%" --app=http://localhost:%PORT%/ --user-data-dir="%PROFIL%-Edge"
) else if exist "%EDGE32%" (
  start "" "%EDGE32%" --app=http://localhost:%PORT%/ --user-data-dir="%PROFIL%-Edge"
) else if exist "%CHR64%" (
  start "" "%CHR64%" --app=http://localhost:%PORT%/ --user-data-dir="%PROFIL%-Chrome"
) else if exist "%CHR32%" (
  start "" "%CHR32%" --app=http://localhost:%PORT%/ --user-data-dir="%PROFIL%-Chrome"
) else (
  start "" "http://localhost:%PORT%/"
)
exit
