# Defterdar - YEDEK baslatici (siyah ekran YOK)
# NOT: Masaustu ikonu artik scripts\defterdar-baslat.cjs (Node) kullanir; bu dosya
# yalnizca Node calistirilamayan ortamlarda yedek olarak kalir.
# Get-NetTCPConnection / Get-CimInstance / netsh cagrilari yapilmaz; her tiklamada
# saniyelerce bekletiyordu.
$ErrorActionPreference = "SilentlyContinue"
$proje = Split-Path $MyInvocation.MyCommand.Path -Parent
Set-Location $proje
$port = 3001

$durum   = Join-Path $env:TEMP "defterdar-$port.durum"   # "calisiyor|<tarih>"
$pidKayit = Join-Path $env:TEMP "defterdar-$port.pid"    # sunucu PID
$duvar   = Join-Path $env:TEMP "defterdar-duvar.tamam"   # firewall kurali bir kez kuruldu

# --- HIZLI yardimcilar (saf .NET, milisaniyeler) ---
function Test-Sunucu([int]$p) {
  # TCP + kucuk HTTP GET /api/ping. (/api/health Ollama + dosya deposu taradigi
  # icin 1-3 sn suruyordu; burada gerek yok.)
  try {
    $c = [Net.Sockets.TcpClient]::new()
    try {
      $c.Connect("127.0.0.1", $p)
      $s = $c.GetStream(); $s.ReadTimeout = 4000; $s.WriteTimeout = 4000
      $istek = [Text.Encoding]::ASCII.GetBytes("GET /api/ping HTTP/1.1`r`nHost: localhost`r`nConnection: close`r`n`r`n")
      $s.Write($istek, 0, $istek.Length)
      $buf = New-Object byte[] 16
      $n = $s.Read($buf, 0, 16)
      return ($n -eq 16 -and [Text.Encoding]::ASCII.GetString($buf, 0, 16) -like "HTTP/1.1 200*")
    } finally { $c.Close() }
  } catch { return $false }
}

function Durum-Yaz([string]$deger) {
  Set-Content -Path $durum -Value "$deger|$(Get-Date -Format o)" -Encoding UTF8
}

# 1) Node var mi? (Get-Command = bellek ici, where.exe degil)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { exit 1 }

# 2) Ilk kurulum / derleme (normalde zaten var, Test-Path ucuz)
if (-not (Test-Path (Join-Path $proje "node_modules"))) { & npm install --no-audit --no-fund >$null 2>&1 }
if (-not (Test-Path (Join-Path $proje ".next\BUILD_ID"))) { & npm run build >$null 2>&1 }

# 3) Firewall izni: SADECE bir kez kurulur (her tiklamada yeni kural eklemiyordu)
if (-not (Test-Path $duvar)) {
  netsh advfirewall firewall add rule name="Defterdar" dir=in action=allow protocol=TCP localport=$port >$null 2>&1
  Set-Content -Path $duvar -Value (Get-Date -Format o) -Encoding UTF8
}

# 4) Sunucu gercekten ayakta mi?
$calisiyor = Test-Sunucu $port

# 5) Bayat sunucu? GUNCELLE.bat zaten yeniden baslatir; burada sadece
#    "build, sunucudan YENI ise" durumunu ucuz dosya tarihiyle yakalariz.
if ($calisiyor) {
  $buildId = Join-Path $proje ".next\BUILD_ID"
  $baslatildi = $null
  if (Test-Path $durum) {
    $parca = (Get-Content $durum -Raw) -split '\|'
    if ($parca.Count -ge 2) { [void][DateTime]::TryParse($parca[1], [ref]$baslatildi) }
  }
  if ($baslatildi -and (Get-Item $buildId).LastWriteTime -gt $baslatildi) {
    if (Test-Path $pidKayit) {
      $eski = [int](Get-Content $pidKayit -Raw)
      try { Stop-Process -Id $eski -Force -ErrorAction SilentlyContinue } catch {}
      Start-Sleep -Milliseconds 400
    }
    $calisiyor = $false
  }
}

# 6) Calismiyorsa gizli baslat
if (-not $calisiyor) {
  $log = Join-Path $proje "server.log"
  $hata = Join-Path $proje "server-hata.log"
  $proc = Start-Process -FilePath "node" `
    -ArgumentList "node_modules\next\dist\bin\next", "start", "-p", "$port", "-H", "0.0.0.0" `
    -WorkingDirectory $proje -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput $log -RedirectStandardError $hata
  Set-Content -Path $pidKayit -Value $proc.Id -Encoding ASCII
  Durum-Yaz "calisiyor"
  # Hazir olana kadar bekle (genelde 1-3 sn)
  $i = 0
  while ($i -lt 40) {
    if (Test-Sunucu $port) { break }
    Start-Sleep -Milliseconds 500
    $i++
  }
} else {
  Durum-Yaz "calisiyor"
}

# 7) Uygulama penceresi (normal pencere - BUNU goreceksin)
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