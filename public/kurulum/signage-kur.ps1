# HospiSync Signage - Kurulum Betigi
# PowerShell'i Yonetici olarak calistirin:
#   Sag tikla > Yonetici olarak calistir
# Veya KUR.bat kullanin (otomatik yapar)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$kioskBat  = Join-Path $scriptDir "kiosk-fs.bat"
$startup   = [Environment]::GetFolderPath("Startup")
$shortcut  = Join-Path $startup "HospiSync Kiosk.lnk"

Write-Host ""
Write-Host "  HospiSync Signage Kurulumu" -ForegroundColor Cyan
Write-Host "  =========================" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $kioskBat)) {
    Write-Host "  [HATA] kiosk-fs.bat bulunamadi!" -ForegroundColor Red
    Write-Host "  Bu betik, kiosk-fs.bat ile ayni klasorde olmali." -ForegroundColor Red
    pause
    exit 1
}

# Uyku ve ekran kapanma devre disi
Write-Host "  [1/4] Guc ayarlari yapiliyor..." -ForegroundColor Yellow
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
Write-Host "        Uyku ve ekran kapanma devre disi" -ForegroundColor Green

# Startup kisayolu olustur
Write-Host "  [2/4] Baslangic kisayolu olusturuluyor..." -ForegroundColor Yellow
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($shortcut)
$sc.TargetPath = $kioskBat
$sc.WorkingDirectory = $scriptDir
$sc.WindowStyle = 7
$sc.Save()
Write-Host "        $shortcut" -ForegroundColor Green

# Bildirimleri kapat
Write-Host "  [3/4] Bildirimler kapatiliyor..." -ForegroundColor Yellow
$notifPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
if (-not (Test-Path $notifPath)) { New-Item -Path $notifPath -Force | Out-Null }
Set-ItemProperty -Path $notifPath -Name "ToastEnabled" -Value 0 -Type DWord
Write-Host "        Bildirimler kapatildi" -ForegroundColor Green

# Gorev cubugunu otomatik gizle
Write-Host "  [4/4] Gorev cubugu gizleniyor..." -ForegroundColor Yellow
$tbPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"
Write-Host "        Gorev cubugunu elle gizleyin: Sag tikla > Ayarlar > Otomatik gizle" -ForegroundColor DarkYellow

Write-Host ""
Write-Host "  Kurulum tamamlandi!" -ForegroundColor Green
Write-Host ""
Write-Host "  Bilgisayari yeniden baslatin." -ForegroundColor White
Write-Host "  hospisync.cloud/fs tam ekran acilacak." -ForegroundColor White
Write-Host ""
Write-Host "  Kiosk modundan cikmak: Alt+F4" -ForegroundColor DarkGray
Write-Host ""
pause
