const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Excluded Sites: Domain parser and sanitizer cleans URLs, ports, and duplicates correctly', () => {
    // 模拟 options.js 中的 parseExcludedSites 逻辑
    function parseExcludedSites(rawText) {
        if (!rawText) return [];
        const lines = String(rawText).split(/[\n,;]+/);
        const result = [];
        for (const line of lines) {
            let clean = line.trim().toLowerCase();
            clean = clean.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].split(':')[0].trim();
            if (clean && !result.includes(clean)) {
                result.push(clean);
            }
        }
        return result;
    }

    const rawInput = `
        https://www.reuters.com/world/
        http://reddit.com:8080/r/all
        reuters.com
        *.github.com
        https://REDDIT.COM
        invalid:domain.com/path
    `;

    const parsed = parseExcludedSites(rawInput);
    assert.deepEqual(parsed, [
        'www.reuters.com',
        'reddit.com',
        'reuters.com',
        '*.github.com',
        'invalid'
    ]);
});

test('Excluded Sites: Domain matching rules support root domains, subdomains, and wildcard patterns', () => {
    function matchesDomainPattern(host, pat) {
        if (!host || !pat) return false;
        let cleanHost = String(host).toLowerCase().trim();
        let cleanPat = String(pat).toLowerCase().trim();
        cleanPat = cleanPat.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].split(':')[0].trim();
        if (!cleanPat) return false;
        if (cleanPat.startsWith('*.')) {
            const root = cleanPat.slice(2);
            return cleanHost === root || cleanHost.endsWith('.' + root);
        }
        return cleanHost === cleanPat || cleanHost.endsWith('.' + cleanPat);
    }

    // 1. 标准根域名覆盖自身与子域
    assert.equal(matchesDomainPattern('reddit.com', 'reddit.com'), true);
    assert.equal(matchesDomainPattern('www.reddit.com', 'reddit.com'), true);
    assert.equal(matchesDomainPattern('old.reddit.com', 'reddit.com'), true);
    assert.equal(matchesDomainPattern('sub.old.reddit.com', 'reddit.com'), true);
    assert.equal(matchesDomainPattern('notreddit.com', 'reddit.com'), false);
    assert.equal(matchesDomainPattern('google.com', 'reddit.com'), false);

    // 2. 通配符前缀 *.domain.com
    assert.equal(matchesDomainPattern('reuters.com', '*.reuters.com'), true);
    assert.equal(matchesDomainPattern('news.reuters.com', '*.reuters.com'), true);
    assert.equal(matchesDomainPattern('reuters.net', '*.reuters.com'), false);

    // 3. 含有协议或路径的容错清洗匹配
    assert.equal(matchesDomainPattern('reuters.com', 'https://reuters.com/world'), true);
    assert.equal(matchesDomainPattern('www.reuters.com', 'http://reuters.com:443'), true);
});

test('Excluded Sites: options.html & options.js config definitions and persistence', () => {
    const optionsHtml = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/options.html'), 'utf8');
    const optionsJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/options.js'), 'utf8');

    // UI 存在黑名单卡片与输入框
    assert.match(optionsHtml, /id="excluded-sites-input"/);
    assert.match(optionsHtml, /生词高亮排除名单/);

    // options.js 存在默认配置与保存读取
    assert.match(optionsJs, /lexipro_excluded_sites:\s*\[\]/);
    assert.match(optionsJs, /parseExcludedSites/);
    assert.match(optionsJs, /toSave\s*=\s*\{[\s\S]*lexipro_excluded_sites/);
    assert.match(optionsJs, /excludedSitesInput\.value\s*=\s*list\.join\('\\n'\)/);
});

test('Excluded Sites: popup.html & popup.js quick toggle integration', () => {
    const popupHtml = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/popup.html'), 'utf8');
    const popupJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/popup.js'), 'utf8');

    // popup.html 存在快捷排除开关
    assert.match(popupHtml, /id="quick-exclude-check"/);
    assert.match(popupHtml, /排除此网站生词高亮/);

    // popup.js 存在域名提取、排除判定与状态切换
    assert.match(popupJs, /lexipro_excluded_sites:\s*\[\]/);
    assert.match(popupJs, /matchesPattern\(hostname,\s*pat\)/);
    assert.match(popupJs, /chrome\.storage\.local\.set\(\{\s*lexipro_excluded_sites/);
    assert.match(popupJs, /已排除高亮/);
});

test('Excluded Sites: content.js & userscript guard highlights and immersion translation completely', () => {
    const contentJs = fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/content.js'), 'utf8');
    const userscript = fs.readFileSync(path.resolve(__dirname, '../划词翻译+生词高亮.txt'), 'utf8');

    for (const [name, code] of [['content.js', contentJs], ['userscript', userscript]]) {
        // 1. 配置注入
        assert.match(code, /excludedSites:\s*initialExcludedSites/, `${name} should have excludedSites in CONFIG`);
        // 2. 匹配与判定函数
        assert.match(code, /function matchesDomainPattern/, `${name} should have matchesDomainPattern`);
        assert.match(code, /function isCurrentSiteExcluded/, `${name} should have isCurrentSiteExcluded`);
        assert.match(code, /function clearPageHighlights/, `${name} should have clearPageHighlights`);
        // 3. 生词高亮入口阻断
        assert.match(code, /async function syncVocabData\(\) \{\s+if \(isCurrentSiteExcluded\(\)\) \{\s+clearPageHighlights\(\);/, `${name} syncVocabData must guard when site excluded`);
        assert.match(code, /function scanPage\(regex,\s*root\s*=\s*document\.body\)\s*\{\s+if \(isCurrentSiteExcluded\(\)\) return;/, `${name} scanPage must guard when site excluded`);
        assert.match(code, /function observeDynamicContent\(regex\)\s*\{\s+if \(isCurrentSiteExcluded\(\)\) return;/, `${name} observeDynamicContent must guard when site excluded`);
        // 4. 沉浸式翻译按需门控
        assert.match(code, /function isCurrentSiteImmersionEnabled/, `${name} must include isCurrentSiteImmersionEnabled`);
        assert.match(code, /if\s*\(typeof isCurrentSiteImmersionEnabled === 'function'\s*&&\s*!isCurrentSiteImmersionEnabled\(\)\)\s*\{\s*return false;\s*\}/, `${name} isGlobalImmersionTranslationPage must guard when immersion not enabled`);
        assert.match(code, /if\s*\(!isCurrentSiteImmersionEnabled\(\)\)\s*\{\s*return;\s*\}/, `${name} initSiteSpecificTranslator must guard when immersion not enabled`);
        // 5. 动森设置面板内提供排除当前网站开关
        assert.match(code, /id="imt-exclude-switch"/, `${name} must include exclude switch in settings UI`);
        assert.match(code, /toggleExcludeSetting/, `${name} must include toggleExcludeSetting`);
        // 6. 热更新派发
        assert.match(code, /handleExcludedSitesChange/, `${name} must include handleExcludedSitesChange`);
        assert.match(code, /key === 'lexipro_excluded_sites'/, `${name} must handle excluded sites change in storage`);
    }
});

test('Version Consistency: manifest.json and userscript upgraded to v4.11.0', () => {
    const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../popup-translation-extension/manifest.json'), 'utf8'));
    const userscript = fs.readFileSync(path.resolve(__dirname, '../划词翻译+生词高亮.txt'), 'utf8');

    assert.equal(manifest.version, '4.11.0', 'manifest.json version must be 4.11.0');
    assert.match(userscript, /\/\/ @version\s+4\.11\.0/, 'userscript version must be 4.11.0');
});
