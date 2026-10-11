@echo off
rtk proxy powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0ops\start-local.ps1" -MobilePreview
if errorlevel 1 pause
