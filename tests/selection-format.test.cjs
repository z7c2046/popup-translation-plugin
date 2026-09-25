const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sourcePath = path.resolve(__dirname, '..', '划词翻译+生词高亮.txt');
const source = fs.readFileSync(sourcePath, 'utf8');
const selectionCodeStart = source.indexOf('const PRESERVED_BLOCK_SELECTOR');
const selectionCodeEnd = source.indexOf('// ================= 语音播放模块');

assert.notEqual(selectionCodeStart, -1, 'selection formatter start marker is missing');
assert.notEqual(selectionCodeEnd, -1, 'selection formatter end marker is missing');

const selectionCode = source.slice(selectionCodeStart, selectionCodeEnd);
const sandbox = { console };
vm.createContext(sandbox);

vm.runInContext(`${selectionCode}
class MockElement {
    constructor(tagName, children = []) {
        this.nodeType = Node.ELEMENT_NODE;
        this.tagName = tagName.toUpperCase();
        this.childNodes = [];
        this.parentNode = null;
        this.parentElement = null;
        children.forEach(child => this.appendChild(child));
    }

    appendChild(child) {
        child.parentNode = this;
        child.parentElement = this;
        this.childNodes.push(child);
        return child;
    }

    matches(selector) {
        const ownTag = this.tagName.toLowerCase();
        return selector.split(',').some(item => item.trim() === ownTag);
    }
}

class MockText {
    constructor(value) {
        this.nodeType = Node.TEXT_NODE;
        this.nodeValue = value;
        this.parentNode = null;
        this.parentElement = null;
    }
}

class MockFragment {
    constructor(children = []) {
        this.nodeType = 11;
        this.childNodes = [];
        this.parentNode = null;
        this.parentElement = null;
        children.forEach(child => this.appendChild(child));
    }

    appendChild(child) {
        child.parentNode = this;
        child.parentElement = null;
        this.childNodes.push(child);
        return child;
    }
}

function flattenChildren(root) {
    const result = [];
    function visit(node) {
        for (const child of node.childNodes || []) {
            result.push(child);
            if (child.childNodes) visit(child);
        }
    }
    visit(root);
    return result;
}

globalThis.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
};
globalThis.NodeFilter = {
    SHOW_ELEMENT: 1,
    SHOW_TEXT: 4
};
globalThis.document = {
    createTreeWalker(root) {
        const nodes = flattenChildren(root);
        let index = -1;
        return {
            currentNode: root,
            nextNode() {
                index += 1;
                if (index >= nodes.length) return false;
                this.currentNode = nodes[index];
                return true;
            }
        };
    }
};

function makeSelection(rawText, fragment) {
    return {
        rangeCount: 1,
        toString() {
            return rawText;
        },
        getRangeAt() {
            return {
                cloneContents() {
                    return fragment;
                }
            };
        }
    };
}

const summaryItems = [
    'Saudi Arabia says it has shot down drones launched by Iran-backed armed group from Iraq',
    'Drones also reported in Jordan and northern Iraq',
    'U.S. official says military commanders advised Trump they were running out of targets',
    'Two-week bombing campaign killed scores in Iran; four US service members died',
    "Iran state media: six ships turned back in strait trying to pass without Tehran's permission"
];
const articleParagraph = "DUBAI, July 27 (Reuters) - Saudi Arabia, Jordan and Iraq reported drone attacks on Monday, two days after the United States abruptly suspended a two-week campaign of air strikes against Iran, as Tehran appeared to put President Donald Trump's latest strategic U-turn to the test.";
const list = new MockElement('ul', summaryItems.map(item => (
    new MockElement('li', [
        new MockElement('div', [new MockText(item)])
    ])
)));
const article = new MockElement('article', [
    new MockElement('div', [list]),
    new MockElement('div', [new MockText(articleParagraph)])
]);
const reutersFragment = new MockFragment([article]);
const reutersRawText = [...summaryItems, articleParagraph].join('\\n');
const reutersResult = getSelectionFormat(makeSelection(reutersRawText, reutersFragment));

const incompleteFragment = new MockFragment([
    new MockElement('li', [new MockText(summaryItems[0])])
]);
const fallbackRawText = summaryItems[0] + '\\n' + articleParagraph;
const fallbackResult = getSelectionFormat(makeSelection(fallbackRawText, incompleteFragment));

// 测试生词高亮 span 标签在标题中不会将标题拆分为多个 block
const titleWithHighlightFragment = new MockFragment([
    new MockText("Microsoft's $41 billion AI bet just cleared a "),
    new MockElement('span', [new MockText('major')]),
    new MockText(' test: Chart of the Day')
]);
const titleRawText = "Microsoft's $41 billion AI bet just cleared a major test: Chart of the Day";
const titleWithHighlightResult = getSelectionFormat(makeSelection(titleRawText, titleWithHighlightFragment));

// 测试生词高亮 span 标签在列表项中不会将单个列表项拆分为多个 block
const listWithHighlightFragment = new MockFragment([
    new MockElement('ul', [
        new MockElement('li', [
            new MockText('First item with '),
            new MockElement('span', [new MockText('important')]),
            new MockText(' word')
        ]),
        new MockElement('li', [new MockText('Second item')])
    ])
]);
const listRawText = 'First item with important word\\nSecond item';
const listWithHighlightResult = getSelectionFormat(makeSelection(listRawText, listWithHighlightFragment));

// 测试在 Flex 容器中原生 selection.toString() 带有伪换行时，getSelectionFormat 能够恢复为无换行的连贯句子
const flexLiWithHighlightsFragment = new MockFragment([
    new MockElement('li', [
        new MockText('Trump rolls out red '),
        new MockElement('span', [new MockText('carpet')]),
        new MockText(' as leaders seek stability '),
        new MockElement('span', [new MockText('despite')]),
        new MockText(' deep tensions')
    ])
]);
const flexLiBrokenRawText = 'Trump rolls out red\\ncarpet\\nas leaders seek stability\\ndespite\\ndeep tensions';
const flexLiResult = getSelectionFormat(makeSelection(flexLiBrokenRawText, flexLiWithHighlightsFragment));

globalThis.__testResults = {
    reutersResult,
    fallbackResult,
    titleWithHighlightResult,
    listWithHighlightResult,
    flexLiResult
};
`, sandbox);

