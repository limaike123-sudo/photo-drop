param(
  [string]$Owner = "limaike123-sudo",
  [string]$Repo = "photo-drop",
  [string]$Branch = "main",
  [string]$RemoteRoot = "uploads",
  [string]$ClothesRoot = "",
  [string]$Date = (Get-Date -Format "yyyy-M-d"),
  [int]$PollSeconds = 60,
  [switch]$Once
)

$ErrorActionPreference = "Stop"

if (-not $ClothesRoot) {
  $codexRoot = Split-Path -Parent $PSScriptRoot
  $clothesFolderName = -join ([char[]](0x8863, 0x670D, 0x751F, 0x56FE))
  $ClothesRoot = Join-Path $codexRoot $clothesFolderName
}

$pictureSuffix = -join ([char[]](0x56FE, 0x7247))
$targetFolder = Join-Path $ClothesRoot "$Date$pictureSuffix"
$remoteFolder = "$RemoteRoot/$Date"
$imagePattern = '\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff|heic)$'

function Get-GitHubHeaders {
  $headers = @{
    Accept = "application/vnd.github+json"
    "User-Agent" = "github-photo-drop-clothes-sync"
  }

  if ($env:GITHUB_PHOTO_TOKEN) {
    $headers.Authorization = "Bearer $env:GITHUB_PHOTO_TOKEN"
  }

  return $headers
}

function Get-RemoteImages {
  $encodedPath = [uri]::EscapeDataString($remoteFolder).Replace("%2F", "/")
  $uri = "https://api.github.com/repos/$Owner/$Repo/contents/$encodedPath`?ref=$Branch"

  try {
    $items = Invoke-RestMethod -Method Get -Uri $uri -Headers (Get-GitHubHeaders)
  } catch {
    $response = $_.Exception.Response
    if ($response -and [int]$response.StatusCode -eq 404) {
      Write-Host "No upload folder yet: $remoteFolder"
      return @()
    }

    Write-Host "Failed to read today's uploads: $($_.Exception.Message)"
    return @()
  }

  return @($items) | Where-Object {
    $_.type -eq "file" -and $_.name -match $imagePattern
  } | Sort-Object name
}

function Sync-Once {
  New-Item -ItemType Directory -Force -Path $targetFolder | Out-Null
  $images = Get-RemoteImages

  foreach ($image in $images) {
    $target = Join-Path $targetFolder $image.name
    if (Test-Path -LiteralPath $target) {
      $localFile = Get-Item -LiteralPath $target
      if ($localFile.Length -eq [int64]$image.size) {
        continue
      }
    }

    Write-Host "Downloading: $($image.name)"
    Invoke-WebRequest -Uri $image.download_url -OutFile $target -Headers (Get-GitHubHeaders)
  }

  Write-Host "Synced to: $targetFolder"
}

Write-Host "Sync today's uploads to clothes folder"
Write-Host "GitHub path: $remoteFolder"
Write-Host "Local folder: $targetFolder"

do {
  Sync-Once

  if ($Once) {
    break
  }

  Write-Host "Waiting $PollSeconds seconds before next check..."
  Start-Sleep -Seconds $PollSeconds
} while ($true)
