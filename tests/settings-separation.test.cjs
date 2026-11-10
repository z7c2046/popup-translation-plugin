const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const extDir = path.join(rootDir, 'popup-translation-extension');

const backgroundJs = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');
const optionsHtml = fs.readFileSync(path.join(extDir, 'options.html'), 'utf8');
const optionsCss = fs.readFileSync(path.join(extDir, 'options.css'), 'utf8');
const optionsJs = fs.readFileSync(path.join(extDir, 'options.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
const userscript = fs.readFileSync(path.join(rootDir, '划词翻译+生词高亮.txt'), 'utf8');

function section(source, start, end) {
    const a = source.indexOf(start);
    assert.ok(a >= 0, `Start marker not found: ${start}`);
    const b = source.indexOf(end, a + start.length);
    assert.ok(b > a, `End marker not found: ${end}`);
    return source.slice(a, b);
}

function createMockElement(id, initialValue = '') {
    const listeners = {};
    const attrs = {};
    const classes = new Set();
    return {
        id,
        value: initialValue,
        type: 'password',
        textContent: '',
        title: '',
        style: { display: '' },
        classList: {
            add: (...c) => c.forEach(x => classes.add(x)),
            remove: (...c) => c.forEach(x => classes.delete(x)),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (classes.has(c)) classes.delete(c); else classes.add(c);
                } else if (force) {
                    classes.add(c);
                } else {
                    classes.delete(c);
                }
            },
            contains: c => classes.has(c)
        },
        className: '',
        setAttribute: (k, v) => { attrs[k] = String(v); },
        getAttribute: k => attrs[k] ?? null,
        addEventListener: (ev, fn) => {
            if (!listeners[ev]) listeners[ev] = [];
            listeners[ev].push(fn);
        },
        dispatchEvent: (evName, extra = {}) => {
            const evt = { type: evName, preventDefault() {}, ...extra };
            (listeners[evName] || []).forEach(fn => fn(evt));
        },
        click() {
            this.dispatchEvent('click');
        }
    };
}

function createMockSettingsBox(initialConfig) {
    const elements = new Map();
    const labelMap = new Map();
    const toggleBtns = [];
    let html = '';

    function rebuildFromHtml(nextHtml) {
        html = String(nextHtml || '');
        elements.clear();
        labelMap.clear();
        toggleBtns.length = 0;

        const idRegex = /id="([^"]+)"/g;
        let m;
        while ((m = idRegex.exec(html)) !== null) {
            const id = m[1];
            let initialVal = '';
            if (id === 'imt-provider-select') initialVal = initialConfig.llmProvider || 'siliconflow';
            else if (id === 'sf-model-select') initialVal = initialConfig.llmProviders?.siliconflow?.model || '';
            else if (id === 'kimi-refresh-token') initialVal = initialConfig.llmProviders?.kimi_free?.refreshToken || '';
            else if (id === 'kimi-access-token') initialVal = initialConfig.llmProviders?.kimi_free?.accessToken || '';
            else if (id === 'imt-notion-token') initialVal = initialConfig.notionToken || '';
            else if (id === 'imt-notion-db') initialVal = initialConfig.notionDatabaseId || '';
            const el = createMockElement(id, initialVal);
            if (id === 'sf-model-group') {
                el.style.display = initialConfig.llmProvider === 'kimi_free' ? 'none' : 'block';
            }
            if (id === 'kimi-settings-group') {
                el.style.display = initialConfig.llmProvider === 'kimi_free' ? 'block' : 'none';
            }
            elements.set(id, el);
        }

        const labelForRegex = /<label\s+for="([^"]+)"/g;
        while ((m = labelForRegex.exec(html)) !== null) {
            labelMap.set(m[1], createMockElement(`label-${m[1]}`));
        }

        const toggleRegex = /class="imt-token-toggle-btn"\s+data-target="([^"]+)"/g;
        while ((m = toggleRegex.exec(html)) !== null) {
            const btn = createMockElement(`toggle-${m[1]}`);
            btn.setAttribute('data-target', m[1]);
            toggleBtns.push(btn);
        }
    }

    return {
        get innerHTML() {
            return html;
        },
        set innerHTML(val) {
            rebuildFromHtml(val);
        },
        querySelector(selector) {
            if (selector.startsWith('#')) {
                return elements.get(selector.slice(1)) || null;
            }
            const labelMatch = selector.match(/^label\[for="([^"]+)"\]$/);
            if (labelMatch) {
                return labelMap.get(labelMatch[1]) || null;
            }
            return null;
        },
        querySelectorAll(selector) {
            if (selector === '.imt-token-toggle-btn') {
                return toggleBtns;
            }
            return [];
        }
    };
}

