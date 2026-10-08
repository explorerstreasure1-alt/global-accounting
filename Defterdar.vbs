' Defterdar - Görünmez başlatıcı (çift tıkla, siyah ekran çıkmaz)
Dim sh, proje
Set sh = CreateObject("WScript.Shell")
proje = Left(WScript.ScriptFullName, InStrRev(WScript.ScriptFullName, "\"))
sh.Run "powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & proje & "Defterdar-Gizli.ps1""", 0, False
Set sh = Nothing
