# GitHub Photo Drop

这是一个静态 GitHub Pages 网站：手机端选择图片，网页把图片上传到你的 GitHub 仓库；电脑端运行 `sync-photos.ps1`，定时把仓库里的图片下载到 `D:\Desktop\codex\37手机端\日期` 文件夹。

## 文件

- `index.html`：手机上传页面
- `styles.css`：页面样式
- `app.js`：GitHub 上传逻辑
- `sync-photos.ps1`：电脑端自动下载脚本
- `sync-today-uploads-to-clothes.ps1`：把“今日上传图片”下载到 `D:\Desktop\codex\衣服生图\日期图片`
- `启动-衣服生图自动同步.bat`：双击后持续自动同步今日上传图到衣服生图
- `desktop-sync-config.example.json`：电脑端同步配置模板

## GitHub 准备

1. 新建一个 GitHub 仓库，例如 `photo-drop`。
2. 开启 GitHub Pages，发布根目录。
3. 创建一个 Fine-grained personal access token。
4. Token 至少需要这个仓库的 Contents 读写权限。

## 手机端

打开 GitHub Pages 网站后填写：

- GitHub Token
- 仓库拥有者
- 仓库名
- 分支，默认 `main`
- 保存目录，默认 `uploads`

设置会保存在手机浏览器本地。

## 电脑端自动下载

复制 `desktop-sync-config.example.json` 为 `desktop-sync-config.json`，填好仓库信息。默认会下载到 `D:\Desktop\codex\37手机端`，并保留每天的日期文件夹。

设置当前 PowerShell 窗口的 Token：

```powershell
$env:GITHUB_PHOTO_TOKEN="你的GitHubToken"
```

只同步一次：

```powershell
.\sync-photos.ps1 -Once
```

持续自动同步：

```powershell
.\sync-photos.ps1
```

## 今日上传图同步到衣服生图

只同步一次，把 `uploads/2026-7-11` 这样的今日上传目录下载到 `D:\Desktop\codex\衣服生图\2026-7-11图片`：

```powershell
.\sync-today-uploads-to-clothes.ps1 -Once
```

持续自动同步：

```powershell
.\sync-today-uploads-to-clothes.ps1
```

也可以直接双击 `启动-衣服生图自动同步.bat`，窗口不关就会每 60 秒自动检查一次今日上传图片。

## GitHub 自动清理

仓库里的 `.github/workflows/cleanup-uploads.yml` 会每天按中国时间自动检查 `uploads` 目录。超过 7 天的日期文件夹会从 GitHub 删除，例如 `uploads/2026-7-11` 会在 7 天后自动清理。

这个清理只影响 GitHub 仓库里的上传文件，不会删除电脑本地 `D:\Desktop\codex\衣服生图\日期图片` 里的文件。
