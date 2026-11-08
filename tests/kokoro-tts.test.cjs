const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../popup-translation-extension/manifest.json');
const offscreenHtmlPath = path.resolve(__dirname, '../popup-translation-extension/offscreen.html');
const offscreenJsPath = path.resolve(__dirname, '../popup-translation-extension/offscreen.js');
const kokoroBundlePath = path.resolve(__dirname, '../popup-translation-extension/lib/kokoro.web.js');
const backgroundJsPath = path.resolve(__dirname, '../popup-translation-extension/background.js');
const optionsHtmlPath = path.resolve(__dirname, '../popup-translation-extension/options.html');
const optionsJsPath = path.resolve(__dirname, '../popup-translation-extension/options.js');
const contentJsPath = path.resolve(__dirname, '../popup-translation-extension/content.js');
const userscriptPath = path.resolve(__dirname, '../划词翻译+生词高亮.txt');

test('Kokoro TTS: Manifest V3 permissions and CSP configuration', () => {
    assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(manifest.version, '4.12.0', 'manifest version must be 4.12.0');
    assert.ok(Array.isArray(manifest.permissions), 'permissions must be an array');
    assert.ok(manifest.permissions.includes('offscreen'), 'permissions must contain "offscreen"');

    assert.ok(manifest.content_security_policy, 'content_security_policy must exist');
    const extPagesCsp = manifest.content_security_policy.extension_pages || '';
    assert.match(extPagesCsp, /wasm-unsafe-eval/, 'extension_pages CSP must allow wasm-unsafe-eval for ONNX inference');

    assert.ok(Array.isArray(manifest.web_accessible_resources), 'web_accessible_resources must exist');
    const hasLibResources = manifest.web_accessible_resources.some(r => r.resources && r.resources.includes('lib/*'));
    assert.ok(hasLibResources, 'web_accessible_resources must expose lib/* for WASM and worker binaries');
});

