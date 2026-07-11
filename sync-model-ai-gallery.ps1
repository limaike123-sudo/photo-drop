param(
  [string]$Date = (Get-Date -Format "yyyy-M-d"),
  [int]$PollSeconds = 60,
  [switch]$Once,
  [switch]$Push
)

$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
$codexRoot = Split-Path -Parent $repoRoot
$modelAiFolderName = (-join ([char[]](0x6A21, 0x7279))) + "ai" + ([char]0x56FE)
$sourceRoot = Join-Path $codexRoot $modelAiFolderName
$sourcePath = Join-Path $sourceRoot $Date
$syncScript = Join-Path $repoRoot "update-desktop-gallery.ps1"

function Get-GitExe {
  $bundledGit = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\native\git\cmd\git.exe"
  if (Test-Path -LiteralPath $bundledGit) {
    return $bundledGit
  }
  return "git"
}

function Invoke-GitPublish {
  $git = Get-GitExe
  $safeDirectory = "safe.directory=$repoRoot"
  $changes = & $git -c $safeDirectory status --porcelain -- desktop-gallery
  if (-not $changes) {
    Write-Host "No desktop-gallery changes to publish."
    return
  }

  & $git -c $safeDirectory config user.name "Codex"
  & $git -c $safeDirectory config user.email "codex@example.local"
  & $git -c $safeDirectory add desktop-gallery
  & $git -c $safeDirectory commit -m "Sync model AI gallery $Date" -- desktop-gallery
  & $git -c $safeDirectory -c http.version=HTTP/1.1 push
}

function Invoke-ModelAiSync {
  if (-not (Test-Path -LiteralPath $sourcePath)) {
    Write-Host "Source folder not found: $sourcePath"
    return
  }

  $imageCount = (Get-ChildItem -LiteralPath $sourcePath -File | Where-Object {
    $_.Extension -match '^\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff|heic)$'
  }).Count

  if ($imageCount -eq 0) {
    Write-Host "No images found in: $sourcePath"
    return
  }

  Write-Host "Syncing $imageCount images from: $sourcePath"
  & $syncScript -SourcePath $sourcePath

  if ($Push) {
    Invoke-GitPublish
  }
}

do {
  Invoke-ModelAiSync
  if ($Once) {
    break
  }
  Start-Sleep -Seconds $PollSeconds
} while ($true)
