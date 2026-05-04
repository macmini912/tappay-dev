# TapPay GitHub Pages Deploy

Clean static deploy bundle for GitHub Pages.

Source workspace: `/Users/macmini/.openclaw/workspace/tappay-github-pages`

## GitHub Pages setup

1. Create a new GitHub repository.
2. Push the contents of this folder to the repository.
3. In GitHub, go to `Settings > Pages`.
4. Set the source to `GitHub Actions`.
5. Use the generated `https://USERNAME.github.io/REPO/` URL.

This folder intentionally does not include a `CNAME`, `_worker.js`, `_routes.json`, backup files, or an existing `.git` directory.

## Backend status

TapPay is intentionally not connected to the existing CartSkip backend.

Current TapPay backend:

```text
https://nvcothattawepepsbihg.functions.supabase.co/tappay-api
```
