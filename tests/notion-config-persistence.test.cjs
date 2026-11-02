/**
 * Notion Config Persistence and Safe Migration Unit & Regression Test Suite
 * 验证 Notion Token 与 Database ID 保存、读取、热更新与安全防自清空机制
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Notion Config Persistence: options.html & options.js align with blueprint requirements', () => {
    const optionsHtml = fs.readFileSync(path.join(__dirname, '../popup-translation-extension/options.html'), 'utf8');
    const optionsJs = fs.readFileSync(path.join(__dirname, '../popup-translation-extension/options.js'), 'utf8');

    // 1. 验证 HTML 中包含 Token、Database ID、密码显隐切换按钮和连通性测试按钮
    assert.match(optionsHtml, /id="notion-token-input"/, 'options.html 必须包含 notion-token-input');
    assert.match(optionsHtml, /id="notion-db-input"/, 'options.html 必须包含 notion-db-input');
    assert.match(optionsHtml, /id="btn-toggle-notion-token"/, 'options.html 必须包含 btn-toggle-notion-token');
    assert.match(optionsHtml, /id="btn-test-notion"/, 'options.html 必须包含 btn-test-notion 连通性测试按钮');
    assert.match(optionsHtml, /id="test-notion-result"/, 'options.html 必须包含 test-notion-result');

    // 2. 验证 options.js 中包含 cleanDatabaseId 规范化提取
    assert.match(optionsJs, /function cleanDatabaseId/, 'options.js 必须包含 cleanDatabaseId 函数');
    assert.match(optionsJs, /btnToggleNotionToken\?\.addEventListener/, 'options.js 必须绑定密码眼睛显隐切换');
    assert.match(optionsJs, /btnTestNotion\?\.addEventListener/, 'options.js 必须绑定 Notion 连通性测试事件');
    assert.match(optionsJs, /https:\/\/api\.notion\.com\/v1\/databases\//, 'options.js 测试连通性必须请求 Notion databases API');
    assert.match(optionsJs, /lexipro_notion_token:\s*notionTokenInput\.value\.trim\(\)/, 'options.js 保存必须保存 notion token');
    assert.match(optionsJs, /lexipro_notion_database_id:\s*cleanedDbId/, 'options.js 保存必须保存规范化后的 database id');
});

test('Notion Safe Migration: content.js & userscript do not wipe valid user configurations on refresh', () => {
    const contentJs = fs.readFileSync(path.join(__dirname, '../popup-translation-extension/content.js'), 'utf8');
    const userscript = fs.readFileSync(path.join(__dirname, '../划词翻译+生词高亮.txt'), 'utf8');

    [contentJs, userscript].forEach((code, idx) => {
        const fileLabel = idx === 0 ? 'content.js' : '划词翻译+生词高亮.txt';

        // 验证绝不包含破坏性的 !initialNotionToken 触发置空逻辑
        assert.doesNotMatch(
            code,
            /if\s*\(!initialNotionToken\s*\|\|\s*initialNotionToken\s*===/,
            `${fileLabel} 严禁包含如果 Token 为空就覆写置空的破坏性自清空条件`
        );
        assert.doesNotMatch(
            code,
            /if\s*\(!initialNotionDbId\s*\|\|/,
            `${fileLabel} 严禁包含如果 Database ID 为空就覆写置空的破坏性条件`
        );

        // 验证只针对特定已废弃硬编码测试 token 做必要清理
        assert.match(
            code,
            /initialNotionToken === 'REDACTED_LEGACY_NOTION_TOKEN'/,
            `${fileLabel} 必须只针对已知失效测试 Token 做迁移`
        );

        // 验证弹窗设置面板内增加了 Notion 配置输入项
        assert.match(code, /id="imt-notion-token"/, `${fileLabel} 弹窗设置必须包含 imt-notion-token`);
        assert.match(code, /id="imt-notion-db"/, `${fileLabel} 弹窗设置必须包含 imt-notion-db`);
        assert.match(code, /function onNotionConfigChange/, `${fileLabel} 弹窗设置必须包含 onNotionConfigChange 回调`);

        // 验证 storage 热更新处理
        assert.match(code, /key === 'lexipro_notion_token'/, `${fileLabel} 必须监听 lexipro_notion_token 热更新`);
        assert.match(code, /key === 'lexipro_notion_database_id'/, `${fileLabel} 必须监听 lexipro_notion_database_id 热更新`);
    });
});

test('Notion Database ID extraction logic cleans various URL and UUID formats correctly', () => {
    function cleanDatabaseId(raw) {
        if (!raw) return '';
        const trimmed = String(raw).trim();
        const match = trimmed.match(/([a-f0-9]{32})/i) || trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
        if (match) {
            return match[1].replace(/-/g, '');
        }
        return trimmed;
    }

    const standardId = '11112222333344445555666677778888';
    assert.strictEqual(cleanDatabaseId('11112222333344445555666677778888'), standardId);
    assert.strictEqual(cleanDatabaseId('11112222-3333-4444-5555-666677778888'), standardId);
    assert.strictEqual(
        cleanDatabaseId('https://www.notion.so/myworkspace/11112222333344445555666677778888?v=123456'),
        standardId
    );
    assert.strictEqual(
        cleanDatabaseId('https://notion.so/11112222-3333-4444-5555-666677778888?pvs=4'),
        standardId
    );
});

