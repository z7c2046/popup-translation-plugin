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

test('FluentRead Port Design: content.js & userscript implement FluentRead DOM discovery, priority queue, inline protection & progress panel UI', () => {
    const contentJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/content.js'), 'utf8');
    const userscript = fs.readFileSync(path.resolve(__dirname, '../划词翻译+生词高亮.txt'), 'utf8');

    for (const [name, code] of [['content.js', contentJs], ['userscript', userscript]]) {
        // 1. 基础及 FluentRead 语义/排除标签集合
        assert.match(code, /IMMERSIVE_BLOCK_TAGS\s*=\s*new Set/, `${name} must include IMMERSIVE_BLOCK_TAGS`);
        assert.match(code, /IMMERSIVE_EXCLUDE_TAGS\s*=\s*new Set/, `${name} must include IMMERSIVE_EXCLUDE_TAGS`);
        assert.match(code, /FR_HARD_PRUNE_TAGS\s*=\s*new Set/, `${name} must include FR_HARD_PRUNE_TAGS`);
        assert.match(code, /FR_PROTECTED_INLINE_TAGS\s*=\s*new Set/, `${name} must include FR_PROTECTED_INLINE_TAGS`);

        // 2. FluentRead 核心过滤器与混合内联拆分函数
        assert.match(code, /function isTranslatableBlock\(el\)/, `${name} must include isTranslatableBlock`);
        assert.match(code, /function isValidTranslatableText\(text\)/, `${name} must include isValidTranslatableText`);
        assert.match(code, /function isFluentStructuralExcluded\(el\)/, `${name} must include structural nav/footer/header/callout filter`);
        assert.match(code, /function isFluentIconOrMathElement\(el\)/, `${name} must include icon font & MathJax/KaTeX guard`);
        assert.match(code, /function isFluentInteractiveControl\(el/, `${name} must distinguish short interactive controls from prose`);
        assert.match(code, /function getDirectInlineRuns\(el\)/, `${name} must split direct inline runs in mixed block containers`);
        assert.match(code, /function protectInlineCodeAndFormulas\(el\)/, `${name} must protect inline code/formula tokens`);

        // 3. FluentRead 三级视口优先调度与防饥饿配额
        assert.match(code, /FR_PREFETCH_MARGIN_PX\s*=\s*600/, `${name} must define 600px prefetch viewport margin`);
        assert.match(code, /FR_BACKGROUND_MAX_WAIT_MS\s*=\s*8000/, `${name} must define 8000ms anti-starvation threshold`);
        assert.match(code, /FR_FOREGROUND_DISPATCH_QUOTA\s*=\s*8/, `${name} must define 8-dispatch foreground fairness quota`);
        assert.match(code, /function scoreFullPageCandidatePriority\(/, `${name} must score visible > near > background candidates`);
        assert.match(code, /takeNextPriorityBatch/, `${name} must dynamically drain priority batches`);

        // 4. 通用网页段落收集与双语注入/UI 标记
        assert.match(code, /addSiteItem\([^,]+,\s*'general_block',\s*newlyCollected\)/, `${name} must collect general blocks`);
        assert.match(code, /immersive-translate-target-translation/, `${name} must use immersive-translate-target-translation class`);
        assert.match(code, /fluent-read-bilingual-content/, `${name} must include FluentRead bilingual content styling`);
        assert.match(code, /fluent-read-loading/, `${name} must include 180ms deferred loading indicator`);
        assert.match(code, /fluent-read-retry-wrapper/, `${name} must include per-block failure retry pill`);
        assert.match(code, /fr-translation-progress/, `${name} must include floating progress panel UI`);
        assert.match(code, /data-immersive-translate-translation-element-mark/, `${name} must mark element with data-immersive-translate-translation-element-mark`);

        // 5. 解除硬编码限制，通用网页也支持沉浸式双语翻译
        assert.match(code, /isGeneral:\s*!isReddit\s*&&\s*!isReuters/, `${name} must support general web translation`);
    }
});

test('FluentRead Priority & DOM Algorithms: runtime behavior for structural/control guards, inline code protection, and anti-starvation priority', () => {
    const vm = require('node:vm');
    const contentJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/content.js'), 'utf8');
    const startIdx = contentJs.indexOf('const FR_HARD_PRUNE_TAGS = new Set');
    const endIdx = contentJs.indexOf('function collectSiteElements(');
    assert.ok(startIdx !== -1 && endIdx > startIdx, 'Must locate FluentRead DOM helpers section');
    const algoSlice = contentJs.slice(startIdx, endIdx);

    const priorityStart = contentJs.indexOf('function scoreFullPageCandidatePriority(');
    const priorityEnd = contentJs.indexOf('function createBatches(');
    assert.ok(priorityStart !== -1 && priorityEnd > priorityStart, 'Must locate FluentRead priority scoring section');
    const prioritySlice = contentJs.slice(priorityStart, priorityEnd);

    const makeMockEl = (tag, opts = {}) => ({
        nodeType: 1,
        tagName: tag.toUpperCase(),
        className: opts.className || '',
        innerText: opts.text || '',
        textContent: opts.text || '',
        style: opts.style || {},
        parentElement: opts.parentElement || null,
        childNodes: opts.childNodes || (opts.text ? [{ nodeType: 3, nodeValue: opts.text }] : []),
        offsetParent: opts.hidden ? null : {},
        offsetWidth: opts.hidden ? 0 : 120,
        offsetHeight: opts.hidden ? 0 : 24,
        isContentEditable: Boolean(opts.editable),
        classList: { contains: (c) => (opts.className || '').split(/\s+/).includes(c) },
        getAttribute: (k) => (opts.attrs || {})[k] ?? null,
        matches: (sel) => {
            if (opts.matchesList) return opts.matchesList.some(m => sel.includes(m));
            return false;
        },
        closest: (sel) => {
            let cur = opts.selfInClosest ? null : undefined;
            if (opts.closestMap) {
                for (const key of Object.keys(opts.closestMap)) {
                    if (sel.includes(key)) return opts.closestMap[key];
                }
            }
            cur = opts.parentElement || null;
            while (cur) {
                if (cur.tagName && sel.toLowerCase().includes(cur.tagName.toLowerCase())) return cur;
                cur = cur.parentElement;
            }
            return null;
        },
        querySelector: () => opts.hasBlockChild ? { tagName: 'P' } : null,
        getBoundingClientRect: () => opts.rect || { top: 100, bottom: 140 }
    });

    const nowMs = 100000;
    const ctx = vm.createContext({
        Set, Map, Array, Object, Math, RegExp, Date: { now: () => nowMs },
        window: {
            innerHeight: 800,
            scrollY: 0,
            getComputedStyle: (el) => el._cs || { fontFamily: 'Inter, sans-serif', display: 'block', visibility: 'visible', opacity: '1' }
        },
        document: { createElement: () => ({}) },
        IMMERSIVE_BLOCK_TAGS: new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'DD', 'DT', 'FIGCAPTION']),
        IMMERSIVE_EXCLUDE_TAGS: new Set(['SCRIPT', 'STYLE', 'CODE', 'PRE', 'SVG', 'MATH', 'NOSCRIPT', 'IFRAME', 'CANVAS', 'VIDEO', 'AUDIO', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON']),
        siteItemsMap: new Map(),
        activePageRequests: new Set()
    });

    vm.runInContext(algoSlice + '\n' + prioritySlice + '\n' +
        'this.isFluentStructuralExcluded = isFluentStructuralExcluded;' +
        'this.isFluentIconOrMathElement = isFluentIconOrMathElement;' +
        'this.isFluentInteractiveControl = isFluentInteractiveControl;' +
        'this.isValidTranslatableText = isValidTranslatableText;' +
        'this.protectInlineCodeAndFormulas = protectInlineCodeAndFormulas;' +
        'this.scoreFullPageCandidatePriority = scoreFullPageCandidatePriority;',
        ctx
    );

    // 1. Structural guards: <nav> skipped, <header> skipped for plain p, but <header><h1>Heading</h1></header> kept; <aside> inside <main> with callout kept
    const navNode = makeMockEl('nav');
    const navLink = makeMockEl('p', { parentElement: navNode, text: 'Navigation link description' });
    assert.equal(ctx.isFluentStructuralExcluded(navLink), true, 'Paragraph inside <nav> must be excluded');

    const headerNode = makeMockEl('header');
    const h1InsideHeader = makeMockEl('h1', { parentElement: headerNode, text: 'Main Article Title' });
    assert.equal(ctx.isFluentStructuralExcluded(h1InsideHeader), false, 'Semantic <h1> inside <header> must be preserved');

    const mainNode = makeMockEl('main');
    const asideCallout = makeMockEl('aside', { parentElement: mainNode, className: 'callout note-box' });
    const calloutP = makeMockEl('p', { parentElement: asideCallout, text: 'Important note for users.' });
    assert.equal(ctx.isFluentStructuralExcluded(calloutP), false, 'Callout <aside> inside <main> must be preserved');

    // 2. Icon fonts & MathJax protection
    const iconSpan = makeMockEl('span', { className: 'material-icons', text: 'settings' });
    assert.equal(ctx.isFluentIconOrMathElement(iconSpan), true, 'Icon font element must be skipped');
    const mathEl = makeMockEl('span', { matchesList: ['.katex'], text: 'x^2 + y^2' });
    assert.equal(ctx.isFluentIconOrMathElement(mathEl), true, 'KaTeX formula element must be skipped');

    // 3. Inline code protection tokens ({{FR_P0}})
    const codeChild = makeMockEl('code', { text: 'git status' });
    const pWithCode = makeMockEl('p', {
        childNodes: [
            { nodeType: 3, nodeValue: 'Run ' },
            codeChild,
            { nodeType: 3, nodeValue: ' before committing changes.' }
        ]
    });
    const protectedRes = ctx.protectInlineCodeAndFormulas(pWithCode);
    assert.equal(protectedRes.text, 'Run {{FR_P0}} before committing changes.');
    assert.equal(protectedRes.tokens.length, 1);
    assert.equal(protectedRes.tokens[0].text, 'git status');

    // 4. Priority queue bands & anti-starvation promotion (>= 8000ms waits promoted from background=2 to band=1)
    const visibleItem = { id: 'vis', type: 'general_block', enqueuedAt: nowMs - 100, element: makeMockEl('p', { rect: { top: 200, bottom: 260 } }) };
    const nearItem = { id: 'near', type: 'general_block', enqueuedAt: nowMs - 100, element: makeMockEl('p', { rect: { top: 1000, bottom: 1060 } }) };
    const bgFreshItem = { id: 'bgFresh', type: 'general_block', enqueuedAt: nowMs - 500, element: makeMockEl('p', { rect: { top: 2500, bottom: 2560 } }) };
    const bgStarvedItem = { id: 'bgStarved', type: 'general_block', enqueuedAt: nowMs - 8500, element: makeMockEl('p', { rect: { top: 2600, bottom: 2660 } }) };

    assert.equal(ctx.scoreFullPageCandidatePriority(visibleItem, nowMs).band, 0, 'Viewport item must score band 0');
    assert.equal(ctx.scoreFullPageCandidatePriority(nearItem, nowMs).band, 1, 'Item within 600px margin must score band 1');
    assert.equal(ctx.scoreFullPageCandidatePriority(bgFreshItem, nowMs).band, 2, 'Offscreen fresh item must score band 2');
    assert.equal(ctx.scoreFullPageCandidatePriority(bgStarvedItem, nowMs).band, 1, 'Offscreen item waiting >= 8000ms must promote to band 1');
});

test('Immersive Translate Design: popup.js connects general web pages to on-demand immersive dual translation', () => {
    const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/popup.js'), 'utf8');

    assert.match(popupJs, /通用网页 \(轻量查词模式\)/, 'popup.js must set general web pages to lightweight lookup mode by default');
    assert.match(popupJs, /btnEnableImmersion/, 'popup.js must support on-demand enable immersion button');
    assert.match(popupJs, /lexipro_auto_translate_sites/, 'popup.js must support site-specific auto translation whitelist');
});

