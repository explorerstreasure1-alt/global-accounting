# Defterdar - Veri yedeği al (güncelleme ÖNCESİ çalıştırılır)
# Veriler proje DIŞINDA (%APPDATA%\Defterdar\data) durur, ama ne olur ne olmaz:
# bu betik tarihli bir kopyayı Belgeler\Defterdar-Yedekler altına alır.
$ErrorActionPreference = "Stop"

function Get-VeriDizin {
  if ($env:VERILER_DIZIN -and (Test-Path $env:VERILER_DIZIN)) { return $env:VERILER_DIZIN }
  $appData = [Environment]::GetFolderPath("ApplicationData")
  foreach ($aday in @(
    (Join-Path $appData "Defterdar\data"),
    (Join-Path $appData "MgroqDefter\data"),
    (Join-Path (Get-Location) "data")
  )) {
    if (Test-Path (Join-Path $aday "kayitlar.json")) { return $aday }
  }
  return (Join-Path $appData "Defterdar\data")
}

$veri = Get-VeriDizin
if (-not (Test-Path (Join-Path $veri "kayitlar.json"))) {
  Write-Host "UYARI: Kayit dosyasi bulunamadi ($veri). Uygulamayi bir kez calistirip veri olusmasini saglayin."
  exit 1
}

$kok = Join-Path ([Environment]::GetFolderPath("MyDocuments")) "Defterdar-Yedekler"
New-Item -ItemType Directory -Force -Path $kok | Out-Null
$etiket = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$hedef = Join-Path $kok "yedek-$etiket"
New-Item -ItemType Directory -Force -Path $hedef | Out-Null

Copy-Item (Join-Path $veri "kayitlar.json") $hedef -Force
Copy-Item (Join-Path $veri "ayarlar.json") $hedef -Force -ErrorAction SilentlyContinue
Copy-Item (Join-Path $veri "sohbet.json") $hedef -Force -ErrorAction SilentlyContinue
if (Test-Path (Join-Path $veri "yedekler")) {
  Copy-Item (Join-Path $veri "yedekler") (Join-Path $hedef "yedekler") -Recurse -Force -ErrorAction SilentlyContinue
}

$kayitSay = (Get-Content (Join-Path $hedef "kayitlar.json") -Raw | ConvertFrom-Json).Count
Write-Host "YEDEK TAMAM: $hedef ($kayitSay kayit)"

# Son 10 yedeği tut, eskileri sil
Get-ChildItem $kok -Directory -Filter "yedek-*" | Sort-Object Name -Descending | Select-Object -Skip 10 | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
Write-Output $hedef
