/**
 * Popup Translation - Options Script
 * 遵循 GEMINI_TRANSLATION_UX_BLUEPRINT 规范：真实保存语义、静态排版预览、深浅自适应与请求连通性测试
 */

const DEFAULT_CONFIG = {
  lexipro_ui_theme: 'modern',
  lexipro_modern_color_mode: 'auto',
  lexipro_animal_background: 'default',
  lexipro_llm_provider: 'siliconflow',
  lexipro_sf_model: 'Qwen/Qwen2.5-7B-Instruct',
  lexipro_sf_api_key: '',
  lexipro_kimi_refresh_token: '',
  lexipro_kimi_access_token: '',
  lexipro_disable_thinking: true,
  lexipro_auto_pronounce: false,
  lexipro_excluded_sites: [],
  lexipro_notion_token: '',
  lexipro_notion_database_id: '',
  lexipro_site_translation_style: 'replace',
  lexipro_site_auto_translate: false,
  lexipro_auto_translate_sites: [],
  lexipro_immersion_sites: [],
  lexipro_tts_engine: 'local_service',
  lexipro_kokoro_voice: 'af_heart',
  lexipro_local_tts_url: 'http://127.0.0.1:18080'
};

// guokaigdg/animal-island-ui 官方 19 种 Background 定义
const ANIMAL_BACKGROUNDS = [
  { id: 'default', cn: '奶油色波点', color: '#725d42', wide: false },
  { id: 'grid', cn: '网格', color: '#725d42', wide: false },
  { id: 'dots-dark-green', cn: '深绿波点', color: '#3a6b3a', wide: false },
  { id: 'sprinkles', cn: '彩色针糖', color: '#725d42', wide: true },
  { id: 'sweet-corner', cn: '甜点街角', color: '#725d42', wide: true },
  { id: 'coffee-break', cn: '咖啡时光', color: '#725d42', wide: true },
  { id: 'dots-pink', cn: '应用粉', color: '#a85565', wide: false },
  { id: 'dots-purple', cn: '紫色', color: '#6a3a9a', wide: false },
  { id: 'dots-blue', cn: '应用蓝', color: '#4a5a8a', wide: false },
  { id: 'dots-yellow', cn: '应用黄', color: '#7a6528', wide: false },
  { id: 'dots-orange', cn: '应用橙', color: '#8a4a2a', wide: false },
  { id: 'dots-teal', cn: '应用青', color: '#2a6b5a', wide: false },
  { id: 'dots-green', cn: '应用绿', color: '#3a6b3a', wide: false },
  { id: 'dots-red', cn: '应用红', color: '#9a3a3a', wide: false },
  { id: 'dots-lime-green', cn: '青柠绿', color: '#5a6b28', wide: false },
  { id: 'dots-yellow-green', cn: '黄绿色', color: '#6a5a28', wide: false },
  { id: 'dots-brown', cn: '棕色', color: '#5a4a2a', wide: false },
  { id: 'dots-warm-peach-pink', cn: '暖桃粉', color: '#8a4a2a', wide: false },
  { id: 'dots-gray', cn: '浅灰波点', color: '#5a5a5a', wide: false }
];

function normalizeUiSkin(val) {
  if (val === 'animal_island') return 'animal_island';
  if (val === 'market_desk' || val === 'modern' || !val) return 'modern';
  return 'modern';
}

function normalizeColorMode(val) {
  if (val === 'light' || val === 'dark') return val;
  return 'auto';
}

function normalizeAnimalBg(val) {
  return ANIMAL_BACKGROUNDS.some(bg => bg.id === val) ? val : 'default';
}

function normalizeLlmProvider(val) {
  return val === 'kimi_free' ? 'kimi_free' : 'siliconflow';
}

