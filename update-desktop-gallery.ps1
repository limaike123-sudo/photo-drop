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
  $encodedRelative = ($relative -split "/" | ForEach-Object { [uri]::EscapeDataString($_) }) -join "/"
  [pscustomobject]@{
    name = $_.Name
    url = "desktop-gallery/$encodedRelative"
    date = Split-Path -Leaf (Split-Path -Parent $_.FullName)
  }
}

$manifest = [pscustomobject]@{
  updatedAt = (Get-Date).ToString("s")
  items = @($items)
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$manifestJson = $manifest | ConvertTo-Json -Depth 4
[System.IO.File]::WriteAllText((Join-Path $galleryPath "manifest.json"), $manifestJson, $utf8NoBom)

Write-Host "已更新：小麦麦操作的图片"
Write-Host "电脑端来源文件夹：$SourcePath"
Write-Host "网站展示文件夹：$galleryPath"
