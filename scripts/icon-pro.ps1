# Mgroq Defter - Premium icon üretici (çok ölçülü PNG + ICO)
# Kullanım: powershell -ExecutionPolicy Bypass -File scripts/icon-pro.ps1
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$proje = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent
if (-not $proje -or -not (Test-Path $proje)) { $proje = Get-Location }
$imgDir = Join-Path $proje "public\images"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

Add-Type @"
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
public static class RoundHelper {
  public static GraphicsPath RoundedRect(int x, int y, int w, int h, int r) {
    var p = new GraphicsPath();
    int d = r * 2;
    p.AddArc(x, y, d, d, 180, 90);
    p.AddArc(x + w - d, y, d, d, 270, 90);
    p.AddArc(x + w - d, y + h - d, d, d, 0, 90);
    p.AddArc(x, y + h - d, d, d, 90, 90);
    p.CloseFigure();
    return p;
  }
}
"@ -ReferencedAssemblies System.Drawing

function Draw-MgroqIcon {
  param([System.Drawing.Graphics]$g, [int]$S)
  $u = [double]$S / 256.0  # birim
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear([System.Drawing.Color]::Transparent)

  # --- zemin: yuvarlak lacivert kart ---
  $rr = [RoundHelper]::RoundedRect(2, 2, $S - 5, $S - 5, [int]($S * 0.22))
  $zemin = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(0, $S)),
    [System.Drawing.Color]::FromArgb(46, 92, 140),
    [System.Drawing.Color]::FromArgb(8, 22, 39))
  $g.FillPath($zemin, $rr)
  $zemin.Dispose()

  # iç parlama (üstte hafif ışık)
  $par = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point(0, 0)),
    (New-Object System.Drawing.Point(0, [int]($S * 0.5))),
    [System.Drawing.Color]::FromArgb(70, 255, 255, 255),
    [System.Drawing.Color]::FromArgb(0, 255, 255, 255))
  $g.FillPath($par, $rr)
  $par.Dispose()

  # --- altın çerçeve ---
  $kalin = [Math]::Max(3, $S / 52)
  $altinKalem = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(242, 193, 78), $kalin)
  $ic = [RoundHelper]::RoundedRect([int]($kalin), [int]($kalin), [int]($S - 1 - 2 * $kalin), [int]($S - 1 - 2 * $kalin), [int]($S * 0.19))
  $g.DrawPath($altinKalem, $ic)
  $altinKalem.Dispose(); $ic.Dispose(); $rr.Dispose()

  # --- defter sayfası ---
  $sx = 62 * $u; $sy = 74 * $u; $sw = 132 * $u; $sh = 118 * $u
  $golge = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(90, 0, 0, 0))
  $gx = [float]([double]$sx + 4.0 * $u); $gy = [float]([double]$sy + 6.0 * $u)
  $g.FillRectangle($golge, $gx, $gy, [float]$sw, [float]$sh)
  $golge.Dispose()
  $sayfaF = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Point([int]$sx, [int]$sy)),
    (New-Object System.Drawing.Point([int]$sx, [int]($sy + $sh))),
    [System.Drawing.Color]::FromArgb(255, 253, 244),
    [System.Drawing.Color]::FromArgb(238, 222, 178))
  $g.FillRectangle($sayfaF, $sx, $sy, $sw, $sh)
  $sayfaF.Dispose()
  # defter çizgileri
  $cizgi = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 120, 170, 200), [Math]::Max(1, $u * 2))
  $cx1 = [float]([double]$sx + 34.0 * $u); $cx2 = [float]([double]$sx + [double]$sw - 12.0 * $u)
  foreach ($ly in @(104.0, 122.0, 140.0)) { $yy = [float]($ly * $u); $g.DrawLine($cizgi, $cx1, $yy, $cx2, $yy) }
  $cizgi.Dispose()
  # kırmızı sırt + dikiş
  $sirt = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(166, 58, 27))
  $g.FillRectangle($sirt, [float]$sx, [float]$sy, [float](26.0 * $u), [float]$sh)
  $sirt.Dispose()
  $dikis = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 233, 176))
  $dd = [float](5.0 * $u); $dx = [float]([double]$sx + 10.0 * $u)
  for ($dy = [double]$sy + 10.0 * $u; $dy -lt [double]$sy + [double]$sh - 6.0 * $u; $dy += 16.0 * $u) {
    $nokta = New-Object System.Drawing.Drawing2D.GraphicsPath
    $nokta.AddEllipse($dx, [float]$dy, $dd, $dd)
    $g.FillPath($dikis, $nokta)
    $nokta.Dispose()
  }
  $dikis.Dispose()
  # sayfa kenarlığı
  $sk = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 90, 40), [Math]::Max(1, $u * 1.5))
  $g.DrawRectangle($sk, $sx, $sy, $sw, $sh)
  $sk.Dispose()

  # --- kocaman TL sembolü (küçük boyutta bile okunur) ---
  $tlSembol = [char]0x20BA  # ₺ (dosya kodlamasından bağımsız)
  $fontBoy = [float]([double]$S * 0.30)
  $font = $null
  foreach ($fa in @("Segoe UI Symbol", "Segoe UI", "Arial", "Tahoma")) {
    try { $font = New-Object System.Drawing.Font($fa, $fontBoy, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel); break } catch {}
  }
  if (-not $font) { $font = New-Object System.Drawing.Font("Arial", $fontBoy, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel) }
  $yazi = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(18, 44, 74))
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = "Center"; $sf.LineAlignment = "Center"
  $rx = [float]([double]$sx + 26.0 * $u); $ry2 = [float]([double]$sy + 58.0 * $u)
  $rw2 = [float]([double]$sw - 26.0 * $u); $rh2 = [float](58.0 * $u)
  $rect = New-Object System.Drawing.RectangleF($rx, $ry2, $rw2, $rh2)
  $g.DrawString($tlSembol, $font, $yazi, $rect, $sf)
  $font.Dispose(); $yazi.Dispose()

  # --- yükselen altın grafik (sağ alt rozet) ---
  $roz = $S * 0.30
  $rcx = $S * 0.74; $rcy = $S * 0.72
  $rozFirca = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(16, 42, 68))
  $rox = [float]([double]$rcx - [double]$roz / 2.0); $roy = [float]([double]$rcy - [double]$roz / 2.0)
  $rozBoy = [float]$roz
  $rozPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rozPath.AddEllipse($rox, $roy, $rozBoy, $rozBoy)
  $g.FillPath($rozFirca, $rozPath)
  $rozPath.Dispose()
  $rozFirca.Dispose()
  $rozK = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(242, 193, 78), [Math]::Max(2, $S / 90))
  $rozPath2 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $rozPath2.AddEllipse($rox, $roy, $rozBoy, $rozBoy)
  $g.DrawPath($rozK, $rozPath2)
  $rozPath2.Dispose()
  $rozK.Dispose()
  $gp = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(45, 212, 160), [Math]::Max(3, $S / 60))
  $gp.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $gp.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $gp.EndCap = [System.Drawing.Drawing2D.LineCap]::ArrowAnchor
  $p1 = New-Object System.Drawing.PointF([float]([double]$rcx - [double]$roz * 0.30), [float]([double]$rcy + [double]$roz * 0.14))
  $p2 = New-Object System.Drawing.PointF([float]([double]$rcx - [double]$roz * 0.08), [float]([double]$rcy - [double]$roz * 0.02))
  $p3 = New-Object System.Drawing.PointF([float]([double]$rcx + [double]$roz * 0.08), [float]([double]$rcy + [double]$roz * 0.06))
  $p4 = New-Object System.Drawing.PointF([float]([double]$rcx + [double]$roz * 0.30), [float]([double]$rcy - [double]$roz * 0.20))
  $pts = @($p1, $p2, $p3, $p4)
  $g.DrawLines($gp, $pts)
  $gp.Dispose()

  # --- üst mini başlık (sadece büyük boyutta) ---
  if ($S -ge 128) {
    $baslikBoy = [int]([double]$S * 0.072)
    $tf = New-Object System.Drawing.Font("Arial", $baslikBoy, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $tb = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 233, 176))
    $sf2 = New-Object System.Drawing.StringFormat
    $sf2.Alignment = "Center"; $sf2.LineAlignment = "Center"
    $baslikRect = New-Object System.Drawing.RectangleF([float](0.0), [float]([double]$S * 0.075), [float]([double]$S), [float]([double]$S * 0.12))
    $g.DrawString("DEFTERDAR", $tf, $tb, $baslikRect, $sf2)
    $tf.Dispose(); $tb.Dispose()
  }
}

