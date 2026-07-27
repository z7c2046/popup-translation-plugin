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

globalThis.__testResults = {
    reutersResult,
    fallbackResult
};
`, sandbox);

const { reutersResult, fallbackResult } = sandbox.__testResults;

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

assert.match(source, /\.imt-translation\s*\{[^}]*font-size:\s*inherit;/s);
assert.match(source, /\.imt-preserved-heading\s*\{[^}]*font-size:\s*inherit;/s);

const fontCodeStart = source.indexOf('function applyFontControlsVisibility');
const fontCodeEnd = source.indexOf('function handleFontControlKeydown');

assert.notEqual(fontCodeStart, -1, 'font controls start marker is missing');
assert.notEqual(fontCodeEnd, -1, 'font controls end marker is missing');

const fontCode = source.slice(fontCodeStart, fontCodeEnd);
const fontSandbox = {};
vm.createContext(fontSandbox);
vm.runInContext(`
let showFontControls = true;
let currentFontSize = 22;
const POPUP_FONT_SIZE = {
    defaultValue: 14.5,
    min: 10,
    max: 30
};
const persistedValues = new Map();
const fontToolbarControls = {
    visible: true,
    classList: {
        toggle(className, enabled) {
            if (className === 'imt-visible') fontToolbarControls.visible = enabled;
        }
    }
};
const tooltip = {
    popupFontSize: '',
    style: {
        setProperty(name, value) {
            if (name === '--imt-popup-font-size') tooltip.popupFontSize = value;
        }
    }
};
function GM_setValue(key, value) {
    persistedValues.set(key, value);
}
function updateFontControlsSwitchUI() {}
function updateFontToolbarState() {}

${fontCode}

applyFontControlsVisibility(false);
globalThis.__fontResults = {
    showFontControls,
    currentFontSize,
    visible: fontToolbarControls.visible,
    popupFontSize: tooltip.popupFontSize,
    storedVisibility: persistedValues.get('lexipro_show_font_controls'),
    storedFontSize: persistedValues.get('lexipro_popup_font_size')
};
`, fontSandbox);

assert.deepEqual(
    { ...fontSandbox.__fontResults },
    {
        showFontControls: false,
        currentFontSize: 14.5,
        visible: false,
        popupFontSize: '14.5px',
        storedVisibility: false,
        storedFontSize: 14.5
    }
);

console.log('selection-format and font-control regression tests passed');
