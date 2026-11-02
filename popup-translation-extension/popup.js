/**
 * LexiPro - Popup Script
 * 遵循 GEMINI_TRANSLATION_UX_BLUEPRINT 规范：真实消息交互、状态感知与零脚本注入特权依赖
 */

document.addEventListener('DOMContentLoaded', async () => {
  const envBadge = document.getElementById('env-badge');
  const envHint = document.getElementById('env-hint');
  const connStatusMsg = document.getElementById('conn-status-msg');
  const specialBox = document.getElementById('special-action-box');
  const specialTitle = document.getElementById('special-title');
  const btnSiteTranslate = document.getElementById('btn-site-translate');
  const btnSiteTranslateText = document.getElementById('btn-site-translate-text');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const quickThemeSelect = document.getElementById('quick-theme-select');
  const quickStyleSelect = document.getElementById('quick-style-select');
  const quickAutoCheck = document.getElementById('quick-auto-check');
  const quickAutoLabel = document.getElementById('quick-auto-label');

  // 读取并初始化当前配置
  const storedConfig = await chrome.storage.local.get({
    lexipro_ui_theme: 'market_desk',
    lexipro_site_translation_style: 'replace',
    lexipro_site_auto_translate: false
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

  if (quickAutoCheck) {
    quickAutoCheck.checked = Boolean(storedConfig.lexipro_site_auto_translate);
    if (quickAutoLabel) {
      quickAutoLabel.innerText = quickAutoCheck.checked ? '已开启' : '已关闭';
      quickAutoLabel.style.color = quickAutoCheck.checked ? '#10B981' : '#475569';
    }
    quickAutoCheck.addEventListener('change', async (e) => {
      const isChecked = e.target.checked;
      await chrome.storage.local.set({ lexipro_site_auto_translate: isChecked });
      if (quickAutoLabel) {
        quickAutoLabel.innerText = isChecked ? '已开启' : '已关闭';
        quickAutoLabel.style.color = isChecked ? '#10B981' : '#475569';
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

  let pageState = null;
  if (activeTab?.id && (isReddit || isReuters)) {
    try {
      pageState = await chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PAGE_STATE' });
    } catch (e) {
      pageState = null;
    }
  }

  function renderPageState() {
    if (isReddit) {
      envBadge.innerText = 'Reddit (专属增强)';
      envBadge.className = 'badge badge-orange';
      specialBox.style.display = 'block';
      specialTitle.innerText = '⚡ Reddit 帖子与评论专属增强';

      if (!pageState) {
        envHint.innerText = '已定位 Reddit 网页。';
        connStatusMsg.style.display = 'block';
        connStatusMsg.innerText = '⚠️ 此页面尚未连接到扩展脚本。若刚打开请刷新网页后重试。';
        btnSiteTranslateText.innerText = '连接中 (请刷新页面)...';
      } else {
        connStatusMsg.style.display = 'none';
        envHint.innerText = '右下角已就绪专属翻译悬浮胶囊，已检测到正文内容。';

        if (pageState.jobState === 'running') {
          btnSiteTranslateText.innerText = `⏳ 正在翻译中 (${pageState.translatedCount}/${pageState.totalCount})...`;
        } else if (pageState.failedCount > 0) {
          btnSiteTranslateText.innerText = `⚠️ 重试未完成段落 (${pageState.failedCount}条)`;
        } else if (pageState.jobState === 'completed') {
          btnSiteTranslateText.innerText = pageState.isShowingOriginal ? '返回中文译文' : '查看英文原文';
        } else {
          btnSiteTranslateText.innerText = '一键翻译 Reddit 帖子与评论';
        }
      }
    } else if (isReuters) {
      envBadge.innerText = '路透社 (专属增强)';
      envBadge.className = 'badge badge-orange';
      specialBox.style.display = 'block';
      specialTitle.innerText = '⚡ 路透社新闻专属增强';

      if (!pageState) {
        envHint.innerText = '已定位路透社新闻网页。';
        connStatusMsg.style.display = 'block';
        connStatusMsg.innerText = '⚠️ 此页面尚未连接到扩展脚本。若刚打开请刷新网页后重试。';
        btnSiteTranslateText.innerText = '连接中 (请刷新页面)...';
      } else {
        connStatusMsg.style.display = 'none';
        envHint.innerText = '右下角已就绪专属新闻全文翻译悬浮胶囊。';

        if (pageState.jobState === 'running') {
          btnSiteTranslateText.innerText = `⏳ 正在翻译中 (${pageState.translatedCount}/${pageState.totalCount})...`;
        } else if (pageState.failedCount > 0) {
          btnSiteTranslateText.innerText = `⚠️ 重试未完成段落 (${pageState.failedCount}条)`;
        } else if (pageState.jobState === 'completed') {
          btnSiteTranslateText.innerText = pageState.isShowingOriginal ? '返回中文译文' : '查看英文原文';
        } else {
          btnSiteTranslateText.innerText = '一键翻译路透社文章正文';
        }
      }
    } else {
      envBadge.innerText = '通用网页 (全功能)';
      envBadge.className = 'badge badge-green';
      envHint.innerText = '划词翻译与生词高亮均已生效，鼠标在网页中划选任意英文即可弹出动森字典。';
      specialBox.style.display = 'none';
      connStatusMsg.style.display = 'none';
    }
  }

  renderPageState();

  // 触发站点翻译或模式切换操作
  btnSiteTranslate.addEventListener('click', async () => {
    if (!activeTab?.id) return;

    if (!pageState) {
      if (connStatusMsg) {
        connStatusMsg.style.display = 'block';
        connStatusMsg.innerText = '此页面尚未连接到扩展。请刷新网页后重试。';
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
  btnOpenOptions.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
});
