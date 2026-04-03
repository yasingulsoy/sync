# HospiSync Kiosk Modu Otomatik Kurulum Scripti
# PowerShell'i Yonetici olarak calistirin ve bu scripti calistirin:
#   Set-ExecutionPolicy Bypass -Scope Process
#   .\setup-kiosk.ps1

$SiteURL = "https://hospisync.cloud"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$StartupFolder = [Environment]::GetFolderPath("Startup")

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " HospiSync Kiosk Kurulum Scripti" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Chrome kontrolu
if (-not (Test-Path $ChromePath)) {
    $ChromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    if (-not (Test-Path $ChromePath)) {
        Write-Host "[HATA] Chrome bulunamadi! Lutfen Chrome yukleyin." -ForegroundColor Red
        exit 1
    }
}
Write-Host "[OK] Chrome bulundu: $ChromePath" -ForegroundColor Green

# Uyku ve ekran kapanma ayarlarini devre disi birak
Write-Host "[...] Guc ayarlari yapiliyor..." -ForegroundColor Yellow
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
Write-Host "[OK] Uyku ve ekran kapanma devre disi birakildi" -ForegroundColor Green

# Kiosk batch dosyasini Startup'a kopyala
$batContent = @"
@echo off
taskkill /F /IM chrome.exe >nul 2>&1
timeout /t 10 /nobreak >nul
start "" "$ChromePath" --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen "$SiteURL"
"@
$batPath = Join-Path $StartupFolder "kiosk-start.bat"
Set-Content -Path $batPath -Value $batContent -Encoding ASCII
Write-Host "[OK] Kiosk baslatici olusturuldu: $batPath" -ForegroundColor Green

# Watchdog VBS dosyasini Startup'a kopyala
$vbsContent = @"
Dim objShell
Set objShell = CreateObject("WScript.Shell")
Do While True
    WScript.Sleep 15000
    Dim objWMI, colProcesses
    Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
    Set colProcesses = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'chrome.exe'")
    If colProcesses.Count = 0 Then
        WScript.Sleep 5000
        objShell.Run """$ChromePath"" --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen ""$SiteURL""", 1, False
    End If
    Set colProcesses = Nothing
    Set objWMI = Nothing
Loop
"@
$vbsPath = Join-Path $StartupFolder "kiosk-watchdog.vbs"
Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII
Write-Host "[OK] Watchdog olusturuldu: $vbsPath" -ForegroundColor Green

# Gorev cubugunu otomatik gizle (Registry)
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StuckRects3"
Write-Host "[BILGI] Gorev cubugunu gizlemek icin: Gorev cubuguna sag tikla > Ayarlar > Otomatik gizle" -ForegroundColor Yellow

# Bildirimleri kapat
$notifRegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
if (-not (Test-Path $notifRegPath)) {
    New-Item -Path $notifRegPath -Force | Out-Null
}
Set-ItemProperty -Path $notifRegPath -Name "ToastEnabled" -Value 0 -Type DWord
Write-Host "[OK] Bildirimler kapatildi" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Kurulum Tamamlandi!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Yapmaniz gerekenler:" -ForegroundColor Yellow
Write-Host "  1. Otomatik oturum acma ayarlayin: Win+R > netplwiz" -ForegroundColor White
Write-Host "  2. Bilgisayari yeniden baslatin" -ForegroundColor White
Write-Host "  3. hospisync.cloud otomatik acilacaktir" -ForegroundColor White
Write-Host ""
Write-Host "Kiosk modundan cikmak: Alt+F4 veya Ctrl+Alt+Delete" -ForegroundColor Gray
