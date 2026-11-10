/**
 * Popup Translation - Offscreen Audio & Neural Synthesis Worker
 * 遵循 Chrome MV3 架构标准：在独立 Offscreen Document 中稳定播放本地音频与离线发音
 */

import { KokoroTTS, env } from './lib/kokoro.web.js';

// 锁定 ONNX Runtime Web 本地扩展资源路径，绝对不向外网 jsdelivr 发起动态模块请求
if (env && typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
  try {
    env.wasmPaths = chrome.runtime.getURL('lib/');
  } catch (e) {}
}

// 当前运行状态
let ttsInstance = null;
let ttsInitPromise = null;
let modelState = 'uninitialized'; // 'uninitialized' | 'loading' | 'ready' | 'error'
let loadProgress = 0;
let lastErrorMsg = '';

// 音频播放控制
let currentAudio = null;
let currentAudioUrl = null;
let currentAudioEpoch = 0;

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
      if (currentAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrl);
      }
    } catch (e) {}
    currentAudioUrl = null;
  }
}

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

async function playAudioDataUrl(dataUrl) {
  if (!dataUrl) return { success: false, error: 'Empty audio data' };
  stopCurrentAudio();

  const audioEl = new Audio(dataUrl);
  currentAudio = audioEl;
  currentAudioUrl = dataUrl;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };

    audioEl.onended = () => {
      if (currentAudio === audioEl) {
        stopCurrentAudio();
      }
      finish({ success: true });
    };
    audioEl.onerror = () => {
      if (currentAudio === audioEl) {
        stopCurrentAudio();
      }
      finish({ success: false });
    };

    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => finish({ success: true }))
        .catch(() => {
          if (currentAudio === audioEl) {
            stopCurrentAudio();
          }
          finish({ success: false });
        });
    } else {
      finish({ success: true });
    }
  });
}

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
      if (env && typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function') {
        try {
          env.wasmPaths = chrome.runtime.getURL('lib/');
        } catch (e) {}
      }

      const primaryDevice = 'wasm';
      const handleProgress = (p) => {
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
      };

      const tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype: 'q8',
        device: primaryDevice,
        progress_callback: handleProgress
      });

      ttsInstance = tts;
      modelState = 'ready';
      loadProgress = 100;
      broadcastStatus({ state: 'ready', progress: 100 });
      return tts;
    } catch (err) {
      modelState = 'error';
      lastErrorMsg = err?.message || String(err);
      broadcastStatus({ state: 'error', error: lastErrorMsg });
      ttsInitPromise = null;
      throw err;
    }
  })();

  return ttsInitPromise;
}

async function playSpeech(text, voice = 'af_heart', speed = 1.0) {
  if (!text || !text.trim()) return { success: false, error: 'Empty text' };

  stopCurrentAudio();
  const tts = await ensureTTS();

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

  // 0. 播放本地原生伴侣服务音频 Data URL
  if (message.type === 'LOCAL_AUDIO_PLAY') {
    if (typeof message.epoch === 'number') {
      if (message.epoch < currentAudioEpoch) {
        sendResponse({ success: false, aborted: true });
        return true;
      }
      currentAudioEpoch = message.epoch;
    }
    playAudioDataUrl(message.dataUrl)
      .then(res => sendResponse(res))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === 'LOCAL_AUDIO_STOP') {
    if (typeof message.epoch === 'number' && message.epoch < currentAudioEpoch) {
      sendResponse({ success: true, ignored: true });
      return true;
    }
    if (typeof message.epoch === 'number') {
      currentAudioEpoch = message.epoch;
    }
    stopCurrentAudio();
    sendResponse({ success: true });
    return true;
  }

  // 1. 发音合成播放指令
  if (message.type === 'KOKORO_PLAY') {
    playSpeech(message.text, message.voice, message.speed)
      .then(res => sendResponse({ success: true, ...res }))
      .catch(err => sendResponse({ success: false, error: err?.message || String(err) }));
    return true;
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
