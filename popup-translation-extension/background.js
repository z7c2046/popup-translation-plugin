/**
 * Popup Translation - Background Service Worker (Manifest V3)
 * 处理扩展存储初始化、跨域网络请求代理（突破页面 CSP 与 CORS 限制）
 * 遵循 GEMINI_TRANSLATION_UX_BLUEPRINT 规范：请求全覆盖超时、全生命周期取消与隔离管理
 */

// 活跃中的 HTTP 请求映射 (requestId -> AbortController)
const activeHttpRequests = new Map();

// Offscreen 宿主页单例管理 Promise 与闲置回收定时器
let creatingOffscreenPromise = null;
let offscreenIdleTimer = null;
let activeLocalTtsAbort = null;
let localTtsEpoch = 0;

function resetOffscreenIdleTimer() {
  if (offscreenIdleTimer) {
    clearTimeout(offscreenIdleTimer);
    offscreenIdleTimer = null;
  }
  // 30 秒无任何发音交互，自动销毁 Offscreen 页面，彻底释放浏览器内存
  offscreenIdleTimer = setTimeout(async () => {
    if (typeof chrome !== 'undefined' && chrome.offscreen && await chrome.offscreen.hasDocument()) {
      try {
        await chrome.offscreen.closeDocument();
      } catch (e) {}
    }
  }, 30000);
}

async function ensureOffscreenDocument() {
  resetOffscreenIdleTimer();
  if (typeof chrome !== 'undefined' && chrome.offscreen) {
    if (await chrome.offscreen.hasDocument()) {
      return;
    }
    if (creatingOffscreenPromise) {
      await creatingOffscreenPromise;
      return;
    }
    creatingOffscreenPromise = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK', 'WORKERS'],
      justification: 'Play synthesized local TTS audio reliably across HTTPS sites'
    });
    await creatingOffscreenPromise;
    creatingOffscreenPromise = null;
  }
}

async function handleLocalTtsPlay(url) {
  if (!url) return { success: false };
  const myEpoch = ++localTtsEpoch;
  if (activeLocalTtsAbort) {
    try { activeLocalTtsAbort.abort('superseded'); } catch (e) {}
    activeLocalTtsAbort = null;
  }

  const controller = new AbortController();
  activeLocalTtsAbort = controller;
  const timer = setTimeout(() => {
    try { controller.abort('timeout'); } catch (e) {}
  }, 5000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { success: false };
    const blob = await res.blob();
    const dataUrl = await blobToBase64(blob);
    if (controller.signal.aborted || myEpoch !== localTtsEpoch) {
      return { success: false, aborted: true };
    }

    await ensureOffscreenDocument();
    if (myEpoch !== localTtsEpoch) {
      return { success: false, aborted: true };
    }
    const playRes = await chrome.runtime.sendMessage({
      type: 'LOCAL_AUDIO_PLAY',
      target: 'offscreen',
      dataUrl,
      epoch: myEpoch
    });
    resetOffscreenIdleTimer();
    return playRes && playRes.success ? { success: true } : { success: false };
  } catch (err) {
    return {
      success: false,
      aborted: Boolean((controller.signal.aborted && controller.signal.reason !== 'timeout') || myEpoch !== localTtsEpoch)
    };
  } finally {
    clearTimeout(timer);
    if (activeLocalTtsAbort === controller) {
      activeLocalTtsAbort = null;
    }
  }
}

// 扩展安装或更新时的初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[Popup Translation] Background Service Worker 已就绪。');
});

