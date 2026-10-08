# Defterdar - Masaüstü kurulumu (kısayol + icon)
# Kullanım: powershell -ExecutionPolicy Bypass -File masaustu-kur.ps1
$ErrorActionPreference = "Stop"
$proje = Split-Path $MyInvocation.MyCommand.Path -Parent
$masa = [Environment]::GetFolderPath("Desktop")

# 1) Icon üret
& powershell -ExecutionPolicy Bypass -File (Join-Path $proje "scripts\icon-pro.ps1")

# 2) Kısayol: Defterdar.lnk -> görünmez başlatıcı (siyah ekran yok), iconlu
$hedef = Join-Path $proje "Defterdar.vbs"
$ico = Join-Path $proje "public\images\icon.ico"
$lnk = Join-Path $masa "Defterdar.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = $hedef
$sc.WorkingDirectory = $proje
$sc.IconLocation = "$ico,0"
$sc.Description = "Defterdar Muhasebe Defteri - cift tikla calistir"
$sc.Save()
Write-Host "Masaüstü kısayolu hazır: $lnk"

# Eski isimli kısayolu temizle
$eski = Join-Path $masa "Mgroq Defter.lnk"
if (Test-Path $eski) { Remove-Item $eski -Force; Write-Host "Eski kisayol kaldirildi." }

# 3) Otomatik başlatma sor (isteğe bağlı)
$cevap = Read-Host "Windows açılışında otomatik başlasın mı? (e/h)"
if ($cevap -eq "e" -or $cevap -eq "E") {
  $startup = [Environment]::GetFolderPath("Startup")
  Copy-Item $lnk (Join-Path $startup "Defterdar.lnk") -Force
  Write-Host "Otomatik başlatma eklendi."
}
Write-Host "Tamam! Masaüstündeki 'Defterdar' simgesine çift tıklayın."
