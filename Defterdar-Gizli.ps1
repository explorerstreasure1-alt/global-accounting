# Defterdar - Gizli başlatıcı (siyah ekran YOK)
# VBS üzerinden penceresiz çalışır: sunucuyu gizli başlatır, uygulama penceresini açar.
$ErrorActionPreference = "SilentlyContinue"
$proje = Split-Path $MyInvocation.MyCommand.Path -Parent
Set-Location $proje
$port = 3001

where.exe node >$null 2>&1
if ($LASTEXITCODE -ne 0) { exit 1 }
if (-not (Test-Path (Join-Path $proje "node_modules"))) {
  & npm install --no-audit --no-fund >$null 2>&1
}
if (-not (Test-Path (Join-Path $proje ".next"))) {
  & npm run build >$null 2>&1
}

# Build sunucudan yeniyse eski chunk manifestini sunmaya devam eden sunucuyu yenile.
$buildId = Join-Path $proje ".next\BUILD_ID"
if (Test-Path $buildId) {
  $buildTime = (Get-Item $buildId).LastWriteTime
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($listener in $listeners) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $isDefterdar = $process.ExecutablePath -like "*node.exe" -and $process.CommandLine -match "next start -p $port"
    if ($isDefterdar -and $process.CreationDate -lt $buildTime) {
      Stop-Process -Id $listener.OwningProcess -Force
    }
  }
}

# Sunucu zaten çalışıyor mu?
$calisiyor = $false
try {
  $h = Invoke-RestMethod "http://localhost:$port/api/health" -TimeoutSec 3
  if ($h.ok) { $calisiyor = $true }
} catch {}

if (-not $calisiyor) {
  $log = Join-Path $proje "server.log"
  $hata = Join-Path $proje "server-hata.log"
  # Wi-Fi'den telefon için tüm ağlara dinle + duvar izni dene (sessiz).
  netsh advfirewall firewall add rule name="Defterdar" dir=in action=allow protocol=TCP localport=$port >$null 2>&1
  Start-Process -FilePath "node" `
    -ArgumentList "node_modules\next\dist\bin\next", "start", "-p", "$port", "-H", "0.0.0.0" `
    -WorkingDirectory $proje -WindowStyle Hidden `
    -RedirectStandardOutput $log -RedirectStandardError $hata
  $i = 0
  while ($i -lt 40) {
    Start-Sleep 1
    try {
      $h = Invoke-RestMethod "http://localhost:$port/api/health" -TimeoutSec 3
      if ($h.ok) { break }
    } catch {}
    $i++
  }
}

# Uygulama penceresi (normal pencere - BUNU göreceksin)
$edge64 = "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
$edge32 = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
$chr64 = "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
$chr32 = "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
$profil = Join-Path ([Environment]::GetFolderPath("ApplicationData")) "Defterdar\PencereProfili-Edge"
$url = "http://localhost:$port/"
if (Test-Path $edge64) { Start-Process $edge64 -ArgumentList "--app=$url", "--user-data-dir=$profil" }
elseif (Test-Path $edge32) { Start-Process $edge32 -ArgumentList "--app=$url", "--user-data-dir=$profil" }
elseif (Test-Path $chr64) { Start-Process $chr64 -ArgumentList "--app=$url", "--user-data-dir=$profil-Chrome" }
elseif (Test-Path $chr32) { Start-Process $chr32 -ArgumentList "--app=$url", "--user-data-dir=$profil-Chrome" }
else { Start-Process $url }
