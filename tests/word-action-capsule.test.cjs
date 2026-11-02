/**
 * 全局网页/例句单词点击高亮与 [读音 | AI解释] 悬浮操作胶囊测试套件
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'popup-translation-extension');
const contentSrc = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
const userscriptSrc = fs.readFileSync(path.join(root, '划词翻译+生词高亮.txt'), 'utf8');

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source boundary missing: ${start}`);
  return source.slice(a, b).trim();
}

(async () => {
  // 1. 验证双端均包含单词点击激活样式与操作胶囊组件
  for (const [name, code] of [['content.js', contentSrc], ['userscript', userscriptSrc]]) {
    assert.ok(code.includes('imt-word-click-active'), `${name} must contain .imt-word-click-active highlight class`);
    assert.ok(code.includes('border-bottom: 1.5px dashed #2563eb'), `${name} must contain dashed underline styling`);
    assert.ok(code.includes('background: #e6f7f8'), `${name} must contain cyan highlight background`);
    assert.ok(code.includes('.imt-word-action-capsule {'), `${name} must contain capsule CSS declaration`);
    assert.ok(code.includes('imt-word-action-capsule'), `${name} must contain wordActionCapsule DOM declaration`);
    assert.ok(code.includes('imt-capsule-btn-audio'), `${name} must contain audio button inside capsule`);
    assert.ok(code.includes('imt-capsule-btn-ai'), `${name} must contain AI explain button inside capsule`);
    assert.ok(code.includes('extractWordFromTextOffset'), `${name} must include extractWordFromTextOffset function`);
    assert.ok(code.includes('clearActiveWordHighlight'), `${name} must include clearActiveWordHighlight function`);
    assert.ok(code.includes('showWordActionCapsule'), `${name} must include showWordActionCapsule function`);
    assert.ok(code.includes('isClickInsideCapsule'), `${name} must include isClickInsideCapsule function`);
    assert.ok(code.includes('executeCapsuleExplain'), `${name} must include executeCapsuleExplain function`);
    assert.ok(code.includes('capsuleAiBtn.dataset.word'), `${name} must persist word to dataset`);
  }

  // 2. 提取 extractWordFromTextOffset 函数并在 vm 中进行全场景单词识别断言
  const fnCode = section(contentSrc, 'function extractWordFromTextOffset(', 'function showWordActionCapsule(');
  const context = vm.createContext({});
  vm.runInContext(fnCode, context);
  const extract = context.extractWordFromTextOffset;
  assert.equal(typeof extract, 'function', 'extractWordFromTextOffset must be an executable function');

  // 测试用例 1：图片原句 "Department of Justice has no authority to stop voting ."
  const sentence = "Department of Justice has no authority to stop voting .";
  const authRes = extract(sentence, sentence.indexOf('authority') + 2);
  assert.ok(authRes, 'Should extract authority');
  assert.equal(authRes.word, 'authority');
  assert.equal(sentence.slice(authRes.start, authRes.end), 'authority');

  // 测试用例 2：连字符复合词 "non-citizens"
  const hyphenSent = "measures have been taken to prevent non-citizens from voting";
  const hyphenRes = extract(hyphenSent, hyphenSent.indexOf('non-citizens') + 4);
  assert.ok(hyphenRes, 'Should extract non-citizens');
  assert.equal(hyphenRes.word, 'non-citizens');

  // 测试用例 3：缩写单词 "doesn't"
  const quoteSent = "The court doesn't agree with the motion.";
  const quoteRes = extract(quoteSent, quoteSent.indexOf("doesn't") + 2);
  assert.ok(quoteRes, 'Should extract doesn\'t');
  assert.equal(quoteRes.word, "doesn't");

  // 测试用例 4：纯空格或句点标点符号不误触发
  assert.equal(extract(sentence, sentence.length - 1), null, 'Trailing dot must not produce word');
  assert.equal(extract("hello     world", 6), null, 'Whitespace must not produce word');

  // 测试用例 5：单个字母或非法数字符号过滤
  assert.equal(extract("item 12345 test", 6), null, 'Pure numbers must be ignored');
  assert.equal(extract("a quick brown fox", 0), null, 'Single letter a must be ignored (length < 2)');

  // 3. 验证与生词高亮及拖拽选区的互斥逻辑
  assert.ok(contentSrc.includes('clearTimeout(highlightPopupHideTimeout)'), 'Must close highlight hover popup on word click');
  assert.ok(contentSrc.includes('closeHighlightPopup()'), 'Must call closeHighlightPopup on word click');
  assert.ok(contentSrc.includes('Math.hypot(e.clientX - lastMouseDownCoords.x'), 'Must measure mouse movement to separate drag selection from single click');

  console.log('All word action capsule unit, extraction, and conflict-prevention tests passed successfully! 🎯');
})().catch(err => {
  console.error('Word action capsule test failed:', err);
  process.exit(1);
});
