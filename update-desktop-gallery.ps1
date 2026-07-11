param(
  [string]$SourcePath = "$PSScriptRoot\DesktopUploads"
)

$ErrorActionPreference = "Stop"

$galleryPath = Join-Path $PSScriptRoot "desktop-gallery"
$today = Get-Date -Format "yyyy-M-d"
$targetPath = Join-Path $galleryPath $today

New-Item -ItemType Directory -Force -Path $SourcePath | Out-Null
New-Item -ItemType Directory -Force -Path $targetPath | Out-Null

$extensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff", ".heic")
$sourceFiles = Get-ChildItem -LiteralPath $SourcePath -File | Where-Object {
  $extensions -contains $_.Extension.ToLowerInvariant()
}

foreach ($file in $sourceFiles) {
  $destination = Join-Path $targetPath $file.Name
  Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
}

$items = Get-ChildItem -LiteralPath $galleryPath -Recurse -File | Where-Object {
  $extensions -contains $_.Extension.ToLowerInvariant()
} | Sort-Object LastWriteTime -Descending | ForEach-Object {
  $relative = $_.FullName.Substring($galleryPath.Length + 1).Replace("\", "/")
  [pscustomobject]@{
    name = $_.Name
    url = "desktop-gallery/$relative"
    date = Split-Path -Leaf (Split-Path -Parent $_.FullName)
  }
}

$manifest = [pscustomobject]@{
  updatedAt = (Get-Date).ToString("s")
  items = @($items)
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $galleryPath "manifest.json") -Encoding UTF8

Write-Host "已更新：小麦麦操作的图片"
Write-Host "电脑端来源文件夹：$SourcePath"
Write-Host "网站展示文件夹：$galleryPath"
