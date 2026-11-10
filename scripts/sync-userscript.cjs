const fs = require('fs');
const path = require('path');

const contentJsPath = path.resolve(__dirname, '../popup-translation-extension/content.js');
const userScriptPath = path.resolve(__dirname, '../划词翻译+生词高亮.txt');
const manifestPath = path.resolve(__dirname, '../popup-translation-extension/manifest.json');

const contentJs = fs.readFileSync(contentJsPath, 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '4.12.0';

const marker = '迁移旧版服务商配置（若之前选了已被移除的智谱，自动重置为硅基流动）';
const markerIndex = contentJs.indexOf(marker);

if (markerIndex === -1) {
  console.error('Marker not found in content.js!');
  process.exit(1);
}

// contentJs ends with:
//     init();
//
//
//     }
// })();
// For userscript, we extract up to init(); and close with })();
let cFromMarker = contentJs.slice(markerIndex);
const tailMatch = cFromMarker.lastIndexOf('init();');
if (tailMatch !== -1) {
  cFromMarker = cFromMarker.slice(0, tailMatch + 'init();'.length);
}

const header = `// ==UserScript==
// @name         Popup Translation - AI 划词翻译与生词高亮
// @namespace    http://tampermonkey.net/
// @version      ${version}
// @description  完整未压缩源码版。包含 SWR 本地直出与 Notion 增量同步算法。移植 animal-island-ui 原生效果：小圆点点击泡泡破裂、AI 翻译打字机渐显、生词高亮 island 不规则气泡。支持硅基流动与 Kimi 网页免费版。
// @author       Gemini
// @match        *://*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      api.siliconflow.cn
// @connect      kimi.moonshot.cn
// @connect      dict.youdao.com
// @connect      api.notion.com
// @connect      127.0.0.1
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

// 阻止脚本在 iframe 内部（如 Arkose Labs 验证码、reCAPTCHA、支付框等）加载
    if (window.top !== window.self) {
        return;
    }

    // `;

const newUserScript = header + cFromMarker + '\n\n})();\n';
fs.writeFileSync(userScriptPath, newUserScript, 'utf8');

// Syntax check
try {
  new Function(newUserScript);
  console.log(`✅ Successfully synced 划词翻译+生词高亮.txt to version ${version}, syntax valid!`);
} catch (e) {
  console.error('❌ Syntax check failed on synced userscript:', e);
  process.exit(1);
}
