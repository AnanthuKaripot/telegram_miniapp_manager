# Agent Guide: Telegram Mini-App Manager

## Scope

This repository owns the Telegram-facing mini-apps and their publishing automation. Keep changes focused on the dashboard, weekly quiz, flashcards, bot API, deployment configuration, and n8n workflows.

## Cross-Project Workflow

`PG-PathScheduler` is the main Flutter app and the primary consumer of the question-bank data. `Qbank-admin-tools` is the source of truth for question edits.

- Do not edit or maintain a second master QBank here. The weekly quiz generator reads questions from `PG-PathScheduler/assets/web/qbank`, or from `QBANK_DIR` when configured.
- The weekly quiz flow selects 10 questions, writes local runtime output to `data/quiz/quiz_data.json`, then reads that file in n8n and publishes it to `pathscheduler/quiz/quiz_data.json`.
- Set `TELEGRAM_MINIAPP_MANAGER_DIR` for n8n so workflow file paths work regardless of the checkout location. Set `QBANK_DIR` only when the main app repository is elsewhere.
- `flashcard_generator` is the upstream daily-flashcard content pipeline. Published flashcard JSON and assets belong under `pathscheduler/flashcards/`.
- User reports and question corrections belong in `Qbank-admin-tools`; they are not resolved by changing generated quiz output here.

## Key Files

- `pathscheduler/index.html`: Mini-app dashboard.
- `pathscheduler/quiz/`: Weekly quiz UI and published quiz data.
- `pathscheduler/flashcards/`: Daily flashcard UI and published flashcard data.
- `bot/scripts/quiz_generator.py`: QBank-based quiz generation.
- `bot/workflows/`: n8n workflow exports.
- `bot/src/index.js`: Cloudflare Worker API.

## Local Setup

1. Install Python for the quiz generator and Node.js for the bot.
2. From `bot/`, run `npm ci`.
3. Set `TELEGRAM_MINIAPP_MANAGER_DIR` to this repository's absolute path before starting n8n.
4. Keep Cloudflare tokens, Telegram credentials, n8n credentials, and generated runtime output out of Git.

## Validation

- Python changes: `python -m py_compile bot/scripts/quiz_generator.py`
- Worker changes: `node --check bot/src/index.js`
- Workflow changes: parse each JSON export independently and scan for machine-specific absolute paths.
- UI changes: serve or open the affected mini-app and verify quiz/flashcard data loading and Telegram Web App behavior.

## Git Rules

Commit source, published web data, workflow definitions, setup documentation, and reusable assets. Do not commit `.env`, credentials, `data/quiz/`, caches, or local generated files. Preserve unrelated working-tree changes.
