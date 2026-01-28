# Telegram Mini-App Manager

A collection of Telegram Mini Apps and Bot services for PG PathScheduler.

## Project Structure

```
telegram_miniapp_manager/
├── pathscheduler/          # Main Module Container
│   ├── index.html          # Dashboard Hub (Main Entry Point)
│   ├── quiz/               # Weekly Quiz Mini App
│   └── flashcards/         # Daily Flashcards Mini App
├── bot/                    # Cloudflare Worker Bot Backend
│   ├── src/index.js       # Main bot logic & API endpoints
│   ├── scripts/           # Python automation scripts
│   └── workflows/         # n8n automation configs
└── CNAME                  # Custom domain config
```

## Components

### Quiz Mini App (`/quiz`)
- Weekly quiz with 10 questions from random subjects
- Single-attempt policy enforced via backend
- Leaderboard integration
- Review mode for completed quizzes

### Flashcards Mini App (`/flashcards`)  
- Daily flashcard viewer
- Flip-to-reveal interaction
- Progress tracking

### Bot Backend (`/bot`)
- Cloudflare Worker deployment
- Telegram webhook handler
- KV storage for quiz scores
- API endpoints: `/submit-score`, `/leaderboard`, `/user-status`

## Deployment

### Mini Apps
Push to GitHub → GitHub Pages serves from `telegram.pathexor.in`

### Bot
```bash
cd bot
npm install
npx wrangler deploy
```

## Environment Variables (Bot)
- `BOT_TOKEN` - Telegram Bot API token
- `QUIZ_DATA` - Cloudflare KV namespace binding
