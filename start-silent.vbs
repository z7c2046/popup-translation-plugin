' LexiPro 本地原生 TTS 伴侣服务 - 无控制台窗口后台静默启动
Dim WshShell, fso, currentDir, scriptPath
Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptPath = WScript.ScriptFullName
currentDir = fso.GetParentFolderName(scriptPath)

' 切换至伴侣服务目录并在后台静默运行 (0 = 隐形隐藏运行，无任何黑窗口)
WshShell.CurrentDirectory = currentDir & "\scripts\local-tts-service"
WshShell.Run "cmd /c node server.js", 0, False
