@echo off
setlocal
title Remove LexiPro Auto-Start

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "LNK_PATH=%STARTUP_FOLDER%\LexiPro-TTS-Service.lnk"

if exist "%LNK_PATH%" (
    del /f /q "%LNK_PATH%"
    echo.
    echo [SUCCESS] Auto-start shortcut removed.
    echo.
) else (
    echo.
    echo [INFO] Auto-start shortcut does not exist.
    echo.
)

timeout /t 2 >nul
endlocal
