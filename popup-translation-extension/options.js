/**
 * LexiPro - Options Script
 */

const DEFAULT_CONFIG = {
  lexipro_sf_model: 'Qwen/Qwen2.5-7B-Instruct',
  lexipro_sf_api_key: '',
  lexipro_disable_thinking: true,
  lexipro_notion_token: 'REDACTED_LEGACY_NOTION_TOKEN',
  lexipro_notion_database_id: '11112222333344445555666677778888',
  lexipro_site_translation_style: 'replace',
  lexipro_site_auto_translate: false
};

document.addEventListener('DOMContentLoaded', async () => {
  const modelSelect = document.getElementById('sf-model-select');
  const keyInput = document.getElementById('sf-key-input');
  const btnToggleKey = document.getElementById('btn-toggle-sf-key');
  const thinkingCheck = document.getElementById('disable-thinking-check');
  const notionTokenInput = document.getElementById('notion-token-input');
  const notionDbInput = document.getElementById('notion-db-input');
  const siteStyleSelect = document.getElementById('site-style-select');
  const siteAutoTranslateCheck = document.getElementById('site-auto-translate-check');

  const btnTestSf = document.getElementById('btn-test-sf');
  const testSfResult = document.getElementById('test-sf-result');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const saveMsg = document.getElementById('save-msg');

  // 读取配置
  const stored = await chrome.storage.local.get(DEFAULT_CONFIG);
  fillForm(stored);

  // 密码显示切换
  btnToggleKey.addEventListener('click', () => {
    if (keyInput.type === 'password') {
      keyInput.type = 'text';
      btnToggleKey.innerText = '🔒';
    } else {
      keyInput.type = 'password';
      btnToggleKey.innerText = '👁️';
    }
  });

  // 测试 API
  btnTestSf.addEventListener('click', async () => {
    testSfResult.innerText = '正在测试连接...';
    testSfResult.className = 'test-result';

    const testBody = {
      model: modelSelect.value,
      messages: [
        { role: 'system', content: 'You are a translator.' },
        { role: 'user', content: 'Translate to Chinese: Hello LexiPro!' }
      ],
      temperature: 0.2
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
        testSfResult.innerText = `✅ 连接成功！模型返回: "${trans.trim()}"`;
        testSfResult.className = 'test-result text-success';
      } else {
        throw new Error(res?.response?.responseText || res?.error || '请求失败');
      }
    } catch (err) {
      testSfResult.innerText = `❌ 连接失败: ${err.message || err}`;
      testSfResult.className = 'test-result text-error';
    }
  });

  // 保存配置
  btnSave.addEventListener('click', async () => {
    const toSave = {
      lexipro_sf_model: modelSelect.value,
      lexipro_sf_api_key: keyInput.value.trim() || DEFAULT_CONFIG.lexipro_sf_api_key,
      lexipro_disable_thinking: thinkingCheck.checked,
      lexipro_notion_token: notionTokenInput.value.trim(),
      lexipro_notion_database_id: notionDbInput.value.trim(),
      lexipro_site_translation_style: siteStyleSelect.value,
      lexipro_site_auto_translate: siteAutoTranslateCheck.checked
    };

    await chrome.storage.local.set(toSave);
    saveMsg.innerText = '✅ 配置已成功保存！';
    saveMsg.className = 'save-msg text-success';
    setTimeout(() => { saveMsg.innerText = ''; }, 3000);
  });

  // 恢复出厂
  btnReset.addEventListener('click', async () => {
    if (confirm('确定要恢复出厂默认设置吗？')) {
      await chrome.storage.local.set(DEFAULT_CONFIG);
      fillForm(DEFAULT_CONFIG);
      saveMsg.innerText = '已恢复默认设置';
      saveMsg.className = 'save-msg';
      setTimeout(() => { saveMsg.innerText = ''; }, 2500);
    }
  });

  function fillForm(cfg) {
    modelSelect.value = cfg.lexipro_sf_model || DEFAULT_CONFIG.lexipro_sf_model;
    keyInput.value = cfg.lexipro_sf_api_key || DEFAULT_CONFIG.lexipro_sf_api_key;
    thinkingCheck.checked = cfg.lexipro_disable_thinking !== false;
    notionTokenInput.value = cfg.lexipro_notion_token || '';
    notionDbInput.value = cfg.lexipro_notion_database_id || '';
    siteStyleSelect.value = cfg.lexipro_site_translation_style || 'replace';
    siteAutoTranslateCheck.checked = Boolean(cfg.lexipro_site_auto_translate);
  }
});

