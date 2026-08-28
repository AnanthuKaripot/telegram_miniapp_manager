# PG PathScheduler | Telegram Mini-App Ecosystem

A premium suite of Telegram Mini Apps (TMAs) designed for high-yield medical exam preparation. This ecosystem provides a central dashboard hub to access study tools like randomized quizzes and clinical flashcards.

## Relationship To Other Projects

`PG-PathScheduler` is the main app and `Qbank-admin-tools` is the source of truth for question edits, new PYQs, and verified report corrections. This repository is a downstream publishing channel: the weekly quiz generator reads the main app's QBank, selects 10 questions, and publishes quiz data to the Telegram mini-app. The standalone `flashcard_generator` publishes daily flashcard content here.

For local n8n runs, set `TELEGRAM_MINIAPP_MANAGER_DIR` to this repository's absolute path. Set `QBANK_DIR` only if the main app is not in the sibling `PG-PathScheduler` directory.

## 🚀 Vision
To provide medical students and professionals with a seamless, "app-like" experience directly within Telegram, optimized for efficiency and knowledge retention.

## 📁 Project Structure

```
telegram_miniapp_manager/
├── pathscheduler/          # Core Mini-App Suite
│   ├── index.html          # Unified Dashboard (Hub)
│   ├── quiz/               # Weekly Subject-Wise Quiz
│   └── flashcards/         # Daily Clinical Flashcards
├── bot/                    # Backend & Logic
│   ├── src/index.js       # Cloudflare Worker API
│   └── scripts/           # Automation & Content Generation
└── index.html              # Smart Entry Redirect
```

## 🛠️ Components

### 1. Unified Dashboard (`/pathscheduler`)
A central "Hub" that provides a compact, professional list of available tools.
- **BotFather Aesthetic**: Clean, list-based UI for high efficiency.
- **Circular Branding**: Consistent use of official logos.
- **One-Tap Access**: Seamless navigation between modules.

### 2. Weekly Knowledge Quiz (`/pathscheduler/quiz`)
A randomized MCQ module to test recall and application.
- **10-Question Sessions**: High-yield, subject-wise randomization.
- **Single-Attempt Policy**: Enforced via backend tracking.
- **Persistent Progress**: LocalStorage fallback for offline continuity.
- **Global Leaderboard**: Compete with peers for the top rank.

### 3. Daily Clinical Flashcards (`/pathscheduler/flashcards`)
Clinical pearls and mnemonics delivered for quick daily review.
- **Interactive Deck**: Flip-to-reveal clinical facts.
- **Micro-Learning**: Optimized for short study sessions.

## ⚙️ Deployment & Setup

### Mini Apps (GitHub Pages)
All components are hosted statically. Updates are live immediately upon merging to `main`.
- **Public URL**: `https://telegram.pathexor.in/pathscheduler/`

### Backend (Cloudflare Workers)
The backend manages users, scores, and storage.

**Deploy (recommended on Windows — API token, no browser login):**

1. Create an API token: [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Edit Cloudflare Workers** template.
2. In PowerShell (session only — do not commit the token):

```powershell
cd bot
$env:CLOUDFLARE_API_TOKEN = "paste-your-token-here"
$env:NODE_OPTIONS = "--use-system-ca"
npm run deploy
```

If `wrangler login` fails with certificate errors, use the API token flow above instead of OAuth.

### 🤖 Telegram Configuration (@BotFather)
To maintain the professional "Main App" experience:
1. **Main App URL**: `https://telegram.pathexor.in/pathscheduler/`
2. **Menu Button**: Point to the same URL for in-chat access.
3. **App Title**: `PG PathScheduler`

---
*Powered by Pathexor • Excellence in Medical Education*