test('Kokoro TTS: Offscreen Document files & Neural Engine implementation', () => {
    assert.ok(fs.existsSync(offscreenHtmlPath), 'offscreen.html must exist');
    const htmlContent = fs.readFileSync(offscreenHtmlPath, 'utf8');
    assert.match(htmlContent, /<script\s+type=["']module["']\s+src=["']offscreen\.js["']>/, 'offscreen.html must load offscreen.js as ESM module');

    assert.ok(fs.existsSync(offscreenJsPath), 'offscreen.js must exist');
    const jsContent = fs.readFileSync(offscreenJsPath, 'utf8');
    assert.match(jsContent, /import\s+\{[^}]*KokoroTTS[^}]*\}\s+from\s+['"]\.\/lib\/kokoro\.web\.js['"]/, 'offscreen.js must import KokoroTTS from standalone web bundle');
    assert.match(jsContent, /env\.wasmPaths/, 'offscreen.js must configure local wasmPaths to eliminate jsdelivr downloads');
    assert.match(jsContent, /onnx-community\/Kokoro-82M-v1\.0-ONNX/, 'offscreen.js must specify Kokoro-82M model repo');
    assert.match(jsContent, /dtype:\s*['"]q8['"]/, 'offscreen.js must use q8 quantized model for lightweight ~80MB footprint');

    assert.match(jsContent, /KOKORO_PLAY/, 'offscreen.js must handle KOKORO_PLAY message');
    assert.match(jsContent, /KOKORO_STOP/, 'offscreen.js must handle KOKORO_STOP message');
    assert.match(jsContent, /KOKORO_GET_STATUS/, 'offscreen.js must handle KOKORO_GET_STATUS message');
    assert.match(jsContent, /KOKORO_PRELOAD/, 'offscreen.js must handle KOKORO_PRELOAD message');
    assert.match(jsContent, /KOKORO_STATUS_UPDATE/, 'offscreen.js must broadcast status updates');

    assert.ok(fs.existsSync(kokoroBundlePath), 'lib/kokoro.web.js bundle must exist');
    const stats = fs.statSync(kokoroBundlePath);
    assert.ok(stats.size > 1000000, 'kokoro.web.js must be a valid non-empty standalone bundle (>1MB)');

    // Verify local WASM and JSEP modules exist so no jsdelivr network requests are attempted
    const jsepMjsPath = path.resolve(__dirname, '../popup-translation-extension/lib/ort-wasm-simd-threaded.jsep.mjs');
    const jsepWasmPath = path.resolve(__dirname, '../popup-translation-extension/lib/ort-wasm-simd-threaded.jsep.wasm');
    assert.ok(fs.existsSync(jsepMjsPath), 'ort-wasm-simd-threaded.jsep.mjs must exist in lib/');
    assert.ok(fs.existsSync(jsepWasmPath), 'ort-wasm-simd-threaded.jsep.wasm must exist in lib/');
});

test('Kokoro TTS: Background service worker offscreen lifecycle & proxy routing', () => {
    assert.ok(fs.existsSync(backgroundJsPath), 'background.js must exist');
    const bgContent = fs.readFileSync(backgroundJsPath, 'utf8');

    assert.match(bgContent, /ensureOffscreenDocument/, 'background.js must define ensureOffscreenDocument');
    assert.match(bgContent, /chrome\.offscreen\.createDocument/, 'background.js must create offscreen document when missing');
    assert.match(bgContent, /AUDIO_PLAYBACK/, 'offscreen creation must specify AUDIO_PLAYBACK reason');
    assert.match(bgContent, /WORKERS/, 'offscreen creation must specify WORKERS reason');
    assert.match(bgContent, /KOKORO_TTS_/, 'background.js must intercept KOKORO_TTS_* messages and forward to offscreen');
    assert.match(bgContent, /resetOffscreenIdleTimer/, 'background.js must implement idle timer to reclaim memory');
    assert.match(bgContent, /chrome\.offscreen\.closeDocument/, 'background.js must close offscreen document when idle to free memory');
});

test('Kokoro TTS: Options page engine selector, voice configuration, and persistence', () => {
    assert.ok(fs.existsSync(optionsHtmlPath), 'options.html must exist');
    const optHtml = fs.readFileSync(optionsHtmlPath, 'utf8');

    assert.match(optHtml, /id=["']tts-engine-select["']/, 'options.html must contain tts-engine-select');
    assert.match(optHtml, /value=["']local_service["']/, 'options.html must support local_service engine');
    assert.match(optHtml, /value=["']youdao["']/, 'options.html must support youdao engine');
    assert.match(optHtml, /value=["']kokoro["']/, 'options.html must support kokoro engine');
    assert.match(optHtml, /value=["']edge["']/, 'options.html must support edge engine');
    assert.match(optHtml, /id=["']local-service-group["']/, 'options.html must have local service options group');
    assert.match(optHtml, /id=["']btn-check-local-service["']/, 'options.html must have check local service button');
    assert.match(optHtml, /id=["']btn-test-local-service["']/, 'options.html must have test local service button');
    assert.match(optHtml, /id=["']kokoro-options-group["']/, 'options.html must have kokoro options group');
    assert.match(optHtml, /id=["']kokoro-voice-select["']/, 'options.html must have kokoro voice select');
    assert.match(optHtml, /id=["']btn-preload-kokoro["']/, 'options.html must have preload button');
    assert.match(optHtml, /id=["']btn-test-kokoro["']/, 'options.html must have test play button');
    assert.match(optHtml, /id=["']kokoro-status-badge["']/, 'options.html must have status badge');

    assert.ok(fs.existsSync(optionsJsPath), 'options.js must exist');
    const optJs = fs.readFileSync(optionsJsPath, 'utf8');
    assert.match(optJs, /lexipro_tts_engine:\s*['"]youdao['"]/, 'DEFAULT_CONFIG must define lexipro_tts_engine default');
    assert.match(optJs, /lexipro_kokoro_voice:\s*['"]af_heart['"]/, 'DEFAULT_CONFIG must define lexipro_kokoro_voice default');
    assert.match(optJs, /lexipro_local_tts_url:\s*['"]http:\/\/127\.0\.0\.1:18080['"]/, 'DEFAULT_CONFIG must define lexipro_local_tts_url default');
    assert.match(optJs, /checkLocalServiceStatus/, 'options.js must implement checkLocalServiceStatus');
    assert.match(optJs, /KOKORO_TTS_GET_STATUS/, 'options.js must query Kokoro status');
    assert.match(optJs, /KOKORO_TTS_PRELOAD/, 'options.js must send preload message');
    assert.match(optJs, /KOKORO_TTS_PLAY/, 'options.js must send test play message');
});

test('Kokoro TTS: Content script and userscript audio routing and graceful fallback', () => {
    const targets = [
        { name: 'content.js', code: fs.readFileSync(contentJsPath, 'utf8') },
        { name: '划词翻译+生词高亮.txt', code: fs.readFileSync(userscriptPath, 'utf8') }
    ];

    for (const { name, code } of targets) {
        assert.match(code, /lexipro_tts_engine/, `${name} must read lexipro_tts_engine config`);
        assert.match(code, /lexipro_kokoro_voice/, `${name} must read lexipro_kokoro_voice config`);
        assert.match(code, /lexipro_local_tts_url/, `${name} must read lexipro_local_tts_url config`);
        assert.match(code, /ttsEngine:\s*initialTtsEngine/, `${name} CONFIG must expose ttsEngine`);
        assert.match(code, /kokoroVoice:\s*initialKokoroVoice/, `${name} CONFIG must expose kokoroVoice`);
        assert.match(code, /localTtsUrl:\s*initialLocalTtsUrl/, `${name} CONFIG must expose localTtsUrl`);

        assert.match(code, /function playLocalServiceTTS/, `${name} must implement playLocalServiceTTS`);
        assert.match(code, /function playKokoroTTS/, `${name} must implement playKokoroTTS`);
        assert.match(code, /function playYoudaoTTS/, `${name} must implement playYoudaoTTS`);
        assert.match(code, /function stopCurrentAudio/, `${name} must implement stopCurrentAudio`);

        // playAudio routing logic
        assert.match(code, /engine === 'local_service'/, `${name} playAudio must check local_service engine`);
        assert.match(code, /engine === 'kokoro'/, `${name} playAudio must check kokoro engine`);
        assert.match(code, /engine === 'edge'/, `${name} playAudio must check edge engine`);
        assert.match(code, /playYoudaoTTS\(text\)/, `${name} playAudio must fallback to youdao`);

        // storage live listener
        assert.match(code, /key === 'lexipro_tts_engine'/, `${name} must support hot update for tts engine`);
        assert.match(code, /key === 'lexipro_kokoro_voice'/, `${name} must support hot update for kokoro voice`);
        assert.match(code, /key === 'lexipro_local_tts_url'/, `${name} must support hot update for local tts url`);

        // example sentence pronunciation button and hanging indent alignment
        assert.match(code, /imt-example-item/, `${name} must structure examples with imt-example-item for alignment`);
        assert.match(code, /imt-example-num/, `${name} must isolate numbers with imt-example-num`);
        assert.match(code, /imt-example-body/, `${name} must wrap text with imt-example-body so wrapped lines align`);
        assert.match(code, /imt-speaker\s+imt-ex-speaker/, `${name} must provide example pronunciation speaker`);
    }
});

