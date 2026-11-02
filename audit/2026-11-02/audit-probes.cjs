// Read-only probes of the current application source; no network or browser storage.
// Updated to verify that the blueprint fixes are successfully in place.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const ext = path.join(root, 'popup-translation-extension');
const content = fs.readFileSync(path.join(ext, 'content.js'), 'utf8');
const user = fs.readFileSync(path.join(root, '划词翻译+生词高亮.txt'), 'utf8');
const report = { scope: 'Extracted current functions with mocked dependencies; verifying blueprint fixes', probes: [] };

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source boundary missing: ${start}`);
  return source.slice(a, b).trim();
}
function add(name, result) { report.probes.push({ name, ...result }); }

(async () => {
  // 1. 验证双端 modelOverride 已经真正生效
  for (const [name, source] of [['extension', content], ['userscript', user]]) {
    let captured;
    const context = vm.createContext({
      CONFIG: { llmProvider: 'siliconflow', disableThinking: true },
      getActiveLLMProvider: () => ({ name: 'mock', model: 'selected-model', apiUrl: 'mock://never-called', apiKey: 'mock' }),
      GM_xmlhttpRequest: details => {
        captured = JSON.parse(details.data);
        details.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: 'mock translation' } }] }) });
        return { abort() {} };
      },
      activeFetchRequest: null,
      getLLMErrorDetail: () => ''
    });
    vm.runInContext(section(source, 'function requestLLMChatCompletion(', '// 发起真实的 API Post 请求'), context);
    await context.requestLLMChatCompletion({ messages: [], modelOverride: 'fallback-model' });
    assert.equal(captured.model, 'fallback-model');
    add(`${name}: modelOverride in effect`, { requested: 'fallback-model', actualRequestModel: captured.model, stream: captured.stream });
  }

  // 2. 双端 initSiteSpecificTranslator 模块代码保持 100% 一致性
  const siteStart = 'function initSiteSpecificTranslator()';
  const siteEnd = '// 启动系统核心初始化入口';
  const siteParity = section(content, siteStart, siteEnd).replace(/\r\n/g, '\n') === section(user, siteStart, siteEnd).replace(/\r\n/g, '\n');
  assert.equal(siteParity, true);
  add('Shared site translator parity', { exactNormalizedMatch: siteParity });

  // 3. 验证失败项支持 retryFailedOnly 重试
  const toasts = [];
  let requests = 0;
  const failed = { id: 'a', type: 'comment', originalText: 'Test comment', status: 'pending' };
  const siteContext = vm.createContext({
    siteItemsMap: new Map([['a', failed]]), isSiteTranslating: false, isSiteShowingTranslation: false,
    siteTotalCount: 0, siteUntranslatedNewCount: 0, siteTranslatedCount: 0, siteConfig: { name: 'Reddit' },
    siteGeneration: 0, activePageRequests: new Set(),
    collectSiteElements() {}, showSiteToast: text => toasts.push(text), updateSiteFabState() {},
    sortPendingItemsByVisualOrder: items => items, createBatches: items => [items], getModelForBatch: () => 'mock',
    requestLLMChatCompletion: async () => { requests++; throw new Error('simulated offline'); },
    applyItemStyle() {}, console,
  });
  vm.runInContext(section(content, 'async function runSiteTranslation(', 'function cleanSiteTrans('), siteContext);
  await siteContext.runSiteTranslation();
  assert.equal(failed.status, 'failed');
  const requestsFirst = requests;
  // 进行重试操作
  await siteContext.runSiteTranslation({ retryFailedOnly: true });
  assert.ok(requests > requestsFirst, 'Retry must issue new requests for failed items');
  add('Failed page items retried on request', { requestsFirst, totalRequestsAfterRetry: requests, itemStatus: failed.status, toasts });

  // 4. 验证扩展 bridge abort 能通知后台并触发 abort 回调
  let pendingCallback;
  let loadCalls = 0;
  let abortCalls = 0;
  const messages = [];
  const bridgeContext = vm.createContext({ chrome: { runtime: {
    sendMessage: (message, cb) => { messages.push(message.type); pendingCallback = cb; },
  } } });
  vm.runInContext(section(content, 'function GM_xmlhttpRequest(', '// 存储变更监听与热更新支持'), bridgeContext);
  const handle = bridgeContext.GM_xmlhttpRequest({ url: 'mock://never-called', onload: () => loadCalls++, onabort: () => abortCalls++ });
  handle.abort();
  assert.equal(abortCalls, 1);
  assert.ok(messages.includes('GM_XHR_ABORT'));
  add('Bridge abort dispatches cancellation and invokes onabort', { sentMessageTypes: [...messages], loadCalls, abortCallbackCalls: abortCalls });

  // 5. 验证后台超时覆盖响应体读取过程
  let cleared = false;
  let finishBody;
  const background = fs.readFileSync(path.join(ext, 'background.js'), 'utf8');
  const bgContext = vm.createContext({
    AbortController, setTimeout: () => 1, clearTimeout: () => { cleared = true; },
    fetch: async () => ({ status: 200, statusText: 'OK', text: () => new Promise(resolve => { finishBody = resolve; }), headers: new Map() }),
    activeHttpRequests: new Map()
  });
  vm.runInContext(section(background, 'async function handleXhrRequest(', 'function blobToBase64('), bgContext);
  const pending = bgContext.handleXhrRequest({ url: 'mock://never-called' });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cleared, false, 'Timeout timer must NOT be cleared while body is still reading');
  finishBody('mock');
  await pending;
  assert.equal(cleared, true, 'Timeout timer cleared in finally block after body reads');
  add('Background timeout safely covers entire response body stream', { timeoutProtectedDuringStream: true, clearedInFinally: cleared });

  // 6. 验证 Popup 交互控件接线与主题切换
  const controls = new Map();
  function element(id) {
    if (!controls.has(id)) controls.set(id, { style: {}, listeners: {}, addEventListener(event, handler) { this.listeners[event] = handler; } });
    return controls.get(id);
  }
  let ready;
  const popupContext = vm.createContext({
    document: { addEventListener: (event, fn) => { ready = fn; }, getElementById: element },
    chrome: {
      storage: { local: { get: async defaults => defaults, set: async () => {} } },
      tabs: { query: async () => [{ id: 1, url: 'https://www.reddit.com/r/test/comments/fixture' }], sendMessage: async () => ({ supported: true, connected: true, siteName: 'Reddit', jobState: 'idle' }) },
      runtime: {}
    },
    window: { close: () => {} }, alert: () => {},
  });
  vm.runInContext(fs.readFileSync(path.join(ext, 'popup.js'), 'utf8'), popupContext);
  await ready();
  assert.ok(element('quick-theme-select').listeners.change, 'quick-theme-select must have registered change handler');
  assert.ok(element('quick-style-select').listeners.change, 'quick-style-select must have registered change handler');
  add('Popup action and theme wiring verified', {
    messageDriven: true,
    quickThemeChangeHandlerRegistered: Boolean(element('quick-theme-select').listeners.change)
  });

  // 7. 色彩对比度核验
  function luminance(hex) {
    const rgb = hex.replace('#', '').match(/../g).map(x => parseInt(x, 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  }
  function ratio(a, b) { const x = luminance(a), y = luminance(b); return Number(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2)); }
  add('Static solid-color contrast calculations', { pairs: [
    ['setting tip with new token', '#5D6672', '#FFFFFF'],
    ['popup footer with new token', '#5D6672', '#F6F7F9'],
    ['proposed light body', '#20252B', '#FFFFFF'],
    ['proposed light secondary', '#5D6672', '#FFFFFF'],
    ['proposed light primary button', '#FFFFFF', '#285FBA'],
    ['proposed dark body', '#E5EAF0', '#20252C'],
    ['proposed dark secondary', '#AAB4C0', '#20252C'],
    ['proposed dark button', '#18202C', '#8DB4FF'],
  ].map(([label, foreground, background]) => ({ label, foreground, background, ratio: ratio(foreground, background) })) });

  const output = JSON.stringify(report, null, 2) + '\n';
  fs.writeFileSync(path.join(__dirname, 'audit-results.json'), output);
  console.log(output);
})().catch(error => { console.error(error); process.exitCode = 1; });
