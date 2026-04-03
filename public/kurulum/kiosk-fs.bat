@echo off
REM HospiSync Signage - Kiosk Baslatici
REM Bu dosya oturum acildiginda otomatik calisir

taskkill /F /IM chrome.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

timeout /t 8 /nobreak >nul

set "URL=https://hospisync.cloud/fs"

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
