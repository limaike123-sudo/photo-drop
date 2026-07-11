param(
  [string]$SourcePath = "$PSScriptRoot\DesktopUploads"
)

$ErrorActionPreference = "Stop"

$galleryPath = Join-Path $PSScriptRoot "desktop-gallery"
$today = Get-Date -Format "yyyy-M-d"
$sourceTargetPath = Join-Path (Join-Path $galleryPath "source") $today
$thumbTargetPath = Join-Path (Join-Path $galleryPath "thumbs") $today

New-Item -ItemType Directory -Force -Path $SourcePath | Out-Null
New-Item -ItemType Directory -Force -Path $sourceTargetPath | Out-Null
New-Item -ItemType Directory -Force -Path $thumbTargetPath | Out-Null

$extensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic")
$sourceFiles = Get-ChildItem -LiteralPath $SourcePath -File | Where-Object {
  $extensions -contains $_.Extension.ToLowerInvariant()
} | Sort-Object Name

Add-Type -AssemblyName System.Drawing

function Save-Thumbnail($SourceFile, $TargetFile) {
  $image = [System.Drawing.Image]::FromFile($SourceFile)
  try {
    $maxSide = 720
    $scale = [Math]::Min($maxSide / $image.Width, $maxSide / $image.Height)
    if ($scale -gt 1) {
      $scale = 1
    }
    $width = [Math]::Max(1, [int]($image.Width * $scale))
    $height = [Math]::Max(1, [int]($image.Height * $scale))
    $thumb = New-Object System.Drawing.Bitmap $width, $height
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($thumb)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.Clear([System.Drawing.Color]::White)
        $graphics.DrawImage($image, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }

      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" } | Select-Object -First 1
      $encoder = [System.Drawing.Imaging.Encoder]::Quality
      $params = New-Object System.Drawing.Imaging.EncoderParameters 1
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter $encoder, 78L
      $thumb.Save($TargetFile, $codec, $params)
    } finally {
      $thumb.Dispose()
    }
  } finally {
    $image.Dispose()
  }
}

$items = @()
$index = 1
foreach ($file in $sourceFiles) {
  $safeBase = "xiaomaimai-{0:d3}" -f $index
  $sourceName = "$safeBase$($file.Extension.ToLowerInvariant())"
  $thumbName = "$safeBase.jpg"
  $sourceDestination = Join-Path $sourceTargetPath $sourceName
  $thumbDestination = Join-Path $thumbTargetPath $thumbName

  Copy-Item -LiteralPath $file.FullName -Destination $sourceDestination -Force
  Save-Thumbnail $file.FullName $thumbDestination

  $items += [pscustomobject]@{
    name = $file.Name
    thumbUrl = "desktop-gallery/thumbs/$today/$thumbName"
    downloadUrl = "desktop-gallery/source/$today/$sourceName"
    date = $today
  }
  $index += 1
}

$existingItems = Get-ChildItem -LiteralPath (Join-Path $galleryPath "source") -Recurse -File -ErrorAction SilentlyContinue | Where-Object {
  $extensions -contains $_.Extension.ToLowerInvariant() -and $_.Directory.Name -ne $today
} | Sort-Object LastWriteTime -Descending | ForEach-Object {
  $date = $_.Directory.Name
  $base = [System.IO.Path]::GetFileNameWithoutExtension($_.Name)
  $thumbPath = Join-Path (Join-Path (Join-Path $galleryPath "thumbs") $date) "$base.jpg"
  if (-not (Test-Path -LiteralPath $thumbPath)) {
    return
  }
  $sourceRelative = $_.FullName.Substring($galleryPath.Length + 1).Replace("\", "/")
  $thumbRelative = $thumbPath.Substring($galleryPath.Length + 1).Replace("\", "/")
  [pscustomobject]@{
    name = $_.Name
    thumbUrl = "desktop-gallery/$thumbRelative"
    downloadUrl = "desktop-gallery/$sourceRelative"
    date = $date
  }
}

$manifest = [pscustomobject]@{
  updatedAt = (Get-Date).ToString("s")
  items = @($items + $existingItems)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $galleryPath "manifest.json"), $manifestJson, $utf8NoBom)

Write-Host "已更新：小麦麦操作的图片"
Write-Host "电脑端来源文件夹：$SourcePath"
Write-Host "网站展示文件夹：$galleryPath"
