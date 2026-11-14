const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const contentJsPath = path.resolve(__dirname, '../popup-translation-extension/content.js');
const userscriptPath = path.resolve(__dirname, '../划词翻译+生词高亮.txt');

const contentSrc = fs.readFileSync(contentJsPath, 'utf8');
const userscriptSrc = fs.readFileSync(userscriptPath, 'utf8');

function section(source, startMarker, endMarker) {
    const startIdx = source.indexOf(startMarker);
    assert.notEqual(startIdx, -1, `Missing start marker: ${startMarker}`);
    const endIdx = source.indexOf(endMarker, startIdx);
    assert.notEqual(endIdx, -1, `Missing end marker: ${endMarker}`);
    return source.slice(startIdx, endIdx);
}

test('Extension bridge handles invalidated chrome.runtime without throwing sendMessage TypeError', async () => {
    const bridgeSlice = section(contentSrc, 'function GM_setValue(', '// 存储变更监听与热更新支持');

    // Scenario A: chrome.runtime is completely undefined (tab left open across extension reload)
    const ctxUndefined = vm.createContext({
        __storageCache: {},
        chrome: {},
        Promise
    });
    vm.runInContext(bridgeSlice, ctxUndefined);

    assert.doesNotThrow(() => ctxUndefined.GM_setValue('k', 'v'), 'GM_setValue must not throw when chrome.storage is missing');
    assert.equal(ctxUndefined.__storageCache.k, 'v');

    let receivedErrA = null;
    const handleA = ctxUndefined.GM_xmlhttpRequest({
        url: 'https://example.com',
        onerror: (err) => { receivedErrA = err; }
    });
    assert.ok(handleA && typeof handleA.abort === 'function', 'GM_xmlhttpRequest must return abort handle even when runtime is missing');
    assert.equal(receivedErrA, null, 'onerror must fire asynchronously so caller can bind abort handle first');

    await new Promise(resolve => setImmediate(resolve));
    assert.ok(receivedErrA && receivedErrA.name === 'Error', 'onerror must receive Error instance');
    assert.equal(receivedErrA.isExtensionContextInvalidated, true);
    assert.match(receivedErrA.message, /刷新当前网页/, 'Error message should advise refreshing page');
    assert.doesNotThrow(() => handleA.abort());

    // Scenario B: chrome.runtime.sendMessage throws synchronously "Extension context invalidated."
    const ctxThrows = vm.createContext({
        __storageCache: {},
        chrome: {
            storage: { local: { set() { throw new Error('Extension context invalidated.'); } } },
            runtime: {
                sendMessage() {
                    throw new Error('Extension context invalidated.');
                }
            }
        },
        Promise
    });
    vm.runInContext(bridgeSlice, ctxThrows);
    assert.doesNotThrow(() => ctxThrows.GM_setValue('k2', 'v2'));

    let receivedErrB = null;
    ctxThrows.GM_xmlhttpRequest({
        url: 'https://example.com',
        onerror: (err) => { receivedErrB = err; }
    });
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(receivedErrB);
    assert.equal(receivedErrB.isExtensionContextInvalidated, true);
    assert.match(receivedErrB.message, /刷新当前网页/);

    // Scenario C: chrome.runtime becomes undefined right before callback runs (reading lastError guard)
    let savedCallback = null;
    const ctxMidFlight = vm.createContext({
        __storageCache: {},
        chrome: {
            runtime: {
                sendMessage(_msg, cb) {
                    savedCallback = cb;
                }
            }
        },
        Promise
    });
    vm.runInContext(bridgeSlice, ctxMidFlight);
    let receivedErrC = null;
    ctxMidFlight.GM_xmlhttpRequest({
        url: 'https://example.com',
        onerror: (err) => { receivedErrC = err; }
    });
    ctxMidFlight.chrome.runtime = undefined;
    assert.doesNotThrow(() => savedCallback(undefined), 'Callback must guard chrome.runtime before reading lastError');
    assert.ok(receivedErrC);
    assert.equal(receivedErrC.isExtensionContextInvalidated, true);
});

test('LLM request wrappers surface invalidated-context error message instead of generic network error', async () => {
    const llmSlice = section(contentSrc, 'const activePageRequests = new Set();', '// 发起真实的 API Post 请求');
    const kimiSlice = section(contentSrc, 'function generateKimiTrafficId()', 'function extractJsonFromContent(');

    const makeInvalidatedErr = () => {
        const err = new Error('扩展已更新或连接已断开，请刷新当前网页后重试');
        err.isExtensionContextInvalidated = true;
        return err;
    };

    let xhrMode = 'fail_all';
    const ctx = vm.createContext({
        Promise,
        TextDecoder,
        btoa,
        CONFIG: {
            disableThinking: true,
            model: 'deepseek-chat',
            llmProviders: {
                kimi_free: { accessToken: 'at', refreshToken: 'rt', model: 'kimi', disableThinking: true }
            }
        },
        activeFetchRequest: null,
        getActiveLLMProvider: () => ({ id: 'deepseek', name: 'DeepSeek', apiUrl: 'https://api.deepseek.com', apiKey: 'sk-test', model: 'deepseek-chat' }),
        getLLMErrorDetail: () => '',
        GM_getValue: (_k, d) => d,
        GM_setValue: () => {},
        GM_xmlhttpRequest: (details) => {
            if (xhrMode === 'create_chat_ok_then_fail' && details.url.includes('/api/chat') && !details.url.includes('completion')) {
                Promise.resolve().then(() => details.onload({ status: 200, responseText: JSON.stringify({ id: 'chat-1' }) }));
            } else {
                Promise.resolve().then(() => details.onerror(makeInvalidatedErr()));
            }
            return { abort() {} };
        }
    });
    vm.runInContext(`${llmSlice}\n${kimiSlice}`, ctx);

    await assert.rejects(
        () => ctx.requestLLMChatCompletion({ messages: [{ role: 'user', content: 'hi' }] }),
        /刷新当前网页/
    );
    await assert.rejects(
        () => ctx.refreshKimiAccessToken(),
        /刷新当前网页/
    );
    await assert.rejects(
        () => ctx.requestKimiWebCompletion({ messages: [{ role: 'user', content: 'hi' }] }),
        /刷新当前网页/
    );

    xhrMode = 'create_chat_ok_then_fail';
    await assert.rejects(
        () => ctx.requestKimiWebCompletion({ messages: [{ role: 'user', content: 'hi' }] }),
        /刷新当前网页/
    );
});

