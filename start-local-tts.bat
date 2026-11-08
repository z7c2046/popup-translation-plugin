@echo off
chcp 65001 >nul
title LexiPro - 本地原生离线发音伴侣服务 (Sherpa-ONNX / Kokoro)

echo ============================================================
echo   🚀 LexiPro 本地原生离线发音伴侣服务 (Sherpa-ONNX / Kokoro)
echo   NextAI Translator 相同内核 · 原生 C++ · 零浏览器显存占用
echo ============================================================
echo.

cd /d "%~dp0scripts\local-tts-service"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 环境！
    echo 请先前往 https://nodejs.org 安装 Node.js (推荐 LTS 版本)。
    echo.
    pause
    exit /b 1
)

echo [1/2] 检查运行环境与依赖...
if not exist "node_modules\sherpa-onnx-node" (
    echo [提示] 首次运行，正在自动拉取 sherpa-onnx-node 原生二进制库...
    call npm install --no-audit
)

echo [2/2] 启动本地原生发音服务...
echo.
node server.js

if %errorlevel% neq 0 (
    echo.
    echo [提示] 服务已停止。按任意键退出...
    pause >nul
)
