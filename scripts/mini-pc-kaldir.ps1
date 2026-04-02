# Mini PC: otomatik acmayi kapatir (Startup'taki dosyayi siler).

$ErrorActionPreference = "Stop"
$startup = [Environment]::GetFolderPath("Startup")
$dest = Join-Path $startup "Hospisync-Cloud.bat"
if (Test-Path $dest) {
    Remove-Item $dest -Force
    Write-Host "Kaldirildi: $dest"
} else {
    Write-Host "Zaten yoktu: $dest"
}
