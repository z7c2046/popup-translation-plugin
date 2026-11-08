@echo off
setlocal
title LexiPro Local TTS - Setup Windows Auto-Start

echo ============================================================
echo   Setting up Silent Windows Auto-Start for LexiPro TTS
echo ============================================================
echo.

set "TARGET_DIR=%~dp0"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_PATH=%TARGET_DIR%start-silent.vbs"
set "LNK_PATH=%STARTUP_FOLDER%\LexiPro-TTS-Service.lnk"

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%LNK_PATH%'); $s.TargetPath = '%VBS_PATH%'; $s.WorkingDirectory = '%TARGET_DIR%'; $s.WindowStyle = 7; $s.Save()"

if exist "%LNK_PATH%" (
    echo.
    echo [SUCCESS] Auto-start shortcut created successfully!
    echo Service will now automatically run silently in the background on Windows boot.
    echo.
) else (
    echo.
    echo [ERROR] Failed to create shortcut in Startup folder.
    echo.
)

pause
endlocal
