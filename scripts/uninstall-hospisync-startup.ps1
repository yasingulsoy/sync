$startup = [Environment]::GetFolderPath("Startup")
$dest = Join-Path $startup "Hospisync-Cloud.bat"
if (Test-Path $dest) {
    Remove-Item $dest -Force
    Write-Host "Kaldirildi: $dest"
} else {
    Write-Host "Dosya yoktu: $dest"
}
