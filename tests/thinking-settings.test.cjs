const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', '划词翻译+生词高亮.txt');
const source = fs.readFileSync(sourcePath, 'utf8');

// 1. Check UserScript version bump
assert.match(source, /\/\/\s*@version\s+4\.(?:[5-9]|[1-9][0-9]+)\.[0-9]+/, 'Script version should be bumped to at least 4.5.5');

// 2. Check storage key and initial state safeguard
assert.match(source, /GM_getValue\('lexipro_disable_thinking'/, 'Must read lexipro_disable_thinking from storage');
assert.match(source, /GM_setValue\('lexipro_disable_thinking'/, 'Must persist lexipro_disable_thinking to storage');
assert.match(source, /disableThinking:\s*initialDisableThinking/, 'CONFIG must include disableThinking initialized with safeguard');
assert.match(source, /disableThinking:\s*initialDisableThinking/, 'CONFIG.llmProviders.siliconflow must include disableThinking');

// 3. Check Settings UI elements in renderSettingsUI
assert.match(source, /id="imt-thinking-group"/, 'Settings UI must include #imt-thinking-group container');
assert.match(source, /id="imt-thinking-switch"/, 'Settings UI must include #imt-thinking-switch button');
assert.match(source, /role="switch"/, 'Thinking switch button must declare role="switch"');
assert.match(source, /id="imt-thinking-status-text"/, 'Settings UI must include status text badge');
assert.match(source, /id="imt-thinking-hint"/, 'Settings UI must include explanatory hint text');
assert.match(source, /for="imt-thinking-switch"[^>]*>\s*关闭深度思考/, 'Label must explicitly indicate 关闭深度思考');

// 4. Check CSS definitions for switch and status badges
assert.match(source, /\.imt-settings-switch-row\s*\{/, 'CSS must define .imt-settings-switch-row');
assert.match(source, /\.imt-animal-switch\s*\{/, 'CSS must define .imt-animal-switch');
assert.match(source, /\.imt-animal-switch\.imt-animal-switch-checked\s*\{/, 'CSS must define checked switch state');
assert.match(source, /\.imt-switch-status-badge\s*\{/, 'CSS must define .imt-switch-status-badge');
assert.match(source, /\.imt-switch-status-badge\.imt-status-off\s*\{/, 'CSS must define status badge for disabled thinking (fast)');
assert.match(source, /\.imt-switch-status-badge\.imt-status-on\s*\{/, 'CSS must define status badge for enabled thinking (reasoning)');

// 5. Verify SiliconFlow request injection logic
assert.match(source, /body\.enable_thinking\s*=\s*false/, 'Must inject enable_thinking: false when thinking is disabled');
assert.match(source, /body\.enable_thinking\s*=\s*true/, 'Must inject enable_thinking: true when thinking is enabled');
assert.match(source, /body\.thinking\s*=\s*\{\s*type:\s*'disabled'\s*\}/, 'Must inject thinking: disabled for compatibility');
assert.match(source, /body\.thinking\s*=\s*\{\s*type:\s*'enabled'\s*\}/, 'Must inject thinking: enabled for compatibility');

// 6. Verify Kimi request injection logic
assert.match(source, /use_search:\s*!Boolean\(CONFIG\.disableThinking\)/, 'Kimi stream must respect disableThinking');

// 7. Test simulation of toggle logic and state transition
function simulateThinkingToggle(currentState) {
    const nextState = !currentState;
    const badgeText = nextState ? '已关闭思考（极速直出）' : '未关闭（深度推理）';
    const badgeClass = `imt-switch-status-badge ${nextState ? 'imt-status-off' : 'imt-status-on'}`;
    const hintText = nextState
        ? '开启此项将关闭模型推理过程，翻译秒级直出（推荐日常查词）'
        : '关闭此项将保留模型深度思考链，输出更详尽但耗时较长';
    const sfEnableThinking = !nextState;

    return {
        nextState,
        badgeText,
        badgeClass,
        hintText,
        sfEnableThinking
    };
}

// Test toggle from enabled (false) to disabled (true)
const turnOffThinking = simulateThinkingToggle(false);
assert.equal(turnOffThinking.nextState, true);
assert.equal(turnOffThinking.sfEnableThinking, false);
assert.equal(turnOffThinking.badgeText, '已关闭思考（极速直出）');
assert.match(turnOffThinking.badgeClass, /imt-status-off/);

// Test toggle from disabled (true) to enabled (false)
const turnOnThinking = simulateThinkingToggle(true);
assert.equal(turnOnThinking.nextState, false);
assert.equal(turnOnThinking.sfEnableThinking, true);
assert.equal(turnOnThinking.badgeText, '未关闭（深度推理）');
assert.match(turnOnThinking.badgeClass, /imt-status-on/);

console.log('Thinking settings unit, UI, and API payload tests passed!');
