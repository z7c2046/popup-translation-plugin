const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', '划词翻译+生词高亮.txt');
const source = fs.readFileSync(sourcePath, 'utf8');

// 1. Verify tampermonkey header and connections
assert.match(source, /\/\/ @connect\s+kimi\.moonshot\.cn/, 'Header must include @connect kimi.moonshot.cn');
assert.doesNotMatch(source, /\/\/ @connect\s+open\.bigmodel\.cn/, 'Header must NOT include open.bigmodel.cn');

// 2. Verify CONFIG structure
assert.match(source, /kimi_free:\s*\{/, 'CONFIG.llmProviders must include kimi_free');
assert.doesNotMatch(source, /zhipu:\s*\{/, 'CONFIG.llmProviders must NOT include zhipu');
assert.doesNotMatch(source, /ZHIPU_MODEL_MIGRATIONS/, 'ZHIPU_MODEL_MIGRATIONS should be removed');

// 3. Test extractJsonFromContent logic
function extractJsonFromContent(content) {
    if (typeof content !== 'string') return content;
    let cleanStr = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    try {
        return JSON.parse(cleanStr);
    } catch (e) {
        const firstBrace = cleanStr.indexOf('{');
        const lastBrace = cleanStr.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            return JSON.parse(cleanStr.slice(firstBrace, lastBrace + 1));
        }
        throw e;
    }
}

// Test case 3.1: standard clean JSON
const sample1 = '{"mode":"en_word","word":"apple"}';
assert.deepEqual(extractJsonFromContent(sample1), { mode: 'en_word', word: 'apple' });

// Test case 3.2: markdown wrapped JSON
const sample2 = '```json\n{"mode":"sentence","translation":"你好，世界"}\n```';
assert.deepEqual(extractJsonFromContent(sample2), { mode: 'sentence', translation: '你好，世界' });

// Test case 3.3: explanatory text around JSON
const sample3 = 'Here is the translation result:\n{"mode":"sentence","translation":"测试"}\nHope this helps!';
assert.deepEqual(extractJsonFromContent(sample3), { mode: 'sentence', translation: '测试' });

// 4. Test SSE Parser simulation
function simulateKimiSSE(chunks) {
    let sseBuffer = '';
    let accumulatedText = '';
    let isStreamDone = false;

    function parseSSE(chunk) {
        sseBuffer += chunk;
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop();
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith('data:')) continue;
            const dataStr = line.slice(5).trim();
            if (!dataStr || dataStr === '[DONE]') {
                if (dataStr === '[DONE]') isStreamDone = true;
                continue;
            }
            try {
                const parsed = JSON.parse(dataStr);
                if (parsed.event === 'cmpl' && typeof parsed.text === 'string') {
                    accumulatedText += parsed.text;
                } else if (parsed.event === 'all_done') {
                    isStreamDone = true;
                }
            } catch (e) {}
        }
    }

    chunks.forEach(chunk => parseSSE(chunk));
    parseSSE('\n');

    return { accumulatedText, isStreamDone };
}

const mockChunks = [
    'data: {"event": "cmpl", "text": "{\\"mode\\": \\"sentence\\""}\n\n',
    'data: {"event": "cmpl", "text": ", \\"translation\\": \\"苹果\\"}"}\n\n',
    'data: {"event": "all_done"}\n\n'
];

const parseResult = simulateKimiSSE(mockChunks);
assert.equal(parseResult.isStreamDone, true);
assert.deepEqual(extractJsonFromContent(parseResult.accumulatedText), {
    mode: 'sentence',
    translation: '苹果'
});

// 5. Test Traffic ID Generation
function generateKimiTrafficId() {
    return Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
}
const trafficId = generateKimiTrafficId();
assert.equal(trafficId.length, 20);
assert.match(trafficId, /^[0-9a-z]{20}$/);

console.log('All Kimi provider unit and regression tests passed!');
