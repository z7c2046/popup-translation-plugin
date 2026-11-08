/**
 * LexiPro - Kokoro TTS Offscreen Audio & Neural Synthesis Worker
 * 遵循 Chrome MV3 架构标准：在独立 Offscreen Document 中运行神经网络推理与 Web Audio 播放
 * 采用按需懒加载与 IndexedDB 离线持久化机制，零侵入宿主网页内存
 */

import { KokoroTTS } from './lib/kokoro.web.js';

// 当前运行状态
let ttsInstance = null;
let ttsInitPromise = null;
let modelState = 'uninitialized'; // 'uninitialized' | 'loading' | 'ready' | 'error'
let loadProgress = 0;
let lastErrorMsg = '';

// 音频播放控制
let currentAudio = null;
let currentAudioUrl = null;

function stopCurrentAudio() {
  if (currentAudio) {
    try {
      currentAudio.pause();
      currentAudio.currentTime = 0;
    } catch (e) {}
    currentAudio = null;
  }
  if (currentAudioUrl) {
    try {
      URL.revokeObjectURL(currentAudioUrl);
    } catch (e) {}
    currentAudioUrl = null;
  }
}

// 向 background 与活跃页面广播当前下载/加载状态
function broadcastStatus(extra = {}) {
  try {
    chrome.runtime.sendMessage({
      type: 'KOKORO_STATUS_UPDATE',
      state: modelState,
      progress: loadProgress,
      error: lastErrorMsg,
      ...extra
    }).catch(() => {});
  } catch (e) {}
}

/**
 * 确保 Kokoro-82M 模型初始化（首次使用自动从 Hugging Face 下载并缓存至 IndexedDB）
 */
async function ensureTTS() {
  if (ttsInstance) {
    return ttsInstance;
  }
  if (ttsInitPromise) {
    return ttsInitPromise;
  }

  modelState = 'loading';
  loadProgress = 0;
  lastErrorMsg = '';
  broadcastStatus({ state: 'loading', progress: 0 });

  ttsInitPromise = (async () => {
    try {
      const device = (typeof navigator !== 'undefined' && navigator.gpu) ? 'webgpu' : 'wasm';
      console.log(`[LexiPro TTS] 正在初始化 Kokoro-82M 离线神经网络模型 (设备: ${device})...`);

      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: device,
        progress_callback: (p) => {
          if (p && typeof p.progress === 'number') {
            loadProgress = Math.min(100, Math.max(0, Math.round(p.progress)));
            broadcastStatus({
              state: 'loading',
              progress: loadProgress,
              file: p.file || '',
              loaded: p.loaded || 0,
              total: p.total || 0
            });
          }
        }
      });

      ttsInstance = tts;
      modelState = 'ready';
      loadProgress = 100;
      console.log('[LexiPro TTS] Kokoro-82M 离线语音模型已成功加载就绪！');
      broadcastStatus({ state: 'ready', progress: 100 });
      return tts;
    } catch (err) {
      modelState = 'error';
      lastErrorMsg = err?.message || String(err);
      console.error('[LexiPro TTS] Kokoro 模型初始化失败:', err);
      broadcastStatus({ state: 'error', error: lastErrorMsg });
      ttsInitPromise = null;
      throw err;
    }
  })();

  return ttsInitPromise;
}

/**
 * 合成并播放语音
 */
async function playSpeech(text, voice = 'af_heart', speed = 1.0) {
  if (!text || !text.trim()) return { success: false, error: 'Empty text' };

  stopCurrentAudio();
  const tts = await ensureTTS();

  console.log(`[LexiPro TTS] 正在合成语音: "${text.slice(0, 30)}..." [音色: ${voice}, 语速: ${speed}]`);
  const audio = await tts.generate(text, {
    voice: voice || 'af_heart',
    speed: typeof speed === 'number' ? speed : 1.0
  });

  const blob = audio.toBlob();
  const audioUrl = URL.createObjectURL(blob);
  currentAudioUrl = audioUrl;

  const audioEl = new Audio(audioUrl);
  currentAudio = audioEl;

  return new Promise((resolve, reject) => {
    audioEl.onended = () => {
      stopCurrentAudio();
      resolve({ success: true });
    };
    audioEl.onerror = (e) => {
      stopCurrentAudio();
      reject(new Error('Audio playback failed: ' + (e?.message || 'unknown')));
    };

    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        stopCurrentAudio();
        // 若受浏览器用户交互策略或快速切换中断，优雅处理
        if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) {
          resolve({ success: true, interrupted: true });
        } else {
          reject(err);
        }
      });
    }
  });
}

// 监听来自扩展后台的调度指令
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') {
    return false;
  }

  // 1. 发音合成播放指令
  if (message.type === 'KOKORO_PLAY') {
    playSpeech(message.text, message.voice, message.speed)
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true; // 异步响应
  }

  // 2. 停止当前发音
  if (message.type === 'KOKORO_STOP') {
    stopCurrentAudio();
    sendResponse({ success: true });
    return true;
  }

  // 3. 查询当前模型加载状态
  if (message.type === 'KOKORO_GET_STATUS') {
    sendResponse({
      success: true,
      state: modelState,
      progress: loadProgress,
      error: lastErrorMsg
    });
    return true;
  }

  // 4. 后台预热/预下载模型
  if (message.type === 'KOKORO_PRELOAD') {
    ensureTTS()
      .then(() => sendResponse({ success: true, state: 'ready' }))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
  }

  return false;
});
