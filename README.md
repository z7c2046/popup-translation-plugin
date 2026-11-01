# Popup Translation Plugin

Tampermonkey userscript for selection translation, Notion vocabulary sync, and highlighted vocabulary lookup.

## Sub-projects

- [`popup-translation-extension/`](./popup-translation-extension/): **Popup Translation 完整版 Chrome 扩展**（Manifest V3 架构），可在 Chrome `chrome://extensions/` 中直接开启开发者模式并以「加载已解压的扩展程序」导入使用。完整包含划词翻译、Notion 生词高亮、动森 UI 字典弹窗，以及本次新增的 **Reddit 帖子/评论** 与 **路透社 (Reuters) 新闻** 一键双语全文翻译！

## Configuration

This repository does not store API credentials. Configure them in Tampermonkey storage before use:

- `lexipro_sf_api_key`
- `lexipro_sf_model` (optional, defaults to `Qwen/Qwen2.5-7B-Instruct`)
- `lexipro_disable_thinking` (optional, boolean, defaults to `true` to disable deep thinking for sub-second responses)
- `lexipro_kimi_refresh_token` (for Kimi free web mode)
- `lexipro_kimi_access_token` (for Kimi free web mode)
- `lexipro_notion_token`
- `lexipro_notion_database_id`

## Version History

### 1.0

- Initial tracked version.
- Selection translation is triggered by hovering over the floating dot.
- Known issue: hover activation is fast but easy to trigger accidentally.

### 1.1

- Changes the floating dot activation mode from hover to click.
- Reduces accidental translation popups while moving the mouse across a page.
- Keeps the original translation, highlighting, cache, and Notion sync behavior.

### 4.2.0 Animal Island UI

- Replaces the popup and highlight styling with an Animal Island UI inspired visual system.
- Adds warm paper colors, mint accents, rounded capsule controls, dotted texture, and pressed button shadows.
- Keeps the 1.1 click activation behavior to avoid hover mis-triggering.

### 4.3.6

- Preserves all selected text when a page mixes semantic list items with `div`-based article paragraphs.
- Keeps headings, list items, and paragraphs at the popup's configured font size while retaining their structure.

### 4.3.7

- Resets and persists the popup font size to the code default when the font-size toolbar controls are disabled.

### 4.3.8

- Replaces the persistent `A− / A＋` toolbar controls and settings switch with one compact `Aa` button and an on-demand font-size popover.
- Adds explicit decrease, increase, current-value, and reset controls; closing the popover no longer changes the saved font size.
- Uses a 15 px default, a 12–20 px integer range, and lighter body/list/heading weights for a clearer Chinese reading hierarchy.

### 4.3.9

- 对齐字号面板与加减复位按钮的 `animal-island-ui` 动森原生组件样式，正圆形加减按钮与胶囊复位按钮完全继承工具栏按钮视觉。
- 字号弹出框作为 Shadow DOM 独立同级浮层展示，不会因内容较少而撑大主翻译框，且不遮挡任何文本。
- 恢复主翻译框 `overflow: hidden; resize: both;` 属性，恢复右下角 Windows 原生拖拽改变大小功能。

### 4.4.0

- 修复划词选区中若包含生词高亮 `span` 标签（如生词本匹配词），选区结构提取器将其误识别为独立 Block 导致标题或段落被切碎换行的 bug。
- 优化 Block 归属算法，确保内联标签（`span`, `a`, `b`, `i`, `strong` 等）从属于其外层块容器或根选区，保持标题和段落的整体翻译格式。
- 扩展 `PRESERVED_BLOCK_SELECTOR` 标签库，完整涵盖 `pre`, `tr`, `figure`, `summary`, `details` 等 HTML 块级元素。

### 4.5.0

- 接入 **Kimi (网页免费版)** 翻译引擎，支持基于 `refresh_token` 与 `access_token` 的逆向流式对话协议。
- 具备 401 鉴权失效自动无感刷新 Token 并持久化存储机制，附带 20 位 `X-Traffic-Id` 设备指纹与防跨域请求头伪装。
- 设置面板新增 Kimi Token 配置项、明密文一键切换按钮（👁️）与获取指引。
- 增强 JSON 容错清洗算法（`extractJsonFromContent`），支持包裹在 Markdown 代码块或额外文本中的结构化数据提取。
- 移除智谱 GLM 服务商，保留并兼容硅基流动。

### 4.5.1

- 修复生词高亮在现代 Flex 容器（如 Kimi / ChatGPT 等 Web 应用）下纵向被强行拉伸的问题。
- 注入 `align-self: baseline`、`display: inline`、`box-sizing: border-box` 等全套防御性样式，避免高亮元素撑大宿主气泡高度或排版变形。

### 4.5.2

- 修复在打字机渐显（Typewriter）或后台 API 流式解析进行中点击设置面板导致释义数据截断、停滞在一半的 bug。
- 将设置面板（`#imt-settings`）与释义容器（`#imt-content`）彻底物理隔离为独立视图容器。
- 切换到设置面板时不再销毁释义 DOM，打字机特效与网络请求在后台持续完整执行；关闭设置面板后无缝呈现完整内容。
- 新增 `tests/typewriter-settings.test.cjs` 自动化测试保障。

### 4.5.4

