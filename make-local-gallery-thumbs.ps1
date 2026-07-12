param(
  [string]$SourceRoot = "$PSScriptRoot\local-gallery\ai-generated",
  [string]$ThumbRoot = "$PSScriptRoot\local-gallery\thumbs\ai-generated",
  [int]$MaxSide = 720,
  [int64]$JpegQuality = 76
)

$ErrorActionPreference = "Stop"
$extensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff")

Add-Type -AssemblyName System.Drawing

function Save-Thumb($SourceFile, $TargetFile) {
  $image = [System.Drawing.Image]::FromFile($SourceFile)
  try {
    $scale = [Math]::Min($MaxSide / $image.Width, $MaxSide / $image.Height)
    if ($scale -gt 1) { $scale = 1 }
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
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter $encoder, $JpegQuality
      $thumb.Save($TargetFile, $codec, $params)
    } finally {
      $thumb.Dispose()
    }
  } finally {
    $image.Dispose()
  }
}

$sourceRootItem = Get-Item -LiteralPath $SourceRoot
$files = Get-ChildItem -LiteralPath $SourceRoot -Recurse -File | Where-Object {
  $extensions -contains $_.Extension.ToLowerInvariant()
}

foreach ($file in $files) {
  $relative = $file.FullName.Substring($sourceRootItem.FullName.Length + 1)
  $relativeDirectory = Split-Path $relative -Parent
  $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
  $targetDirectory = if ($relativeDirectory) { Join-Path $ThumbRoot $relativeDirectory } else { $ThumbRoot }
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  $targetFile = Join-Path $targetDirectory "$baseName.jpg"
  Save-Thumb $file.FullName $targetFile
  Write-Host "Thumb: $targetFile"
}

Write-Host "Done. Files: $($files.Count)"
