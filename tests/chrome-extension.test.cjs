const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const extDir = path.resolve(__dirname, '..', 'popup-translation-extension');
const manifestPath = path.join(extDir, 'manifest.json');

assert.ok(fs.existsSync(manifestPath), 'manifest.json should exist');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

assert.equal(manifest.manifest_version, 3, 'Must be Manifest V3');
assert.ok(manifest.name.includes('Popup Translation'), 'Must have Popup Translation in name');
assert.ok(manifest.version, 'Must have version');
assert.ok(manifest.content_scripts?.[0]?.matches?.includes('<all_urls>'), 'Must match all URLs for selection & highlight');
assert.ok(manifest.background?.service_worker, 'Must declare background service worker');
assert.ok(fs.existsSync(path.join(extDir, 'content.js')), 'content.js must exist');
assert.ok(fs.existsSync(path.join(extDir, 'background.js')), 'background.js must exist');
assert.ok(fs.existsSync(path.join(extDir, 'popup.html')), 'popup.html must exist');
assert.ok(fs.existsSync(path.join(extDir, 'popup.js')), 'popup.js must exist');
assert.ok(fs.existsSync(path.join(extDir, 'options.html')), 'options.html must exist');
assert.ok(fs.existsSync(path.join(extDir, 'options.js')), 'options.js must exist');

// 验证 content.js 包含 Reddit 与 Reuters 站点专属翻译与 3 种翻译样式
const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
assert.ok(contentJs.includes('initSiteSpecificTranslator'), 'content.js must include site specific translator');
assert.ok(contentJs.includes('reddit.com'), 'content.js must include reddit adapter');
assert.ok(contentJs.includes('reuters.com'), 'content.js must include reuters adapter');
assert.ok(contentJs.includes("siteTranslationStyle === 'replace'"), 'content.js must support direct replace style');
assert.ok(contentJs.includes("siteTranslationStyle === 'underline'"), 'content.js must support underline dual style');
assert.ok(contentJs.includes('lexipro-trans-card'), 'content.js must support card box style');
assert.ok(contentJs.includes('siteAutoTranslate'), 'content.js must support auto translate feature');

// 验证油猴脚本也包含了站点翻译与 3 种翻译样式
const userscript = fs.readFileSync(path.resolve(__dirname, '..', '划词翻译+生词高亮.txt'), 'utf8');
assert.ok(userscript.includes('initSiteSpecificTranslator'), 'Userscript must include site specific translator');
assert.ok(userscript.includes('reddit.com'), 'Userscript must include reddit adapter');
assert.ok(userscript.includes('reuters.com'), 'Userscript must include reuters adapter');
assert.ok(userscript.includes("siteTranslationStyle === 'replace'"), 'Userscript must support direct replace style');
assert.ok(userscript.includes("siteTranslationStyle === 'underline'"), 'Userscript must support underline dual style');
assert.ok(userscript.includes('lexipro-trans-card'), 'Userscript must support card box style');
assert.ok(userscript.includes('siteAutoTranslate'), 'Userscript must support auto translate feature');

// 验证 options.html 中包含自动翻译开关控件
const optionsHtml = fs.readFileSync(path.join(extDir, 'options.html'), 'utf8');
assert.ok(optionsHtml.includes('id="site-auto-translate-check"'), 'options.html must have auto translate checkbox');

// 验证前 10 条优先出屏、多模型轮询竞速、沉浸式原文切换按钮与悬浮胶囊增高
for (const [name, code] of [['content.js', contentJs], ['userscript', userscript]]) {
    assert.ok(code.includes('min-height: 44px'), `${name} must increase fab height to min 44px`);
    assert.ok(code.includes('lexipro-orig-toggle-btn'), `${name} must include toggle original text button`);
    assert.ok(code.includes('sortPendingItemsByVisualOrder'), `${name} must sort items from top to bottom`);
    assert.ok(code.includes('sortedItems.slice(0, 10)'), `${name} must slice top 10 items for priority batch`);
    assert.ok(code.includes('getModelForBatch'), `${name} must support multi-model pool round-robin`);
    assert.ok(code.includes('initialNotionToken'), `${name} must dynamically read and sanitize notion token`);
    assert.ok(!code.includes("notionToken: 'REDACTED_LEGACY_NOTION_TOKEN'"), `${name} must not hardcode invalid legacy notion token`);
    assert.ok(code.includes('hasChinese'), `${name} must detect Chinese input for directional translation`);
    assert.ok(code.includes('do NOT answer the question'), `${name} must prevent model from answering questions instead of translating`);
    assert.ok(code.includes('setNativeInputValue'), `${name} must include React/controlled input native value setter`);
    assert.ok(!code.includes('/^https?://S+'), `${name} must not contain broken URL regex causing ReferenceError S`);
    assert.ok(code.includes('/^https?:\\/\\/\\S+$/i'), `${name} must contain valid URL regex`);
    assert.ok(code.includes("element.closest('[data-lexipro-site-id]')"), `${name} must prevent parent-child duplicate capture to protect post body`);
    assert.ok(code.includes('market_desk'), `${name} must support market_desk theme`);
    assert.ok(code.includes('animal_island'), `${name} must support animal_island theme`);
}

// 验证 options.js 默认不再下发已失效的测试 Notion Token
const optionsJs = fs.readFileSync(path.join(extDir, 'options.js'), 'utf8');
assert.ok(optionsJs.includes("lexipro_notion_token: ''"), 'options.js must default notion token to empty string');
assert.ok(optionsJs.includes('lexipro_ui_theme'), 'options.js must manage ui theme option');

// 验证 options.html 包含主题选择控件
assert.ok(optionsHtml.includes('id="ui-theme-select"'), 'options.html must have ui theme select');

console.log('Popup Translation Chrome Extension & Userscript progressive streaming, multi-model racing, and toggle original tests passed successfully!');
