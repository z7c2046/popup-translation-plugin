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

console.log('Popup Translation Chrome Extension & Userscript auto-translate and 3-style tests passed successfully!');
