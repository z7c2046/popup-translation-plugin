/**
 * LexiPro - Options Script
 * 遵循 GEMINI_TRANSLATION_UX_BLUEPRINT 规范：真实保存语义、静态排版预览、深浅自适应与请求连通性测试
 */

const DEFAULT_CONFIG = {
  lexipro_ui_theme: 'market_desk',
  lexipro_sf_model: 'Qwen/Qwen2.5-7B-Instruct',
  lexipro_sf_api_key: '',
  lexipro_disable_thinking: true,
  lexipro_auto_pronounce: false,
  lexipro_notion_token: '',
  lexipro_notion_database_id: '',
  lexipro_site_translation_style: 'replace',
  lexipro_site_auto_translate: false
};

document.addEventListener('DOMContentLoaded', async () => {
  const themeSelect = document.getElementById('ui-theme-select');
  const modelSelect = document.getElementById('sf-model-select');
  const keyInput = document.getElementById('sf-key-input');
  const btnToggleKey = document.getElementById('btn-toggle-sf-key');
  const thinkingCheck = document.getElementById('disable-thinking-check');
  const autoPronounceCheck = document.getElementById('auto-pronounce-check');
  const notionTokenInput = document.getElementById('notion-token-input');
  const notionDbInput = document.getElementById('notion-db-input');
  const siteStyleSelect = document.getElementById('site-style-select');
  const siteAutoTranslateCheck = document.getElementById('site-auto-translate-check');

  const btnTestSf = document.getElementById('btn-test-sf');
  const testSfResult = document.getElementById('test-sf-result');
  const btnToggleNotionToken = document.getElementById('btn-toggle-notion-token');
  const btnTestNotion = document.getElementById('btn-test-notion');
  const testNotionResult = document.getElementById('test-notion-result');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const saveMsg = document.getElementById('save-msg');
  const previewBox = document.getElementById('preview-box');

  // 规范化提取 32 位 Notion Database ID (去横杠与 URL 前后缀)
  function cleanDatabaseId(raw) {
    if (!raw) return '';
    const trimmed = String(raw).trim();
    const match = trimmed.match(/([a-f0-9]{32})/i) || trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
    if (match) {
      return match[1].replace(/-/g, '');
    }
    return trimmed;
  }

  // 读取配置
  const stored = await chrome.storage.local.get(DEFAULT_CONFIG);
  fillForm(stored);
  updatePreview();

  // 密码显示/隐藏切换
  btnToggleKey.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      btnToggleKey.innerText = '🔒';
    } else {
      keyInput.type = 'password';
      btnToggleKey.innerText = '👁️';
    }
  });

  // 本地实时排版效果预览 (零网络消耗)
  function updatePreview() {
    if (!previewBox) return;
    const style = siteStyleSelect.value || 'replace';
    const isDark = (themeSelect.value === 'market_desk' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const items = [
      {
        orig: 'Revenue for the third quarter may rise by 5% amid robust data center demand.',
        trans: '得益于数据中心强劲的需求，第三季度营收可能增长 5% 保留。'
      },
      {
        orig: 'I keep holding my shares because the chip supply cycle is clearly turning upward.',
        trans: '我继续持有股票，因为芯片供应周期显然正在向上反转。'
      }
    ];

    if (style === 'replace') {
      previewBox.innerHTML = items.map((it, idx) => `
        <div style="margin-bottom: 10px; font-size: 14px; line-height: 1.6; color: ${isDark ? '#E5EAF0' : '#20252B'};">
          <span>${it.trans}</span>
          <span style="display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; padding: 1px 6px; font-size: 11px; border-radius: 5px; border: 1px solid ${isDark ? '#3B4551' : '#CBD5E1'}; background: ${isDark ? '#2A313A' : '#EEF2F6'}; color: ${isDark ? '#8DB4FF' : '#285FBA'}; cursor: pointer;">⇄ 原文</span>
        </div>
      `).join('');
    } else if (style === 'underline') {
      previewBox.innerHTML = items.map((it, idx) => `
        <div style="margin-bottom: 12px; font-size: 14px; line-height: 1.5;">
          <div style="color: ${isDark ? '#AAB4C0' : '#4B5563'};">${it.orig}</div>
          <div style="border-bottom: 1.5px dashed ${isDark ? '#8DB4FF' : '#285FBA'}; color: ${isDark ? '#E5EAF0' : '#20252B'}; padding-bottom: 2px; margin-top: 3px;">${it.trans}</div>
        </div>
      `).join('');
    } else if (style === 'card') {
      previewBox.innerHTML = items.map((it, idx) => `
        <div style="margin-bottom: 12px; font-size: 13.5px;">
          <div style="color: ${isDark ? '#AAB4C0' : '#4B5563'}; margin-bottom: 4px;">${it.orig}</div>
          <div style="background: ${isDark ? '#20252C' : '#FFFFFF'}; border: 1px solid ${isDark ? '#3B4551' : '#DCE2E9'}; border-left: 3px solid ${isDark ? '#8DB4FF' : '#285FBA'}; border-radius: 6px; padding: 6px 10px; color: ${isDark ? '#E5EAF0' : '#20252B'};">
            <span style="font-size: 10.5px; font-weight: bold; color: ${isDark ? '#8DB4FF' : '#285FBA'}; margin-right: 6px;">[译文]</span>${it.trans}
          </div>
        </div>
      `).join('');
    }
  }

  siteStyleSelect.addEventListener('change', updatePreview);
  themeSelect.addEventListener('change', updatePreview);

  // 测试 API 连通性
  btnTestSf.addEventListener('click', async () => {
    testSfResult.innerText = '正在测试连接...';
    testSfResult.className = 'test-result';

    const testBody = {
      model: modelSelect.value,
      messages: [
        { role: 'system', content: 'You are a professional translator. Return only the translated text.' },
        { role: 'user', content: 'Translate to Chinese: The system is ready.' }
      ],
      temperature: 0.1
    };

    if (thinkingCheck.checked) {
      testBody.enable_thinking = false;
      testBody.thinking = { type: 'disabled' };
    }

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GM_XHR',
        details: {
          url: 'https://api.siliconflow.cn/v1/chat/completions',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${keyInput.value.trim() || DEFAULT_CONFIG.lexipro_sf_api_key}`
          },
          data: JSON.stringify(testBody)
        }
      });

      if (res && res.success && res.response?.status >= 200 && res.response?.status < 300) {
        const json = JSON.parse(res.response.responseText);
        const trans = json.choices?.[0]?.message?.content || '';
        testSfResult.innerText = `✅ 连接成功！模型响应: "${trans.trim()}"`;
        testSfResult.className = 'test-result text-success';
      } else {
        throw new Error(res?.response?.responseText || res?.error || '请求失败');
      }
    } catch (err) {
      testSfResult.innerText = `❌ 连接失败: ${err.message || err}`;
      testSfResult.className = 'test-result text-error';
    }
  });

  // Notion Token 密码显示/隐藏切换
  btnToggleNotionToken?.addEventListener('click', () => {
    if (notionTokenInput.type === 'password') {
      notionTokenInput.type = 'text';
      btnToggleNotionToken.innerText = '🔒';
    } else {
      notionTokenInput.type = 'password';
      btnToggleNotionToken.innerText = '👁️';
    }
  });

  // 测试 Notion 知识库 API 连通性
  btnTestNotion?.addEventListener('click', async () => {
    const rawToken = notionTokenInput.value.trim();
    const rawDb = cleanDatabaseId(notionDbInput.value);
    notionDbInput.value = rawDb;

    if (!rawToken || !rawDb) {
      testNotionResult.innerText = '⚠️ 请先填写完整的 Notion Token 与 Database ID';
      testNotionResult.className = 'test-result text-error';
      return;
    }

    testNotionResult.innerText = '正在测试连接 Notion API...';
    testNotionResult.className = 'test-result';

    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GM_XHR',
        details: {
          url: `https://api.notion.com/v1/databases/${rawDb}`,
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${rawToken}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          }
        }
      });

      if (res && res.success && res.response?.status >= 200 && res.response?.status < 300) {
        let dbTitle = '未命名数据库';
        try {
          const json = JSON.parse(res.response.responseText);
          const titleArr = json.title || [];
          dbTitle = titleArr.map(t => t.plain_text).join('') || '未命名生词库';
        } catch (e) {}
        testNotionResult.innerText = `✅ 连接成功！已连通知识库: 「${dbTitle}」`;
        testNotionResult.className = 'test-result text-success';
      } else {
        const status = res?.response?.status;
        let errMsg = `连接失败 (HTTP ${status || 'Error'})`;
        if (status === 401) {
          errMsg = 'Token 无效或已失效 (HTTP 401 Unauthorized)';
        } else if (status === 404) {
          errMsg = '未找到该数据库 (HTTP 404)。请确保在 Notion 页面右上角将此数据库 Connect/Share 给了您创建的 Integration！';
        }
        throw new Error(errMsg);
      }
    } catch (err) {
      testNotionResult.innerText = `❌ ${err.message || err}`;
      testNotionResult.className = 'test-result text-error';
    }
  });

  // 保存配置（遵循蓝图 P1-13：真实保存，清空即清空，不暗中回填内置 Key）
  btnSave.addEventListener('click', async () => {
    const cleanedDbId = cleanDatabaseId(notionDbInput.value);
    notionDbInput.value = cleanedDbId;

    const toSave = {
      lexipro_ui_theme: themeSelect ? themeSelect.value : 'market_desk',
      lexipro_sf_model: modelSelect.value,
      lexipro_sf_api_key: keyInput.value.trim(),
      lexipro_disable_thinking: thinkingCheck.checked,
      lexipro_auto_pronounce: autoPronounceCheck ? autoPronounceCheck.checked : false,
      lexipro_notion_token: notionTokenInput.value.trim(),
      lexipro_notion_database_id: cleanedDbId,
      lexipro_site_translation_style: siteStyleSelect.value,
      lexipro_site_auto_translate: siteAutoTranslateCheck.checked
    };

    await chrome.storage.local.set(toSave);
    saveMsg.innerText = '✅ 配置已成功保存！已向页面广播热更新。';
    saveMsg.className = 'save-msg text-success';
    setTimeout(() => { saveMsg.innerText = ''; }, 3000);
  });

  // 恢复出厂默认配置
  btnReset.addEventListener('click', async () => {
    if (confirm('确定要恢复出厂默认设置吗？')) {
      await chrome.storage.local.set(DEFAULT_CONFIG);
      fillForm(DEFAULT_CONFIG);
      updatePreview();
      saveMsg.innerText = '已恢复出厂默认设置';
      saveMsg.className = 'save-msg';
      setTimeout(() => { saveMsg.innerText = ''; }, 2500);
    }
  });

  function fillForm(cfg) {
    if (themeSelect) themeSelect.value = cfg.lexipro_ui_theme || 'market_desk';
    modelSelect.value = cfg.lexipro_sf_model || DEFAULT_CONFIG.lexipro_sf_model;
    keyInput.value = cfg.lexipro_sf_api_key || '';
    thinkingCheck.checked = cfg.lexipro_disable_thinking !== false;
    if (autoPronounceCheck) autoPronounceCheck.checked = Boolean(cfg.lexipro_auto_pronounce);
    notionTokenInput.value = cfg.lexipro_notion_token || '';
    notionDbInput.value = cfg.lexipro_notion_database_id || '';
    siteStyleSelect.value = cfg.lexipro_site_translation_style || 'replace';
    siteAutoTranslateCheck.checked = Boolean(cfg.lexipro_site_auto_translate);
  }
});