const { reutersResult, fallbackResult, titleWithHighlightResult, listWithHighlightResult, flexLiResult } = sandbox.__testResults;

assert.equal(reutersResult.text.includes('DUBAI, July 27'), true);
assert.deepEqual(
    Array.from(reutersResult.blocks, block => block.type),
    ['li', 'li', 'li', 'li', 'li', 'p']
);
assert.equal(reutersResult.blocks.at(-1).text.includes('strategic U-turn'), true);

assert.equal(fallbackResult.text, fallbackResult.blocks.map(block => block.text).join('\n'));
assert.equal(fallbackResult.blocks.length, 2);
assert.deepEqual(
    Array.from(fallbackResult.blocks, block => block.type),
    ['line', 'line']
);
assert.equal(fallbackResult.blocks[1].text.includes('DUBAI, July 27'), true);

// 验证生词高亮标题保持为 1 个完整 block，不会因为生词 span 导致换行隔离
assert.equal(titleWithHighlightResult.blocks.length, 1);
assert.equal(titleWithHighlightResult.blocks[0].text, titleWithHighlightResult.text);

// 验证带有生词高亮的列表项目保持为 2 个完整的 li block
assert.equal(listWithHighlightResult.blocks.length, 2);
assert.deepEqual(
    Array.from(listWithHighlightResult.blocks, block => block.type),
    ['li', 'li']
);
assert.equal(listWithHighlightResult.blocks[0].text, 'First item with important word');
assert.equal(listWithHighlightResult.blocks[1].text, 'Second item');

// 验证即使浏览器原生 selection.toString() 带有分词换行，getSelectionFormat 仍能组装回无换行完整句子
assert.equal(flexLiResult.blocks.length, 1);
assert.equal(flexLiResult.text, 'Trump rolls out red carpet as leaders seek stability despite deep tensions');
assert.equal(flexLiResult.text.includes('\n'), false);

assert.match(source, /\.notion-vocab-inline-container\s*\{[^}]*display:\s*inline\s*!important;/s);
assert.match(source, /isFlexOrGridParent/);
assert.match(source, /\.imt-translation\s*\{[^}]*font-size:\s*inherit;/s);
assert.match(source, /\.imt-preserved-heading\s*\{[^}]*font-size:\s*inherit;/s);

const fontCodeStart = source.indexOf('function formatPopupFontSize');
const fontCodeEnd = source.indexOf("fontDecBtn.addEventListener('click'");

assert.notEqual(fontCodeStart, -1, 'font controls start marker is missing');
assert.notEqual(fontCodeEnd, -1, 'font controls end marker is missing');

