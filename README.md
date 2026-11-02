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
### 4.6.1 流式并发与沉浸原文切换

- **前 10 条高优先级即时流式上屏（Progressive Streaming Render）**：
  - 彻底改变等待整页加载完成才展示的旧逻辑，收集元素后自顶向下严格按页面视觉位置排序；
  - 优先切出最顶部的 10 条内容（帖子标题、正文及前排热评），以极小批次并发竞速极速发出并在 1~2 秒内**即时上屏渲染**；
  - 后续评论条目交由后台 4 并发 Worker 流式消费，边翻译边动态上屏，用户边滚动边看，无需等待成百上千条全部加载。
- **多模型轮询并发与竞速重试机制（Multi-model Round-robin & Racing Fallback）**：
  - 硅基流动（SiliconFlow）内置免费模型调度池（`Qwen/Qwen2.5-7B-Instruct`, `THUDM/GLM-4-9B-0414`, `Qwen/Qwen3.5-4B`, `Qwen/Qwen3-8B` 等）；
  - 并发任务轮询分摊给不同模型，分流并发压力并彻底规避单模型限流；若单个请求遇到超时或报错，自动无缝切换备选模型竞速重试。
- **沉浸式替换模式新增「显示原文 / 切换译文」交互**：
  - 在沉浸直接替换原生字体模式下，在被替换的中文旁边轻量挂载半透明胶囊按钮 `[🌐 原文]`；
  - 点击即可在原汁原味英文原文与中文译文之间无缝自由切换；支持悬停原生 tooltip 显示原文。
- **悬浮胶囊 FAB 视觉体验调优**：
  - 胶囊最小高度提升至 `44px`，加大上下内边距（`padding: 10px 20px`），整体更加圆润饱满；
  - 默认离底边高度提升至 `40px`，避免紧贴屏幕底部造成遮挡或误触。
- **输入框三连击空格智能定向双向互译与问句防回答防护**：
  - 前端引入高精度语言检测：检测到输入包含中文时，明确下发「中文 -> 英文」专属单向指令；若为英文，则下发「英文 -> 中文」指令；
  - 增加严格负向约束（`Do NOT answer the question`）：针对输入诸如「为什么不购买SNXX」等问句时，彻底杜绝大模型误以为向其提问而生成答复的问题，确保 100% 仅输出纯正地道的翻译句子；
  - 增强针对 Reddit 等现代化复杂富文本输入框（React / LitElement / ContentEditable）的兼容性，引入 `setNativeInputValue` 原生原型 Setter 赋值与 `InputEvent` 事件广播，确保替换后即时上屏且不被框架状态还原。
- **Notion 401 异常隔离与失效 Token 智能迁移清洗**：
  - 移除原代码硬编码的失效测试 Token，初始化时自动清洗本地失效的遗留配置；
  - 未配置 Notion 时安全跳过同步请求，并在全链路增设全局异常隔离，彻底消除控制台 `Uncaught (in promise) Error: HTTP 401` 报红。
- **修复 Reddit 页面收集内容时的 `ReferenceError: S is not defined` 报错**：
  - 修复 `addSiteItem` 中过滤纯网址的正则表达式由于转义字符丢失变成 `if (/^https?://S+$/i.test(text))` 的问题，恢复为标准的 `/^https?:\/\/\S+$/i`，杜绝将 `S` 误识别为未声明变量的问题。
### 4.6.2 Market Desk 金融终端配色移植与正文结构防御

- **修复 Reddit 翻译中正文突然消失的严重问题**：
  - **根本原因**：页面滚动触发 MutationObserver 重新收集 DOM 时，旧代码缺少父子节点互斥过滤，导致内部子节点被重复收集并发生跨批次覆盖坍缩；
  - **深度防御**：在 `addSiteItem` 中引入祖先与子孙全链路互斥保护（`closest('[data-lexipro-site-id]')`），精准提取真正包含正文内容的文本层；并在 `applyItemStyle` 沉浸式替换中引入 `white-space: pre-wrap` 与 `min-height: 1em`，彻底杜绝 DOM 结构坍缩或被 Reddit 移除。
- **1:1 移植 `market_desk_skeleton_demo.html` 金融终端高级深浅模式配色**：
  - 提取 Market Desk 核心色板（深色 `#0b0d10`, `#14171b`, `#191d22`, `#262b31`, `#548afa`, `#31c39a`, `#f06e75` 及对应白天高质感浅色板）；
  - 全面重塑右下角 FAB 悬浮胶囊、多功能二级菜单与各级控制按钮，支持随系统或网页暗黑/明亮环境无缝自适应。
- **美化重塑【原文 / 译文】微型操作胶囊**：
  - 彻底摒弃粗糙的浅紫色圆框，重做为 Market Desk 金融微型操作胶囊（Micro-Pill，圆角 6px、精细冷灰边框、`ui-monospace` 字体与 `⇄ 原文` 极简符号）；
  - 点击平滑在 `⇄ 原文` 与高光状态的 `⇄ 译文` 间无缝切换，完全融入现代专业网页排版。
