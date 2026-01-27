# Deployment Guide

## Prerequisites

1. **Node.js** — Install from [nodejs.org](https://nodejs.org/)
2. **Cloudflare Account** — Sign up free at [cloudflare.com](https://cloudflare.com)
3. **Telegram Bot Token** — Get from [@BotFather](https://t.me/BotFather)

---

## Step 1: Install Dependencies

```bash
cd bot
npm install
```

---

## Step 2: Login to Cloudflare

```bash
npx wrangler login
```

This opens a browser to authenticate.

---

## Step 3: Add Bot Token as Secret

```bash
npx wrangler secret put BOT_TOKEN
```

When prompted, paste your bot token from BotFather.

---

## Step 4: Deploy

```bash
npm run deploy
```

After deployment, Wrangler will show your worker URL like:
```
https://pathscheduler-telegram-bot.<your-subdomain>.workers.dev
```

**Copy this URL** — you'll need it next.

---

## Step 5: Set Telegram Webhook

Replace `YOUR_BOT_TOKEN` and `YOUR_WORKER_URL` in this command:

```bash
curl -X POST "https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=YOUR_WORKER_URL"
```

**Example:**
```bash
curl -X POST "https://api.telegram.org/bot123456:ABC-DEF/setWebhook?url=https://pathscheduler-telegram-bot.johndoe.workers.dev"
```

You should see: `{"ok":true,"result":true,"description":"Webhook was set"}`

---

## Step 6: Test Your Bot

1. Open Telegram
2. Go to [@neet_pg_pathscheduler_quizbot](https://t.me/neet_pg_pathscheduler_quizbot)
3. Send `/start`
4. You should see the welcome message with buttons!

---

## Troubleshooting

### Check Webhook Status
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/getWebhookInfo"
```

### View Worker Logs
```bash
npx wrangler tail
```

### Remove Webhook (if needed)
```bash
curl "https://api.telegram.org/botYOUR_BOT_TOKEN/deleteWebhook"
```
