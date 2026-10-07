# Popup Translation Plugin

Tampermonkey userscript for selection translation, Notion vocabulary sync, and highlighted vocabulary lookup.

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


