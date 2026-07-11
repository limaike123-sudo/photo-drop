@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0sync-today-uploads-to-clothes.ps1"
pause
