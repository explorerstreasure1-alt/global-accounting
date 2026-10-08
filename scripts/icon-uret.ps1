# Mgroq Defter - Logo PNG + ICO üretici
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts/icon-uret.ps1
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$proje = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
if (-not (Test-Path $proje)) { $proje = Get-Location }
$imgDir = Join-Path $proje "public\images"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

function New-MgroqIcon($boyut, $hedef) {
    $bmp = New-Object System.Drawing.Bitmap($boyut, $boyut)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = "AntiAlias"
    # zemin
    $zemin = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        (New-Object System.Drawing.Point(0,0)),
        (New-Object System.Drawing.Point($boyut,$boyut)),
        [System.Drawing.Color]::FromArgb(39,74,115),
        [System.Drawing.Color]::FromArgb(11,28,48)
    )
    $g.FillRectangle($zemin, 0, 0, $boyut, $boyut)
    # altın çerçeve
    $kalem = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(242,193,78), [Math]::Max(4, $boyut/64))
    $g.DrawRectangle($kalem, 6, 6, $boyut-13, $boyut-13)
    # defter sayfası
    $oran = $boyut / 256.0
    $sayfa = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(243,230,196))
    $g.FillRectangle($sayfa, 72*$oran, 92*$oran, 112*$oran, 112*$oran)
    $sirt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(154,52,18))
    $g.FillRectangle($sirt, 72*$oran, 92*$oran, 20*$oran, 112*$oran)
    # ₺ yazısı
    $fontBoy = [Math]::Max(24, [int]($boyut * 0.24))
    $font = New-Object System.Drawing.Font("Georgia", $fontBoy, [System.Drawing.FontStyle]::Bold)
    $firca = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(22,50,79))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = "Center"; $sf.LineAlignment = "Center"
    $rx = [double](72*$oran); $ry = [double](120*$oran); $rw = [double](112*$oran); $rh = [double](70*$oran)
    $rect = New-Object System.Drawing.RectangleF($rx, $ry, $rw, $rh)
    $g.DrawString([string]"TL", $font, $firca, $rect, $sf)
    # grafik çizgisi
    $grafik = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(242,193,78), [Math]::Max(5, $boyut/48))
    $noktalar = @(
        (New-Object System.Drawing.Point([int](52*$oran), [int](208*$oran))),
        (New-Object System.Drawing.Point([int](106*$oran), [int](176*$oran))),
        (New-Object System.Drawing.Point([int](138*$oran), [int](188*$oran))),
        (New-Object System.Drawing.Point([int](168*$oran), [int](140*$oran))),
        (New-Object System.Drawing.Point([int](204*$oran), [int](120*$oran)))
    )
    $g.DrawLines($grafik, $noktalar)
    $g.Dispose()
    $bmp.Save($hedef, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

New-MgroqIcon 256 (Join-Path $imgDir "logo.png")
New-MgroqIcon 128 (Join-Path $imgDir "ai-avatar.png")
Write-Host "PNG üretildi: logo.png, ai-avatar.png"

# ICO: 256 PNG'yi ICO olarak kopyala (Windows kısayol için yeterli)
$icoYol = Join-Path $imgDir "icon.ico"
$pngYol = Join-Path $imgDir "logo.png"
# Gerçek ICO başlığı yaz (PNG sıkıştırmalı ICO)
$pngBytes = [IO.File]::ReadAllBytes($pngYol)
$ms = New-Object IO.MemoryStream
$bw = New-Object IO.BinaryWriter($ms)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]1)
$bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
$bw.Write([UInt16]1); $bw.Write([UInt16]32)
$bw.Write([UInt16]0); $bw.Write([UInt16]0)
$bw.Write([UInt32]$pngBytes.Length); $bw.Write([UInt32]22)
$bw.Write($pngBytes)
$bw.Flush()
[IO.File]::WriteAllBytes($icoYol, $ms.ToArray())
$bw.Close(); $ms.Close()
Write-Host "ICO üretildi: $icoYol"
