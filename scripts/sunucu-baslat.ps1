# Defterdar - Sunucuyu baslat + PID/durum kaydi yaz.
# GUNCELLE.bat bu betigi cagirir; boylece masaustu ikonu sunucuyu dogru PID ile
# tanir ve gerekirse kapatabilir. Hazirlik kontrolu /api/ping uzerinden yapilir
# (/api/health Ollama ve dosya deposunu taradigi icin 1-3 sn suruyor ve
# 2 saniyelik zaman asimi yanlis alarm uretiyordu).
$ErrorActionPreference = "Stop"
$proje = Split-Path $MyInvocation.MyCommand.Path -Parent
$port = 3001

$pidKayit = Join-Path $env:TEMP "defterdar-$port.pid"
$durum   = Join-Path $env:TEMP "defterdar-$port.durum"

$proc = Start-Process -FilePath "node" `
  -ArgumentList "node_modules\next\dist\bin\next", "start", "-p", "$port", "-H", "0.0.0.0" `
  -WorkingDirectory $proje -WindowStyle Hidden -PassThru `
  -RedirectStandardOutput (Join-Path $proje "server.log") `
  -RedirectStandardError  (Join-Path $proje "server-hata.log")

Set-Content -Path $pidKayit -Value $proc.Id -Encoding ASCII
Set-Content -Path $durum -Value "calisiyor|$(Get-Date -Format o)" -Encoding UTF8

$hazir = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    if ((Invoke-WebRequest "http://localhost:$port/api/ping" -TimeoutSec 3 -UseBasicParsing).StatusCode -eq 200) {
      $hazir = $true
      break
    }
  } catch {}
}

if (-not $hazir) {
  Write-Error "Guncel sunucu $port portunda hazir olmadi."
  exit 1
}
Write-Host "Guncel Defterdar sunucusu hazir: http://localhost:$port (PID $($proc.Id))"