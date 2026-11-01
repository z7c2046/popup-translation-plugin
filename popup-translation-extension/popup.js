/**
 * LexiPro - Popup Script
 */

document.addEventListener('DOMContentLoaded', async () => {
  const envBadge = document.getElementById('env-badge');
  const envHint = document.getElementById('env-hint');
  const specialBox = document.getElementById('special-action-box');
  const specialTitle = document.getElementById('special-title');
  const btnSiteTranslate = document.getElementById('btn-site-translate');
  const btnSiteTranslateText = document.getElementById('btn-site-translate-text');
  const btnOpenOptions = document.getElementById('btn-open-options');
  const quickThemeSelect = document.getElementById('quick-theme-select');
  const quickStyleSelect = document.getElementById('quick-style-select');
  const quickAutoCheck = document.getElementById('quick-auto-check');
  const quickAutoLabel = document.getElementById('quick-auto-label');

  // 读取并设置当前翻译样式与自动翻译开关
  const storedConfig = await chrome.storage.local.get({
    lexipro_site_translation_style: 'replace',
    lexipro_site_auto_translate: false
  });

  if (quickStyleSelect) {
    quickStyleSelect.value = storedConfig.lexipro_site_translation_style || 'replace';
    quickStyleSelect.addEventListener('change', async (e) => {
      const val = e.target.value;
      await chrome.storage.local.set({ lexipro_site_translation_style: val });
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

  // 获取当前标签页
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = activeTab?.url || '';

  const isReddit = /https:\/\/[^/]*\.reddit\.com/i.test(url);
  const isReuters = /https:\/\/[^/]*\.reuters\.com/i.test(url);

  if (isReddit) {
    envBadge.innerText = 'Reddit (专属增强)';
    envBadge.className = 'badge badge-orange';
    envHint.innerText = '检测到 Reddit 页面，右下角已就绪专属双语翻译悬浮胶囊。';
    specialBox.style.display = 'block';
    specialTitle.innerText = '⚡ Reddit 帖子与评论一键翻译';
    btnSiteTranslateText.innerText = '翻译 Reddit 帖子与所有评论';
  } else if (isReuters) {
    envBadge.innerText = '路透社 (专属增强)';
    envBadge.className = 'badge badge-orange';
    envHint.innerText = '检测到路透社新闻页面，右下角已就绪专属双语翻译悬浮胶囊。';
    specialBox.style.display = 'block';
    specialTitle.innerText = '⚡ 路透社新闻一键全文翻译';
    btnSiteTranslateText.innerText = '翻译路透社文章正文与标题';
  } else {
    envBadge.innerText = '通用网页 (全功能)';
    envBadge.className = 'badge badge-green';
    envHint.innerText = '划词翻译与生词高亮均已生效，鼠标在网页中划选任意英文即可弹出动森字典。';
    specialBox.style.display = 'none';
  }

  // 触发站点翻译
  btnSiteTranslate.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          const btn = document.querySelector('#lexipro-site-fab');
          if (btn) btn.click();
        }
      });
      window.close();
    } catch (e) {
      alert('已激活！请直接在网页右下角点击悬浮翻译胶囊。');
      window.close();
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

