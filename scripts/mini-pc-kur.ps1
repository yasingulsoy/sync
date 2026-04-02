# Mini PC: Bu TEK dosyayi USB ile kopyalayip bir kez calistirin.
# Windows oturum acilinca https://hospisync.cloud varsayilan tarayicida acilir.
# Sag tik > PowerShell ile calistir  VEYA:
#   powershell -ExecutionPolicy Bypass -File ".\mini-pc-kur.ps1"

$ErrorActionPreference = "Stop"
$startup = [Environment]::GetFolderPath("Startup")
$dest = Join-Path $startup "Hospisync-Cloud.bat"

$bat = @"
@echo off
timeout /t 5 /nobreak >nul
start "" "https://hospisync.cloud"
"@
[System.IO.File]::WriteAllText($dest, $bat.TrimEnd() + "`r`n", [System.Text.Encoding]::ASCII)

Write-Host "Kuruldu (her oturum acilista calisir):"
Write-Host $dest
