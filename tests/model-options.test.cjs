const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', '划词翻译+生词高亮.txt');
const source = fs.readFileSync(sourcePath, 'utf8');

// Verify that only the 4 free models exist in sf-model-select
const expectedModels = [
    'Qwen/Qwen2.5-7B-Instruct',
    'Qwen/Qwen3.5-4B',
    'Qwen/Qwen3-8B',
    'THUDM/GLM-4-9B-0414'
];

expectedModels.forEach(model => {
    assert.ok(source.includes(`value="${model}"`), `Script must include model option: ${model}`);
});

// Verify that all paid or obsolete models are NOT present in sf-model-select
const removedModels = [
    'deepseek-ai/DeepSeek-V3',
    'deepseek-ai/DeepSeek-V3.2',
    'Qwen/Qwen3.5-9B',
    'Qwen/Qwen3-VL-32B-Instruct'
];

removedModels.forEach(model => {
    assert.ok(!source.includes(`value="${model}"`), `Script must NOT include removed model option: ${model}`);
});

// Verify fallback safeguard exists and defaults to a valid free model
assert.match(source, /VALID_SF_MODELS/, 'Script must define VALID_SF_MODELS safeguard');
assert.match(source, /!VALID_SF_MODELS\.includes\(initialSfModel\)/, 'Script must validate initialSfModel');
assert.doesNotMatch(source, /initialSfModel = "deepseek/, 'Default fallback must not point to DeepSeek');

console.log('SiliconFlow all-free model roster and safeguard tests passed!');
