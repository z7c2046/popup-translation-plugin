const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const rootDir = path.resolve(__dirname, '..');
const extDir = path.join(rootDir, 'popup-translation-extension');

const optionsHtml = fs.readFileSync(path.join(extDir, 'options.html'), 'utf8');
const optionsCss = fs.readFileSync(path.join(extDir, 'options.css'), 'utf8');
const optionsJs = fs.readFileSync(path.join(extDir, 'options.js'), 'utf8');
const popupHtml = fs.readFileSync(path.join(extDir, 'popup.html'), 'utf8');
const popupCss = fs.readFileSync(path.join(extDir, 'popup.css'), 'utf8');
const popupJs = fs.readFileSync(path.join(extDir, 'popup.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
const userscript = fs.readFileSync(path.join(rootDir, '划词翻译+生词高亮.txt'), 'utf8');

const OFFICIAL_ANIMAL_BG_IDS = [
    'default',
    'grid',
    'dots-dark-green',
    'sprinkles',
    'sweet-corner',
    'coffee-break',
    'dots-pink',
    'dots-purple',
    'dots-blue',
    'dots-yellow',
    'dots-orange',
    'dots-teal',
    'dots-green',
    'dots-red',
    'dots-lime-green',
    'dots-yellow-green',
    'dots-brown',
    'dots-warm-peach-pink',
    'dots-gray'
];

function section(source, start, end) {
    const a = source.indexOf(start);
    const b = source.indexOf(end, a + start.length);
    assert.ok(a >= 0 && b > a, `Boundary not found: ${start} .. ${end}`);
    return source.slice(a, b);
}

test('Dual Skin Assets: Animal Island scene SVG wallpapers exist and are valid', () => {
    for (const fileName of ['sweet-corner.svg', 'coffee-break.svg']) {
        const filePath = path.join(extDir, 'assets', fileName);
        assert.ok(fs.existsSync(filePath), `assets/${fileName} must exist`);
        const svg = fs.readFileSync(filePath, 'utf8');
        assert.match(svg, /^<svg[^>]*viewBox="0 0 2560 1440"/, `${fileName} must declare 2560x1440 viewBox`);
        assert.match(svg, /<\/svg>\s*$/, `${fileName} must end cleanly with </svg>`);
        assert.doesNotMatch(svg, /LexiPro|Lexi Pro/, `${fileName} must not contain unauthorized branding`);
    }
});

test('Dual Skin Logic: options.js normalizers, defaults, and 19 Animal Island wallpapers work accurately', () => {
    const snippet = section(optionsJs, 'const DEFAULT_CONFIG =', "document.addEventListener('DOMContentLoaded'");
    const ctx = vm.createContext({});
    vm.runInContext(
        `${snippet}\nthis.__exports = { DEFAULT_CONFIG, ANIMAL_BACKGROUNDS, normalizeUiSkin, normalizeColorMode, normalizeAnimalBg };`,
        ctx
    );

    const { DEFAULT_CONFIG, ANIMAL_BACKGROUNDS, normalizeUiSkin, normalizeColorMode, normalizeAnimalBg } = ctx.__exports;

    assert.equal(DEFAULT_CONFIG.lexipro_ui_theme, 'modern');
    assert.equal(DEFAULT_CONFIG.lexipro_modern_color_mode, 'auto');
    assert.equal(DEFAULT_CONFIG.lexipro_animal_background, 'default');

    assert.equal(ANIMAL_BACKGROUNDS.length, 19, 'Must include all 19 official animal-island-ui backgrounds');
    assert.deepEqual(Array.from(ANIMAL_BACKGROUNDS, b => b.id), OFFICIAL_ANIMAL_BG_IDS);
    for (const bg of ANIMAL_BACKGROUNDS) {
        const expectedWide = ['sprinkles', 'sweet-corner', 'coffee-break'].includes(bg.id);
        assert.equal(bg.wide, expectedWide, `${bg.id} wide flag mismatch`);
    }

    // Skin normalizer + legacy market_desk migration
    assert.equal(normalizeUiSkin('modern'), 'modern');
    assert.equal(normalizeUiSkin('market_desk'), 'modern');
    assert.equal(normalizeUiSkin('animal_island'), 'animal_island');
    assert.equal(normalizeUiSkin(''), 'modern');
    assert.equal(normalizeUiSkin(null), 'modern');
    assert.equal(normalizeUiSkin('unknown_skin'), 'modern');

    // Color mode normalizer
    assert.equal(normalizeColorMode('light'), 'light');
    assert.equal(normalizeColorMode('dark'), 'dark');
    assert.equal(normalizeColorMode('auto'), 'auto');
    assert.equal(normalizeColorMode('invalid'), 'auto');

    // Animal background normalizer
    for (const id of OFFICIAL_ANIMAL_BG_IDS) {
        assert.equal(normalizeAnimalBg(id), id);
    }
    assert.equal(normalizeAnimalBg('non_existent'), 'default');
    assert.equal(normalizeAnimalBg(undefined), 'default');
});

test('Dual Skin Options UI: options.html and options.css implement Modern Light/Dark + Animal Island + 19 wallpapers', () => {
    // HTML controls
    assert.match(optionsHtml, /id="ui-theme-select"[\s\S]*value="modern"[\s\S]*value="animal_island"/);
    assert.doesNotMatch(optionsHtml, /value="market_desk"/, 'options.html should expose modern and animal_island instead of market_desk');
    assert.match(optionsHtml, /id="modern-color-mode-control"[\s\S]*data-mode="auto"[\s\S]*data-mode="light"[\s\S]*data-mode="dark"/);
    assert.match(optionsHtml, /id="animal-bg-group"/);
    assert.match(optionsHtml, /id="animal-bg-grid"/);

    // Modern Light/Dark design tokens from AI Translator
    assert.match(optionsCss, /body\[data-skin="modern"\]\[data-theme="light"\]/);
    assert.match(optionsCss, /body\[data-skin="modern"\]\[data-theme="dark"\]/);
    for (const token of ['#4f46e5', '#3b82f6', '#6366f1', '#0f172a', '#f3f4f6', '#1b1e25', '#b02a5f', '#0da175']) {
        assert.ok(optionsCss.includes(token), `options.css must include modern token ${token}`);
    }

    // Animal Island design tokens & all 19 wallpaper CSS rules
    assert.match(optionsCss, /body\[data-skin="animal_island"\]/);
    assert.ok(optionsCss.includes('sweet-corner.svg'), 'options.css must reference assets/sweet-corner.svg');
    assert.ok(optionsCss.includes('coffee-break.svg'), 'options.css must reference assets/coffee-break.svg');
    for (const bgId of OFFICIAL_ANIMAL_BG_IDS) {
        assert.ok(optionsCss.includes(`.aiu-bg-${bgId}`), `options.css must style wallpaper class .aiu-bg-${bgId}`);
    }
});

test('Dual Skin Popup UI: popup.html, popup.css, and popup.js implement Modern Light/Dark + Animal Island + live sync', () => {
    assert.match(popupHtml, /id="quick-theme-select"[\s\S]*value="modern"[\s\S]*value="animal_island"/);
    assert.doesNotMatch(popupHtml, /value="market_desk"/);

    assert.match(popupCss, /body\[data-skin="modern"\]\[data-theme="light"\]/);
    assert.match(popupCss, /body\[data-skin="modern"\]\[data-theme="dark"\]/);
    assert.match(popupCss, /body\[data-skin="animal_island"\]/);
    for (const bgId of OFFICIAL_ANIMAL_BG_IDS.filter(id => id !== 'default')) {
        assert.ok(popupCss.includes(`[data-animal-bg="${bgId}"]`), `popup.css must support wallpaper [data-animal-bg="${bgId}"]`);
    }

    assert.ok(popupJs.includes('normalizeUiSkin'), 'popup.js must normalize ui skin');
    assert.ok(popupJs.includes('normalizeColorMode'), 'popup.js must normalize color mode');
    assert.ok(popupJs.includes('applyPopupSkin'), 'popup.js must apply skin and resolved light/dark theme');
    assert.ok(popupJs.includes('chrome.storage.onChanged'), 'popup.js must react to live storage theme changes');
});

test('Dual Skin Content & Userscript: runtime theme resolution, Shadow DOM skins, tooltip settings, and page translator sync', () => {
    for (const [name, source] of [['content.js', contentJs], ['userscript', userscript]]) {
        // Test pure helper execution in VM
        const helperCode = section(source, '// ================= 皮肤状态与归一化 =================', '// ================= 注入主页面高亮 CSS =================');
        for (const isDarkMatch of [false, true]) {
            const ctx = vm.createContext({
                GM_getValue: (k, d) => (k === 'lexipro_ui_theme' ? 'market_desk' : d),
                window: {
                    matchMedia: () => ({ matches: isDarkMatch, addEventListener() {} })
                }
            });
            vm.runInContext(
                `${helperCode}\nthis.__res = { currentUiSkin, normalizedMarket: normalizeUiSkin('market_desk'), auto: resolveUiColorTheme('auto'), light: resolveUiColorTheme('light'), dark: resolveUiColorTheme('dark') };`,
                ctx
            );
            assert.equal(ctx.__res.currentUiSkin, 'modern', `${name} must migrate legacy market_desk -> modern`);
            assert.equal(ctx.__res.normalizedMarket, 'modern', `${name} normalizeUiSkin('market_desk') -> modern`);
            assert.equal(ctx.__res.light, 'light');
            assert.equal(ctx.__res.dark, 'dark');
            assert.equal(ctx.__res.auto, isDarkMatch ? 'dark' : 'light');
        }

        // Shadow DOM skin CSS
        assert.ok(source.includes(':host([data-skin="modern"])'), `${name} must define :host modern styles`);
        assert.ok(source.includes(':host([data-skin="modern"][data-theme="dark"])'), `${name} must define :host modern dark styles`);
        assert.ok(source.includes(':host([data-skin="animal_island"])'), `${name} must define :host animal_island styles`);
        assert.ok(source.includes('html[data-lexipro-skin="modern"]'), `${name} must style page highlight/elements for modern skin`);
        assert.ok(source.includes('html[data-lexipro-skin="modern"][data-lexipro-theme="dark"]'), `${name} must style page elements for modern dark`);
        assert.ok(source.includes('html[data-lexipro-skin="animal_island"]'), `${name} must style page elements for animal_island`);

        // Tooltip in-page settings controls (#imt-skin-select + #imt-color-mode-select)
        assert.ok(source.includes('id="imt-skin-select"'), `${name} tooltip settings must allow switching skin`);
        assert.ok(source.includes('id="imt-color-mode-select"'), `${name} tooltip settings must allow switching auto/light/dark mode`);

        // Synchronized storage & runtime hooks
        assert.ok(source.includes('applyUISkin'), `${name} must implement applyUISkin`);
        assert.ok(source.includes("key === 'lexipro_modern_color_mode'"), `${name} must hot-reload lexipro_modern_color_mode`);
        assert.ok(source.includes('__lexipro_sync_site_theme'), `${name} must sync theme with site translator FAB/menu`);
    }
});

test('Modern Skin Speaker Alignment: .imt-speaker and .imt-ex-speaker match toolbar .imt-action-btn tactile hover/press physics', () => {
    for (const [name, source] of [['content.js', contentJs], ['userscript', userscript]]) {
        const modernBlock = section(
            source,
            '/* ================= 皮肤一：现代极简风格 (:host([data-skin="modern"])) ================= */',
            ':host([data-skin="modern"]) .imt-section {'
        );

        assert.doesNotMatch(
            modernBlock,
            /\.imt-speaker[\s\S]*border-bottom:\s*3px/,
            `${name}: modern skin speakers must use 1px modern border instead of 3px cartoon border`
        );
        assert.doesNotMatch(
            modernBlock,
            /\.imt-speaker[\s\S]*transform:\s*translateY\(2px\)/,
            `${name}: modern skin speakers must not use old Animal Island translateY(2px) active transform`
        );
        assert.match(
            modernBlock,
            /:host\(\[data-skin="modern"\]\)\s*\.imt-speaker,\s*:host\(\[data-skin="modern"\]\)\s*\.imt-speaker\.imt-ex-speaker\s*\{[\s\S]*?border:\s*1px solid var\(--modern-divider\);[\s\S]*?border-bottom-width:\s*1px;/,
            `${name}: modern speakers must inherit uniform 1px modern border and surface`
        );
        assert.match(
            modernBlock,
            /:host\(\[data-skin="modern"\]\)\s*\.imt-speaker:hover,\s*:host\(\[data-skin="modern"\]\)\s*\.imt-speaker\.imt-ex-speaker:hover\s*\{[\s\S]*?transform:\s*translateY\(-1px\);[\s\S]*?box-shadow:\s*0 4px 10px var\(--modern-accent-glow\);/,
            `${name}: modern speaker hover must match .imt-action-btn lift and indigo glow`
        );
        assert.match(
            modernBlock,
            /:host\(\[data-skin="modern"\]\)\s*\.imt-speaker:active,\s*:host\(\[data-skin="modern"\]\)\s*\.imt-speaker\.imt-ex-speaker:active[\s\S]*?transform:\s*translateY\(1px\)\s*scale\(0\.95\);[\s\S]*?border-bottom-width:\s*1px;[\s\S]*?box-shadow:\s*none;/,
            `${name}: modern speaker active press must match .imt-action-btn scale(0.95) + translateY(1px) + box-shadow: none`
        );
    }
});

test('Animal Island Wallpaper Picker: background only updates on tile click, never on mouse hover', async () => {
    const helperDefs = section(optionsJs, 'const DEFAULT_CONFIG =', "document.addEventListener('DOMContentLoaded'");
    const pickerDefs = section(optionsJs, '  function renderAnimalBgPicker() {', '  // 侧边栏分栏导航切换');

    // Source-level guard against reintroducing hover-preview listeners on wallpaper tiles
    assert.doesNotMatch(
        pickerDefs,
        /addEventListener\(\s*['"]mouse(?:enter|over|leave|out)['"]/,
        'renderAnimalBgPicker must not bind mouse hover listeners that switch backdrop on hover'
    );

    const makeEl = (tag = 'div') => {
        const classes = new Set();
        const attrs = new Map();
        const listeners = new Map();
        const el = {
            tagName: tag.toUpperCase(),
            children: [],
            style: {},
            dataset: {},
            textContent: '',
            _innerHTML: '',
            get innerHTML() { return this._innerHTML; },
            set innerHTML(val) {
                this._innerHTML = val;
                if (val === '') this.children = [];
            },
            setAttribute(k, v) { attrs.set(k, String(v)); },
            getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
            removeAttribute(k) { attrs.delete(k); },
            classList: {
                add: (...names) => names.forEach(n => classes.add(n)),
                remove: (...names) => names.forEach(n => classes.delete(n)),
                toggle: (n, force) => {
                    const next = force === undefined ? !classes.has(n) : Boolean(force);
                    if (next) classes.add(n);
                    else classes.delete(n);
                    return next;
                },
                contains: (n) => classes.has(n)
            },
            addEventListener(type, fn) {
                if (!listeners.has(type)) listeners.set(type, []);
                listeners.get(type).push(fn);
            },
            async dispatchEvent(type) {
                for (const fn of (listeners.get(type) || [])) {
                    await fn({ target: el, currentTarget: el });
                }
            },
            appendChild(child) {
                this.children.push(child);
                return child;
            },
            querySelectorAll(sel) {
                if (sel === '.aiu-bg-tile') return this.children;
                return [];
            }
        };
        return el;
    };

    const pageBackdrop = makeEl('div');
    const bodyEl = makeEl('body');
    const animalBgGrid = makeEl('div');
    const animalBgCurrentBadge = makeEl('span');
    const modernColorModeGroup = makeEl('div');
    const animalBgGroup = makeEl('div');
    const themeSelect = { value: 'animal_island' };
    const savedPatches = [];

    const ctx = vm.createContext({
        document: {
            body: bodyEl,
            createElement: (tag) => makeEl(tag)
        },
        pageBackdrop,
        animalBgGrid,
        animalBgCurrentBadge,
        modernColorModeGroup,
        animalBgGroup,
        themeSelect,
        modernColorIndicator: null,
        modernColorButtons: [],
        currentColorMode: 'auto',
        currentAnimalBg: 'default',
        resolveModernTheme: () => 'light',
        saveStoragePatch: async (patch) => { savedPatches.push(patch); }
    });

    vm.runInContext(
        `${helperDefs}\n${pickerDefs}\nrenderAnimalBgPicker();\napplySkinToDocument();\nthis.__api = { pageBackdrop, animalBgGrid, animalBgCurrentBadge, getBg: () => currentAnimalBg };`,
        ctx
    );

    const tiles = ctx.__api.animalBgGrid.children;
    assert.equal(tiles.length, 19);
    assert.equal(ctx.__api.pageBackdrop.getAttribute('data-animal-bg'), 'default');

    const sweetTile = tiles.find(t => t.dataset.bg === 'sweet-corner');
    assert.ok(sweetTile);

    // Hovering sweet-corner must NOT alter backdrop, selected state, or storage
    await sweetTile.dispatchEvent('mouseenter');
    await sweetTile.dispatchEvent('mouseover');
    await sweetTile.dispatchEvent('mouseleave');
    assert.equal(ctx.__api.pageBackdrop.getAttribute('data-animal-bg'), 'default');
    assert.equal(ctx.__api.getBg(), 'default');
    assert.equal(ctx.__api.animalBgCurrentBadge.textContent, '奶油色波点');
    assert.equal(savedPatches.length, 0);

    // Clicking sweet-corner must update backdrop, selection, badge, and storage
    await sweetTile.dispatchEvent('click');
    assert.equal(ctx.__api.pageBackdrop.getAttribute('data-animal-bg'), 'sweet-corner');
    assert.equal(ctx.__api.getBg(), 'sweet-corner');
    assert.equal(sweetTile.classList.contains('is-selected'), true);
    assert.equal(sweetTile.getAttribute('aria-checked'), 'true');
    assert.equal(ctx.__api.animalBgCurrentBadge.textContent, '甜点街角');
    assert.deepEqual(JSON.parse(JSON.stringify(savedPatches)), [{ lexipro_animal_background: 'sweet-corner' }]);
});

test('Branding Check: Dual-skin files contain zero LexiPro / Lexi Pro strings', () => {
    for (const [label, text] of [
        ['options.html', optionsHtml],
        ['options.css', optionsCss],
        ['options.js', optionsJs],
        ['popup.html', popupHtml],
        ['popup.css', popupCss],
        ['popup.js', popupJs],
        ['content.js', contentJs],
        ['划词翻译+生词高亮.txt', userscript]
    ]) {
        assert.doesNotMatch(text, /LexiPro|Lexi Pro/, `${label} must not contain LexiPro branding`);
    }
});
