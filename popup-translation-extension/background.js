/**
 * LexiPro - Background Service Worker (Manifest V3)
 * 处理扩展存储初始化、跨域网络请求代理（突破页面 CSP 与 CORS 限制）
 */

// 扩展安装或更新时的初始化
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[LexiPro] Background Service Worker 已就绪。');
});

// 监听来自 content script 或 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 1. GM_xmlhttpRequest 跨域网络代理
  if (message.type === 'GM_XHR') {
    handleXhrRequest(message.details)
      .then(res => sendResponse({ success: true, response: res }))
      .catch(err => sendResponse({ success: false, error: err.message || String(err) }));
    return true; // 保持异步消息通道
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
});

/**
 * 代理执行网络请求（支持 GET, POST, 超时与自定义请求头）
 */
async function handleXhrRequest(details) {
  const { url, method = 'GET', headers = {}, data, timeout = 45000, responseType } = details;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

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
    clearTimeout(timer);

    let responseData;
    if (responseType === 'json') {
      responseData = await res.json().catch(() => null);
    } else if (responseType === 'blob') {
      const blob = await res.blob();
      responseData = await blobToBase64(blob);
    } else {
      responseData = await res.text();
    }

    // 收集响应头
    const respHeaders = {};
    res.headers.forEach((value, key) => {
      respHeaders[key] = value;
    });

    return {
      status: res.status,
      statusText: res.statusText,
      responseText: typeof responseData === 'string' ? responseData : JSON.stringify(responseData),
      response: responseData,
      headers: respHeaders
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new Error(`请求超时 (${timeout}ms): ${url}`);
    }
    throw err;
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

