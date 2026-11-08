@echo off
setlocal
title Stop LexiPro Local TTS Service

echo Stopping LexiPro Local TTS Service on port 18080...
echo.

for /f "tokens=5" %%a in ('netstat -aon ^| findstr :18080 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo [SUCCESS] Local TTS service stopped.
timeout /t 2 >nul
endlocal
