@echo off
setlocal
title LexiPro Local TTS Service (Sherpa-ONNX)

cd /d "%~dp0scripts\local-tts-service"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org
    echo.
    pause
    exit /b 1
)

node server.js

if %errorlevel% neq 0 (
    echo.
    echo [INFO] Service exited with code %errorlevel%
    pause
)
endlocal