function Save-IconPng {
  param([int]$boyut, [string]$hedef)
  $bmp = New-Object System.Drawing.Bitmap($boyut, $boyut)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Draw-MgroqIcon -g $g -S $boyut
  $g.Dispose()
  $bmp.Save($hedef, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# 1) Ana 256 PNG + tüm ölçüler
Save-IconPng 256 (Join-Path $imgDir "logo.png")
Save-IconPng 512 (Join-Path $imgDir "logo-512.png")
Save-IconPng 192 (Join-Path $imgDir "logo-192.png")
Save-IconPng 180 (Join-Path $imgDir "apple-touch-icon.png")
Save-IconPng 128 (Join-Path $imgDir "logo-128.png")
Save-IconPng 64  (Join-Path $imgDir "logo-64.png")
Save-IconPng 48  (Join-Path $imgDir "logo-48.png")
Save-IconPng 32  (Join-Path $imgDir "logo-32.png")
Save-IconPng 16  (Join-Path $imgDir "logo-16.png")
Copy-Item (Join-Path $imgDir "logo.png") (Join-Path $imgDir "ai-avatar.png") -Force
Write-Host "PNG seti üretildi (16/32/48/64/128/256)."

# 2) Çok girişli ICO (16,24,32,48,64,128,256 - PNG sıkıştırmalı, Win7+ uyumlu)
$boyutlar = @(16, 24, 32, 48, 64, 128, 256)
$pngler = @()
foreach ($b in $boyutlar) {
  $bmp = New-Object System.Drawing.Bitmap($b, $b)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  Draw-MgroqIcon -g $g -S ([int]$b)
  $g.Dispose()
  $ms = New-Object IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $pngler += ,$ms.ToArray()
  $ms.Close()
}
$icoYol = Join-Path $imgDir "icon.ico"
$fs = [IO.File]::OpenWrite($icoYol)
$bw = New-Object IO.BinaryWriter($fs)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$pngler.Count)
$ofset = 6 + 16 * $pngler.Count
for ($i = 0; $i -lt $pngler.Count; $i++) {
  $b = $boyutlar[$i]
  $w = if ($b -ge 256) { 0 } else { $b }
  $bw.Write([byte]$w); $bw.Write([byte]$w); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$pngler[$i].Length); $bw.Write([UInt32]$ofset)
  $ofset += $pngler[$i].Length
}
foreach ($p in $pngler) { $bw.Write($p) }
$bw.Flush(); $bw.Close(); $fs.Close()
Write-Host "ICO üretildi (7 ölçülü): $icoYol"
