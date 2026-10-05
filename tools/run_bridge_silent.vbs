Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)
strRoot = fso.GetParentFolderName(strPath)
WshShell.Run chr(34) & strRoot & "\Start_Print_Bridge.bat" & Chr(34), 0
Set WshShell = Nothing
