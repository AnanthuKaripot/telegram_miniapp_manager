export default {
  async fetch(request, env) {
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
— all in one powerful app.

⬇️ *Get Started*
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📣 Join Channel', url: 'https://t.me/neetpgpathscheduler' },
        { text: '🌐 Community', url: 'https://www.pathexor.in/pathscheduler/links/' }
      ],
      [
        { text: '🚀 Our Apps', callback_data: 'apps' },
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
/channels — Join our community
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
🚀 *PG PathScheduler Apps*

Enhance your preparation with our tools:
`.trim();

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📚 Flashcards', web_app: { url: 'https://telegram.pathexor.in/flashcards/' } }
      ],
      [
        { text: '🧠 Weekly Quiz', web_app: { url: 'https://telegram.pathexor.in/quiz/' } }
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
📢 *Join Our Community*

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
