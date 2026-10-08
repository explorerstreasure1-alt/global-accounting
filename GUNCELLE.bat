@echo off
REM Mgroq Defter - GÜVENLİ GÜNCELLEME
REM Önce veriyi yedekler, sonra paketleri kurup derler, en son verinin durduğunu doğrular.
REM Veriler proje dışında (%APPDATA%\MgroqDefter\data) saklandığı için zaten korunur;
REM bu betik ekstra garanti + doğrulama yapar.
cd /d "%~dp0"

echo [1/4] Yedek aliniyor...
powershell -ExecutionPolicy Bypass -File "scripts\yedek-al.ps1"
if errorlevel 1 (
  echo YEDEK ALINAMADI! Guncelleme durduruldu, veriyi riske atmayalim.
  pause
  exit /b 1
)

echo [2/4] Paketler kuruluyor...
call npm install --no-audit --no-fund
if errorlevel 1 (
  echo npm install hata verdi. Yedeginiz alinmisti, onceki surum calismaya devam eder.
  pause
  exit /b 1
)

echo [3/4] Derleniyor...
powershell -ExecutionPolicy Bypass -Command "$listeners = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue; foreach ($listener in $listeners) { $process = Get-CimInstance Win32_Process -Filter ('ProcessId=' + $listener.OwningProcess); if ($process.ExecutablePath -like '*node.exe' -and $process.CommandLine -match 'next start -p 3001') { Stop-Process -Id $listener.OwningProcess -Force; Write-Host 'Eski Defterdar sunucusu kapatildi.' } else { Write-Error '3001 portundaki uygulama Defterdar sunucusu olarak dogrulanamadi; durdurulmadi.'; exit 1 } }"
if errorlevel 1 (
  echo 3001 portundaki sunucu guvenli sekilde taninamadi. Build durduruldu.
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo Derleme hata verdi. Verileriniz yedekte duruyor, kodu eski haline dondurun.
  pause
  exit /b 1
)

powershell -ExecutionPolicy Bypass -Command "$proje = (Get-Location).Path; Start-Process -FilePath 'node' -ArgumentList 'node_modules\next\dist\bin\next','start','-p','3001' -WorkingDirectory $proje -WindowStyle Hidden -RedirectStandardOutput (Join-Path $proje 'server.log') -RedirectStandardError (Join-Path $proje 'server-hata.log'); $hazir = $false; for ($i = 0; $i -lt 30; $i++) { try { $h = Invoke-RestMethod 'http://localhost:3001/api/health' -TimeoutSec 2; if ($h.ok) { $hazir = $true; break } } catch {}; Start-Sleep -Seconds 1 }; if (-not $hazir) { Write-Error 'Guncel sunucu 3001 portunda hazir olmadi.'; exit 1 }; Write-Host 'Guncel Defterdar sunucusu hazir: http://localhost:3001'"
if errorlevel 1 (
  echo Yeni sunucu baslatilamadi. Defterdar-Gizli.ps1 ile tekrar acmayi deneyin.
  pause
  exit /b 1
)

echo [4/4] Veri dogrulaniyor...
powershell -ExecutionPolicy Bypass -Command "$d = if ($env:VERILER_DIZIN) { $env:VERILER_DIZIN } else { Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'MgroqDefter\data' }; $k = Join-Path $d 'kayitlar.json'; if (Test-Path $k) { $n = (Get-Content $k -Raw | ConvertFrom-Json).Count; Write-Host \"VERI SAGLAM: $n kayit ($d)\" } else { Write-Host 'UYARI: kayit dosyasi henuz yok, ilk acilista ornek veriler kurulacak.' }"
echo.
echo GUNCELLEME TAMAM. Acik masaustu penceresini kapatip Defterdar simgesinden yeniden acin.
pause
