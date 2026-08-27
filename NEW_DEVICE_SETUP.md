# New Device Setup

Both folders are independent Git repositories. Clone each repository into the new device; do not copy `.git` folders manually.

## Clone

```powershell
mkdir C:\flutter_project\neet_pg_tools_flutter
cd C:\flutter_project\neet_pg_tools_flutter
git clone git@github.com:AnanthuKaripot/webpage-for-pathexor.git "pathexor web"
git clone git@github.com:AnanthuKaripot/telegram_miniapp_manager.git telegram_miniapp_manager
```

## Static websites

No build step is required. GitHub Pages serves the committed HTML, CSS, JavaScript, JSON, and image files directly.

## Telegram bot

Install Node.js, then install the locked dependencies:

```powershell
cd C:\flutter_project\neet_pg_tools_flutter\telegram_miniapp_manager\bot
npm ci
```

The Cloudflare account and KV namespace are configured in `wrangler.toml`. The Telegram token is not stored in Git. Add it after authenticating:

```powershell
npx wrangler login
npx wrangler secret put BOT_TOKEN
npm run deploy
```

Alternatively, set `CLOUDFLARE_API_TOKEN` for the current PowerShell session and run `npm run deploy:win`. Never commit API tokens, `.dev.vars`, or `.env` files.

## Verify after cloning

```powershell
git status --short --branch
node --check bot\src\index.js
python -m py_compile bot\scripts\quiz_generator.py
npx wrangler deploy --dry-run
```

The quiz timer measures elapsed answering time and records only time spent before an answer. Time spent reading the explanation is excluded from the tie-breaker.