- 硅基流动全面转为纯免费模型矩阵，彻底移除所有付费模型（包括 DeepSeek 系列）：
  - `Qwen/Qwen2.5-7B-Instruct`（默认推荐，经典 7B 高质通用指令与翻译模型）
  - `Qwen/Qwen3.5-4B`（超长 256K 上下文、原生多模态极速模型）
  - `Qwen/Qwen3-8B`（131K 上下文、支持思考与通用对话双模式）
  - `THUDM/GLM-4-9B-0414`（智谱开源通用 9B 模型）
- 增加免费模型有效性校验与安全迁移机制：若本地 Tampermonkey 存储中残留任何旧模型或付费模型，自动回退至默认免费模型 `Qwen/Qwen2.5-7B-Instruct`。
- 新增 `tests/model-options.test.cjs` 单元测试保障。

### 4.5.5

- 设置面板新增「关闭深度思考」选项（动森经典 Organic Switch）：
  - 针对支持推理思考的模型（如 `Qwen/Qwen3-8B` 等），支持一键开启或关闭模型长思维链思考。
  - 默认开启「关闭深度思考」，通过注入 `enable_thinking: false` 与 `thinking: { type: 'disabled' }` 参数，使查词与翻译响应自 15~20 秒大幅缩减至 1 秒以内，彻底消除超长思考超时与达到 Token 上限风险。
  - 用户可随时在设置面板切换：关闭时极速直出翻译（显示绿色徽章「已关闭思考（极速直出）」）；开启时保留完整模型深度思维链推理（显示「未关闭（深度推理）」）。
  - 状态实时通过 `GM_setValue('lexipro_disable_thinking')` 持久化，并与服务商通信协议无缝打通。
- 新增 `tests/thinking-settings.test.cjs` 自动化单元测试保障。

### 4.5.6

- 精简优化 AI 单词翻译 System Prompt（提示词）：
  - 单词查询模式（英文单词 `en_word` / 中文词语 `zh_word`）彻底移除同义词（synonyms）、反义词（antonyms）、近义词要求。
  - 明确增加指令约束（`Vocabulary rules for Mode 1 & Mode 2: Do NOT include synonyms, antonyms, or related words`），杜绝大模型额外输出冗余词汇。
  - 核心保留：音标、词性缩写（pos）、精准释义及双语对照例句。
  - 同步精简 UI 渲染层，去除同义词/反义词区域，使弹窗更加清爽聚焦，大幅缩减输出 Token 长度并加快生成响应速度。
  - 新增 `tests/prompt-refinement.test.cjs` 自动化单元测试保障。

### 4.6.0

- **视觉与交互全面重构**：
  - **全新蓝紫微光科技图标**：摒弃原有大橙色块，采用深邃蓝紫微光渐变（#2563EB - #7C3AED）与圆角质感双语字符设计；
  - **深色磨砂黑极光悬浮胶囊**：悬浮按钮升级为磨砂半透明深色毛玻璃胶囊（Dark Frosted Glass），搭配发光指示器，小巧紧凑、支持自由拖拽与吸附，不遮挡 Reddit 内容。
- **全新支持三种翻译显示样式与进站自动翻译开关（双端支持，一键即时热切换）**：
  - **进入页面自动翻译 (Auto-translate)**：设置中心或悬浮菜单中开启后，打开 Reddit 帖子或路透社新闻时无需手动点击，自动完成整页翻译；深度支持 Reddit SPA 路由监听；
  - **沉浸直接替换（默认推荐）**：直接沿用 Reddit 帖子和评论原有的 HTML 标签、字号、字体与行高排版，仅将其中的英文替换为中文，视觉上天衣无缝；
  - **下划线双语对照**：上面显示英文原文，下方紧跟带有优雅虚线下划线的中文译文，字体字号直接继承原文，无多余边框遮挡；
  - **独立轻量卡片**：在原文下方内嵌柔和微卡片，提供微型复制与折叠按钮。
- **新增 Reddit 帖子与多层级评论一键翻译功能**：
  - 在 Reddit 页面（`*.reddit.com`）右下角自动激活专属悬浮胶囊，支持自由拖拽与吸附记忆；
  - 一键并发批量翻译帖子标题、正文与各级嵌套评论；
  - 动态侦测向下滚动加载的新评论，胶囊自动显示增量未翻译角标（如 `+12`）。
- **新增路透社 (Reuters) 新闻一键全文翻译功能**：
  - 在路透社新闻页面（`*.reuters.com`）右下角自动激活专属悬浮胶囊；
  - 一键并发翻译文章大标题、导语摘要与正文全部段落，智能过滤作者署名与版权小字；
  - 支持一键「📋 复制译文」、「折叠/展开」与「还原为英文原文」。
- **全新系统级 Chrome 扩展 `popup-translation-extension/`**：
  - 基于 Chrome 官方 Manifest V3 标准构建，彻底规避脚本体积膨胀带来的阅读与管理复杂度；
  - 完整继承油猴脚本的所有能力：全网划词翻译、动森原生 UI 字典弹窗、Notion 生词本增量同步（SWR）、页面彩色生词气泡高亮、输入框中英互译；
  - 同步集成三种翻译样式、Reddit 与路透社一键全文翻译增强功能，开箱即用，直接通过 Chrome 扩展管理界面加载已解压程序即可使用。
- 新增 `tests/chrome-extension.test.cjs` 自动化测试套件。
