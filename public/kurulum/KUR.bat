@echo off
REM HospiSync Signage - Tek Tikla Kurulum
REM Bu dosyaya cift tiklayin, kurulum otomatik yapilir.

echo.
echo   HospiSync Signage Kurulumu baslatiliyor...
echo.

cd /d "%~dp0"

REM signage-kur.ps1 ayni klasorde mi kontrol et
if not exist "signage-kur.ps1" (
    echo   [HATA] signage-kur.ps1 bulunamadi!
    echo   Tum dosyalari ayni klasore cikardiginizdan emin olun.
    pause
    exit /b 1
)

REM PowerShell betigi yonetici olarak calistir
powershell -ExecutionPolicy Bypass -File "%~dp0signage-kur.ps1"