test('Extension Options Architecture: AI Engine (SiliconFlow + Kimi) and Notion config live in options page', () => {
    // 1. HTML controls in options.html#panel-ai & #panel-notion
    const panelAi = section(optionsHtml, 'id="panel-ai"', 'id="panel-notion"');
    assert.match(panelAi, /id="llm-provider-select"[\s\S]*value="siliconflow"[\s\S]*value="kimi_free"/);
    assert.match(panelAi, /id="disable-thinking-check"/);
    assert.match(panelAi, /id="sf-config-card"[\s\S]*id="sf-active-badge"/);
    assert.match(panelAi, /id="sf-model-select"[\s\S]*id="sf-key-input"[\s\S]*id="btn-toggle-sf-key"/);
    assert.match(panelAi, /id="btn-test-sf"[\s\S]*id="test-sf-result"/);
    assert.match(panelAi, /id="kimi-config-card"[\s\S]*id="kimi-active-badge"/);
    assert.match(panelAi, /href="https:\/\/kimi\.moonshot\.cn"/);
    assert.match(panelAi, /id="kimi-refresh-token-input"[\s\S]*id="btn-toggle-kimi-refresh"/);
    assert.match(panelAi, /id="kimi-access-token-input"[\s\S]*id="btn-toggle-kimi-access"/);
    assert.match(panelAi, /id="btn-test-kimi"[\s\S]*id="test-kimi-result"/);

    assert.match(optionsHtml, /id="panel-notion"[\s\S]*id="notion-token-input"[\s\S]*id="notion-db-input"/);
    assert.ok(!optionsHtml.includes('👁️') && !optionsJs.includes('👁️'), 'options UI must use SVG eye icons instead of emoji');

    // 2. options.js DEFAULT_CONFIG + normalizeLlmProvider in VM
    const snippet = section(optionsJs, 'const DEFAULT_CONFIG =', "document.addEventListener('DOMContentLoaded'");
    const ctx = vm.createContext({});
    vm.runInContext(
        `${snippet}\nthis.__exports = { DEFAULT_CONFIG, normalizeLlmProvider };`,
        ctx
    );
    const { DEFAULT_CONFIG, normalizeLlmProvider } = ctx.__exports;
    assert.equal(DEFAULT_CONFIG.lexipro_llm_provider, 'siliconflow');
    assert.ok(typeof DEFAULT_CONFIG.lexipro_kimi_refresh_token === 'string' && DEFAULT_CONFIG.lexipro_kimi_refresh_token.length > 20);
    assert.ok(typeof DEFAULT_CONFIG.lexipro_kimi_access_token === 'string' && DEFAULT_CONFIG.lexipro_kimi_access_token.length > 20);

    assert.equal(normalizeLlmProvider('siliconflow'), 'siliconflow');
    assert.equal(normalizeLlmProvider('kimi_free'), 'kimi_free');
    assert.equal(normalizeLlmProvider('zhipu'), 'siliconflow');
    assert.equal(normalizeLlmProvider(''), 'siliconflow');
    assert.equal(normalizeLlmProvider(undefined), 'siliconflow');

    // 3. options.js event handlers, connectivity tests, live sync, and save keys
    assert.match(optionsJs, /function updateEngineBadges\(\)/);
    assert.match(optionsJs, /btnToggleKimiRefresh\?\.addEventListener/);
    assert.match(optionsJs, /btnToggleKimiAccess\?\.addEventListener/);
    assert.match(optionsJs, /async function refreshKimiTestToken\(/);
    assert.match(optionsJs, /async function createKimiTestChat\(/);
    assert.match(optionsJs, /btnTestKimi\?\.addEventListener\('click'/);
    assert.match(optionsJs, /const sfApiKey = keyInput\.value\.trim\(\);[\s\S]*if \(!sfApiKey\)/, 'btnTestSf must require non-empty API key rather than silently using default');
    assert.match(optionsJs, /lexipro_llm_provider:\s*normalizeLlmProvider/);
    assert.match(optionsJs, /lexipro_kimi_refresh_token:\s*kimiRefreshInput/);
    assert.match(optionsJs, /lexipro_kimi_access_token:\s*kimiAccessInput/);
    assert.match(optionsJs, /lexipro_kimi_thinking:\s*!thinkingCheck\.checked/);
    assert.match(optionsJs, /changes\.lexipro_sf_api_key/);
    assert.match(optionsJs, /changes\.lexipro_kimi_refresh_token/);
    assert.match(optionsJs, /changes\.lexipro_kimi_access_token/);
    assert.match(optionsJs, /changes\.lexipro_notion_token/);
    assert.match(optionsJs, /changes\.lexipro_notion_database_id/);
});

test('Background Worker: handles OPEN_OPTIONS_PAGE cleanly and reports failures safely', async () => {
    const listenersSrc = section(backgroundJs, 'chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {', '// 3. Kokoro 离线神经网络 TTS 发音转发代理');
    assert.match(listenersSrc, /if \(message\.type === 'OPEN_OPTIONS_PAGE'\)/);

    const ctx = vm.createContext({
        assert,
        openCalled: 0,
        shouldReject: false
    });
    const testScript = `
      const handlers = [];
      const chrome = {
        runtime: {
          openOptionsPage() {
            globalThis.openCalled++;
            return globalThis.shouldReject ? Promise.reject(new Error('No UI')) : Promise.resolve();
          },
          onMessage: { addListener(fn) { handlers.push(fn); } }
        }
      };
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        ${section(backgroundJs, "  if (message.type === 'OPEN_OPTIONS_PAGE') {", "  // 3. Kokoro")}
      });
      this.__invoke = (msg) => new Promise(resolve => {
        const ret = handlers[0](msg, {}, resolve);
        assert.equal(ret, true);
      });
    `;
    vm.runInContext(testScript, ctx);
    const messageListener = ctx.__invoke;

    const okRes = await messageListener({ type: 'OPEN_OPTIONS_PAGE' });
    assert.equal(ctx.openCalled, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(okRes)), { success: true });

    ctx.shouldReject = true;
    const failRes = await messageListener({ type: 'OPEN_OPTIONS_PAGE' });
    assert.equal(ctx.openCalled, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(failRes)), { success: false });
});

test('Startup Credential Initialization: preserves custom tokens, respects cleared empty keys, and detects extension runtime accurately', () => {
    for (const [label, source] of [['content.js', contentJs], ['划词翻译+生词高亮.txt', userscript]]) {
        const initCode = section(
            source,
            '// 迁移旧版服务商配置（若之前选了已被移除的智谱，自动重置为硅基流动）',
            '// animal-island-ui「island 动森不规则有机气泡」轮廓路径'
        );

        // Case A: Fresh install (nothing in storage -> null defaults returned, defaults populated)
        {
            const stored = new Map();
            const setCalls = [];
            const ctx = vm.createContext({
                window: {},
                GM_getValue: (k, d) => (stored.has(k) ? stored.get(k) : d),
                GM_setValue: (k, v) => {
                    stored.set(k, v);
                    setCalls.push([k, v]);
                },
                chrome: { runtime: { id: 'ext-runtime-id' } }
            });
            ctx.window.top = ctx.window;
            ctx.window.self = ctx.window;
            vm.runInContext(
                `${initCode}\nthis.__out = { CONFIG, isExt: isChromeExtensionRuntime(), DEFAULT_SF_API_KEY, DEFAULT_KIMI_REFRESH_TOKEN, DEFAULT_KIMI_ACCESS_TOKEN };`,
                ctx
            );
            assert.equal(ctx.__out.isExt, true, `${label} must detect Chrome extension runtime when chrome.runtime.id exists`);
            assert.equal(ctx.__out.CONFIG.llmProviders.siliconflow.apiKey, ctx.__out.DEFAULT_SF_API_KEY);
            assert.equal(ctx.__out.CONFIG.llmProviders.kimi_free.refreshToken, ctx.__out.DEFAULT_KIMI_REFRESH_TOKEN);
            assert.equal(ctx.__out.CONFIG.llmProviders.kimi_free.accessToken, ctx.__out.DEFAULT_KIMI_ACCESS_TOKEN);
            assert.ok(setCalls.some(([k]) => k === 'lexipro_kimi_refresh_token'));
            assert.ok(setCalls.some(([k]) => k === 'lexipro_kimi_access_token'));
        }

        // Case B: User customized credentials -> never overwritten on startup
        {
            const stored = new Map([
                ['lexipro_disable_thinking', true],
                ['lexipro_llm_provider', 'kimi_free'],
                ['lexipro_sf_api_key', 'sk-custom-user-key'],
                ['lexipro_kimi_refresh_token', 'rt-custom-user'],
                ['lexipro_kimi_access_token', 'at-custom-user']
            ]);
            const setCalls = [];
            const ctx = vm.createContext({
                window: {},
                GM_getValue: (k, d) => (stored.has(k) ? stored.get(k) : d),
                GM_setValue: (k, v) => {
                    stored.set(k, v);
                    setCalls.push([k, v]);
                },
                // Normal Chromium webpage has chrome object WITHOUT chrome.runtime.id
                chrome: { runtime: {} }
            });
            ctx.window.top = ctx.window;
            ctx.window.self = ctx.window;
            vm.runInContext(`${initCode}\nthis.__out = { CONFIG, isExt: isChromeExtensionRuntime() };`, ctx);
            assert.equal(ctx.__out.isExt, false, `${label} must return false on normal webpage with chrome.runtime without id`);
            assert.equal(ctx.__out.CONFIG.llmProvider, 'kimi_free');
            assert.equal(ctx.__out.CONFIG.llmProviders.siliconflow.apiKey, 'sk-custom-user-key');
            assert.equal(ctx.__out.CONFIG.llmProviders.kimi_free.refreshToken, 'rt-custom-user');
            assert.equal(ctx.__out.CONFIG.llmProviders.kimi_free.accessToken, 'at-custom-user');
            assert.equal(setCalls.length, 0, `${label} must not overwrite user custom credentials on startup`);
        }

        // Case C: User explicitly cleared credentials to '' -> empty string preserved (no silent fallback)
        {
            const stored = new Map([
                ['lexipro_disable_thinking', true],
                ['lexipro_sf_api_key', ''],
                ['lexipro_kimi_refresh_token', ''],
                ['lexipro_kimi_access_token', '']
            ]);
            const setCalls = [];
            const ctx = vm.createContext({
                window: {},
                GM_getValue: (k, d) => (stored.has(k) ? stored.get(k) : d),
                GM_setValue: (k, v) => {
                    stored.set(k, v);
                    setCalls.push([k, v]);
                }
            });
            ctx.window.top = ctx.window;
            ctx.window.self = ctx.window;
            vm.runInContext(`${initCode}\nthis.__out = { CONFIG, isExt: isChromeExtensionRuntime() };`, ctx);
            assert.equal(ctx.__out.isExt, false, `${label} must return false when chrome global is undefined`);
            assert.equal(ctx.__out.CONFIG.llmProviders.siliconflow.apiKey, '', `${label} must preserve cleared empty SF API key`);
            assert.equal(ctx.__out.CONFIG.llmProviders.kimi_free.refreshToken, '', `${label} must preserve cleared empty Kimi refresh token`);
            assert.equal(ctx.__out.CONFIG.llmProviders.kimi_free.accessToken, '', `${label} must preserve cleared empty Kimi access token`);
            assert.equal(setCalls.length, 0);
        }
    }
});

test('Settings Separation in Tooltip UI: Chrome Extension hides Kimi/Notion credentials & opens Extension Options; Userscript retains them', () => {
    for (const [label, source] of [['content.js', contentJs], ['划词翻译+生词高亮.txt', userscript]]) {
        const escapeHtmlFn = section(source, 'function escapeHtml(str)', 'const PRESERVED_BLOCK_SELECTOR');
        const isExtFn = section(source, 'function isChromeExtensionRuntime()', '// ================= 配置区');
        const skinHelpers = section(source, 'function normalizeUiSkin(', 'let currentUiSkin =');
        const renderFn = section(source, 'function renderSettingsUI() {', '// ================= Notion 收藏 / 取消收藏逻辑');

        // 1. Extension Mode
        {
            const config = {
                llmProvider: 'kimi_free',
                disableThinking: true,
                autoPronounce: false,
                llmProviders: {
                    siliconflow: { model: 'Qwen/Qwen2.5-7B-Instruct', disableThinking: true },
                    kimi_free: { refreshToken: 'secret-rt', accessToken: 'secret-at', enableThinking: false }
                },
                notionToken: 'ntn_secret',
                notionDatabaseId: 'aaaa2222bbbb4444cccc6666dddd8888'
            };
            const settingsBox = createMockSettingsBox(config);
            const gmSetCalls = [];
            const runtimeMessages = [];
            const openedUrls = [];
            let simulateSendFail = false;

            const ctx = vm.createContext({
                CONFIG: config,
                currentUiSkin: 'modern',
                currentModernColorMode: 'auto',
                settingsBox,
                applyUISkin() {},
                syncVocabData() {},
                GM_setValue: (k, v) => gmSetCalls.push([k, v]),
                window: {
                    open: (url, target, features) => openedUrls.push({ url, target, features })
                },
                chrome: {
                    runtime: {
                        id: 'ext-id-xyz',
                        lastError: null,
                        getURL: p => `chrome-extension://ext-id-xyz/${p}`,
                        sendMessage(msg, cb) {
                            runtimeMessages.push(msg);
                            if (simulateSendFail) {
                                ctx.chrome.runtime.lastError = { message: 'Disconnected' };
                                cb && cb(undefined);
                                ctx.chrome.runtime.lastError = null;
                            } else {
                                cb && cb({ success: true });
                            }
                        }
                    }
                }
            });

            vm.runInContext(
                `${escapeHtmlFn}\n${isExtFn}\n${skinHelpers}\n${renderFn}\nrenderSettingsUI();`,
                ctx
            );

            const html = settingsBox.innerHTML;
            assert.doesNotMatch(html, /id="kimi-settings-group"/, `${label} extension tooltip must omit #kimi-settings-group`);
            assert.doesNotMatch(html, /id="kimi-refresh-token"/, `${label} extension tooltip must omit #kimi-refresh-token`);
            assert.doesNotMatch(html, /id="kimi-access-token"/, `${label} extension tooltip must omit #kimi-access-token`);
            assert.doesNotMatch(html, /Local Storage 复制 Token/, `${label} extension tooltip must omit Kimi Local Storage hint`);
            assert.doesNotMatch(html, /id="notion-settings-group"/, `${label} extension tooltip must omit #notion-settings-group`);
            assert.doesNotMatch(html, /id="imt-notion-token"/, `${label} extension tooltip must omit #imt-notion-token`);
            assert.doesNotMatch(html, /id="imt-notion-db"/, `${label} extension tooltip must omit #imt-notion-db`);

            assert.match(html, /id="imt-open-ext-options-btn"/, `${label} extension tooltip must render Extension Options button`);
            assert.match(html, /id="imt-skin-select"/);
            assert.match(html, /id="imt-color-mode-select"/);
            assert.match(html, /id="imt-provider-select"/);
            assert.match(html, /id="imt-thinking-switch"/);
            assert.match(html, /id="imt-pronounce-switch"/);

            // Switch provider cleanly with missing #kimi-settings-group (no TypeError)
            const providerSelect = settingsBox.querySelector('#imt-provider-select');
            const sfModelGroup = settingsBox.querySelector('#sf-model-group');
            providerSelect.value = 'siliconflow';
            providerSelect.dispatchEvent('change');
            assert.equal(config.llmProvider, 'siliconflow');
            assert.equal(sfModelGroup.style.display, 'block');

            providerSelect.value = 'kimi_free';
            providerSelect.dispatchEvent('change');
            assert.equal(config.llmProvider, 'kimi_free');
            assert.equal(sfModelGroup.style.display, 'none');

            // Clicking Extension Options button calls OPEN_OPTIONS_PAGE and falls back cleanly on error
            const extBtn = settingsBox.querySelector('#imt-open-ext-options-btn');
            extBtn.click();
            assert.deepEqual(JSON.parse(JSON.stringify(runtimeMessages)), [{ type: 'OPEN_OPTIONS_PAGE' }]);
            assert.equal(openedUrls.length, 0);

            simulateSendFail = true;
            extBtn.click();
            assert.equal(openedUrls.length, 1);
            assert.equal(openedUrls[0].url, 'chrome-extension://ext-id-xyz/options.html');
        }

        // 2. Tampermonkey Userscript Mode (no chrome.runtime.id)
        {
            const config = {
                llmProvider: 'siliconflow',
                disableThinking: true,
                autoPronounce: false,
                llmProviders: {
                    siliconflow: { model: 'Qwen/Qwen2.5-7B-Instruct', disableThinking: true },
                    kimi_free: { refreshToken: 'tm-rt', accessToken: 'tm-at', enableThinking: false }
                },
                notionToken: 'tm_ntn',
                notionDatabaseId: 'aaaa2222bbbb4444cccc6666dddd8888'
            };
            const settingsBox = createMockSettingsBox(config);
            let syncCalled = 0;
            const gmSetCalls = [];

            const ctx = vm.createContext({
                CONFIG: config,
                currentUiSkin: 'animal_island',
                currentModernColorMode: 'auto',
                settingsBox,
                applyUISkin() {},
                syncVocabData: () => { syncCalled++; },
                GM_setValue: (k, v) => gmSetCalls.push([k, v]),
                window: {}
            });

            vm.runInContext(
                `${escapeHtmlFn}\n${isExtFn}\n${skinHelpers}\n${renderFn}\nrenderSettingsUI();`,
                ctx
            );

            const html = settingsBox.innerHTML;
            assert.match(html, /id="kimi-settings-group"/, `${label} userscript tooltip must retain #kimi-settings-group`);
            assert.match(html, /id="kimi-refresh-token"/);
            assert.match(html, /id="kimi-access-token"/);
            assert.match(html, /id="notion-settings-group"/, `${label} userscript tooltip must retain #notion-settings-group`);
            assert.match(html, /id="imt-notion-token"/);
            assert.match(html, /id="imt-notion-db"/);
            assert.doesNotMatch(html, /id="imt-open-ext-options-btn"/, `${label} userscript tooltip must not render Extension Options button`);

            // Provider change in userscript toggles #kimi-settings-group visibility
            const providerSelect = settingsBox.querySelector('#imt-provider-select');
            const sfModelGroup = settingsBox.querySelector('#sf-model-group');
            const kimiSettingsGroup = settingsBox.querySelector('#kimi-settings-group');
            providerSelect.value = 'kimi_free';
            providerSelect.dispatchEvent('change');
            assert.equal(sfModelGroup.style.display, 'none');
            assert.equal(kimiSettingsGroup.style.display, 'block');

            // Verify eye toggle works for userscript tokens
            const toggleBtn = settingsBox.querySelectorAll('.imt-token-toggle-btn')[0];
            const targetInput = settingsBox.querySelector(`#${toggleBtn.getAttribute('data-target')}`);
            assert.equal(targetInput.type, 'password');
            toggleBtn.click();
            assert.equal(targetInput.type, 'text');

            // Verify Notion config change saves and syncs
            const dbInput = settingsBox.querySelector('#imt-notion-db');
            dbInput.value = 'https://www.notion.so/my/11112222333344445555666677778888?v=1';
            dbInput.dispatchEvent('change');
            assert.equal(config.notionDatabaseId, '11112222333344445555666677778888');
            assert.equal(syncCalled, 1);
            assert.ok(gmSetCalls.some(([k, v]) => k === 'lexipro_notion_database_id' && v === '11112222333344445555666677778888'));
        }
    }
});

test('Hot Reload Sync & getActiveLLMProvider: updates credentials live and tailors missing-config error hint', () => {
    for (const [label, source] of [['content.js', contentJs], ['划词翻译+生词高亮.txt', userscript]]) {
        const isExtFn = section(source, 'function isChromeExtensionRuntime()', '// ================= 配置区');
        const activeProviderFn = section(source, 'function getActiveLLMProvider()', 'function getLLMErrorDetail(');
        const storageChangeBlock = section(source, '// 全局配置热更新监听（由 storage 监听回调派发）', '// 启动系统核心初始化入口');

        for (const isExt of [true, false]) {
            const config = {
                llmProvider: 'siliconflow',
                disableThinking: true,
                llmProviders: {
                    siliconflow: {
                        name: '硅基流动',
                        apiUrl: 'https://api.siliconflow.cn/v1/chat/completions',
                        apiKey: 'sk-initial',
                        model: 'Qwen/Qwen2.5-7B-Instruct',
                        supportsJsonResponse: true
                    },
                    kimi_free: {
                        name: 'Kimi (网页免费版)',
                        refreshToken: 'rt-initial',
                        accessToken: 'at-initial',
                        enableThinking: false
                    }
                }
            };
            const settingsBox = createMockSettingsBox(config);
            settingsBox.innerHTML = isExt
                ? '<select id="imt-provider-select"></select><div id="sf-model-group"></div><select id="sf-model-select"></select>'
                : '<select id="imt-provider-select"></select><div id="sf-model-group"></div><div id="kimi-settings-group"></div><select id="sf-model-select"></select><input id="kimi-refresh-token"><input id="kimi-access-token">';

            const storedMap = new Map();
            const ctx = vm.createContext({
                CONFIG: config,
                VALID_SF_MODELS: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen3.5-4B', 'Qwen/Qwen3-8B', 'THUDM/GLM-4-9B-0414'],
                DEFAULT_SF_API_KEY: 'sk-default',
                settingsBox,
                handleExcludedSitesChange() {},
                applyUISkin() {},
                syncVocabData() {},
                isCurrentSiteExcluded: () => false,
                isCurrentSiteImmersionEnabled: () => false,
                initSiteSpecificTranslator() {},
                GM_getValue: (k, d) => (storedMap.has(k) ? storedMap.get(k) : d),
                window: {},
                chrome: isExt ? { runtime: { id: 'ext-123' } } : undefined
            });

            vm.runInContext(`${isExtFn}\n${activeProviderFn}\n${storageChangeBlock}`, ctx);

            const onChange = ctx.window.__lexipro_onStorageChange;
            onChange('lexipro_sf_model', 'Qwen/Qwen3-8B');
            assert.equal(config.llmProviders.siliconflow.model, 'Qwen/Qwen3-8B', `${label} must hot-reload lexipro_sf_model`);

            onChange('lexipro_sf_api_key', '');
            assert.equal(config.llmProviders.siliconflow.apiKey, '', `${label} must hot-reload cleared lexipro_sf_api_key`);
            assert.throws(
                () => ctx.getActiveLLMProvider(),
                isExt ? /扩展设置（AI 翻译引擎）/ : /⚙️ 设置面板/,
                `${label} missing API key message must point to right UI in isExt=${isExt}`
            );

            onChange('lexipro_llm_provider', 'kimi_free');
            assert.equal(config.llmProvider, 'kimi_free', `${label} must hot-reload lexipro_llm_provider`);

            onChange('lexipro_kimi_refresh_token', '');
            onChange('lexipro_kimi_access_token', '');
            storedMap.set('lexipro_kimi_refresh_token', '');
            storedMap.set('lexipro_kimi_access_token', '');
            assert.equal(config.llmProviders.kimi_free.refreshToken, '');
            assert.equal(config.llmProviders.kimi_free.accessToken, '');
            assert.throws(
                () => ctx.getActiveLLMProvider(),
                isExt ? /扩展设置（AI 翻译引擎）/ : /⚙️ 设置面板/,
                `${label} missing Kimi token message must point to right UI in isExt=${isExt}`
            );
        }
    }
});

test('Kimi Token Functions: refreshKimiAccessToken & requestKimiWebCompletion respect cleared empty tokens in storage', async () => {
    for (const [label, source] of [['content.js', contentJs], ['划词翻译+生词高亮.txt', userscript]]) {
        const isExtFn = section(source, 'function isChromeExtensionRuntime()', '// ================= 配置区');
        const activeProviderFn = section(source, 'function getActiveLLMProvider()', 'function getLLMErrorDetail(');
        const kimiCore = section(source, 'function generateKimiTrafficId()', 'function extractJsonFromContent(');

        let networkCalled = false;
        const storedMap = new Map([
            ['lexipro_kimi_refresh_token', ''],
            ['lexipro_kimi_access_token', '']
        ]);
        const ctx = vm.createContext({
            CONFIG: {
                llmProvider: 'kimi_free',
                disableThinking: true,
                llmProviders: {
                    kimi_free: {
                        name: 'Kimi (网页免费版)',
                        refreshToken: 'stale-fallback-rt',
                        accessToken: 'stale-fallback-at'
                    }
                }
            },
            activeFetchRequest: null,
            GM_getValue: (k, d) => (storedMap.has(k) ? storedMap.get(k) : d),
            GM_setValue: (k, v) => storedMap.set(k, v),
            GM_xmlhttpRequest: () => {
                networkCalled = true;
                return { abort() {} };
            },
            chrome: { runtime: { id: 'ext-123' } }
        });

        vm.runInContext(`${isExtFn}\n${activeProviderFn}\n${kimiCore}`, ctx);

        await assert.rejects(
            () => ctx.refreshKimiAccessToken(),
            /未配置 Kimi Refresh Token/,
            `${label} refreshKimiAccessToken must reject rather than using stale fallback when storage is ''`
        );
        await assert.rejects(
            () => ctx.requestKimiWebCompletion({ messages: [{ role: 'user', content: 'hi' }] }),
            /未配置 Kimi Token/,
            `${label} requestKimiWebCompletion must reject when stored Kimi tokens are ''`
        );
        assert.equal(networkCalled, false, `${label} must not fire network requests with stale tokens after user cleared storage`);
    }
});

test('Branding Check: modified and test files contain zero unauthorized branding', () => {
    const forbiddenRegex = new RegExp('Lexi' + ' ?Pro');
    const selfSrc = fs.readFileSync(__filename, 'utf8');
    for (const [label, src] of [
        ['background.js', backgroundJs],
        ['options.html', optionsHtml],
        ['options.css', optionsCss],
        ['options.js', optionsJs],
        ['content.js', contentJs],
        ['划词翻译+生词高亮.txt', userscript],
        ['tests/settings-separation.test.cjs', selfSrc]
    ]) {
        assert.doesNotMatch(src, forbiddenRegex, `${label} must not contain unauthorized branding`);
    }
});
