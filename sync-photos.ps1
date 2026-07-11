param(
  [string]$ConfigPath = "$PSScriptRoot\desktop-sync-config.json",
  [switch]$Once
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ConfigPath)) {
  Copy-Item -LiteralPath "$PSScriptRoot\desktop-sync-config.example.json" -Destination $ConfigPath
  Write-Host "已生成配置文件：$ConfigPath"
  Write-Host "请先填写 owner、repo、branch、remotePath、downloadPath，然后重新运行。"
  exit 1
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
$token = $env:GITHUB_PHOTO_TOKEN
if (-not $token) {
  Write-Host "请先设置环境变量 GITHUB_PHOTO_TOKEN，它需要能读取该仓库内容。"
  exit 1
}

function Get-GitHubHeaders {
  @{
    Authorization = "Bearer $token"
    Accept = "application/vnd.github+json"
    "User-Agent" = "github-photo-drop-sync"
  }
}

function Get-RemoteItems([string]$Path) {
  $encodedPath = [uri]::EscapeDataString($Path).Replace("%2F", "/")
  $uri = "https://api.github.com/repos/$($config.owner)/$($config.repo)/contents/$encodedPath`?ref=$($config.branch)"
  try {
    $items = Invoke-RestMethod -Method Get -Uri $uri -Headers (Get-GitHubHeaders)
  } catch {
    Write-Host "读取 GitHub 目录失败：$($_.Exception.Message)"
    return @()
  }

  $result = @()
  foreach ($item in @($items)) {
    if ($item.type -eq "dir") {
      $result += Get-RemoteItems $item.path
    } elseif ($item.type -eq "file" -and $item.name -match '\.(jpg|jpeg|png|gif|webp|bmp|tif|tiff|heic)$') {
      $result += $item
    }
  }
  return $result
}

function Get-RelativeDownloadPath($RemoteFilePath) {
  $remoteRoot = [string]$config.remotePath
  $relative = $RemoteFilePath
  if ($relative.StartsWith("$remoteRoot/")) {
    $relative = $relative.Substring($remoteRoot.Length + 1)
  }
  return $relative.Replace("/", "\")
}

function Sync-Once {
  New-Item -ItemType Directory -Force -Path $config.downloadPath | Out-Null
  $items = Get-RemoteItems $config.remotePath
  foreach ($item in $items) {
    $relative = Get-RelativeDownloadPath $item.path
    $target = Join-Path $config.downloadPath $relative
    $targetDir = Split-Path -Parent $target
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    if (Test-Path -LiteralPath $target) {
      continue
    }
    Write-Host "下载：$relative"
    Invoke-WebRequest -Uri $item.download_url -OutFile $target -Headers (Get-GitHubHeaders)
  }
}

do {
  Sync-Once
  if ($Once) {
    break
  }
  Start-Sleep -Seconds ([int]$config.pollSeconds)
} while ($true)
