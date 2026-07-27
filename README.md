# Popup Translation Plugin

Tampermonkey userscript for selection translation, Notion vocabulary sync, and highlighted vocabulary lookup.

## Configuration

This repository does not store API credentials. Configure them in Tampermonkey storage before use:

- `lexipro_sf_api_key`
- `lexipro_sf_model` (optional, defaults to `Qwen/Qwen2.5-14B-Instruct`)
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
