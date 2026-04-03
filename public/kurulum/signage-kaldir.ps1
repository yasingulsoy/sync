# HospiSync Signage - Kaldirma Betigi
# Baslangic kisayolunu kaldirir, guc ayarlarini geri almaz

$startup  = [Environment]::GetFolderPath("Startup")
$shortcut = Join-Path $startup "HospiSync Kiosk.lnk"

Write-Host ""
Write-Host "  HospiSync Signage Kaldirma" -ForegroundColor Yellow
Write-Host ""

if (Test-Path $shortcut) {
    Remove-Item $shortcut -Force
    Write-Host "  [OK] Baslangic kisayolu kaldirildi." -ForegroundColor Green
} else {
    Write-Host "  [BILGI] Baslangic kisayolu zaten yok." -ForegroundColor DarkYellow
}

# Bildirimleri geri ac
$notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
if (Test-Path $notifPath) {
    Set-ItemProperty -Path $notifPath -Name "ToastEnabled" -Value 1 -Type DWord
    Write-Host "  [OK] Bildirimler tekrar acildi." -ForegroundColor Green
}

Write-Host ""
Write-Host "  Kaldirma tamamlandi. Bilgisayari yeniden baslatin." -ForegroundColor White
Write-Host ""
pause
