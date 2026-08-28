# Telegram Quiz Bot and Cloudflare Deployment

This document explains how the Telegram quiz bot is hosted, how the weekly quiz reaches the mini-app, and how to deploy changes safely.

## 1. Install the required software

On the Windows computer that will run the bot deployment and n8n workflows, install:

1. **Node.js LTS** from [nodejs.org](https://nodejs.org/). npm is included with Node.js.
2. **Git** from [git-scm.com](https://git-scm.com/), if the repositories are not already cloned.
3. **Python 3** for the quiz generator.
4. **n8n**, if this computer will run the quiz-generation workflow.

Check the installations in PowerShell:

```powershell
node --version
npm --version
python --version
npx wrangler --version
```

The bot source is in:

```text
C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager\bot
```

## 2. Create and configure Cloudflare

1. Create or sign in to a [Cloudflare account](https://dash.cloudflare.com/).
2. Open **Workers & Pages** and make sure the account associated with the project is selected.
3. The project is configured as the Worker named `pathscheduler-telegram-bot` in `wrangler.toml`.
4. The `account_id` and the existing `QUIZ_DATA` KV namespace are already recorded in `wrangler.toml`. Do not replace them unless the project is intentionally moved to another Cloudflare account.
5. From the bot directory, install the locked npm dependencies:

```powershell
cd "C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager\bot"
npm ci
```

Authenticate Wrangler. This opens a browser for Cloudflare login:

```powershell
npx wrangler login
```

If Wrangler reports that the wrong account is selected, log out and log in again with the Cloudflare account that owns the Worker:

```powershell
npx wrangler logout
npx wrangler login
```

A custom domain is optional. The deployed `workers.dev` URL is sufficient for the mini-app. The current application URL is:

```text
https://pathscheduler-telegram-bot.pathexor.workers.dev
```

## 3. Add Cloudflare secrets

Secrets are encrypted values stored by Cloudflare. They are not committed to Git and must not be placed in `index.js`, `wrangler.toml`, or workflow JSON files.

Add the Telegram Bot API token once:

```powershell
npx wrangler secret put BOT_TOKEN
```

Wrangler will prompt for the value. Paste the token from Telegram's `@BotFather` only into that prompt.

Add a GitHub token with read access to the private repository `AnanthuKaripot/telegram-mini-app-data-files`:

```powershell
npx wrangler secret put GITHUB_TOKEN
```

For a fine-grained GitHub token, grant access only to that repository and the minimum **Contents: Read** permission. Do not put the token in a URL or commit it to a file.

The n8n GitHub credential is separate from `GITHUB_TOKEN`. n8n needs a GitHub credential with **Contents: Write** access because it commits each newly generated quiz to the private repository.

### Configure n8n's environment on Windows

The Execute Command node needs to know where this repository is. Set the variable permanently for your Windows user in PowerShell:

```powershell
[Environment]::SetEnvironmentVariable(
        "TELEGRAM_MINIAPP_MANAGER_DIR",
        "C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager",
        "User"
)
```

Close and restart n8n after setting it. A running n8n process keeps the environment it had when it started. If n8n runs as a Windows service or under another user, set the variable for that service account instead.

Verify it in a newly opened PowerShell window:

```powershell
Get-Item Env:TELEGRAM_MINIAPP_MANAGER_DIR
Test-Path "$env:TELEGRAM_MINIAPP_MANAGER_DIR\bot\scripts\quiz_generator.py"
```

The second command must print `True`. The workflow also checks this variable and prints a specific error before running Python if n8n cannot see it.

## 4. What these commands do

### `cd telegram_miniapp_manager\bot`

Changes PowerShell's current directory to the Worker project. This matters because `wrangler.toml`, `package.json`, and `src/index.js` are in this directory.

The absolute equivalent is:

```powershell
cd "C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager\bot"
```

### `npx wrangler secret put GITHUB_TOKEN`

Runs Wrangler without requiring a global Wrangler installation. The command creates or replaces the encrypted `GITHUB_TOKEN` secret for the deployed Worker. The Worker reads it as `env.GITHUB_TOKEN` when `/weekly-quiz` requests the private GitHub file.

This command does not upload the source code and does not change the GitHub repository. It only updates the Cloudflare secret.

### `npx wrangler deploy`

Builds and uploads the Worker defined by `wrangler.toml` and `src/index.js` to Cloudflare. It publishes the routes and code changes, while retaining configured secrets and the KV binding.

After deployment, Wrangler prints the deployed Worker URL. Test the public health of the quiz endpoint with:

```powershell
Invoke-WebRequest "https://pathscheduler-telegram-bot.pathexor.workers.dev/weekly-quiz"
```

A successful response should contain the current quiz JSON. A `503` means `GITHUB_TOKEN` has not been configured. A `502` usually means the token cannot read the private repository or the file path is missing.

For normal source changes, the shorter project script may also be used:

```powershell
npm run deploy
```

## 5. How the quiz data flows

The weekly quiz has separate source, runtime, publication, and delivery locations:

```text
PG-PathScheduler QBank
        |
        v
quiz_generator.py
        |
        v
C:\Users\anant\.n8n-files\quiz\quiz_data.json
        |
        v
n8n GitHub node
        |
        v
private telegram-mini-app-data-files repository
        |
        v
Cloudflare Worker /weekly-quiz
        |
        +--> Telegram mini-app
        +--> Flutter app
```

1. The n8n workflow runs `bot/scripts/quiz_generator.py`.
2. The generator selects questions from `PG-PathScheduler/assets/web/qbank`, or from `QBANK_DIR` when that environment variable is configured.
3. It writes the generated JSON to `C:\Users\anant\.n8n-files\quiz\quiz_data.json`. This is n8n's approved local file area, so the Read Binary File or Read/Write Files node can access it.
4. The n8n GitHub node uploads that file to:

```text
pathscheduler/quiz/quiz_data.json
```

inside `telegram-mini-app-data-files`.

5. The Worker calls GitHub's authenticated Contents API using `GITHUB_TOKEN` and returns only the JSON. The token never reaches a browser or Telegram user.
6. The mini-app and Flutter service call `/weekly-quiz`, so the quiz-data repository can remain private.

The quiz repository is separate from `telegram_miniapp_manager` deliberately. A quiz update therefore creates a commit in the data repository and does not modify the mini-app source repository or create Git conflicts there.

## 6. How the bot functions

The Cloudflare Worker in `src/index.js` is the bot's HTTP API and Telegram webhook handler.

### Weekly quiz delivery

`GET /weekly-quiz` authenticates to GitHub with `GITHUB_TOKEN`, reads the private quiz JSON, and returns it with CORS enabled. The mini-app uses this endpoint to load the current questions.

### Scores and leaderboard

- `POST /submit-score` validates a user's score and stores one attempt per user and quiz in the `QUIZ_DATA` Cloudflare KV namespace.
- `GET /user-status?userId=...&quizId=...` checks whether that user has already attempted the quiz.
- `GET /leaderboard?quizId=...` loads scores for that quiz, sorts by score and then completion time, and returns the top ten.

The KV namespace stores scores and status, not the quiz questions. Quiz questions remain in the private GitHub data repository.

### Challenge mode

Challenge endpoints use the same KV namespace with expiring records:

- `POST /create-challenge` creates a challenge and returns an ID.
- `GET /get-challenge?id=...` retrieves challenge questions.
- `POST /submit-challenge-score` records one score per user for a challenge.
- `GET /challenge-leaderboard?id=...` returns challenge rankings.

### Telegram integration

- `POST /` receives Telegram webhook updates and responds to bot commands and button interactions.
- `GET /setup` configures the Telegram menu button to open the PathScheduler mini-app using `BOT_TOKEN`.
- The bot's mini-app button opens the Telegram Web App; the quiz UI itself is served by the mini-app site and calls the Worker API for quiz data, status, submissions, and rankings.

## 7. Deploy and connect Telegram

Deploy from the bot directory:

```powershell
cd "C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager\bot"
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

### Important: run Wrangler in the bot directory

`wrangler.toml` is located in `telegram_miniapp_manager\bot`, not in the parent `telegram_miniapp_manager` directory. Run this first:

```powershell
cd "C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager\bot"
Get-Location
Test-Path .\wrangler.toml
```

The second command must print `True`. If you are intentionally running from the parent directory, pass the configuration file explicitly:

```powershell
npx wrangler secret put GITHUB_TOKEN --config .\bot\wrangler.toml
npx wrangler deploy --config .\bot\wrangler.toml
```

When using `--config` from the parent directory, Wrangler resolves `main = "src/index.js"` relative to the configuration file. Running from the `bot` directory is the simpler and recommended option.

Set or refresh the Telegram webhook after deployment. Replace both placeholders and run:

```powershell
$botToken = "YOUR_BOT_TOKEN"
$workerUrl = "https://pathscheduler-telegram-bot.pathexor.workers.dev"
Invoke-RestMethod "https://api.telegram.org/bot$botToken/setWebhook?url=$workerUrl"
```

Check the webhook:

```powershell
Invoke-RestMethod "https://api.telegram.org/bot$botToken/getWebhookInfo"
```

View live Worker logs while testing:

```powershell
npx wrangler tail
```

## 8. Deploy checklist

- Node.js, npm, Python, Git, and n8n are installed.
- Wrangler is logged into the correct Cloudflare account.
- `BOT_TOKEN` exists as a Cloudflare secret.
- `GITHUB_TOKEN` can read the private quiz-data repository.
- The n8n GitHub credential can write to the quiz-data repository.
- The n8n process runs under the Windows user that owns `C:\Users\anant\.n8n-files`.
- The workflow's file node uses the evaluated home-directory expression and not the old repository `data\quiz` path.
- The Worker endpoint returns valid quiz JSON before users open the quiz.
- The Telegram webhook points to the deployed Worker URL.

## 9. Useful troubleshooting

### `Access to the file is not allowed`

The n8n file node is reading outside its approved directory. Confirm that the generator writes to:

```text
C:\Users\anant\.n8n-files\quiz\quiz_data.json
```

Restart n8n after changing its environment or user account, then run the generator node before the file-read node.

### Execute Command exits with code `2`

Python commonly returns code `2` when it cannot find the script path. In this workflow that usually means `TELEGRAM_MINIAPP_MANAGER_DIR` was missing when n8n started. Set the variable, restart n8n, and confirm the path check above. The workflow's first command now reports `TELEGRAM_MINIAPP_MANAGER_DIR is not set in the n8n process` when this is the cause.

### `/weekly-quiz` returns `503`

The Worker has no `GITHUB_TOKEN` secret. Run:

```powershell
npx wrangler secret put GITHUB_TOKEN
npx wrangler deploy
```

### `/weekly-quiz` returns `502`

Check that the token has access to the private repository and that the committed file exists at `pathscheduler/quiz/quiz_data.json`. Use `npx wrangler tail` while requesting the endpoint.

### The bot does not respond

Check the webhook with `getWebhookInfo`, confirm the Worker URL, and inspect `npx wrangler tail`. The bot token must belong to the same bot whose webhook is configured.

### `Required Worker name missing`

This means Wrangler did not load `wrangler.toml`. Check the current directory and config file:

```powershell
Get-Location
Test-Path .\wrangler.toml
```

Change into the bot directory and repeat the command:

```powershell
cd "C:\Users\anant\Projects\PG PathScheduler\telegram_miniapp_manager\bot"
npx wrangler secret put BOT_TOKEN
```

The `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` message can appear afterward on Windows with some Wrangler/Node.js combinations. It is a secondary process-cleanup crash; fix the missing configuration path first. If it persists after running from the correct directory, use the project's locked dependencies with `npm ci` and run `npm exec wrangler -- secret put BOT_TOKEN`.
