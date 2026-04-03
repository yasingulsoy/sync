@echo off
REM HospiSync Signage - Kiosk Baslatici
REM Internet yoksa 5 dakikada bir tekrar dener

taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

set "URL=https://hospisync.cloud/fs"

REM Ilk acilista ag icin 10 sn bekle
timeout /t 10 /nobreak >nul

:BEKLE
ping -n 1 -w 3000 8.8.8.8 >nul 2>&1
if errorlevel 1 (
    echo [%date% %time%] Internet yok, 5 dk sonra tekrar deneniyor...
    timeout /t 300 /nobreak >nul
    goto BEKLE
)

REM Internet var, tarayiciyi ac
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen "%URL%"
    goto :eof
)

if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen "%URL%"
    goto :eof
)

REM Chrome yoksa Edge kullan
start "" msedge.exe --kiosk --disable-infobars --noerrdialogs --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen "%URL%"