test('playYoudaoTTS avoids direct page <audio> CSP block in both Chrome Extension and Userscript modes', async () => {
    for (const [label, src] of [['content.js', contentSrc], ['userscript', userscriptSrc]]) {
        const isExtFn = section(src, 'function isChromeExtensionRuntime()', '// ================= 配置区');
        const ttsModule = section(src, '// ================= 语音播放模块 =================', '// ================= Notion 增量同步算法 (SWR) =================');

        // 1) Active Chrome Extension: must proxy through LOCAL_TTS_PLAY and fall back to speechSynthesis (never new Audio)
        const sentMessages = [];
        const audioConstructions = [];
        const spokenTexts = [];
        let extRuntimeSendOk = true;

        function MockAudio(url) {
            audioConstructions.push(url);
            this.play = () => Promise.resolve();
            this.pause = () => {};
        }
        function MockUtterance(text) {
            this.text = text;
        }

        const extCtx = vm.createContext({
            CONFIG: { ttsEngine: 'youdao', kokoroVoice: 'af_heart', localTtsUrl: 'http://127.0.0.1:18080' },
            GM_getValue: (_k, d) => d,
            currentAudio: null,
            vocabMap: new Map(),
            navigator: { userAgent: 'Chrome/140.0.0.0' },
            Audio: MockAudio,
            SpeechSynthesisUtterance: MockUtterance,
            chrome: {
                runtime: {
                    id: 'ext-123',
                    lastError: null,
                    sendMessage(msg, cb) {
                        sentMessages.push(msg);
                        if (cb) cb(extRuntimeSendOk ? { success: true } : { success: false });
                    }
                }
            },
            window: {
                speechSynthesis: {
                    cancel() {},
                    getVoices() { return [{ name: 'Google US English', lang: 'en-US' }]; },
                    speak(u) { spokenTexts.push(u.text); }
                }
            }
        });
        extCtx.window.navigator = extCtx.navigator;
        vm.runInContext(`${isExtFn}\n${ttsModule}`, extCtx);

        extCtx.playAudio('naval');
        assert.equal(audioConstructions.length, 0, `${label}: extension mode must never instantiate page <audio> for youdao`);
        assert.ok(sentMessages.some(m => m.type === 'LOCAL_TTS_PLAY' && m.url === 'https://dict.youdao.com/dictvoice?audio=naval&type=2'));

        extRuntimeSendOk = false;
        extCtx.playAudio('naval');
        assert.equal(audioConstructions.length, 0, `${label}: failed extension audio proxy must fall back to speechSynthesis, not <audio>`);
        assert.deepEqual(spokenTexts, ['naval']);

        // 2) Userscript mode with AudioContext: must use GM_xmlhttpRequest arraybuffer + Web Audio, never <audio>
        const gmCalls = [];
        const tmAudioConstructions = [];
        const tmSpoken = [];
        let startedBuffer = false;

        const tmCtx = vm.createContext({
            CONFIG: { ttsEngine: 'youdao', kokoroVoice: 'af_heart', localTtsUrl: 'http://127.0.0.1:18080' },
            GM_getValue: (_k, d) => d,
            currentAudio: null,
            vocabMap: new Map(),
            navigator: { userAgent: 'Chrome/140.0.0.0' },
            Audio: function(u) { tmAudioConstructions.push(u); return new MockAudio(u); },
            SpeechSynthesisUtterance: MockUtterance,
            GM_xmlhttpRequest: (details) => {
                gmCalls.push(details);
                details.onload({ status: 200, response: new ArrayBuffer(16) });
            },
            window: {
                AudioContext: function() {
                    this.state = 'running';
                    this.destination = {};
                    this.decodeAudioData = (_buf, onSuccess) => {
                        onSuccess({ duration: 0.5 });
                    };
                    this.createBufferSource = () => ({
                        buffer: null,
                        connect() {},
                        start() { startedBuffer = true; }
                    });
                },
                speechSynthesis: {
                    cancel() {},
                    getVoices() { return []; },
                    speak(u) { tmSpoken.push(u.text); }
                }
            }
        });
        tmCtx.window.navigator = tmCtx.navigator;
        vm.runInContext(`${isExtFn}\n${ttsModule}`, tmCtx);

        tmCtx.playAudio('naval');
        assert.equal(tmAudioConstructions.length, 0, `${label}: userscript mode with Web Audio must not instantiate page <audio>`);
        assert.equal(gmCalls.length, 1);
        assert.equal(gmCalls[0].responseType, 'arraybuffer');
        assert.equal(gmCalls[0].url, 'https://dict.youdao.com/dictvoice?audio=naval&type=2');
        assert.equal(startedBuffer, true);
        assert.equal(tmSpoken.length, 0);
    }
});