- **全新双视觉皮肤体系（Theme System）**：
  - **Market Desk（金融终端高级深浅模式 · 默认推荐）**：专业沉稳、自适应白天与黑夜；
  - **动森经典（Animal Island 温馨纸质小清新 · 可选）**：保留手作温润奶油米黄、薄荷绿与柔和阴影；
  - 在选项设置中心（Options）、工具栏弹出菜单（Popup）及悬浮面板中均可一键即时热切换。
- **油猴脚本与 Chrome 扩展双端 100% 严格同步更新**。
- 自动化测试套件 `tests/chrome-extension.test.cjs` 同步扩充断言保障。

### 4.6.3 蓝图体验架构全面升级与双端可信实现 (基于 GEMINI_TRANSLATION_UX_BLUEPRINT)

- **Popup 与 Content 通信重构，彻底杜绝脆弱 Scripting 注入**：
  - 移除对 `chrome.scripting.executeScript` 的非法特权依赖，重构为标准的 `chrome.tabs.sendMessage` 消息机制（`GET_PAGE_STATE`, `START_PAGE_TRANSLATION`, `RETRY_FAILED`, `TOGGLE_ORIGINAL` 等）；
  - 增加真实页面连接感知，连接中或未注入页面友好提示「请刷新网页后重试」，杜绝假报成功与自动关闭面板；
  - 修复 `quick-theme-select` 主题切换未接线问题，支持即时保存与多标签页热更新。
- **真实模型覆盖与备用模型轮询 (Model Override in Effect)**：
  - 修复 `requestLLMChatCompletion` 未解构 `modelOverride` 参数的根本缺陷，确保重试和轮询时实际发送的 HTTP 请求 `body.model` 严格采用指定备选模型；
  - 页面级翻译请求引入 `requestScope: 'page'`，与划词查词请求句柄物理隔离，避免划词查词时误杀正在执行的页面翻译。
- **后台代理超时全覆盖与客户端主动中止**：
  - `background.js` 中 `timer` 移入 `try...finally`，确保超时计时器覆盖包含响应体读取在内的完整数据流；
  - 扩展桥 `GM_xmlhttpRequest` 具备唯一 `requestId`，在调用 `.abort()` 时向后台派发 `GM_XHR_ABORT` 消息真实终止底层 Fetch，并正确调用 `onabort` 使 Promise 妥善 settle，杜绝异步悬挂。
- **原生 DOM 深度保留渲染 (DOM Preservation)**：
  - 彻底摒弃反序列化重写 `innerHTML` 的破坏性做法，创建独立的 `origWrapper` 原生子节点专属容器保留原有 DOM 树及 React 事件绑定；
  - 切换原文时仅切换显示样式与胶囊状态，不销毁节点，无额外网络消耗；还原网页时原生节点完整无损。
- **SPA 换页隔离与 Generation 生命周期管理**：
  - 引入 `siteGeneration` 自增代数与路由监听；当用户在 Reddit 等单页应用中前进/后退/切帖时，立即自增代数并终止上一代请求、清空旧状态，异步回包校验代数，杜绝旧页面数据污染新页面。
- **失败条目精准单项重试与可信状态机**：
  - 维护清晰状态机（`pending`, `translating`, `done`, `failed`），支持 `runSiteTranslation({ retryFailedOnly: true })` 仅重试失败项，绝不重复翻译已完成条目；
  - 修复零正文时虚假提示「全部完成」的缺陷，准确反馈未完成数量与重试入口。
- **WCAG 高对比度与 `--lp-*` 语义色板规范**：
  - 全面引入蓝图规范语义 Token（`--lp-bg`, `--lp-surface`, `--lp-text`, `--lp-text-secondary`, `--lp-primary` 等）；
  - 将次要提示文本对比度由原先的 2.43:1 大幅提升至 5.82:1，彻底满足 WCAG AA 级要求；
  - 彻底修复 CSS 中将 DOM 选择器误写进 `@media` 列表的语法错误。
- **Options 设置中心重构与本地实时预览**：
  - 增加本地静态排版效果预览区（固定提供真实英文新闻与评论示例，随模式与主题切换即时展示排版效果，零网络消耗）；
  - 规范化配置保存语义，用户清空 API Key 时严格保存为空，不暗中回填内置 Key。
- **测试套件全面升级**：
  - 新增 `tests/blueprint-ux.test.cjs` 蓝图规范自动化验收测试，现存 8 个测试套件全部通过（8/8 pass）；
  - 更新 `audit/2026-11-02/audit-probes.cjs` 与 `audit-results.json`，验证修复后所有探针全绿。

### 4.7.0 全局网页/例句单词点击高亮与 [读音 | AI 解释] 悬浮操作胶囊

