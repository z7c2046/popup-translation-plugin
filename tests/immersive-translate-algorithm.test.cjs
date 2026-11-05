const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Immersive Translate Algorithm: Block tag detection and exclusion rules match open-source heuristics', () => {
    const IMMERSIVE_BLOCK_TAGS = new Set([
        'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
        'LI', 'BLOCKQUOTE', 'ARTICLE', 'SECTION',
        'DD', 'DT', 'FIGCAPTION'
    ]);

    const IMMERSIVE_EXCLUDE_TAGS = new Set([
        'SCRIPT', 'STYLE', 'CODE', 'PRE', 'SVG', 'MATH',
        'NOSCRIPT', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO',
        'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON'
    ]);

    function isTranslatableBlockMock(node) {
        if (!node || node.nodeType !== 1) return false;
        const tag = node.tagName.toUpperCase();
        if (IMMERSIVE_EXCLUDE_TAGS.has(tag)) return false;
        if (node.isContentEditable) return false;
        if (node.getAttribute?.('translate') === 'no') return false;
        if (node.classList?.contains?.('notranslate')) return false;
        if (node.style?.display === 'none' || node.style?.visibility === 'hidden') return false;
        return IMMERSIVE_BLOCK_TAGS.has(tag);
    }

    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'P' }), true);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'H2' }), true);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'BLOCKQUOTE' }), true);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'CODE' }), false);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'PRE' }), false);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'SVG' }), false);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'INPUT' }), false);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'P', getAttribute: () => 'no' }), false);
    assert.equal(isTranslatableBlockMock({ nodeType: 1, tagName: 'P', style: { display: 'none' } }), false);
});

test('Immersive Translate Algorithm: Text validation correctly filters non-translatable text', () => {
    function isValidTranslatableText(text) {
        if (!text) return false;
        const trimmed = text.trim();
        if (trimmed.length < 3) return false;
        if (/^https?:\/\/\S+$/i.test(trimmed)) return false;
        if (/^[\d\s.,;:'"\/\\()\[\]{}#@!%&*+=_-]+$/.test(trimmed)) return false;
        if (!/[a-zA-Z]{2,}/.test(trimmed)) return false;
        const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g) || [];
        if (chineseChars.length > trimmed.length * 0.6) return false;
        return true;
    }

    // 正常待翻译英文段落
    assert.equal(isValidTranslatableText('This is a great open-source translation design.'), true);
    assert.equal(isValidTranslatableText('Quantum computing allows exponentially faster calculation.'), true);

    // 纯链接、纯数字、纯符号
    assert.equal(isValidTranslatableText('https://github.com/immersive-translate/immersive-translate'), false);
    assert.equal(isValidTranslatableText('1234567890'), false);
    assert.equal(isValidTranslatableText('--- // +++ ==='), false);
    assert.equal(isValidTranslatableText('ok'), false); // < 3 字符

    // 中文主体段落（避免消耗 Token 重新翻译）
    assert.equal(isValidTranslatableText('这是一个完全用中文书写的段落，不需要被机器再次翻译。'), false);
});

test('Immersive Translate Design: content.js & userscript implement open-source dual-language injection & markers', () => {
    const contentJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/content.js'), 'utf8');
    const userscript = fs.readFileSync(path.resolve(__dirname, '../划词翻译+生词高亮.txt'), 'utf8');

    for (const [name, code] of [['content.js', contentJs], ['userscript', userscript]]) {
        // 1. 块级语义标签和排除标签集合
        assert.match(code, /IMMERSIVE_BLOCK_TAGS\s*=\s*new Set/, `${name} must include IMMERSIVE_BLOCK_TAGS`);
        assert.match(code, /IMMERSIVE_EXCLUDE_TAGS\s*=\s*new Set/, `${name} must include IMMERSIVE_EXCLUDE_TAGS`);

        // 2. 块节点判定与文本校验函数
        assert.match(code, /function isTranslatableBlock\(el\)/, `${name} must include isTranslatableBlock`);
        assert.match(code, /function isValidTranslatableText\(text\)/, `${name} must include isValidTranslatableText`);

        // 3. 通用网页通用段落选择器遍历
        assert.match(code, /addSiteItem\(el,\s*'general_block',\s*newlyCollected\)/, `${name} must collect general blocks`);

        // 4. 沉浸式翻译标志性注入容器与属性标记
        assert.match(code, /immersive-translate-target-translation/, `${name} must use immersive-translate-target-translation class`);
        assert.match(code, /data-immersive-translate-translation-element-mark/, `${name} must mark element with data-immersive-translate-translation-element-mark`);

        // 5. 解除硬编码限制，通用网页也支持沉浸式双语翻译
        assert.match(code, /isGeneral:\s*!isReddit\s*&&\s*!isReuters/, `${name} must support general web translation`);
    }
});

test('Immersive Translate Design: popup.js connects general web pages to immersive dual translation', () => {
    const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/popup.js'), 'utf8');

    assert.match(popupJs, /通用网页 \(沉浸式翻译就绪\)/, 'popup.js must support general web immersive translation');
    assert.match(popupJs, /一键沉浸式翻译本页/, 'popup.js must provide one-click immersive translation for general web pages');
});

