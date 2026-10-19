' Defterdar - Gorunmez baslatici (cift tikla, siyah ekran cikmaz)
' Hedef: Node tabanli hizli baslatici. Eski PowerShell surumu 6-12 sn suruyordu.
Dim sh, fso, proje
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
proje = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = proje
sh.Run "node """ & proje & "\scripts\defterdar-baslat.cjs""", 0, False
Set sh = Nothing
Set fso = Nothing