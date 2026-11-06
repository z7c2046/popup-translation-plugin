/**
 * LexiPro - Popup Script
 * 遵循用户意图：按网站独立控制沉浸式翻译与自动翻译，通用网页默认轻量查词绝不侵入干扰
 */

document.addEventListener('DOMContentLoaded', async () => {
  const envBadge = document.getElementById('env-badge');
  const envHint = document.getElementById('env-hint');
  const connStatusMsg = document.getElementById('conn-status-msg');
  const specialBox = document.getElementById('special-action-box');
  const specialTitle = document.getElementById('special-title');
  const generalImmersionBox = document.getElementById('general-immersion-box');
  const btnEnableImmersion = document.getElementById('btn-enable-immersion');
  const btnDisableImmersion = document.getElementById('btn-disable-immersion');
  const btnSiteTranslate = document.getElementById('btn-site-translate');
  const btnSiteTranslateText = document.getElementById('btn-site-translate-text');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const quickThemeSelect = document.getElementById('quick-theme-select');
  const quickStyleSelect = document.getElementById('quick-style-select');
  const quickAutoCheck = document.getElementById('quick-auto-check');
  const quickAutoLabel = document.getElementById('quick-auto-label');
  const quickExcludeCheck = document.getElementById('quick-exclude-check');
  const quickExcludeLabel = document.getElementById('quick-exclude-label');

  // 辅助：域名匹配判断
  function matchesPattern(host, pat) {
    if (!host || !pat) return false;
    let cleanPat = String(pat).toLowerCase().trim();
    cleanPat = cleanPat.replace(/^[a-zA-Z]+:\/\//, '').split('/')[0].split(':')[0].trim();
    if (!cleanPat) return false;
    if (cleanPat.startsWith('*.')) {
      const root = cleanPat.slice(2);
      return host === root || host.endsWith('.' + root);
    }
    return host === cleanPat || host.endsWith('.' + cleanPat);
  }

  // 读取并初始化当前配置
  const storedConfig = await chrome.storage.local.get({
    lexipro_ui_theme: 'market_desk',
    lexipro_site_translation_style: 'replace',
    lexipro_site_auto_translate: false,
    lexipro_auto_translate_sites: [],
    lexipro_immersion_sites: [],
    lexipro_excluded_sites: []
  });

  if (quickThemeSelect) {
    quickThemeSelect.value = storedConfig.lexipro_ui_theme || 'market_desk';
    quickThemeSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      await chrome.storage.local.set({ lexipro_ui_theme: val });
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: 'SET_THEME', theme: val }).catch(() => {});
      }
    });
  }

  if (quickStyleSelect) {
    quickStyleSelect.value = storedConfig.lexipro_site_translation_style || 'replace';
    quickStyleSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      await chrome.storage.local.set({ lexipro_site_translation_style: val });
      if (activeTab?.id) {
        chrome.tabs.sendMessage(activeTab.id, { type: 'SET_DISPLAY_MODE', mode: val }).catch(() => {});
      }
    });
  }

  // 获取当前活跃标签页
  let activeTab = null;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs?.[0] || null;
  } catch (e) {}

  const rawUrl = activeTab?.url || '';
  let hostname = '';
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase();
  } catch (e) {}

  const isReddit = hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  const isReuters = hostname === 'reuters.com' || hostname.endsWith('.reuters.com');

  let currentExcludedSites = Array.isArray(storedConfig.lexipro_excluded_sites) ? storedConfig.lexipro_excluded_sites : [];
  let isCurrentExcluded = Boolean(hostname && currentExcludedSites.some(pat => matchesPattern(hostname, pat)));

  let currentImmersionSites = Array.isArray(storedConfig.lexipro_immersion_sites) ? storedConfig.lexipro_immersion_sites : [];
  let isUserImmersion = Boolean(hostname && currentImmersionSites.some(pat => matchesPattern(hostname, pat)));
  let isImmersionActive = isReddit || isReuters || isUserImmersion;

  let currentAutoTranslateSites = Array.isArray(storedConfig.lexipro_auto_translate_sites) ? storedConfig.lexipro_auto_translate_sites : [];
  let isCurrentAutoTranslate = Boolean(hostname && currentAutoTranslateSites.some(pat => matchesPattern(hostname, pat)));

  let pageState = null;
  if (activeTab?.id && isImmersionActive) {
    try {
      pageState = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PAGE_STATE' });
    } catch (e) {
      pageState = null;
    }
  }

  // 生词高亮排除开关处理
  if (quickExcludeCheck) {
    quickExcludeCheck.checked = isCurrentExcluded;
    if (quickExcludeLabel) {
      quickExcludeLabel.innerText = isCurrentExcluded ? '已排除高亮' : '未排除';
      quickExcludeLabel.style.color = isCurrentExcluded ? '#B33E45' : '#475569';
    }
    quickExcludeCheck.addEventListener('change', async (e) => {
      if (!hostname) return;
      const isChecked = e.target.checked;
      isCurrentExcluded = isChecked;

      if (isChecked) {
        if (!currentExcludedSites.some(p => matchesPattern(hostname, p))) {
          currentExcludedSites.push(hostname);
        }
      } else {
        currentExcludedSites = currentExcludedSites.filter(p => !matchesPattern(hostname, p));
      }

      await chrome.storage.local.set({ lexipro_excluded_sites: currentExcludedSites });
      if (quickExcludeLabel) {
        quickExcludeLabel.innerText = isChecked ? '已排除高亮' : '未排除';
        quickExcludeLabel.style.color = isChecked ? '#B33E45' : '#475569';
      }
      renderPageState();
    });
  }

  // 进站自动翻译开关（针对当前网站独立控制，绝不全局一刀切）
  if (quickAutoCheck) {
    quickAutoCheck.checked = isCurrentAutoTranslate;
    if (quickAutoLabel) {
      quickAutoLabel.innerText = isCurrentAutoTranslate ? '当前网站开启' : '已关闭';
      quickAutoLabel.style.color = isCurrentAutoTranslate ? '#10B981' : '#475569';
    }
    quickAutoCheck.addEventListener('change', async (e) => {
      if (!hostname) return;
      const isChecked = e.target.checked;
      isCurrentAutoTranslate = isChecked;

      if (isChecked) {
        if (!currentAutoTranslateSites.some(p => matchesPattern(hostname, p))) {
          currentAutoTranslateSites.push(hostname);
        }
      } else {
        currentAutoTranslateSites = currentAutoTranslateSites.filter(p => !matchesPattern(hostname, p));
      }

      await chrome.storage.local.set({ lexipro_auto_translate_sites: currentAutoTranslateSites });
      if (quickAutoLabel) {
        quickAutoLabel.innerText = isChecked ? '当前网站开启' : '已关闭';
        quickAutoLabel.style.color = isChecked ? '#10B981' : '#475569';
      }
    });
  }

  // 通用网页按需开启沉浸式翻译
  btnEnableImmersion?.addEventListener('click', async () => {
    if (!hostname) return;
    if (!currentImmersionSites.some(p => matchesPattern(hostname, p))) {
      currentImmersionSites.push(hostname);
    }
    await chrome.storage.local.set({ lexipro_immersion_sites: currentImmersionSites });
    isUserImmersion = true;
    isImmersionActive = true;
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'ENABLE_IMMERSION_FOR_SITE' }).catch(() => {});
    }
    renderPageState();
  });

  // 关闭当前网页的沉浸式翻译
  btnDisableImmersion?.addEventListener('click', async () => {
    if (!hostname) return;
    currentImmersionSites = currentImmersionSites.filter(p => !matchesPattern(hostname, p));
    await chrome.storage.local.set({ lexipro_immersion_sites: currentImmersionSites });
    isUserImmersion = false;
    isImmersionActive = isReddit || isReuters;
    if (activeTab?.id) {
      chrome.tabs.sendMessage(activeTab.id, { type: 'DISABLE_IMMERSION_FOR_SITE' }).catch(() => {});
    }
    renderPageState();
  });

  function renderPageState() {
    if (isCurrentExcluded) {
      envBadge.innerText = '已排除生词高亮';
      envBadge.className = 'badge badge-gray';
      envHint.innerText = '当前网站在生词高亮黑名单中，不会在页面上标注生词。';
    } else if (isReddit) {
      envBadge.innerText = 'Reddit (专属增强)';
      envBadge.className = 'badge badge-orange';
      envHint.innerText = '已就绪专属双语沉浸式翻译。';
    } else if (isReuters) {
      envBadge.innerText = '路透社 (专属增强)';
      envBadge.className = 'badge badge-orange';
      envHint.innerText = '已就绪路透社新闻全文双语翻译。';
    } else if (isUserImmersion) {
      envBadge.innerText = '沉浸式翻译已启用';
      envBadge.className = 'badge badge-green';
      envHint.innerText = '当前网页已开启沉浸式双语翻译，右下角已就绪操作胶囊。';
    } else {
      envBadge.innerText = '通用网页 (轻量查词模式)';
      envBadge.className = 'badge badge-green';
      envHint.innerText = '沉浸式翻译与单词点击解释默认关闭，不打扰股市行情或页面排版；划词翻译可正常使用。';
    }

    if (isImmersionActive) {
      specialBox.style.display = 'block';
      if (generalImmersionBox) generalImmersionBox.style.display = 'none';
      specialTitle.innerText = isReddit ? '⚡ Reddit 专属增强' : (isReuters ? '⚡ 路透社新闻专属增强' : '⚡ 沉浸式双语翻译');

      if (btnDisableImmersion) {
        btnDisableImmersion.style.display = (!isReddit && !isReuters && isUserImmersion) ? 'inline-block' : 'none';
      }

      if (!pageState) {
        connStatusMsg.style.display = 'none';
        btnSiteTranslateText.innerText = '一键翻译全页内容';
      } else {
        connStatusMsg.style.display = 'none';
        if (pageState.jobState === 'running') {
          btnSiteTranslateText.innerText = `⏳ 正在翻译中 (${pageState.translatedCount}/${pageState.totalCount})...`;
        } else if (pageState.failedCount > 0) {
          btnSiteTranslateText.innerText = `⚠️ 重试未完成段落 (${pageState.failedCount}条)`;
        } else if (pageState.jobState === 'completed') {
          btnSiteTranslateText.innerText = pageState.isShowingOriginal ? '返回中文译文' : '查看英文原文';
        } else {
          btnSiteTranslateText.innerText = '一键翻译全页内容';
        }
      }
    } else {
      specialBox.style.display = 'none';
      if (generalImmersionBox) generalImmersionBox.style.display = 'block';
      connStatusMsg.style.display = 'none';
    }
  }

  renderPageState();

  // 触发站点翻译或模式切换操作
  btnSiteTranslate?.addEventListener('click', async () => {
    if (!activeTab?.id) return;

    if (!pageState) {
      try {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'START_PAGE_TRANSLATION' });
        btnSiteTranslateText.innerText = '⏳ 已启动翻译...';
      } catch (err) {
        if (connStatusMsg) {
          connStatusMsg.style.display = 'block';
          connStatusMsg.innerText = '请刷新网页后重试。';
        }
      }
      return;
    }

    try {
      if (pageState.failedCount > 0) {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'RETRY_FAILED' });
        btnSiteTranslateText.innerText = '⏳ 正在重试中...';
      } else if (pageState.jobState === 'completed') {
        const res = await chrome.tabs.sendMessage(activeTab.id, { type: 'TOGGLE_ORIGINAL' });
        pageState.isShowingOriginal = Boolean(res?.isShowingOriginal);
        renderPageState();
      } else {
        await chrome.tabs.sendMessage(activeTab.id, { type: 'START_PAGE_TRANSLATION' });
        btnSiteTranslateText.innerText = '⏳ 已启动翻译...';
      }
    } catch (err) {
      if (connStatusMsg) {
        connStatusMsg.style.display = 'block';
        connStatusMsg.innerText = '操作失败: 页面通信中断，请刷新后重试。';
      }
    }
  });

  // 打开设置页
  btnOpenOptions?.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
});
