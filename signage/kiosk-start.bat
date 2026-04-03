@echo off
REM HospiSync Digital Signage - Kiosk Modu Baslatici
REM Bu dosyayi her mini PC'nin Startup klasorune kopyalayin:
REM   shell:startup (Calistir'a yazin)

REM Onceki Chrome islemlerini kapat
taskkill /F /IM chrome.exe >nul 2>&1

REM Agbaglantisi icin bekle (bazen PC boot sonrasi ag gec baglaniyor)
timeout /t 10 /nobreak >nul

REM Chrome'u kiosk modunda ac
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen "https://hospisync.cloud"
