@echo off
title LexiPro Local TTS Service
cd /d "%~dp0"
node server.js
if %errorlevel% neq 0 pause

