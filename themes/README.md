# TapPay themes

TapPay keeps storefront behavior in `app.js` and theme presets in `themes/index.js`.

To add a custom theme:

1. Add a new entry to `THEME_PRESETS`.
2. Give it a stable `id`, display `name`, and `settings` overrides.
3. Open Admin → Settings → Theme preset, choose the theme, then Save Settings.

Theme settings may be partial. Missing values fall back to the TapPay default.

Common style keys:

- `pageBg`
- `panelBg`
- `cardBg`
- `headerBg`
- `footerBg`
- `textColor`
- `mutedColor`
- `accentColor`
- `buttonTextColor`
- `productImageBg`
- `cornerStyle` (`square` or `rounded`)

Theme presets can also provide brand/content defaults like `wordmarkTop`, `introTitle`, or `footerText` when a full branded theme should ship with its own copy.