document.addEventListener('DOMContentLoaded', async () => {
  const themeSelect = document.getElementById('ui-theme-select');
  const llmProviderSelect = document.getElementById('llm-provider-select');
  const sfActiveBadge = document.getElementById('sf-active-badge');
  const kimiActiveBadge = document.getElementById('kimi-active-badge');
  const modelSelect = document.getElementById('sf-model-select');
  const keyInput = document.getElementById('sf-key-input');
  const btnToggleKey = document.getElementById('btn-toggle-sf-key');
  const kimiRefreshInput = document.getElementById('kimi-refresh-token-input');
  const kimiAccessInput = document.getElementById('kimi-access-token-input');
  const btnToggleKimiRefresh = document.getElementById('btn-toggle-kimi-refresh');
  const btnToggleKimiAccess = document.getElementById('btn-toggle-kimi-access');
  const thinkingCheck = document.getElementById('disable-thinking-check');
  const autoPronounceCheck = document.getElementById('auto-pronounce-check');
  const excludedSitesInput = document.getElementById('excluded-sites-input');
  const autoTranslateSitesInput = document.getElementById('auto-translate-sites-input');
  const notionTokenInput = document.getElementById('notion-token-input');
  const notionDbInput = document.getElementById('notion-db-input');
  const siteStyleSelect = document.getElementById('site-style-select');
  const ttsEngineSelect = document.getElementById('tts-engine-select');
  const kokoroOptionsGroup = document.getElementById('kokoro-options-group');
  const kokoroVoiceSelect = document.getElementById('kokoro-voice-select');
  const kokoroStatusBadge = document.getElementById('kokoro-status-badge');
  const btnPreloadKokoro = document.getElementById('btn-preload-kokoro');
  const btnTestKokoro = document.getElementById('btn-test-kokoro');
  const kokoroMsg = document.getElementById('kokoro-msg');

  const localServiceGroup = document.getElementById('local-service-group');
  const localServiceUrlInput = document.getElementById('local-service-url');
  const localServiceStatusBadge = document.getElementById('local-service-status-badge');
  const btnCheckLocalService = document.getElementById('btn-check-local-service');
  const btnTestLocalService = document.getElementById('btn-test-local-service');
  const btnTestLocalMelo = document.getElementById('btn-test-local-melo');

  const btnTestSf = document.getElementById('btn-test-sf');
  const testSfResult = document.getElementById('test-sf-result');
  const btnTestKimi = document.getElementById('btn-test-kimi');
  const testKimiResult = document.getElementById('test-kimi-result');
  const btnToggleNotionToken = document.getElementById('btn-toggle-notion-token');
  const btnTestNotion = document.getElementById('btn-test-notion');
  const testNotionResult = document.getElementById('test-notion-result');
  const btnSave = document.getElementById('btn-save');
  const btnReset = document.getElementById('btn-reset');
  const saveMsg = document.getElementById('save-msg');
  const previewBox = document.getElementById('preview-box');
  const pageBackdrop = document.querySelector('.page-backdrop');
  const modernColorModeGroup = document.getElementById('modern-color-mode-group');
  const modernColorIndicator = document.getElementById('modern-color-indicator');
  const modernColorButtons = Array.from(document.querySelectorAll('#modern-color-mode-control .segmented-tab-btn'));
  const animalBgGroup = document.getElementById('animal-bg-group');
  const animalBgGrid = document.getElementById('animal-bg-grid');
  const animalBgCurrentBadge = document.getElementById('animal-bg-current-badge');
  const activePanelTitle = document.getElementById('active-panel-title');
  const panelSubtitle = document.getElementById('panel-subtitle');
  const adminShell = document.querySelector('.admin-shell');
  const navTabs = Array.from(document.querySelectorAll('.sidebar-nav .nav-item'));
  const settingsPanels = Array.from(document.querySelectorAll('.settings-panel'));

  let currentColorMode = 'auto';
  let currentAnimalBg = 'default';

  const colorMediaQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function resolveModernTheme(mode) {
    if (mode === 'dark') return 'dark';
    if (mode === 'light') return 'light';
    return (colorMediaQuery && colorMediaQuery.matches) ? 'dark' : 'light';
  }

  function saveStoragePatch(patch) {
    if (hasChromeStorage) {
      return chrome.storage.local.set(patch).catch(() => {});
    }
    try {
      for (const [k, v] of Object.entries(patch)) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    } catch (e) {}
    return Promise.resolve();
  }

  function renderAnimalBgPicker() {
    if (!animalBgGrid) return;
    animalBgGrid.innerHTML = '';
    ANIMAL_BACKGROUNDS.forEach((bg) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `aiu-bg-tile aiu-bg-${bg.id}${bg.wide ? ' is-wide' : ''}`;
      btn.dataset.bg = bg.id;
      btn.style.color = bg.color;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', bg.id === currentAnimalBg ? 'true' : 'false');
      if (bg.id === currentAnimalBg) {
        btn.classList.add('is-selected');
      }
      btn.innerHTML = `
        <span class="aiu-bg-tile-check" aria-hidden="true">✓</span>
        <span class="aiu-bg-tile-cn">${bg.cn}</span>
        <span class="aiu-bg-tile-id">${bg.id}</span>
      `;
      btn.addEventListener('click', async () => {
        currentAnimalBg = normalizeAnimalBg(bg.id);
        applySkinToDocument();
        await saveStoragePatch({ lexipro_animal_background: currentAnimalBg });
      });
      animalBgGrid.appendChild(btn);
    });
  }

  function syncSegmentedControl() {
    const modes = ['auto', 'light', 'dark'];
    const idx = Math.max(0, modes.indexOf(currentColorMode));
    if (modernColorIndicator) {
      modernColorIndicator.style.transform = `translateX(${idx * 100}%)`;
    }
    modernColorButtons.forEach((btn) => {
      const isSelected = btn.dataset.mode === currentColorMode;
      btn.classList.toggle('selected', isSelected);
      btn.setAttribute('aria-checked', isSelected ? 'true' : 'false');
    });
  }

  function applySkinToDocument() {
    const skin = normalizeUiSkin(themeSelect ? themeSelect.value : 'modern');
    const resolvedTheme = skin === 'modern' ? resolveModernTheme(currentColorMode) : 'light';

    document.body.setAttribute('data-skin', skin);
    document.body.setAttribute('data-theme', resolvedTheme);

    if (pageBackdrop) {
      if (skin === 'animal_island') {
        pageBackdrop.setAttribute('data-animal-bg', currentAnimalBg);
      } else {
        pageBackdrop.removeAttribute('data-animal-bg');
      }
    }

    if (modernColorModeGroup) {
      modernColorModeGroup.style.display = skin === 'modern' ? 'block' : 'none';
    }
    if (animalBgGroup) {
      animalBgGroup.style.display = skin === 'animal_island' ? 'block' : 'none';
    }

    syncSegmentedControl();

    if (animalBgGrid) {
      const bgMeta = ANIMAL_BACKGROUNDS.find(b => b.id === currentAnimalBg) || ANIMAL_BACKGROUNDS[0];
      if (animalBgCurrentBadge) {
        animalBgCurrentBadge.textContent = bgMeta.cn;
      }
      animalBgGrid.querySelectorAll('.aiu-bg-tile').forEach((tile) => {
        const isSel = tile.dataset.bg === currentAnimalBg;
        tile.classList.toggle('is-selected', isSel);
        tile.setAttribute('aria-checked', isSel ? 'true' : 'false');
      });
    }
  }

  // 侧边栏分栏导航切换与 URL Hash 记忆
  function switchPanel(panelName, { updateHash = true } = {}) {
    const targetPanel = document.getElementById(`panel-${panelName}`);
    const targetTab = document.getElementById(`tab-${panelName}`);
    if (!targetPanel || !targetTab) return;

    navTabs.forEach((tab) => {
      const isTarget = tab === targetTab;
      tab.classList.toggle('is-active', isTarget);
      tab.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    settingsPanels.forEach((panel) => {
      panel.classList.toggle('is-active', panel === targetPanel);
    });

    if (activePanelTitle) {
      activePanelTitle.textContent = targetPanel.dataset.title || targetTab.textContent.trim();
    }
    if (panelSubtitle) {
      panelSubtitle.textContent = targetPanel.dataset.subtitle || '';
    }

    if (updateHash && window.location.hash !== `#${panelName}`) {
      try {
        history.replaceState(null, '', `#${panelName}`);
      } catch (e) {}
    }
  }

  navTabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      switchPanel(tab.dataset.panel);
    });
    tab.addEventListener('keydown', (e) => {
      let nextIdx = -1;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        nextIdx = (index + 1) % navTabs.length;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        nextIdx = (index - 1 + navTabs.length) % navTabs.length;
      }
      if (nextIdx >= 0) {
        e.preventDefault();
        const nextTab = navTabs[nextIdx];
        nextTab.focus();
        switchPanel(nextTab.dataset.panel);
      }
    });
  });

  const initialPanel = window.location.hash.replace(/^#/, '');
  if (initialPanel && document.getElementById(`panel-${initialPanel}`)) {
    switchPanel(initialPanel, { updateHash: false });
  }
  if (adminShell) {
    void adminShell.offsetHeight;
    requestAnimationFrame(() => {
      adminShell.classList.add('is-ready');
    });
  }

  // 支持 Ctrl+S / Cmd+S 快捷保存
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      btnSave?.click();
    }
  });

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

  // 解析并清洗排除网站域名列表
  function parseExcludedSites(rawText) {
    if (!rawText) return [];
    const lines = String(rawText).split(/[\n,;]+/);
    const result = [];
    for (const line of lines) {
      let clean = line.trim().toLowerCase();
      clean = clean.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].split(':')[0].trim();
      if (clean && !result.includes(clean)) {
        result.push(clean);
      }
    }
    return result;
  }

  // 读取配置
  const hasChromeStorage = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  let stored = { ...DEFAULT_CONFIG };
  if (hasChromeStorage) {
    stored = await chrome.storage.local.get(DEFAULT_CONFIG);
  } else {
    try {
      for (const k of Object.keys(DEFAULT_CONFIG)) {
        const raw = localStorage.getItem(k);
        if (raw !== null) stored[k] = JSON.parse(raw);
      }
    } catch (e) {}
  }

  renderAnimalBgPicker();
  fillForm(stored);
  updatePreview();

  const EYE_OPEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYE_OFF_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

  function updateEngineBadges() {
    const provider = normalizeLlmProvider(llmProviderSelect ? llmProviderSelect.value : 'siliconflow');
    if (sfActiveBadge) {
      sfActiveBadge.style.display = provider === 'siliconflow' ? 'inline-flex' : 'none';
    }
    if (kimiActiveBadge) {
      kimiActiveBadge.style.display = provider === 'kimi_free' ? 'inline-flex' : 'none';
    }
  }

  llmProviderSelect?.addEventListener('change', updateEngineBadges);

  function toggleEyeInput(inputEl, btnEl) {
    if (!inputEl || !btnEl) return;
    if (inputEl.type === 'password') {
      inputEl.type = 'text';
      btnEl.innerHTML = EYE_OFF_SVG;
    } else {
      inputEl.type = 'password';
      btnEl.innerHTML = EYE_OPEN_SVG;
    }
  }

  // 密码显示/隐藏切换
  btnToggleKey.addEventListener('click', () => {
    toggleEyeInput(keyInput, btnToggleKey);
  });

  btnToggleKimiRefresh?.addEventListener('click', () => {
    toggleEyeInput(kimiRefreshInput, btnToggleKimiRefresh);
  });

  btnToggleKimiAccess?.addEventListener('click', () => {
    toggleEyeInput(kimiAccessInput, btnToggleKimiAccess);
  });

  // 本地实时排版效果预览 (零网络消耗)
  function updatePreview() {
    if (!previewBox) return;
    const style = siteStyleSelect.value || 'replace';
    const skin = normalizeUiSkin(themeSelect ? themeSelect.value : 'modern');
    const isAnimal = skin === 'animal_island';
    const isDark = !isAnimal && resolveModernTheme(currentColorMode) === 'dark';

    const origColor = isAnimal ? '#9b8567' : (isDark ? '#9ca3af' : '#475569');
    const transColor = isAnimal ? '#725d42' : (isDark ? '#f3f4f6' : '#0f172a');
    const accentColor = isAnimal ? '#0b8079' : (isDark ? '#818cf8' : '#4f46e5');
    const cardBg = isAnimal ? '#fff8e4' : (isDark ? 'rgba(28, 31, 38, 0.9)' : '#ffffff');
    const cardBorder = isAnimal ? '#d8c8ab' : (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)');
    const leftAccent = isAnimal ? '#19c8b9' : (isDark ? '#6366f1' : '#4f46e5');
    const pillBg = isAnimal ? '#e8faf5' : (isDark ? 'rgba(99, 102, 241, 0.16)' : '#ffffff');
    const pillBorder = isAnimal ? '#82d5bb' : (isDark ? 'rgba(99, 102, 241, 0.35)' : '#cbd5e1');

    const items = [
      {
        orig: 'Revenue for the third quarter may rise by 5% amid robust data center demand.',
        trans: '得益于数据中心强劲的需求，第三季度营收可能增长 5%。'
      },
      {
        orig: 'I keep holding my shares because the chip supply cycle is clearly turning upward.',
        trans: '我继续持有股票，因为芯片供应周期显然正在向上反转。'
      }
    ];

    const dividerCss = isAnimal
      ? 'padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1.5px dashed #d8c8ab;'
      : `padding-bottom: 12px; margin-bottom: 12px; border-bottom: 1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E3E8F0'};`;

    if (style === 'replace') {
      previewBox.innerHTML = items.map((it, idx) => `
        <div style="${idx < items.length - 1 ? dividerCss : ''} font-size: 13.5px; line-height: 1.65; color: ${transColor};">
          <span>${it.trans}</span>
          <span style="display: inline-flex; align-items: center; gap: 3px; margin-left: 6px; padding: 1px 7px; font-size: 11px; border-radius: ${isAnimal ? '999px' : '6px'}; border: 1px solid ${pillBorder}; background: ${pillBg}; color: ${accentColor}; font-weight: 600; cursor: pointer;">⇄ 原文</span>
        </div>
      `).join('');
    } else if (style === 'underline') {
      previewBox.innerHTML = items.map((it, idx) => `
        <div style="${idx < items.length - 1 ? dividerCss : ''} font-size: 13.5px; line-height: 1.55;">
          <div style="color: ${origColor};">${it.orig}</div>
          <div style="border-bottom: 1.5px dashed ${leftAccent}; color: ${transColor}; display: inline-block; padding-bottom: 2px; margin-top: 4px;">${it.trans}</div>
        </div>
      `).join('');
    } else if (style === 'card') {
      previewBox.innerHTML = items.map((it, idx) => `
        <div style="${idx < items.length - 1 ? dividerCss : ''} font-size: 13.5px;">
          <div style="color: ${origColor}; margin-bottom: 5px;">${it.orig}</div>
          <div style="background: ${cardBg}; border: 1px solid ${cardBorder}; border-left: 3.5px solid ${leftAccent}; border-radius: ${isAnimal ? '12px' : '8px'}; padding: 7px 11px; color: ${transColor};">
            <span style="font-size: 10.5px; font-weight: bold; color: ${accentColor}; margin-right: 6px;">[译文]</span>${it.trans}
          </div>
        </div>
      `).join('');
    }
  }

  siteStyleSelect.addEventListener('change', updatePreview);

  themeSelect.addEventListener('change', async () => {
    const chosenSkin = normalizeUiSkin(themeSelect.value);
    themeSelect.value = chosenSkin;
    applySkinToDocument();
    updatePreview();
    await saveStoragePatch({ lexipro_ui_theme: chosenSkin });
  });

  modernColorButtons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      currentColorMode = normalizeColorMode(btn.dataset.mode);
      applySkinToDocument();
      updatePreview();
      await saveStoragePatch({ lexipro_modern_color_mode: currentColorMode });
    });
  });

  colorMediaQuery?.addEventListener?.('change', () => {
    if (normalizeUiSkin(themeSelect?.value) === 'modern' && currentColorMode === 'auto') {
      applySkinToDocument();
      updatePreview();
    }
  });

  if (hasChromeStorage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      let skinDirty = false;
      if (changes.lexipro_ui_theme) {
        const nextSkin = normalizeUiSkin(changes.lexipro_ui_theme.newValue);
        if (themeSelect && themeSelect.value !== nextSkin) {
          themeSelect.value = nextSkin;
          skinDirty = true;
        }
      }
      if (changes.lexipro_modern_color_mode) {
        currentColorMode = normalizeColorMode(changes.lexipro_modern_color_mode.newValue);
        skinDirty = true;
      }
      if (changes.lexipro_animal_background) {
        currentAnimalBg = normalizeAnimalBg(changes.lexipro_animal_background.newValue);
        skinDirty = true;
      }
      if (skinDirty) {
        applySkinToDocument();
        updatePreview();
      }
      if (changes.lexipro_llm_provider && llmProviderSelect) {
        llmProviderSelect.value = normalizeLlmProvider(changes.lexipro_llm_provider.newValue);
        updateEngineBadges();
      }
      if (changes.lexipro_sf_model && modelSelect && changes.lexipro_sf_model.newValue) {
        modelSelect.value = changes.lexipro_sf_model.newValue;
      }
      if (changes.lexipro_disable_thinking && thinkingCheck) {
        thinkingCheck.checked = changes.lexipro_disable_thinking.newValue !== false;
      }
      if (changes.lexipro_auto_pronounce && autoPronounceCheck) {
        autoPronounceCheck.checked = Boolean(changes.lexipro_auto_pronounce.newValue);
      }
      if (changes.lexipro_sf_api_key && keyInput && document.activeElement !== keyInput) {
        keyInput.value = changes.lexipro_sf_api_key.newValue || '';
      }
      if (changes.lexipro_kimi_refresh_token && kimiRefreshInput && document.activeElement !== kimiRefreshInput) {
        kimiRefreshInput.value = changes.lexipro_kimi_refresh_token.newValue || '';
      }
      if (changes.lexipro_kimi_access_token && kimiAccessInput && document.activeElement !== kimiAccessInput) {
        kimiAccessInput.value = changes.lexipro_kimi_access_token.newValue || '';
      }
      if (changes.lexipro_notion_token && notionTokenInput && document.activeElement !== notionTokenInput) {
        notionTokenInput.value = changes.lexipro_notion_token.newValue || '';
      }
      if (changes.lexipro_notion_database_id && notionDbInput && document.activeElement !== notionDbInput) {
        notionDbInput.value = changes.lexipro_notion_database_id.newValue || '';
      }
    });
  }

  // 语音引擎与伴侣服务状态联动
  function updateTtsUI() {
    if (!ttsEngineSelect) return;
    if (ttsEngineSelect.value === 'kokoro') {
      ttsEngineSelect.value = 'local_service';
    }
    const isKokoro = ttsEngineSelect.value === 'kokoro';
    const isLocalService = ttsEngineSelect.value === 'local_service';

    if (kokoroOptionsGroup) kokoroOptionsGroup.style.display = isKokoro ? 'block' : 'none';
    if (localServiceGroup) localServiceGroup.style.display = isLocalService ? 'block' : 'none';

    if (isKokoro) {
      queryKokoroStatus();
    } else if (isLocalService) {
      checkLocalServiceStatus(false);
    }
  }

  // 探测本地原生 Sherpa-ONNX 伴侣服务运行状态
  async function checkLocalServiceStatus(isManual = false) {
    if (!localServiceStatusBadge) return;
    const baseUrl = (localServiceUrlInput?.value || 'http://127.0.0.1:18080').trim().replace(/\/+$/, '');
    localServiceStatusBadge.innerText = '○ 检测中...';
    localServiceStatusBadge.style.background = '#ECF0FE';
    localServiceStatusBadge.style.color = '#3154D1';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);

    try {
      const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const hasKokoro = data.features?.kokoro?.ready;
        const hasMelo = data.features?.melo?.ready;
        let featText = '服务在线';
        if (hasKokoro && hasMelo) featText = '双引擎在线';
        else if (hasKokoro) featText = 'Kokoro 在线';
        else if (hasMelo) featText = 'MeloTTS 在线';

        localServiceStatusBadge.innerText = `● ${featText}`;
        localServiceStatusBadge.style.background = '#E6F7EE';
        localServiceStatusBadge.style.color = '#0F7652';
        return true;
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      clearTimeout(timer);
      localServiceStatusBadge.innerText = '○ 未启动服务';
      localServiceStatusBadge.style.background = '#FEF2F2';
      localServiceStatusBadge.style.color = '#DC2626';
      if (isManual) {
        alert('未检测到本地原生发音服务。\n\n请双击项目根目录的「本地语音服务.exe」启动。');
      }
      return false;
    }
  }

  btnCheckLocalService?.addEventListener('click', () => {
    checkLocalServiceStatus(true);
  });

  btnTestLocalService?.addEventListener('click', async () => {
    const baseUrl = (localServiceUrlInput?.value || 'http://127.0.0.1:18080').trim().replace(/\/+$/, '');
    const voice = kokoroVoiceSelect?.value || 'af_heart';
    const testUrl = `${baseUrl}/tts?text=${encodeURIComponent('Welcome! Experience native neural speech with Kokoro.')}&voice=${encodeURIComponent(voice)}&speed=1.0`;

    try {
      const audio = new Audio(testUrl);
      await audio.play();
    } catch (e) {
      checkLocalServiceStatus(true);
    }
  });

  btnTestLocalMelo?.addEventListener('click', async () => {
    const baseUrl = (localServiceUrlInput?.value || 'http://127.0.0.1:18080').trim().replace(/\/+$/, '');
    const testUrl = `${baseUrl}/tts?text=${encodeURIComponent('你好，欢迎使用本地原生语音服务，这是MeloTTS中文发音。')}&speed=1.0`;

    try {
      const audio = new Audio(testUrl);
      await audio.play();
    } catch (e) {
      checkLocalServiceStatus(true);
    }
  });

  function queryKokoroStatus() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    chrome.runtime.sendMessage({ type: 'KOKORO_TTS_GET_STATUS' })
      .then(res => {
        if (res && res.success && kokoroStatusBadge) {
          if (res.state === 'ready') {
            kokoroStatusBadge.innerText = '✅ 离线模型已就绪';
            kokoroStatusBadge.style.background = '#ECFDF5';
            kokoroStatusBadge.style.color = '#059669';
          } else if (res.state === 'loading') {
            kokoroStatusBadge.innerText = `⏳ 正在下载模型 (${res.progress || 0}%)...`;
            kokoroStatusBadge.style.background = '#EFF6FF';
            kokoroStatusBadge.style.color = '#2563EB';
          } else if (res.state === 'error') {
            kokoroStatusBadge.innerText = '⚠️ 加载失败，点击重试';
            kokoroStatusBadge.style.background = '#FEF2F2';
            kokoroStatusBadge.style.color = '#DC2626';
          } else {
            kokoroStatusBadge.innerText = '未下载 (首次使用自动下载 ~80MB)';
            kokoroStatusBadge.style.background = '#F1F5F9';
            kokoroStatusBadge.style.color = '#64748B';
          }
        }
      })
      .catch(() => {});
  }

  ttsEngineSelect?.addEventListener('change', updateTtsUI);

  // 监听来自 Offscreen 的下载进度更新
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'KOKORO_STATUS_UPDATE' && kokoroStatusBadge) {
        if (msg.state === 'ready') {
          kokoroStatusBadge.innerText = '✅ 离线模型已就绪';
          kokoroStatusBadge.style.background = '#ECFDF5';
          kokoroStatusBadge.style.color = '#059669';
          if (kokoroMsg) kokoroMsg.innerText = '离线语音包已准备就绪！';
        } else if (msg.state === 'loading') {
          kokoroStatusBadge.innerText = `⏳ 正在下载模型 (${msg.progress || 0}%)...`;
          kokoroStatusBadge.style.background = '#EFF6FF';
          kokoroStatusBadge.style.color = '#2563EB';
          if (kokoroMsg) kokoroMsg.innerText = `下载进度: ${msg.progress || 0}%`;
        } else if (msg.state === 'error') {
          kokoroStatusBadge.innerText = '⚠️ 模型下载失败';
          kokoroStatusBadge.style.background = '#FEF2F2';
          kokoroStatusBadge.style.color = '#DC2626';
          if (kokoroMsg) kokoroMsg.innerText = msg.error || '下载失败，请检查网络';
        }
      }
    });
  }

  // 预热/预下载按钮
  btnPreloadKokoro?.addEventListener('click', async () => {
    if (kokoroMsg) kokoroMsg.innerText = '正在启动后台下载，请稍候...';
    try {
      const res = await chrome.runtime.sendMessage({ type: 'KOKORO_TTS_PRELOAD' });
      if (res && res.success) {
        if (kokoroMsg) kokoroMsg.innerText = '✅ Kokoro 离线模型已成功预热！';
      } else {
        if (kokoroMsg) kokoroMsg.innerText = '❌ 预热失败: ' + (res?.error || '未知错误');
      }
    } catch (e) {
      if (kokoroMsg) kokoroMsg.innerText = '❌ 预热失败: ' + e.message;
    }
  });

  // 试听发音
  btnTestKokoro?.addEventListener('click', async () => {
    const voice = kokoroVoiceSelect?.value || 'af_heart';
    if (kokoroMsg) kokoroMsg.innerText = '正在合成试听语音...';
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'KOKORO_TTS_PLAY',
        text: 'Welcome! Experience natural neural speech with Kokoro.',
        voice: voice
      });
      if (res && res.success) {
        if (kokoroMsg) kokoroMsg.innerText = '🔊 正在播放试听发音...';
      } else {
        if (kokoroMsg) kokoroMsg.innerText = '❌ 发音失败: ' + (res?.error || '未知错误');
      }
    } catch (e) {
      if (kokoroMsg) kokoroMsg.innerText = '❌ 发音失败: ' + e.message;
    }
  });

  // 测试 API 连通性
  btnTestSf.addEventListener('click', async () => {
    const sfApiKey = keyInput.value.trim();
    if (!sfApiKey) {
      testSfResult.innerText = '○ 请先填写 SiliconFlow API Key';
      testSfResult.className = 'test-result text-error';
      return;
    }

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
            'Authorization': `Bearer ${sfApiKey}`
          },
          data: JSON.stringify(testBody)
        }
      });

      if (res && res.success && res.response?.status >= 200 && res.response?.status < 300) {
        const json = JSON.parse(res.response.responseText);
        const trans = json.choices?.[0]?.message?.content || '';
        testSfResult.innerText = `● 连接成功！模型响应: "${trans.trim()}"`;
        testSfResult.className = 'test-result text-success';
      } else {
        throw new Error(res?.response?.responseText || res?.error || '请求失败');
      }
    } catch (err) {
      testSfResult.innerText = `○ 连接失败: ${err.message || err}`;
      testSfResult.className = 'test-result text-error';
    }
  });

  function createKimiTestHeaders(token) {
    const trafficId = Array.from({ length: 20 }, () => Math.floor(Math.random() * 36).toString(36)).join('');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': 'https://kimi.moonshot.cn',
      'Referer': 'https://kimi.moonshot.cn/',
      'X-Traffic-Id': trafficId
    };
  }

  async function refreshKimiTestToken(refreshToken) {
    const res = await chrome.runtime.sendMessage({
      type: 'GM_XHR',
      details: {
        url: 'https://kimi.moonshot.cn/api/auth/token/refresh',
        method: 'GET',
        headers: createKimiTestHeaders(refreshToken),
        timeout: 20000
      }
    });

    if (res && res.success && res.response?.status === 200) {
      const data = JSON.parse(res.response.responseText || '{}');
      if (data.access_token) {
        return {
          accessToken: data.access_token,
          refreshToken: data.refresh_token || refreshToken
        };
      }
    }

    const status = res?.response?.status;
    let detail = '';
    try {
      const errJson = JSON.parse(res?.response?.responseText || '{}');
      detail = errJson.message || errJson.msg || '';
    } catch (e) {}
    throw new Error(`Refresh Token 刷新失败 (HTTP ${status || 'Error'})${detail ? `：${detail}` : ''}`);
  }

  async function createKimiTestChat(accessToken) {
    const res = await chrome.runtime.sendMessage({
      type: 'GM_XHR',
      details: {
        url: 'https://kimi.moonshot.cn/api/chat',
        method: 'POST',
        headers: createKimiTestHeaders(accessToken),
        data: JSON.stringify({
          name: 'Popup Translation Test',
          is_example: false
        }),
        timeout: 20000
      }
    });

    if (res && res.success && res.response?.status === 200) {
      const data = JSON.parse(res.response.responseText || '{}');
      if (data.id) {
        return { ok: true, chatId: data.id };
      }
    }

    const status = res?.response?.status;
    let detail = '';
    try {
      const errJson = JSON.parse(res?.response?.responseText || '{}');
      detail = errJson.message || errJson.msg || errJson.error_msg || '';
    } catch (e) {}
    return {
      ok: false,
      status,
      error: res?.error || `HTTP ${status || 'Error'}${detail ? `：${detail}` : ''}`
    };
  }

  // 测试 Kimi 网页版 Token 连通性
  btnTestKimi?.addEventListener('click', async () => {
    if (!testKimiResult) return;
    let refreshToken = kimiRefreshInput ? kimiRefreshInput.value.trim() : '';
    let accessToken = kimiAccessInput ? kimiAccessInput.value.trim() : '';

    if (!accessToken && !refreshToken) {
      testKimiResult.innerText = '○ 请先填写 Kimi Access Token 或 Refresh Token';
      testKimiResult.className = 'test-result text-error';
      return;
    }

    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      testKimiResult.innerText = '○ 请在 Chrome 扩展环境下测试连通性';
      testKimiResult.className = 'test-result text-error';
      return;
    }

    testKimiResult.innerText = '正在验证 Kimi Token 连通性...';
    testKimiResult.className = 'test-result';

    let refreshed = false;
    try {
      if (!accessToken && refreshToken) {
        const nextTokens = await refreshKimiTestToken(refreshToken);
        accessToken = nextTokens.accessToken;
        refreshToken = nextTokens.refreshToken;
        refreshed = true;
      }

      let chatRes = await createKimiTestChat(accessToken);
      if (!chatRes.ok && chatRes.status === 401 && refreshToken) {
        const nextTokens = await refreshKimiTestToken(refreshToken);
        accessToken = nextTokens.accessToken;
        refreshToken = nextTokens.refreshToken;
        refreshed = true;
        chatRes = await createKimiTestChat(accessToken);
      }

      if (!chatRes.ok) {
        throw new Error(chatRes.error || 'Kimi 会话创建失败');
      }

      if (refreshed) {
        if (kimiAccessInput) kimiAccessInput.value = accessToken;
        if (kimiRefreshInput) kimiRefreshInput.value = refreshToken;
        await saveStoragePatch({
          lexipro_kimi_access_token: accessToken,
          lexipro_kimi_refresh_token: refreshToken
        });
      }

      testKimiResult.innerText = refreshed
        ? '● 连接成功！已自动刷新并更新最新 Token'
        : '● 连接成功！Kimi Token 状态有效';
      testKimiResult.className = 'test-result text-success';
    } catch (err) {
      testKimiResult.innerText = `○ 连接失败: ${err.message || err}`;
      testKimiResult.className = 'test-result text-error';
    }
  });

  // Notion Token 密码显示/隐藏切换
  btnToggleNotionToken?.addEventListener('click', () => {
    if (notionTokenInput.type === 'password') {
      notionTokenInput.type = 'text';
      btnToggleNotionToken.innerHTML = EYE_OFF_SVG;
    } else {
      notionTokenInput.type = 'password';
      btnToggleNotionToken.innerHTML = EYE_OPEN_SVG;
    }
  });

  // 测试 Notion 知识库 API 连通性
  btnTestNotion?.addEventListener('click', async () => {
    const rawToken = notionTokenInput.value.trim();
    const rawDb = cleanDatabaseId(notionDbInput.value);
    notionDbInput.value = rawDb;

    if (!rawToken || !rawDb) {
      testNotionResult.innerText = '○ 请先填写完整的 Notion Token 与 Database ID';
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
        testNotionResult.innerText = `● 连接成功！已连通知识库: 「${dbTitle}」`;
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
      testNotionResult.innerText = `○ ${err.message || err}`;
      testNotionResult.className = 'test-result text-error';
    }
  });

  // 保存配置（遵循蓝图 P1-13：真实保存，清空即清空，不暗中回填内置 Key）
  btnSave.addEventListener('click', async () => {
    const cleanedDbId = cleanDatabaseId(notionDbInput.value);
    notionDbInput.value = cleanedDbId;

    const excludedSites = parseExcludedSites(excludedSitesInput ? excludedSitesInput.value : '');
    if (excludedSitesInput) {
      excludedSitesInput.value = excludedSites.join('\n');
    }

    const autoTranslateSites = parseExcludedSites(autoTranslateSitesInput ? autoTranslateSitesInput.value : '');
    if (autoTranslateSitesInput) {
      autoTranslateSitesInput.value = autoTranslateSites.join('\n');
    }

    const toSave = {
      lexipro_ui_theme: normalizeUiSkin(themeSelect ? themeSelect.value : 'modern'),
      lexipro_modern_color_mode: currentColorMode,
      lexipro_animal_background: currentAnimalBg,
      lexipro_llm_provider: normalizeLlmProvider(llmProviderSelect ? llmProviderSelect.value : 'siliconflow'),
      lexipro_sf_model: modelSelect.value,
      lexipro_sf_api_key: keyInput.value.trim(),
      lexipro_kimi_refresh_token: kimiRefreshInput ? kimiRefreshInput.value.trim() : '',
      lexipro_kimi_access_token: kimiAccessInput ? kimiAccessInput.value.trim() : '',
      lexipro_disable_thinking: thinkingCheck.checked,
      lexipro_kimi_thinking: !thinkingCheck.checked,
      lexipro_auto_pronounce: autoPronounceCheck ? autoPronounceCheck.checked : false,
      lexipro_excluded_sites: excludedSites,
      lexipro_auto_translate_sites: autoTranslateSites,
      lexipro_notion_token: notionTokenInput.value.trim(),
      lexipro_notion_database_id: cleanedDbId,
      lexipro_site_translation_style: siteStyleSelect.value,
      lexipro_site_auto_translate: false,
      lexipro_tts_engine: (ttsEngineSelect && ttsEngineSelect.value !== 'kokoro') ? ttsEngineSelect.value : 'local_service',
      lexipro_kokoro_voice: kokoroVoiceSelect ? kokoroVoiceSelect.value : 'af_heart',
      lexipro_local_tts_url: (localServiceUrlInput?.value || 'http://127.0.0.1:18080').trim()
    };

    await saveStoragePatch(toSave);
    applySkinToDocument();
    updatePreview();
    saveMsg.innerText = '● 已保存';
    saveMsg.className = 'save-msg text-success';
    setTimeout(() => { saveMsg.innerText = ''; }, 3000);
  });

  // 恢复出厂默认配置
  btnReset.addEventListener('click', async () => {
    if (confirm('确定要恢复出厂默认设置吗？')) {
      await saveStoragePatch(DEFAULT_CONFIG);
      fillForm(DEFAULT_CONFIG);
      updatePreview();
      saveMsg.innerText = '已恢复出厂默认设置';
      saveMsg.className = 'save-msg';
      setTimeout(() => { saveMsg.innerText = ''; }, 2500);
    }
  });

  function fillForm(cfg) {
    if (themeSelect) themeSelect.value = normalizeUiSkin(cfg.lexipro_ui_theme);
    currentColorMode = normalizeColorMode(cfg.lexipro_modern_color_mode);
    currentAnimalBg = normalizeAnimalBg(cfg.lexipro_animal_background);
    if (llmProviderSelect) llmProviderSelect.value = normalizeLlmProvider(cfg.lexipro_llm_provider);
    modelSelect.value = cfg.lexipro_sf_model || DEFAULT_CONFIG.lexipro_sf_model;
    keyInput.value = cfg.lexipro_sf_api_key || '';
    if (kimiRefreshInput) kimiRefreshInput.value = cfg.lexipro_kimi_refresh_token || '';
    if (kimiAccessInput) kimiAccessInput.value = cfg.lexipro_kimi_access_token || '';
    thinkingCheck.checked = cfg.lexipro_disable_thinking !== false;
    updateEngineBadges();
    if (autoPronounceCheck) autoPronounceCheck.checked = Boolean(cfg.lexipro_auto_pronounce);
    if (excludedSitesInput) {
      const list = Array.isArray(cfg.lexipro_excluded_sites) ? cfg.lexipro_excluded_sites : [];
      excludedSitesInput.value = list.join('\n');
    }
    if (autoTranslateSitesInput) {
      const autoList = Array.isArray(cfg.lexipro_auto_translate_sites) ? cfg.lexipro_auto_translate_sites : [];
      autoTranslateSitesInput.value = autoList.join('\n');
    }
    notionTokenInput.value = cfg.lexipro_notion_token || '';
    notionDbInput.value = cfg.lexipro_notion_database_id || '';
    siteStyleSelect.value = cfg.lexipro_site_translation_style || 'replace';
    let savedEngine = cfg.lexipro_tts_engine || 'local_service';
    if (savedEngine === 'kokoro') savedEngine = 'local_service';
    if (ttsEngineSelect) ttsEngineSelect.value = savedEngine;
    if (kokoroVoiceSelect) kokoroVoiceSelect.value = cfg.lexipro_kokoro_voice || 'af_heart';
    if (localServiceUrlInput) localServiceUrlInput.value = cfg.lexipro_local_tts_url || 'http://127.0.0.1:18080';
    applySkinToDocument();
    updateTtsUI();
  }
});
