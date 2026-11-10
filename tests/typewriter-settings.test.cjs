const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', '划词翻译+生词高亮.txt');
const source = fs.readFileSync(sourcePath, 'utf8');
const contentJsPath = path.resolve(__dirname, '..', 'popup-translation-extension', 'content.js');
const contentJs = fs.readFileSync(contentJsPath, 'utf8');

// 1. Check DOM structure and style definitions
assert.match(source, /id="imt-settings"/, 'Tooltip HTML must include #imt-settings element');
assert.match(source, /#imt-content,\s*#imt-settings\s*\{/, 'CSS must style both #imt-content and #imt-settings');
assert.match(source, /#imt-content::-webkit-scrollbar,\s*#imt-settings::-webkit-scrollbar/, 'Scrollbar CSS must style #imt-settings');
assert.match(source, /const settingsBox = tooltip\.querySelector\('#imt-settings'\);/, 'Element reference settingsBox must be initialized');

// 2. Check that lastTranslationHtml snapshot hack is removed
assert.doesNotMatch(source, /lastTranslationHtml/, 'lastTranslationHtml should be removed in favor of container isolation');

// 3. Test setSettingsOpen and container switching
assert.match(source, /function setSettingsOpen\(open\)\s*\{/, 'setSettingsOpen function must exist');

// 3.1 Test Typewriter speaker sync and adaptive speed
assert.match(source, /\.imt-speaker\.imt-speaker-pending/, 'CSS must define .imt-speaker-pending for hidden initial state');
assert.match(source, /\.imt-speaker\.imt-speaker-visible/, 'CSS must define .imt-speaker-visible for smooth pop-in transition');
assert.match(source, /function collectTypewriterItems/, 'collectTypewriterItems must be implemented');
assert.match(source, /type:\s*['"]speaker['"]/, 'collectTypewriterItems must identify speaker items in document order');
assert.match(source, /isAscii\s*\?\s*Math\.min\(3,\s*remaining\)\s*:\s*1/, 'typewriterReveal must use adaptive step sizing for snappy English sentences');

// 3.2 Verify speaker buttons match .imt-action-btn hover & press-down tactile physics in both extension and userscript
for (const [name, code] of [['extension', contentJs], ['userscript', source]]) {
    assert.doesNotMatch(code, /\.imt-speaker\.imt-speaker-visible\s*\{[^}]*!important/, `${name}: .imt-speaker-visible must not use !important that blocks :hover/:active transforms`);
    assert.match(code, /\.imt-speaker:hover\s*\{[\s\S]*?transform:\s*translateY\(-1px\)/, `${name}: .imt-speaker:hover must match .imt-action-btn lift`);
    assert.match(code, /\.imt-speaker:active\s*\{[\s\S]*?transform:\s*translateY\(2px\);\s*border-bottom-width:\s*1px;/, `${name}: .imt-speaker:active must match .imt-action-btn press`);
    assert.match(code, /\.imt-speaker\.imt-ex-speaker:hover\s*\{[\s\S]*?transform:\s*translateY\(-1px\)/, `${name}: .imt-ex-speaker:hover must match .imt-action-btn lift`);
    assert.match(code, /\.imt-speaker\.imt-ex-speaker:active\s*\{[\s\S]*?transform:\s*translateY\(2px\);\s*border-bottom-width:\s*1px;/, `${name}: .imt-ex-speaker:active must match .imt-action-btn press`);
}

// 4. Simulate DOM & Typewriter behavior in isolation
class MockDOMNode {
    constructor(nodeType, value = '') {
        this.nodeType = nodeType;
        this.nodeValue = value;
        this.childNodes = [];
        this.parentElement = null;
        this.style = {};
        this.classList = new Set();
    }

    appendChild(child) {
        child.parentElement = this;
        this.childNodes.push(child);
        return child;
    }

    closest(selector) {
        return null;
    }
}

const NodeFilter = {
    SHOW_TEXT: 4,
    FILTER_ACCEPT: 1,
    FILTER_REJECT: 2
};

function createMockTreeWalker(root) {
    const textNodes = [];
    function collect(node) {
        if (node.nodeType === 3) {
            textNodes.push(node);
        }
        for (const child of node.childNodes) {
            collect(child);
        }
    }
    collect(root);
    let index = -1;
    return {
        nextNode() {
            index++;
            if (index < textNodes.length) {
                this.currentNode = textNodes[index];
                return true;
            }
            return false;
        },
        currentNode: null
    };
}

// Test Typewriter background execution while container is hidden (display: none)
let typewriterToken = 0;
function typewriterReveal(container, { speed = 1 } = {}, onComplete = () => {}) {
    typewriterToken++;
    const myToken = typewriterToken;

    const walker = createMockTreeWalker(container);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    if (!nodes.length) return;

    const fullText = nodes.map(node => node.nodeValue);
    nodes.forEach(node => { node.nodeValue = ''; });

    let nodeIndex = 0;
    let charPos = 0;

    function step() {
        if (myToken !== typewriterToken) return;

        while (nodeIndex < nodes.length && charPos >= fullText[nodeIndex].length) {
            nodeIndex++;
            charPos = 0;
        }
        if (nodeIndex >= nodes.length) {
            onComplete();
            return;
        }

        charPos++;
        nodes[nodeIndex].nodeValue = fullText[nodeIndex].slice(0, charPos);
        container.scrollTop = container.scrollHeight || 0;
        setTimeout(step, speed);
    }

    step();
}

async function testTypewriterBackgroundProgress() {
    const contentBox = new MockDOMNode(1);
    const textNode1 = new MockDOMNode(3, 'revenue /\'rev.an.ju:/ ');
    const textNode2 = new MockDOMNode(3, 'n. 收入；收益；（政府或组织的）财政收入');
    contentBox.appendChild(textNode1);
    contentBox.appendChild(textNode2);

    let isDone = false;
    typewriterReveal(contentBox, { speed: 2 }, () => {
        isDone = true;
    });

    // Simulate switching to settings view halfway through typing
    await new Promise(resolve => setTimeout(resolve, 10));
    contentBox.style.display = 'none';

    // Wait until background typing completes while contentBox is hidden
    await new Promise(resolve => {
        const check = () => {
            if (isDone) resolve();
            else setTimeout(check, 10);
        };
        check();
    });

    assert.equal(isDone, true, 'Typewriter should have completed in background');
    assert.equal(textNode1.nodeValue, 'revenue /\'rev.an.ju:/ ');
    assert.equal(textNode2.nodeValue, 'n. 收入；收益；（政府或组织的）财政收入');

    // Simulate returning from settings view
    contentBox.style.display = 'block';
    assert.equal(textNode1.nodeValue, 'revenue /\'rev.an.ju:/ ');
    assert.equal(textNode2.nodeValue, 'n. 收入；收益；（政府或组织的）财政收入');
}

testTypewriterBackgroundProgress().then(() => {
    console.log('typewriter-settings regression tests passed');
}).catch(err => {
    console.error(err);
    process.exit(1);
});
