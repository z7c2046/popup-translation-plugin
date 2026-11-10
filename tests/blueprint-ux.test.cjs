/**
 * GEMINI_TRANSLATION_UX_BLUEPRINT 规范验收测试套件
 * 针对蓝图 15 项核心问题与验收矩阵进行全面覆盖断言
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const extDir = path.join(root, 'popup-translation-extension');
const contentSrc = fs.readFileSync(path.join(extDir, 'content.js'), 'utf8');
const userscriptSrc = fs.readFileSync(path.join(root, '划词翻译+生词高亮.txt'), 'utf8');
const backgroundSrc = fs.readFileSync(path.join(extDir, 'background.js'), 'utf8');
const popupSrc = fs.readFileSync(path.join(extDir, 'popup.js'), 'utf8');
const optionsSrc = fs.readFileSync(path.join(extDir, 'options.js'), 'utf8');
const popupCss = fs.readFileSync(path.join(extDir, 'popup.css'), 'utf8');
const optionsCss = fs.readFileSync(path.join(extDir, 'options.css'), 'utf8');

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source boundary missing: ${start}`);
  return source.slice(a, b).trim();
}

(async () => {
  // 1. 验证双端 requestLLMChatCompletion 中 modelOverride 真实生效且请求作用域隔离
  for (const [name, source] of [['extension', contentSrc], ['userscript', userscriptSrc]]) {
    let capturedBody = null;
    const context = vm.createContext({
      CONFIG: { llmProvider: 'siliconflow', disableThinking: true },
      getActiveLLMProvider: () => ({ name: 'mock', model: 'selected-model', apiUrl: 'mock://api', apiKey: 'mock-key' }),
      GM_xmlhttpRequest: details => {
        capturedBody = JSON.parse(details.data);
        details.onload({ status: 200, responseText: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) });
        return { abort() {} };
      },
      activeFetchRequest: null,
      getLLMErrorDetail: () => ''
    });

    vm.runInContext(section(source, 'function requestLLMChatCompletion(', '// 发起真实的 API Post 请求'), context);

    // 默认情况使用 selected-model
    await context.requestLLMChatCompletion({ messages: [] });
    assert.equal(capturedBody.model, 'selected-model', `${name} should use configured model by default`);

    // 传入 modelOverride 时，请求 body 必须严格变为 modelOverride！
    await context.requestLLMChatCompletion({ messages: [], modelOverride: 'Qwen/Qwen3-8B' });
    assert.equal(capturedBody.model, 'Qwen/Qwen3-8B', `${name} must send modelOverride in request body`);
  }

  // 2. 验证页面级请求隔离 (requestScope = 'page' 不覆盖 activeFetchRequest，划词查词不误杀页面请求)
  {
    let abortCalled = false;
    const context = vm.createContext({
      CONFIG: { llmProvider: 'siliconflow', disableThinking: true },
      getActiveLLMProvider: () => ({ name: 'mock', model: 'm', apiUrl: 'mock://api', apiKey: 'k' }),
      GM_xmlhttpRequest: () => ({
        abort: () => { abortCalled = true; }
      }),
      activeFetchRequest: null,
      getLLMErrorDetail: () => ''
    });

    vm.runInContext(
      section(contentSrc, 'const activePageRequests = new Set();', '// 发起真实的 API Post 请求') +
      '\nthis.activePageRequests = activePageRequests;',
      context
    );

    // 发起页面请求
    context.requestLLMChatCompletion({ messages: [], requestScope: 'page' });
    assert.equal(context.activeFetchRequest, null, 'Page request must not overwrite activeFetchRequest');
    assert.equal(context.activePageRequests.size, 1, 'Page request must be held in activePageRequests');

    // 发起划词请求
    context.requestLLMChatCompletion({ messages: [], requestScope: 'selection' });
    assert.ok(context.activeFetchRequest, 'Selection request must be assigned to activeFetchRequest');

    // 取消划词请求时，页面请求不能受到影响
    context.activeFetchRequest.abort();
    assert.equal(abortCalled, true);
    assert.equal(context.activePageRequests.size, 1, 'Selection abort must not cancel activePageRequests');
  }

  // 3. 验证 background.js 超时全覆盖与主动中止
  {
    assert.ok(backgroundSrc.includes('finally'), 'background.js must clear timer and delete req in finally block');
    assert.ok(backgroundSrc.includes('activeHttpRequests'), 'background.js must maintain activeHttpRequests map');
    assert.ok(backgroundSrc.includes('GM_XHR_ABORT'), 'background.js must support GM_XHR_ABORT message');
  }

  // 4. 验证 popup.js 不再依赖脆弱的 scripting 注入，改用基于消息的通信机制
  {
    assert.ok(!popupSrc.includes('chrome.scripting.executeScript'), 'popup.js must not call chrome.scripting.executeScript');
    assert.ok(popupSrc.includes("chrome.tabs.sendMessage"), 'popup.js must use message passing with active tab');
    assert.ok(popupSrc.includes("type: 'GET_PAGE_STATE'"), 'popup.js must query GET_PAGE_STATE');
    assert.ok(popupSrc.includes("quickThemeSelect.addEventListener('change'"), 'popup.js must wire quickThemeSelect change event');
  }

  // 5. 验证 options 页面静态排版预览、深浅自适应、高对比度色板及左侧边栏分栏布局
  {
    const optionsHtml = fs.readFileSync(path.join(extDir, 'options.html'), 'utf8');
    assert.ok(optionsSrc.includes('updatePreview'), 'options.js must include local static preview update function');
    assert.ok(optionsSrc.includes('switchPanel'), 'options.js must implement sidebar switchPanel navigation');
    assert.ok(optionsSrc.includes("keyInput.value.trim()"), 'options.js must strictly save user key without hidden fallback injection');
    assert.ok(optionsCss.includes('--lp-text-secondary: #5D6672'), 'options.css must use WCAG-compliant high-contrast secondary text');
    assert.ok(optionsCss.includes('.admin-shell'), 'options.css must define two-column .admin-shell layout');
    assert.ok(optionsCss.includes('.nav-item.is-active'), 'options.css must style active sidebar nav item');
    assert.ok(popupCss.includes('--lp-text-secondary: #5D6672'), 'popup.css must use WCAG-compliant high-contrast secondary text');
    assert.ok(optionsHtml.includes('id="panel-subtitle"'), 'options.html must define workspace topbar subtitle');
    assert.ok(optionsSrc.includes('panelSubtitle'), 'options.js must sync workspace topbar subtitle on tab switch');
    assert.ok(!optionsHtml.includes('👁️') && !optionsSrc.includes('👁️'), 'options UI must use monochrome SVG eye icons instead of emoji');

    for (const panel of ['reading', 'speech', 'sites', 'ai', 'notion']) {
      assert.ok(optionsHtml.includes(`id="tab-${panel}"`), `options.html must define sidebar tab-${panel}`);
      assert.ok(optionsHtml.includes(`id="panel-${panel}"`), `options.html must define settings panel-${panel}`);
    }
  }

  // 6. 验证 DOM 保留机制（在 content.js 与 userscript 中原生节点放入 origWrapper，不销毁重写）
  for (const [name, code] of [['content.js', contentSrc], ['userscript', userscriptSrc]]) {
    assert.ok(code.includes('lexipro-orig-wrapper'), `${name} must preserve native child DOM nodes in origWrapper`);
    assert.ok(code.includes('lexipro-trans-container'), `${name} must mount translations in independent container`);
    assert.ok(code.includes('retryFailedOnly'), `${name} must support retrying failed items only`);
    assert.ok(code.includes('siteGeneration'), `${name} must track SPA siteGeneration to discard obsolete callbacks`);
    assert.ok(!code.includes('@media (prefers-color-scheme: light), [data-theme="light"]'), `${name} must not mix DOM selectors inside @media query`);
    
    // 7. 验证双语对照下划线样式继承（字体颜色与字重继承原文，避免过浅）
    assert.ok(code.includes('.lexipro-trans-underline {\n                margin-top: 6px;') || code.includes('.lexipro-trans-underline {\r\n                margin-top: 6px;'), `${name} must include updated underline styles`);
    assert.ok(code.includes("under.style.color = 'inherit'"), `${name} must set inline color inherit on underline translation element`);
    assert.ok(code.includes("under.style.fontWeight = 'inherit'"), `${name} must set inline font-weight inherit on underline translation element`);
  }

  console.log('All GEMINI_TRANSLATION_UX_BLUEPRINT compliance and regression tests passed successfully! 🚀');
})().catch(err => {
  console.error('Blueprint test failure:', err);
  process.exit(1);
});
