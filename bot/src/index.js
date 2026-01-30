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
        // Sort by score (high to low) and take top 10
        scores.sort((a, b) => b.score - a.score);
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
        const { quizId, userId, firstName, score, total } = data;

        if (!quizId || !userId) return new Response('Missing parameters', { status: 400 });

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
        const entry = { quizId, userId, firstName, score, total, date: new Date().toISOString() };
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

    // Telegram Webhook Handler (Original Logic)
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }

    try {
      const update = await request.json();

      // Handle /start command
      if (update.message?.text === '/start') {
        await sendWelcomeMessage(env.BOT_TOKEN, update.message.chat.id, update.message.from.first_name);
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
          case 'apps':
            await sendAppsMessage(env.BOT_TOKEN, chatId);
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

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📣 Join Channel', url: 'https://t.me/neetpgpathscheduler' },
        { text: '🌐 Ecosystem', url: 'https://www.pathexor.in/pathscheduler/links/' }
      ],
      [
        { text: '🚀 Mini Apps', callback_data: 'apps' },
        { text: '💡 Help', callback_data: 'help' }
      ]
    ]
  };

  await sendTelegramMessage(botToken, chatId, welcomeText, keyboard);
}

// ═══════════════════════════════════════════════════════════════
// HELP MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendHelpMessage(botToken, chatId) {
  const helpText = `
📖 *Available Commands*

/start — Welcome & main menu
/apps — Browse mini apps
/channels — Join our ecosystem
/help — Show this message

━━━━━━━━━━━━━━━━━━━━━━

Need assistance? Contact us via our official channel.
`.trim();

  await sendTelegramMessage(botToken, chatId, helpText, null);
}

// ═══════════════════════════════════════════════════════════════
// APPS MESSAGE
// ═══════════════════════════════════════════════════════════════

async function sendAppsMessage(botToken, chatId) {
  const appsText = `
🚀 *PG PathScheduler Mini Apps*

Enhance your preparation with our tools:
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📚 Flashcards', web_app: { url: 'https://telegram.pathexor.in/pathscheduler/flashcards/' } }
      ],
      [
        { text: '🧠 Weekly Quiz', web_app: { url: 'https://telegram.pathexor.in/pathscheduler/quiz/' } }
      ],
      [
        { text: '🔙 Back', callback_data: 'start' }
      ]
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