const fontCode = source.slice(fontCodeStart, fontCodeEnd);
const fontSandbox = {};
vm.createContext(fontSandbox);
vm.runInContext(`
let isFontPopoverOpen = false;
let currentFontSize = 15;
const POPUP_FONT_SIZE = {
    defaultValue: 15,
    min: 12,
    max: 20,
    step: 1
};
const persistedValues = new Map();
function makeMockElement() {
    const classes = new Set();
    const attributes = new Map();
    const listeners = new Map();
    return {
        classes,
        attributes,
        listeners,
        title: '',
        textContent: '',
        classList: {
            toggle(className, enabled) {
                if (enabled) classes.add(className);
                else classes.delete(className);
            }
        },
        setAttribute(name, value) {
            attributes.set(name, value);
        },
        addEventListener(type, handler) {
            if (!listeners.has(type)) listeners.set(type, []);
            listeners.get(type).push(handler);
        },
        dispatch(type, event) {
            for (const handler of listeners.get(type) || []) handler(event);
        }
    };
}
const fontMenuBtn = makeMockElement();
const fontPopover = makeMockElement();
const fontIncBtn = makeMockElement();
const fontDecBtn = makeMockElement();
const fontResetBtn = makeMockElement();
const fontValue = makeMockElement();
const tooltip = makeMockElement();
tooltip.popupFontSize = '';
tooltip.style = {
    setProperty(name, value) {
        if (name === '--imt-popup-font-size') tooltip.popupFontSize = value;
    }
};
function GM_setValue(key, value) {
    persistedValues.set(key, value);
}

${fontCode}

let stoppedMouseDownEvents = 0;
const internalMouseDownEvent = {
    stopPropagation() {
        stoppedMouseDownEvents += 1;
    }
};
fontMenuBtn.dispatch('mousedown', internalMouseDownEvent);
fontPopover.dispatch('mousedown', internalMouseDownEvent);
globalThis.__mouseDownIsolationResults = {
    stoppedMouseDownEvents
};

applyPopupFontSize(17);
setFontPopoverOpen(true);
globalThis.__openPopoverResults = {
    menuExpanded: fontMenuBtn.attributes.get('aria-expanded'),
    popoverHidden: fontPopover.attributes.get('aria-hidden'),
    popoverOpenClass: fontPopover.classes.has('imt-open'),
    tooltipOpenClass: tooltip.classes.has('imt-font-popover-open')
};
setFontPopoverOpen(false);
globalThis.__closedPopoverResults = {
    currentFontSize,
    storedFontSize: persistedValues.get('lexipro_popup_font_size'),
    popupFontSize: tooltip.popupFontSize,
    menuExpanded: fontMenuBtn.attributes.get('aria-expanded'),
    popoverHidden: fontPopover.attributes.get('aria-hidden'),
    popoverOpenClass: fontPopover.classes.has('imt-open'),
    tooltipOpenClass: tooltip.classes.has('imt-font-popover-open'),
    displayedValue: fontValue.textContent
};

applyPopupFontSize(POPUP_FONT_SIZE.defaultValue);
globalThis.__resetFontResults = {
    currentFontSize,
    storedFontSize: persistedValues.get('lexipro_popup_font_size'),
    resetDisabled: fontResetBtn.classes.has('imt-disabled')
};
`, fontSandbox);

assert.deepEqual(
    { ...fontSandbox.__mouseDownIsolationResults },
    {
        stoppedMouseDownEvents: 2
    }
);

assert.deepEqual(
    { ...fontSandbox.__openPopoverResults },
    {
        menuExpanded: 'true',
        popoverHidden: 'false',
        popoverOpenClass: true,
        tooltipOpenClass: true
    }
);

assert.deepEqual(
    { ...fontSandbox.__closedPopoverResults },
    {
        currentFontSize: 17,
        storedFontSize: 17,
        popupFontSize: '17px',
        menuExpanded: 'false',
        popoverHidden: 'true',
        popoverOpenClass: false,
        tooltipOpenClass: false,
        displayedValue: '17 px'
    }
);

assert.deepEqual(
    { ...fontSandbox.__resetFontResults },
    {
        currentFontSize: 15,
        storedFontSize: 15,
        resetDisabled: true
    }
);

assert.match(
    source,
    /const POPUP_FONT_SIZE = \{\s*defaultValue: 15,\s*min: 12,\s*max: 20,\s*step: 1\s*\};/
);
assert.match(source, /id="imt-font-menu-btn"[^>]*>Aa<\/span>/);
assert.match(source, /id="imt-font-popover"/);
assert.doesNotMatch(source, /imt-show-font-controls-switch|imt-font-toolbar-controls|showFontControls/);
assert.match(source, /\.imt-translation\s*\{[^}]*font-weight:\s*650;[^}]*line-height:\s*1\.65;/s);
assert.match(source, /\.imt-preserved-heading\s*\{[^}]*font-weight:\s*800;[^}]*line-height:\s*1\.65;/s);
assert.match(
    source,
    /\.imt-font-step-btn:hover:not\(:disabled\):not\(\.imt-disabled\),\s*#imt-font-reset-btn:hover:not\(:disabled\):not\(\.imt-disabled\)\s*\{[^}]*background:\s*linear-gradient\(180deg, #effdf8, var\(--aiu-primary-soft\)\);/s
);
assert.match(
    source,
    /#imt-font-popover\s*\{[^}]*border:\s*2px solid var\(--aiu-border\);[^}]*border-radius:\s*20px;/s
);

console.log('selection-format and font-popover regression tests passed');
