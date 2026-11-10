/**
 * Popup Translation - Popup Script
 * 按网站独立控制沉浸式翻译与自动翻译，保持极简界面交互
 */

document.addEventListener('DOMContentLoaded', async () => {
  const envBadge = document.getElementById('env-badge');
  const siteHostname = document.getElementById('site-hostname');
  const siteCard = document.getElementById('site-card');
  const connStatusMsg = document.getElementById('conn-status-msg');
  const specialBox = document.getElementById('special-action-box');
  const generalImmersionBox = document.getElementById('general-immersion-box');
  const btnEnableImmersion = document.getElementById('btn-enable-immersion');
  const btnDisableImmersion = document.getElementById('btn-disable-immersion');
  const btnSiteTranslate = document.getElementById('btn-site-translate');
  const btnSiteTranslateText = document.getElementById('btn-site-translate-text');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const quickThemeSelect = document.getElementById('quick-theme-select');
  const quickStyleSelect = document.getElementById('quick-style-select');
  const quickAutoCheck = document.getElementById('quick-auto-check');
  const quickExcludeCheck = document.getElementById('quick-exclude-check');

  // 域名匹配判断
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

  // 读取并初始化配置
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
  let urlObj = null;
  try {
    urlObj = new URL(rawUrl);
  } catch (e) {}

  const isWebPage = Boolean(urlObj && (urlObj.protocol === 'http:' || urlObj.protocol === 'https:'));
  const hostname = isWebPage ? urlObj.hostname.toLowerCase() : '';

  if (siteHostname) {
    if (hostname) {
      siteHostname.innerText = hostname;
    } else if (urlObj?.protocol === 'chrome-extension:') {
      siteHostname.innerText = '扩展程序页面';
    } else {
      siteHostname.innerText = '浏览器内部页';
    }
    siteHostname.title = rawUrl;
  }

  const isReddit = hostname === 'reddit.com' || hostname.endsWith('.reddit.com');
  const isReuters = hostname === 'reuters.com' || hostname.endsWith('.reuters.com');

  let currentExcludedSites = Array.isArray(storedConfig.lexipro_excluded_sites) ? storedConfig.lexipro_excluded_sites : [];
  let isCurrentExcluded = Boolean(hostname && currentExcludedSites.some(pat => matchesPattern(hostname, pat)));

  let currentImmersionSites = Array.isArray(storedConfig.lexipro_immersion_sites) ? storedConfig.lexipro_immersion_sites : [];
  let isUserImmersion = Boolean(hostname && currentImmersionSites.some(pat => matchesPattern(hostname, pat)));
  let isImmersionActive = !isCurrentExcluded && (isReddit || isReuters || isUserImmersion);

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

  // 生词高亮与沉浸式排除开关
  if (quickExcludeCheck) {
    quickExcludeCheck.checked = isCurrentExcluded;
    quickExcludeCheck.disabled = !isWebPage;
    quickExcludeCheck.addEventListener('change', async (e) => {
      if (!hostname) return;
      const isChecked = e.target.checked;
      isCurrentExcluded = isChecked;

      if (isChecked) {
        if (!currentExcludedSites.some(p => matchesPattern(hostname, p))) {
          currentExcludedSites.push(hostname);
        }
        currentImmersionSites = currentImmersionSites.filter(p => !matchesPattern(hostname, p));
        await chrome.storage.local.set({ lexipro_excluded_sites: currentExcludedSites, lexipro_immersion_sites: currentImmersionSites });
        isUserImmersion = false;
        isImmersionActive = false;
        if (activeTab?.id) {
          chrome.tabs.sendMessage(activeTab.id, { type: 'DISABLE_IMMERSION_FOR_SITE' }).catch(() => {});
        }
      } else {
        currentExcludedSites = currentExcludedSites.filter(p => !matchesPattern(hostname, p));
        await chrome.storage.local.set({ lexipro_excluded_sites: currentExcludedSites });
        isImmersionActive = isReddit || isReuters || isUserImmersion;
      }

      renderPageState();
    });
  }

  // 进站自动翻译开关
  if (quickAutoCheck) {
    quickAutoCheck.checked = isCurrentAutoTranslate;
    quickAutoCheck.disabled = !isWebPage;
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
    if (!isWebPage) {
      envBadge.innerText = '系统/扩展页';
      envBadge.className = 'badge badge-gray';
      specialBox.style.display = 'none';
      if (generalImmersionBox) generalImmersionBox.style.display = 'none';
      connStatusMsg.style.display = 'none';
      if (siteCard) siteCard.style.display = 'none';
      return;
    }

    if (isCurrentExcluded) {
      envBadge.innerText = '已排除高亮';
      envBadge.className = 'badge badge-gray';
      specialBox.style.display = 'none';
      if (generalImmersionBox) generalImmersionBox.style.display = 'none';
      connStatusMsg.style.display = 'none';
      if (siteCard) siteCard.style.display = 'none';
      return;
    }

    if (siteCard) siteCard.style.display = '';

    if (isReddit) {
      envBadge.innerText = 'Reddit 增强';
      envBadge.className = 'badge badge-orange';
    } else if (isReuters) {
      envBadge.innerText = '路透社增强';
      envBadge.className = 'badge badge-orange';
    } else if (isUserImmersion) {
      envBadge.innerText = '沉浸式已开启';
      envBadge.className = 'badge badge-green';
    } else {
      envBadge.innerText = '通用网页 (轻量查词模式)';
      envBadge.className = 'badge badge-green';
    }

    if (isImmersionActive) {
      specialBox.style.display = 'block';
      if (generalImmersionBox) generalImmersionBox.style.display = 'none';

      if (btnDisableImmersion) {
        btnDisableImmersion.style.display = (!isReddit && !isReuters && isUserImmersion) ? 'inline-block' : 'none';
      }

      if (!pageState) {
        connStatusMsg.style.display = 'none';
        btnSiteTranslateText.innerText = '一键翻译全页内容';
      } else {
        connStatusMsg.style.display = 'none';
        if (pageState.jobState === 'running') {
          btnSiteTranslateText.innerText = `⏳ 正在翻译 (${pageState.translatedCount}/${pageState.totalCount})`;
        } else if (pageState.failedCount > 0) {
          btnSiteTranslateText.innerText = `⚠️ 重试失败段落 (${pageState.failedCount})`;
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
        btnSiteTranslateText.innerText = '⏳ 正在重试...';
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
        connStatusMsg.innerText = '页面通信中断，请刷新后重试。';
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
