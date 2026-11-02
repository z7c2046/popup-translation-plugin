/**
 * Word Pronunciation On-Demand vs Auto-Pronounce Settings Test Suite
 * 验证查词默认改为点击发音、自动发音作为可配置项在两端（Chrome扩展与油猴脚本）严格生效
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Auto Pronounce Settings: options.html & options.js default to false (click to play)', () => {
    const optionsHtml = fs.readFileSync(path.join(__dirname, '../popup-translation-extension/options.html'), 'utf8');
    const optionsJs = fs.readFileSync(path.join(__dirname, '../popup-translation-extension/options.js'), 'utf8');

    // 1. 验证 options.html 存在 auto-pronounce-check 元素
    assert.match(optionsHtml, /id="auto-pronounce-check"/, 'options.html 必须包含 auto-pronounce-check 开关');
    assert.match(optionsHtml, /查词时自动朗读发音/, 'options.html 必须包含自动朗读发音标题');

    // 2. 验证 DEFAULT_CONFIG 中 lexipro_auto_pronounce 默认为 false
    assert.match(optionsJs, /lexipro_auto_pronounce:\s*false/, 'DEFAULT_CONFIG 中 lexipro_auto_pronounce 必须默认为 false');
    assert.match(optionsJs, /lexipro_auto_pronounce:\s*autoPronounceCheck\s*\?\s*autoPronounceCheck\.checked\s*:\s*false/, 'options.js 保存必须保存 auto-pronounce');
    assert.match(optionsJs, /autoPronounceCheck\.checked\s*=\s*Boolean\(cfg\.lexipro_auto_pronounce\)/, 'options.js 回填必须回填 auto-pronounce 状态');
});

test('Auto Pronounce Logic: content.js & userscript guard auto-play with CONFIG.autoPronounce', () => {
    const contentJs = fs.readFileSync(path.join(__dirname, '../popup-translation-extension/content.js'), 'utf8');
    const userscript = fs.readFileSync(path.join(__dirname, '../划词翻译+生词高亮.txt'), 'utf8');

    [contentJs, userscript].forEach((code, idx) => {
        const fileLabel = idx === 0 ? 'content.js' : '划词翻译+生词高亮.txt';

        // 1. 验证初始化与默认值
        assert.match(
            code,
            /let initialAutoPronounce = GM_getValue\('lexipro_auto_pronounce',\s*false\);/,
            `${fileLabel} 初始化必须默认读取 false`
        );
        assert.match(
            code,
            /autoPronounce:\s*initialAutoPronounce/,
            `${fileLabel} CONFIG 必须包含 autoPronounce`
        );

        // 2. 验证所有查词自动播放点全部受到 CONFIG.autoPronounce 门控
        assert.doesNotMatch(
            code,
            /(?<!CONFIG\.autoPronounce\s*&&\s*)data\.mode === "en_word"\)\s*playAudio\(data\.word \|\| text\);/,
            `${fileLabel} 缓存命中时绝不能在未判断 autoPronounce 的情况下自动播放发音`
        );
        assert.doesNotMatch(
            code,
            /(?<!CONFIG\.autoPronounce\s*&&\s*)resultData\.mode === "en_word"\)\s*playAudio\(resultData\.word \|\| text\);/,
            `${fileLabel} API 翻译成功后绝不能在未判断 autoPronounce 的情况下自动播放发音`
        );

        // 3. 验证弹窗设置 UI 包含发音开关
        assert.match(code, /id="imt-pronounce-switch"/, `${fileLabel} 弹窗设置必须包含 imt-pronounce-switch`);
        assert.match(code, /function togglePronounceSetting\(\)/, `${fileLabel} 必须包含 togglePronounceSetting 函数`);
        assert.match(code, /GM_setValue\('lexipro_auto_pronounce',\s*nextValue\)/, `${fileLabel} 切换时必须保存 lexipro_auto_pronounce`);

        // 4. 验证 storage 热更新分支
        assert.match(code, /key === 'lexipro_auto_pronounce'/, `${fileLabel} 必须监听 lexipro_auto_pronounce 热更新`);
    });
});

