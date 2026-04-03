' HospiSync Kiosk Watchdog
' Chrome kapanirsa otomatik yeniden baslatir
' Bu dosya da Startup klasorune kopyalanmali

Dim objShell
Set objShell = CreateObject("WScript.Shell")

Do While True
    WScript.Sleep 15000 ' 15 saniye bekle
    
    Dim objWMI, colProcesses
    Set objWMI = GetObject("winmgmts:\\.\root\cimv2")
    Set colProcesses = objWMI.ExecQuery("SELECT * FROM Win32_Process WHERE Name = 'chrome.exe'")
    
    If colProcesses.Count = 0 Then
        WScript.Sleep 5000
        objShell.Run """C:\Program Files\Google\Chrome\Application\chrome.exe"" --kiosk --disable-infobars --disable-session-crashed-bubble --noerrdialogs --disable-translate --no-first-run --autoplay-policy=no-user-gesture-required --start-fullscreen ""https://hospisync.cloud""", 1, False
    End If
    
    Set colProcesses = Nothing
    Set objWMI = Nothing
Loop
