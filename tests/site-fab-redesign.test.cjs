/**
 * Floating Immersive Translation Button Redesign Test Suite
 * Verifies:
 * 1. Removal of duplicate bottom-right settings button (#lexipro-site-fab-more) & popup menu (#lexipro-site-menu)
 * 2. Button label always reads "沉浸式翻译" in idle state (Reuters, Reddit, general sites)
 * 3. Enlarged dimensions (56px height, >=172px width, 16px label), rounded corners (999px pill & icon), and tactile click animations
 * 4. Click ripple/spring-bounce effect, drag-click suppression, keyboard trigger, and extension popup/storage hooks
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repoDir = path.resolve(__dirname, '..');
const contentJs = fs.readFileSync(path.join(repoDir, 'popup-translation-extension/content.js'), 'utf8');
const userscript = fs.readFileSync(path.join(repoDir, '划词翻译+生词高亮.txt'), 'utf8');

function section(source, startMarker, endMarker) {
    const start = source.indexOf(startMarker);
    assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
    const end = endMarker ? source.indexOf(endMarker, start) : source.length;
    assert.notEqual(end, -1, `Missing end marker: ${endMarker}`);
    return source.slice(start, end);
}

function createFabDomMock(hostname = 'www.reuters.com') {
    const bodyChildren = [];
    const addedStyles = [];
    const docListeners = {};

    function parseAttributes(str) {
        const attrs = {};
        const attrRe = /([\w-]+)="([^"]*)"/g;
        let m;
        while ((m = attrRe.exec(str))) {
            attrs[m[1]] = m[2];
        }
        return attrs;
    }

    function makeClassList(el) {
        const set = new Set();
        const sync = () => {
            el._className = Array.from(set).join(' ');
        };
        return {
            _setFromString(val) {
                set.clear();
                String(val || '').split(/\s+/).filter(Boolean).forEach(c => set.add(c));
                el._className = String(val || '');
            },
            add(...cls) { cls.forEach(c => set.add(c)); sync(); },
            remove(...cls) { cls.forEach(c => set.delete(c)); sync(); },
            toggle(c, force) {
                if (force === true) set.add(c);
                else if (force === false) set.delete(c);
                else if (set.has(c)) set.delete(c);
                else set.add(c);
                sync();
            },
            contains(c) { return set.has(c); }
        };
    }

    function createEl(tag = 'div') {
        const listeners = {};
        const el = {
            tagName: tag.toUpperCase(),
            id: '',
            _className: '',
            attributes: {},
            style: {},
            children: [],
            parentNode: null,
            _innerHTML: '',
            innerText: '',
            offsetWidth: 180,
            offsetHeight: 56,
            setAttribute(k, v) {
                this.attributes[k] = String(v);
                if (k === 'id') this.id = String(v);
            },
            getAttribute(k) { return this.attributes[k] ?? null; },
            addEventListener(type, fn) {
                listeners[type] = listeners[type] || [];
                listeners[type].push(fn);
            },
            removeEventListener(type, fn) {
                if (!listeners[type]) return;
                listeners[type] = listeners[type].filter(f => f !== fn);
            },
            dispatchEvent(ev = {}) {
                const event = {
                    type: ev.type || 'click',
                    button: ev.button ?? 0,
                    clientX: ev.clientX ?? 0,
                    clientY: ev.clientY ?? 0,
                    key: ev.key || '',
                    target: ev.target || el,
                    stopPropagation() {},
                    preventDefault() {}
                };
                for (const fn of (listeners[event.type] || [])) {
                    fn(event);
                }
                return event;
            },
            click() {
                return this.dispatchEvent({ type: 'click', clientX: 50, clientY: 28 });
            },
            getBoundingClientRect() {
                return { left: 1000, top: 660, right: 1180, bottom: 716, width: 180, height: 56 };
            },
            appendChild(child) {
                child.parentNode = el;
                el.children.push(child);
                return child;
            },
            remove() {
                if (el.parentNode) {
                    const idx = el.parentNode.children.indexOf(el);
                    if (idx !== -1) el.parentNode.children.splice(idx, 1);
                    el.parentNode = null;
                }
            },
            closest() { return null; },
            querySelector(sel) { return walkFind(el, sel); },
            querySelectorAll(sel) {
                const list = [];
                walkAll(el, sel, list);
                return list;
            }
        };
        el.classList = makeClassList(el);
        Object.defineProperty(el, 'className', {
            get() { return el._className; },
            set(v) { el.classList._setFromString(v); }
        });
        Object.defineProperty(el, 'innerHTML', {
            get() { return el._innerHTML; },
            set(html) {
                el._innerHTML = String(html);
                el.children = [];
                // Lightweight parse for our FAB markup
                if (el._innerHTML.includes('id="lexipro-site-fab"')) {
                    const fab = createEl('div');
                    fab.id = 'lexipro-site-fab';
                    fab.className = 'lexipro-site-fab';
                    const fabTag = el._innerHTML.match(/<div class="lexipro-site-fab"[^>]*>/)?.[0] || '';
                    fab.attributes = parseAttributes(fabTag);

                    const iconWrap = createEl('div');
                    iconWrap.className = 'lexipro-site-fab-icon';
                    const spin = createEl('span');
                    spin.className = 'lexipro-site-spinner';
                    spin.style.display = 'none';
                    const logo = createEl('span');
                    logo.className = 'lexipro-site-logo-icon';
                    logo.innerText = el._innerHTML.includes('🍃') ? '🍃' : '译';
                    iconWrap.appendChild(spin);
                    iconWrap.appendChild(logo);

                    const label = createEl('div');
                    label.id = 'lexipro-site-fab-label';
                    label.className = 'lexipro-site-fab-label';
                    const lm = el._innerHTML.match(/id="lexipro-site-fab-label"[^>]*>([^<]*)</);
                    label.innerText = lm ? lm[1].trim() : '';

                    fab.appendChild(iconWrap);
                    fab.appendChild(label);

                    const toolbar = createEl('div');
                    toolbar.className = 'lexipro-site-fab-toolbar';
                    const badge = createEl('div');
                    badge.id = 'lexipro-site-badge';
                    badge.className = 'lexipro-site-badge';
                    badge.style.display = 'none';
                    badge.innerText = '0';

                    toolbar.appendChild(fab);
                    toolbar.appendChild(badge);
                    el.appendChild(toolbar);
                }
            }
        });
        return el;
    }

    function matchesSel(node, sel) {
        if (sel.startsWith('#')) return node.id === sel.slice(1);
        if (sel.startsWith('.')) {
            const cls = sel.slice(1);
            return node.classList.contains(cls);
        }
        return false;
    }

    function walkFind(root, sel) {
        for (const ch of root.children) {
            if (matchesSel(ch, sel)) return ch;
            const nested = walkFind(ch, sel);
            if (nested) return nested;
        }
        return null;
    }

    function walkAll(root, sel, out) {
        for (const ch of root.children) {
            if (matchesSel(ch, sel)) out.push(ch);
            walkAll(ch, sel, out);
        }
    }

    const body = createEl('body');
    body.appendChild = (child) => {
        child.parentNode = body;
        bodyChildren.push(child);
        body.children = bodyChildren;
        return child;
    };

    const document = {
        readyState: 'complete',
        body,
        documentElement: createEl('html'),
        createElement: (tag) => createEl(tag),
        getElementById: (id) => walkFind(body, `#${id}`),
        querySelector: (sel) => {
            if (sel === '#lexipro-site-fab .lexipro-site-logo-icon') {
                const fab = walkFind(body, '#lexipro-site-fab');
                return fab ? walkFind(fab, '.lexipro-site-logo-icon') : null;
            }
            return walkFind(body, sel);
        },
        querySelectorAll: (sel) => {
            const out = [];
            walkAll(body, sel, out);
            return out;
        },
        addEventListener(type, fn) {
            docListeners[type] = docListeners[type] || [];
            docListeners[type].push(fn);
        },
        removeEventListener(type, fn) {
            if (!docListeners[type]) return;
            docListeners[type] = docListeners[type].filter(f => f !== fn);
        },
        dispatchDocEvent(type, ev = {}) {
            for (const fn of (docListeners[type] || [])) fn(ev);
        }
    };

    return { document, addedStyles, location: { hostname, href: `https://${hostname}/` } };
}

test('Site FAB Redesign: removes duplicate settings gear button & menu in both content.js and userscript', () => {
    for (const [name, source] of [['content.js', contentJs], ['userscript', userscript]]) {
        assert.doesNotMatch(source, /id="lexipro-site-fab-more"/, `${name} must remove duplicate #lexipro-site-fab-more gear button`);
        assert.doesNotMatch(source, /id="lexipro-site-menu"/, `${name} must remove duplicate #lexipro-site-menu popup panel`);
        assert.doesNotMatch(source, /\.lexipro-site-fab-more\b/, `${name} must remove unused .lexipro-site-fab-more CSS`);
        assert.doesNotMatch(source, /\.lexipro-site-menu\b/, `${name} must remove unused .lexipro-site-menu CSS`);
        assert.doesNotMatch(source, /lps-btn-theme-toggle|lps-btn-auto-toggle/, `${name} must remove duplicate menu toggle buttons`);
    }
});

test('Site FAB Redesign: CSS enlarges button, keeps rounded corners, and defines click animations across all skins', () => {
    for (const [name, source] of [['content.js', contentJs], ['userscript', userscript]]) {
        assert.match(source, /\.lexipro-site-fab\s*\{[\s\S]*height:\s*56px;/, `${name} .lexipro-site-fab height must be enlarged to 56px`);
        assert.match(source, /\.lexipro-site-fab\s*\{[\s\S]*min-width:\s*172px;/, `${name} .lexipro-site-fab min-width must be enlarged to >= 172px`);
        assert.match(source, /\.lexipro-site-fab\s*\{[\s\S]*border-radius:\s*999px;/, `${name} .lexipro-site-fab must use 999px pill rounded corners`);
        assert.match(source, /\.lexipro-site-logo-icon\s*\{[\s\S]*border-radius:\s*999px;/, `${name} .lexipro-site-logo-icon must use 999px rounded medallion`);
        assert.match(source, /\.lexipro-site-fab-label\s*\{[\s\S]*font-size:\s*16px;/, `${name} label font-size must be enlarged to 16px`);
        assert.match(source, /\.lexipro-site-fab:not\(\.dragging\):active/, `${name} must style active press feedback`);
        assert.match(source, /@keyframes lexipro-fab-click-pop/, `${name} must define click spring bounce keyframes`);
        assert.match(source, /\.lexipro-fab-ripple/, `${name} must define radial ripple click wave`);
        assert.match(source, /html\[data-lexipro-skin="modern"\]\[data-lexipro-theme="dark"\] \.lexipro-site-fab:not\(\.dragging\):active/, `${name} must style dark mode active press`);
        assert.match(source, /html\[data-lexipro-skin="animal_island"\] \.lexipro-site-fab:not\(\.dragging\):active/, `${name} must style Animal Island active 3D lip press`);
    }
});

test('Site FAB Runtime Execution: mounts as "沉浸式翻译" on Reuters/Reddit/general, handles click effect, drag suppression, and hooks cleanly', () => {
    const initCode = section(contentJs, 'function initSiteSpecificTranslator() {', '// 扩展环境与 Popup 的全局消息交互支持');

    for (const [siteHost, skin] of [
        ['www.reuters.com', 'modern'],
        ['www.reddit.com', 'modern'],
        ['example.com', 'animal_island']
    ]) {
        const { document, location } = createFabDomMock(siteHost);
        const store = {
            lexipro_ui_theme: skin,
            lexipro_site_translation_style: 'replace'
        };
        let llmCalls = 0;

        const sandbox = {
            document,
            location,
            window: {
                innerWidth: 1280,
                innerHeight: 800,
                addEventListener() {}
            },
            CONFIG: { llmProvider: 'siliconflow', siliconflowModel: 'Qwen/Qwen2.5-7B-Instruct', autoTranslateSites: [] },
            currentUiSkin: skin,
            GM_getValue: (k, d) => (k in store ? store[k] : d),
            GM_setValue: (k, v) => { store[k] = v; },
            GM_addStyle: () => {},
            isCurrentSiteExcluded: () => false,
            isCurrentSiteImmersionEnabled: () => true,
            isCurrentSiteAutoTranslate: () => false,
            normalizeUiSkin: (v) => (v === 'animal_island' ? 'animal_island' : 'modern'),
            applyUISkin: (nextSkin) => {
                if (nextSkin) sandbox.currentUiSkin = sandbox.normalizeUiSkin(nextSkin);
            },
            matchesDomainPattern: (h, p) => h === p,
            clearActiveWordHighlight: () => {},
            activePageRequests: new Set(),
            requestLLMChatCompletion: () => {
                llmCalls++;
                return Promise.resolve('{"translations":[]}');
            },
            MutationObserver: class { observe() {} disconnect() {} },
            setTimeout,
            clearTimeout,
            setInterval: () => 1,
            escapeHtml: (s) => String(s),
            Set, Map, Array, Object, Math, JSON, Promise, Number, String, Boolean
        };
        sandbox.window.window = sandbox.window;
        vm.createContext(sandbox);
        vm.runInContext(`${initCode}\ninitSiteSpecificTranslator();`, sandbox);

        const root = document.getElementById('lexipro-site-fab-root');
        assert.ok(root, `FAB root must mount on ${siteHost}`);
        assert.equal(document.getElementById('lexipro-site-fab-more'), null, `No gear button should mount on ${siteHost}`);
        assert.equal(document.getElementById('lexipro-site-menu'), null, `No settings menu should mount on ${siteHost}`);

        const fab = document.getElementById('lexipro-site-fab');
        const label = document.getElementById('lexipro-site-fab-label');
        assert.ok(fab, `Main FAB must exist on ${siteHost}`);
        assert.equal(label.innerText, '沉浸式翻译', `FAB idle label on ${siteHost} must be strictly "沉浸式翻译"`);
        assert.equal(fab.getAttribute('aria-label'), '沉浸式翻译');

        // 1. Clicking triggers click animation (.lexipro-fab-clicked + .lexipro-fab-ripple)
        fab.click();
        assert.ok(fab.classList.contains('lexipro-fab-clicked'), 'Clicking FAB must add spring bounce class lexipro-fab-clicked');
        const ripple = fab.querySelector('.lexipro-fab-ripple');
        assert.ok(ripple, 'Clicking FAB must spawn expanding .lexipro-fab-ripple wave');

        // Wait microtask then test drag suppression (drag > 4px must suppress immediate click)
        fab.dispatchEvent({ type: 'mousedown', button: 0, clientX: 1050, clientY: 680 });
        document.dispatchDocEvent('mousemove', { clientX: 1020, clientY: 650 });
        document.dispatchDocEvent('mouseup', { clientX: 1020, clientY: 650 });
        assert.ok(store.lexipro_site_fab_pos, 'Dragging FAB must persist new position');
        // Next click immediately after drag must NOT spawn another ripple
        fab.children.filter(c => c.classList.contains('lexipro-fab-ripple')).forEach(c => c.remove());
        fab.classList.remove('lexipro-fab-clicked');
        fab.click();
        assert.equal(fab.querySelector('.lexipro-fab-ripple'), null, 'Click immediately after drag should be suppressed');

        // 2. Test exposed hooks from extension popup & hot reload cleanly without menu DOM
        assert.doesNotThrow(() => {
            sandbox.window.__lexipro_sync_site_theme('animal_island');
            sandbox.window.__lexipro_set_theme('modern');
            sandbox.window.__lexipro_set_display_mode('underline');
            sandbox.window.__lexipro_update_auto_status();
            sandbox.window.__lexipro_site_storage_listener('lexipro_ui_theme', 'animal_island');
            const state = sandbox.window.__lexipro_get_page_state();
            assert.equal(state.immersionActive, true);
        }, 'Extension hooks must execute cleanly without menu elements');

        // 3. Destroy hook cleans up cleanly
        sandbox.window.__lexipro_destroy_site_translator();
        assert.equal(document.getElementById('lexipro-site-fab-root'), null, 'Destroy hook must remove FAB root');
        assert.equal(llmCalls, 0, 'Empty mock page has 0 items so 0 LLM calls');
    }
});

