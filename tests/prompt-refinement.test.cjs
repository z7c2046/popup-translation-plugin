const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const sourcePath = path.resolve(__dirname, '..', '划词翻译+生词高亮.txt');
const source = fs.readFileSync(sourcePath, 'utf8');

// 1. Extract SYSTEM_PROMPT from source
const promptMatch = source.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
assert.ok(promptMatch, 'SYSTEM_PROMPT should exist in script');
const systemPrompt = promptMatch[1];

// 2. Ensure synonyms and antonyms are NOT requested in Mode 1 & Mode 2
assert.doesNotMatch(systemPrompt, /"synonyms":/, 'SYSTEM_PROMPT must not request synonyms');
assert.doesNotMatch(systemPrompt, /"antonyms":/, 'SYSTEM_PROMPT must not request antonyms');
assert.doesNotMatch(systemPrompt, /English synonym/, 'SYSTEM_PROMPT must not contain synonym placeholder');
assert.doesNotMatch(systemPrompt, /English antonym/, 'SYSTEM_PROMPT must not contain antonym placeholder');

// 3. Ensure essential fields are preserved
assert.match(systemPrompt, /"pos":/, 'SYSTEM_PROMPT must keep pos (part of speech)');
assert.match(systemPrompt, /"meaning":/, 'SYSTEM_PROMPT must keep meaning in Mode 1');
assert.match(systemPrompt, /"translation":/, 'SYSTEM_PROMPT must keep translation in Mode 2');
assert.match(systemPrompt, /"examples":/, 'SYSTEM_PROMPT must keep bilingual examples');
assert.match(systemPrompt, /"phonetic":/, 'SYSTEM_PROMPT must keep phonetic symbol');

// 4. Ensure explicit negative constraint is in place
assert.match(systemPrompt, /Do NOT include synonyms, antonyms/i, 'SYSTEM_PROMPT should include explicit rule forbidding synonyms/antonyms');

// 5. Ensure rendering logic does not render synonyms or antonyms
const renderWordMatch = source.match(/if \(data\.mode === "en_word"\) \{([\s\S]*?)return html;\s*\}/);
assert.ok(renderWordMatch, 'en_word render block must exist');
assert.doesNotMatch(renderWordMatch[1], /同义词/);
assert.doesNotMatch(renderWordMatch[1], /反义词/);

console.log('AI translation prompt refinement tests passed successfully!');

