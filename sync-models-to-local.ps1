param(
  [int]$PollSeconds = 60,
  [switch]$Once
)

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$codexRoot = Split-Path -Parent $repoRoot
$modelFolderName = -join ([char[]](0x6A21, 0x7279))
$targetPath = Join-Path $codexRoot $modelFolderName
$apiUrl = "https://api.github.com/repos/limaike123-sudo/photo-drop/contents/local-gallery/models?ref=main"
$headers = @{ "User-Agent" = "Codex" }
$extensions = @(".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff")

function Sync-Models {
  New-Item -ItemType Directory -Force -Path $targetPath | Out-Null
  $items = Invoke-RestMethod -Uri $apiUrl -Headers $headers
  $images = @($items | Where-Object {
    $_.type -eq "file" -and $extensions -contains ([System.IO.Path]::GetExtension($_.name).ToLowerInvariant())
  })

  foreach ($image in $images) {
    $destination = Join-Path $targetPath $image.name
    $needsDownload = $true
    if (Test-Path -LiteralPath $destination) {
      $localLength = (Get-Item -LiteralPath $destination).Length
      $needsDownload = $localLength -ne [int64]$image.size
    }

    if ($needsDownload) {
      Invoke-WebRequest -Uri $image.download_url -OutFile $destination -UseBasicParsing
      Write-Host "Downloaded: $($image.name)"
    }
  }

  Write-Host "Model sync complete. Files: $($images.Count)"
  Write-Host "Target: $targetPath"
}

do {
  Sync-Models
  if ($Once) {
    break
  }
  Start-Sleep -Seconds $PollSeconds
} while ($true)
