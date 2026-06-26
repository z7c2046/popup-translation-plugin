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
