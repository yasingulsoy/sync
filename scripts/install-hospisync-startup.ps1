# Hospisync: Windows oturum acilisinda https://hospisync.cloud adresini acar.
# Calistirma: sag tik > PowerShell ile calistir VEYA: powershell -ExecutionPolicy Bypass -File ".\install-hospisync-startup.ps1"

$ErrorActionPreference = "Stop"
$startup = [Environment]::GetFolderPath("Startup")
$batName = "Hospisync-Cloud.bat"
$source = Join-Path $PSScriptRoot "hospisync-open.bat"
$dest = Join-Path $startup $batName

if (-not (Test-Path $source)) {
    Write-Error "Bulunamadi: $source"
}

Copy-Item -Path $source -Destination $dest -Force
Write-Host "Tamam. Su dosya oturum acilinca calisacak:"
Write-Host $dest
Write-Host ""
Write-Host "Kaldirmak icin: uninstall-hospisync-startup.ps1 calistirin veya Startup klasorunden $batName dosyasini silin."
