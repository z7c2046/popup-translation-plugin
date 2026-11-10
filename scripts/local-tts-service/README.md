# Popup Translation 本地原生离线语音服务 (Sherpa-ONNX / Kokoro-82M + MeloTTS 双引擎)

本服务是专为 **Popup Translation 划词翻译扩展** 与 **油猴脚本** 打造的本地独立语音服务程序。

底层采用开源语音框架 **`sherpa-onnx`** 原生 C++ 动态链接库，**与开源划词翻译工具 NextAI Translator 采用一致的底层技术架构**。

---

## 双引擎架构

* 🎙️ **英文引擎**：**`Kokoro-82M`**（11 种自然男女声）
* 🇨🇳 **中文/混读引擎**：**`MeloTTS`**（中英混读与自然变调）
* 🔀 **智能分流**：包含汉字自动走 **MeloTTS**，纯英文走 **Kokoro-82M**；也支持 `model=kokoro` / `model=melo`。

---

## 启动与使用指南

1. 在项目根目录双击 **`本地语音服务.exe`**。
2. 程序会在系统右下角托盘显示绿色小喇叭图标 🔊，关闭主窗口会自动收起到托盘。
3. 打开扩展设置中心 → 【语音发音引擎】选择 `🚀 本地原生服务 (Kokoro + MeloTTS · 推荐)`，点击【🔍 检测连接】确认显示绿色在线即可。

---

## HTTP API

* **健康检查**：`GET http://127.0.0.1:18080/health`
* **发音接口**：`GET http://127.0.0.1:18080/tts?text=apple&voice=af_heart&speed=1.0`
* **OpenAI 兼容接口**：`POST http://127.0.0.1:18080/v1/audio/speech` (`{"input": "Hello world", "voice": "af_heart"}`)
