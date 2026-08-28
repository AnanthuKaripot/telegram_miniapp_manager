/**
 * PG PathScheduler Telegram Bot - Cloudflare Worker
 * 
 * API Endpoints:
 * - GET  /leaderboard?quizId=xxx     - Get top 10 scores for a quiz
 * - POST /submit-score               - Submit quiz score (single attempt enforced)
 * - GET  /user-status?userId&quizId  - Check if user has already completed quiz
 * - GET  /setup                     - Automate Telegram Menu Button setup
 * - POST /                           - Telegram webhook handler
 * 
 * Environment Bindings:
 * - BOT_TOKEN: Telegram Bot API token (secret)
 * - QUIZ_DATA: KV namespace for storing quiz scores
 * 
 * @module telegram-bot-worker
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Setup Route - Automate Menu Button Configuration
    if (url.pathname === '/setup') {
      try {
        const hubUrl = 'https://telegram.pathexor.in/pathscheduler/';
        const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/setChatMenuButton`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            menu_button: {
              type: 'web_app',
              text: 'Open App',
              web_app: { url: hubUrl }
            }
          })
        });
        const tgData = await tgRes.json();
        return new Response(JSON.stringify({
          success: tgData.ok,
          message: tgData.ok ? 'Menu Button configured successfully!' : 'Failed to configure Menu Button.',
          telegram_response: tgData
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
      }
    }

    // Serve the private weekly quiz repository without exposing its GitHub token.
    if (url.pathname === '/weekly-quiz' && request.method === 'GET') {
      if (!env.GITHUB_TOKEN) {
        return new Response('Quiz service is not configured', { status: 503 });
      }

      try {
        const githubResponse = await fetch(
          'https://api.github.com/repos/AnanthuKaripot/telegram-mini-app-data-files/contents/pathscheduler/quiz/quiz_data.json',
          {
            headers: {
              Accept: 'application/vnd.github.raw+json',
              Authorization: `Bearer ${env.GITHUB_TOKEN}`,
              'User-Agent': 'pathscheduler-telegram-bot',
            },
          },
        );

        if (!githubResponse.ok) {
          return new Response('Quiz data unavailable', { status: 502 });
        }

        return new Response(await githubResponse.text(), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
        });
      } catch (e) {
        return new Response('Quiz data unavailable', { status: 502 });
      }
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    // Leaderboard Route
    if (url.pathname === '/leaderboard') {
      try {
        const quizId = url.searchParams.get('quizId');
        if (!quizId) return new Response('Missing Quiz ID', { status: 400 });

        const list = await env.QUIZ_DATA.list({ prefix: `quiz:${quizId}:user:` });
        const scores = [];
        for (const key of list.keys) {
          const val = await env.QUIZ_DATA.get(key.name);
          if (val) scores.push(JSON.parse(val));
        }
        // Sort by score (high to low), then answering time (low to high).
        scores.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return (a.timeTaken ?? Number.MAX_SAFE_INTEGER) - (b.timeTaken ?? Number.MAX_SAFE_INTEGER);
        });
        const top10 = scores.slice(0, 10);

        return new Response(JSON.stringify(top10), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response('Error', { status: 500 });
      }
    }

    // Submit Score Route
    if (url.pathname === '/submit-score' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { quizId, userId, firstName, score, total, timeTaken } = data;

        if (!quizId || !userId || !Number.isInteger(score) || !Number.isInteger(total) ||
          total < 1 || score < 0 || score > total || !Number.isFinite(timeTaken) || timeTaken < 0) {
          return new Response('Invalid parameters', { status: 400 });
        }

        const kvKey = `quiz:${quizId}:user:${userId}`;

        // Check if user already submitted for THIS quiz
        const existing = await env.QUIZ_DATA.get(kvKey);
        if (existing) {
          return new Response(JSON.stringify({ error: 'Already submitted' }), {
            status: 403,
            headers: { 'Access-Control-Allow-Origin': '*' }
          });
        }

        // Save score
        const entry = { quizId, userId, firstName, score, total, timeTaken, date: new Date().toISOString() };
        await env.QUIZ_DATA.put(kvKey, JSON.stringify(entry));

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response('Error', { status: 500 });
      }
    }

    // User Status Route
    if (url.pathname === '/user-status') {
      const userId = url.searchParams.get('userId');
      const quizId = url.searchParams.get('quizId');

      if (!userId || !quizId) return new Response('Missing parameters', { status: 400 });

      const entry = await env.QUIZ_DATA.get(`quiz:${quizId}:user:${userId}`);
      return new Response(entry || JSON.stringify({ status: 'not_played' }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }


    // ═══════════════════════════════════════════════════════════════
    // CHALLENGE MODE ENDPOINTS
    // ═══════════════════════════════════════════════════════════════

    // 1. Create Challenge
    if (url.pathname === '/create-challenge' && request.method === 'POST') {
      try {
        const data = await request.json();

        // Basic validation
        if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
          return new Response('Invalid payload: questions array required', { status: 400 });
        }

        const id = crypto.randomUUID().slice(0, 12);

        // Store challenge data (Expire in 14 days)
        // Key: challenge:DATA:{id}
        await env.QUIZ_DATA.put(`challenge:DATA:${id}`, JSON.stringify(data), { expirationTtl: 1209600 });

        return new Response(JSON.stringify({ id: id }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }

    // 2. Get Challenge Data
    if (url.pathname === '/get-challenge') {
      const id = url.searchParams.get('id');
      if (!id) return new Response('Missing ID', { status: 400 });

      const data = await env.QUIZ_DATA.get(`challenge:DATA:${id}`);

      if (!data) return new Response('Challenge not found or expired', { status: 404 });

      return new Response(data, {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 3. Submit Challenge Score
    if (url.pathname === '/submit-challenge-score' && request.method === 'POST') {
      try {
        const { challengeId, userId, firstName, score, total, timeTaken } = await request.json();

        if (!challengeId || !userId || !Number.isInteger(score) || !Number.isInteger(total) ||
          total < 1 || score < 0 || score > total || !Number.isFinite(timeTaken) || timeTaken < 0) {
          return new Response('Invalid parameters', { status: 400 });
        }

        const key = `challenge:SCORE:${challengeId}:${userId}`;

        // Check for existing attempt
        const existing = await env.QUIZ_DATA.get(key);
        if (existing) {
          return new Response(JSON.stringify({ error: 'Already submitted' }), {
            status: 403,
            headers: { 'Access-Control-Allow-Origin': '*' }
          });
        }

        const scoreData = {
          userId,
          firstName: firstName || 'Anonymous',
          score,
          total,
          timeTaken,
          submittedAt: new Date().toISOString()
        };

        // Store score (Expire in 14 days to match challenge)
        await env.QUIZ_DATA.put(key, JSON.stringify(scoreData), { expirationTtl: 1209600 });

        return new Response(JSON.stringify({ success: true }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }

    // 4. Get Challenge Leaderboard
    if (url.pathname === '/challenge-leaderboard') {
      const id = url.searchParams.get('id');
      if (!id) return new Response('Missing ID', { status: 400 });

      try {
        const list = await env.QUIZ_DATA.list({ prefix: `challenge:SCORE:${id}:` });
        const scores = [];

        for (const key of list.keys) {
          const val = await env.QUIZ_DATA.get(key.name);
          if (val) scores.push(JSON.parse(val));
        }

        // Sort: High Score > Low Time > Early Submission
        scores.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          if (a.timeTaken !== b.timeTaken) return (a.timeTaken || 0) - (b.timeTaken || 0); // Less time is better? Or maybe just ignore time if not tracked accurately
          return 0;
        });

        return new Response(JSON.stringify(scores), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
      }
    }

    // Telegram Webhook Handler (Original Logic)
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    try {
      const update = await request.json();

      // Handle /start command
      if (update.message?.text?.startsWith('/start')) {
        const text = update.message.text;
        const param = text.split(' ')[1]; // Extract payload (e.g., 'challenge_123')

        if (param && param.startsWith('challenge_')) {
          // Handle Challenge Deep Link
          const challengeId = param.replace('challenge_', '');
          await sendChallengeInvite(env.BOT_TOKEN, update.message.chat.id, update.message.from.first_name, challengeId);
        } else {
          // Normal Start
          await sendWelcomeMessage(env.BOT_TOKEN, update.message.chat.id, update.message.from.first_name);
        }
      }

      // Handle /help command
      if (update.message?.text === '/help') {
        await sendHelpMessage(env.BOT_TOKEN, update.message.chat.id);
      }

      // Handle /apps command
      if (update.message?.text === '/apps') {
        await sendAppsMessage(env.BOT_TOKEN, update.message.chat.id);
      }

      // Handle /channels command
      if (update.message?.text === '/channels') {
        await sendChannelsMessage(env.BOT_TOKEN, update.message.chat.id);
      }

      // Handle callback queries (button clicks)
      if (update.callback_query) {
        const callbackData = update.callback_query.data;
        const chatId = update.callback_query.message.chat.id;
        const firstName = update.callback_query.from.first_name;

        // Answer callback to remove loading state
        await answerCallbackQuery(env.BOT_TOKEN, update.callback_query.id);

        switch (callbackData) {
          case 'help':
            await sendHelpMessage(env.BOT_TOKEN, chatId);
            break;
          case 'start':
            await sendWelcomeMessage(env.BOT_TOKEN, chatId, firstName);
            break;
          case 'noop':
            // Do nothing for decorative buttons
            break;
        }
      }

      return new Response('OK', { status: 200 });
    } catch (error) {
      console.error('Error:', error);
      return new Response('Error', { status: 500 });
    }
  }
};

// Answer callback query to remove loading state
async function answerCallbackQuery(botToken, callbackQueryId) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId })
  });
}

// Answer callback query with a toast message
async function answerCallbackQueryWithText(botToken, callbackQueryId, text) {
  await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId, text: text, show_alert: false })
  });
}

// ═══════════════════════════════════════════════════════════════
// INLINE KEYBOARDS
// ═══════════════════════════════════════════════════════════════

const FLASHCARDS_WEB_APP = {
  text: '📚 Flashcards',
  web_app: { url: 'https://telegram.pathexor.in/pathscheduler/flashcards/' }
};

const WEEKLY_QUIZ_WEB_APP = {
  text: '🧠 Weekly Quiz',
  web_app: { url: 'https://telegram.pathexor.in/pathscheduler/quiz/' }
};

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '📣 Join Channel', url: 'https://t.me/neetpgpathscheduler' },
        { text: '🌐 Ecosystem', url: 'https://www.pathexor.in/pathscheduler/links/' }
      ],
      [FLASHCARDS_WEB_APP, WEEKLY_QUIZ_WEB_APP],
      [{ text: '💡 Help', callback_data: 'help' }]
    ]
  };
}

// ═══════════════════════════════════════════════════════════════
// WELCOME MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendWelcomeMessage(botToken, chatId, firstName) {
  const welcomeText = `
🩺 *Hey Dr. ${firstName}!*

Welcome to *PG PathScheduler*

_The ultimate companion for medical professionals._
High-yield QBank • AI explanations • Smart flashcards

⬇️ *Get Started*
`.trim();

  await sendTelegramMessage(botToken, chatId, welcomeText, mainMenuKeyboard());
}

// ═══════════════════════════════════════════════════════════════
// HELP MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendHelpMessage(botToken, chatId) {
  const helpText = `
📖 *Available Commands*

/start — Welcome & main menu
/apps — Open Flashcards or Weekly Quiz
/channels — Join our ecosystem
/help — Show this message

━━━━━━━━━━━━━━━━━━━━━━

Need assistance? Contact us via our official channel.
`.trim();

  await sendTelegramMessage(botToken, chatId, helpText, null);
}

// ═══════════════════════════════════════════════════════════════
// APPS MESSAGE (/apps — same tools as main menu)
// ═══════════════════════════════════════════════════════════════

async function sendAppsMessage(botToken, chatId) {
  const appsText = `
🚀 *PG PathScheduler Tools*

Pick a tool below:
`.trim();

  const keyboard = {
    inline_keyboard: [
      [FLASHCARDS_WEB_APP, WEEKLY_QUIZ_WEB_APP],
      [{ text: '🔙 Back to Menu', callback_data: 'start' }]
    ]
  };

  await sendTelegramMessage(botToken, chatId, appsText, keyboard);
}

// ═══════════════════════════════════════════════════════════════
// CHANNELS MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendChannelsMessage(botToken, chatId) {
  const channelsText = `
📢 *Join Our Ecosystem*

Stay updated with the latest content, tips, and discussions:
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📣 PG PathScheduler Channel', url: 'https://t.me/neetpgpathscheduler' }
      ],
      [
        { text: '🔙 Back to Menu', callback_data: 'start' }
      ]
    ]
  };

  await sendTelegramMessage(botToken, chatId, channelsText, keyboard);
}

// ═══════════════════════════════════════════════════════════════
// TELEGRAM API HELPER
// ═══════════════════════════════════════════════════════════════

async function sendTelegramMessage(botToken, chatId, text, keyboard) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'Markdown'
  };

  if (keyboard) {
    payload.reply_markup = keyboard;
  }

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Telegram API error:', error);
  }
}

async function sendChallengeInvite(botToken, chatId, firstName, challengeId) {
  const text = `
⚔️ *Challenge Accepted?*

Hey Dr. ${firstName}, you've been challenged to a quiz!

• 10 High-Yield Questions
• Timed Mode
• Beat the Score

👇 *Tap below to play now!*
`.trim();

  // Web App URL with start param for Challenge Mode
  // Note: We use the hosted URL for the Mini App
  const webAppUrl = 'https://telegram.pathexor.in/pathscheduler/quiz/';

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: '⚔️ Accept Challenge',
          web_app: {
            url: `${webAppUrl}?start_param=challenge_${challengeId}`
          }
        }
      ]
    ]
  };

  await sendTelegramMessage(botToken, chatId, text, keyboard);
}