// 监听来自 content script 或 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. GM_xmlhttpRequest 跨域网络代理
  if (message.type === 'GM_XHR') {
    handleXhrRequest(message.details)
      .then(res => sendResponse({ success: true, response: res }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true;
  }

  // 1.1 主动中止网络代理请求
  if (message.type === 'GM_XHR_ABORT') {
    const reqId = message.requestId;
    if (reqId && activeHttpRequests.has(reqId)) {
      const controller = activeHttpRequests.get(reqId);
      try {
        controller.abort('aborted_by_client');
      } catch (e) {}
      activeHttpRequests.delete(reqId);
      sendResponse({ success: true, aborted: true });
    } else {
      sendResponse({ success: false, error: 'Request not found or already settled' });
    }
    return true;
  }

  // 2. 批量存储同步
  if (message.type === 'STORAGE_GET_ALL') {
    chrome.storage.local.get(null).then(data => sendResponse({ success: true, data }));
    return true;
  }

  if (message.type === 'STORAGE_SET') {
    chrome.storage.local.set(message.data).then(() => sendResponse({ success: true }));
    return true;
  }

  // 3. Kokoro 离线神经网络 TTS 发音转发代理
  if (typeof message.type === 'string' && message.type.startsWith('KOKORO_TTS_')) {
    const offscreenType = message.type.replace('KOKORO_TTS_', 'KOKORO_');
    ensureOffscreenDocument()
      .then(() => chrome.runtime.sendMessage({ ...message, type: offscreenType, target: 'offscreen' }))
      .then(res => {
        resetOffscreenIdleTimer();
        sendResponse(res || { success: true });
      })
      .catch(err => {
        resetOffscreenIdleTimer();
        sendResponse({ success: false, error: err?.message || String(err) });
      });
    return true;
  }

  // 4. 本地原生伴侣发音服务代理（绕过网页 Mixed Content / PNA / CSP 限制）
  if (message.type === 'LOCAL_TTS_PLAY') {
    handleLocalTtsPlay(message.url)
      .then(res => sendResponse(res))
      .catch(() => sendResponse({ success: false }));
    return true;
  }

  if (message.type === 'LOCAL_TTS_STOP') {
    const stopEpoch = ++localTtsEpoch;
    if (activeLocalTtsAbort) {
      try { activeLocalTtsAbort.abort('stopped'); } catch (e) {}
      activeLocalTtsAbort = null;
    }
    if (typeof chrome !== 'undefined' && chrome.offscreen && typeof chrome.offscreen.hasDocument === 'function') {
      chrome.offscreen.hasDocument()
        .then(has => {
          if (has && stopEpoch === localTtsEpoch) {
            return chrome.runtime.sendMessage({ type: 'LOCAL_AUDIO_STOP', target: 'offscreen', epoch: stopEpoch }).catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => sendResponse({ success: true }));
    } else {
      sendResponse({ success: true });
    }
    return true;
  }
});

/**
 * 代理执行网络请求（支持 GET, POST, 超时覆盖完整响应体与自定义取消）
 */
async function handleXhrRequest(details) {
  const { url, method = 'GET', headers = {}, data, timeout = 45000, responseType, requestId } = details;

  const controller = new AbortController();
  if (requestId) {
    activeHttpRequests.set(requestId, controller);
  }

  let timer = null;
  if (timeout > 0) {
    timer = setTimeout(() => {
      try {
        controller.abort('timeout');
      } catch (e) {}
    }, timeout);
  }

  try {
    const fetchOptions = {
      method: method.toUpperCase(),
      headers: { ...headers },
      signal: controller.signal
    };

    if (data && (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT' || fetchOptions.method === 'PATCH')) {
      fetchOptions.body = data;
    }

    const res = await fetch(url, fetchOptions);

    let responseData;
    if (responseType === 'json') {
      responseData = await res.json().catch(() => null);
    } else if (responseType === 'blob') {
      const blob = await res.blob();
      responseData = await blobToBase64(blob);
    } else {
      responseData = await res.text();
    }

    const respHeaders = {};
    if (res.headers && typeof res.headers.forEach === 'function') {
      res.headers.forEach((value, key) => {
        respHeaders[key] = value;
      });
    }

    return {
      status: res.status,
      statusText: res.statusText,
      responseText: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      response: responseData,
      headers: respHeaders
    };
  } catch (err) {
    if (err.name === 'AbortError') {
      if (controller.signal && controller.signal.reason === 'aborted_by_client') {
        throw new Error('请求已由客户端取消');
      }
      throw new Error(`请求超时 (${timeout}ms): ${url}`);
    }
    throw err;
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
    if (requestId) {
      activeHttpRequests.delete(requestId);
    }
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