- **全新全局单字点击查词交互 (Word Action Capsule)**：
  - 彻底打破以往仅靠划选拉框查词的传统限制，在当前网页的正文任意位置、以及词典弹窗内的例句中，**直接单击任意英文单词**即可触发交互；
  - 被点击的单词即时获得视觉聚焦反馈：包裹柔和浅青绿高亮背景（`#E6F7F8`）与优雅的蓝色虚线下划线（`border-bottom: 1.5px dashed #2563EB`）；
  - 单词正下方居中弹出暗黑墨灰质感的微型操作悬浮胶囊（Word Action Capsule），带有向上小三角精准指向当前单词。
- **胶囊内置三项一体化核心功能**：
  - **单词标题**：清晰显示当前锁定的单词原型；
  - **🔊 读音**：点击直接调用 Edge 自然语音 / 有道词典高保真发音接口朗读该单词；
  - **✨ AI 解释**：点击直接激活大语言模型（SiliconFlow / Kimi）深度解析引擎，无缝呼出标准动森 UI 字典弹窗并实时渲染音标、词性、精准释义与双语对照例句。
- **与生词高亮及拖拽划选的完美防冲突机制**：
  - **生词高亮解耦**：Notion 知识库同步的高亮生词保持原有的鼠标悬停（`mouseenter`）展示速查气泡逻辑；用户单击普通单词或生词时优先激活点词胶囊，互不干扰、互斥关闭，彻底消除重叠打架；
  - **拖拽划选解耦**：引入鼠标微小位移判定（`dist < 5px`）；用户拖拽划选一长句或多词短语时，依然触发经典的小圆点划词翻译机制；仅纯粹的鼠标单击才触发单字点词胶囊；
  - **无损 DOM 还原机制**：点击空白处、滚动屏幕或按下 Escape 键时，胶囊优雅淡出，临时包裹的高亮节点自动通过 `unwrap` 恢复为原始纯文本节点（`parent.normalize()`），不残留任何垃圾 DOM，对 React/Vue/SPA 网页框架 100% 零污染。
- **油猴脚本与 Chrome 扩展双端 100% 严格同步更新**。
- 新增 `tests/word-action-capsule.test.cjs` 自动化单元测试保障，全部 9 项测试套件持续全绿。

### 4.7.1 单字悬浮胶囊 [AI 解释 | 读音] 事件穿透与 Closed Shadow DOM 坐标判定修复

- **修复点击胶囊 [✨ AI 解释] 按钮无弹窗响应的阻断性缺陷**：
  - **根本原因排查**：宿主 Shadow DOM 使用了 `mode: 'closed'`，在外部全局 `document.addEventListener('click', ..., true)` 捕获阶段，事件的 `e.composedPath()` 无法透传 Shadow DOM 内部闭包节点，导致 `path.includes(wordActionCapsule)` 恒判为 `false`；文档点击监听器误判点击发生在胶囊外部，在事件冒泡到按钮前提前清空了 `activeWordText` 并重新在点击坐标提取下层网页文本，导致胶囊重新初始化而词典弹窗无法弹出。
  - **精准坐标判定防御 (`isClickInsideCapsule`)**：新增基于视口物理坐标的边界判定函数 `isClickInsideCapsule(e)`，在捕获阶段首行拦截点击事件。只要点击落在胶囊物理视口边界（`getBoundingClientRect()`）内，直接放行，杜绝任何提前清空或重复查词。
  - **双向数据持久绑定 (`dataset.word`)**：在展示胶囊时同步将目标单词存入 `wordActionCapsule.dataset.word` 与 `capsuleAiBtn.dataset.word`，即使外部全局变量发生抖动，按钮亦能 100% 稳定读取当前锁定的英文单词。
  - **双重查词入口支持**：不仅支持点击 `[✨ AI 解释]` 呼出词典弹窗，同时将胶囊内的单词文本本身升级为可点击状态（`cursor: pointer`），点击单词名称或 AI 解释按钮均可直接调用 `triggerFetch(word)` 弹出动森 UI 词典。
  - **胶囊事件阻断传播**：为 `wordActionCapsule` 增加 `click` 与 `mousedown` 的 `e.stopPropagation()`，彻底杜绝胶囊内点击向宿主页面外溢。
- **单字点击查词（下标操作胶囊）作用域精准限定**：
  - 依据设计规范，宿主网页正文单词点击交互（高亮背景、虚线下划线及下标悬浮胶囊）**严格限定在全局沉浸式翻译页面出现**（如 Reddit、路透社 Reuters 等专属沉浸式增强站点，以及处于沉浸式翻译状态下的页面）以及标准词典弹窗的双语例句中；
  - 在全网其他日常普通网页（如 Google、GitHub、Baidu 等）中保持纯净无干扰体验，日常单击不弹出下标胶囊，继续保留经典的拖拽长句/短语划选触发小圆点翻译机制。
- **油猴脚本与 Chrome 扩展双端 100% 严格同步修复**。
- 自动化测试用例全面强化并保持 9/9 持续全绿。
