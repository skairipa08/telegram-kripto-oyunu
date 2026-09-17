/**
 * Project Empire — Telegram Bot Polling Runner (Local & MVP Testing)
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN="<bot_token>" APP_ORIGIN="https://empire.example" pnpm tsx scripts/telegram-bot.ts
 */

import {
  buildBotResponse,
  isDesignatedAdmin,
} from '../apps/api/src/telegram/bot-handler';

const token = process.env.TELEGRAM_BOT_TOKEN || process.argv[2];
const appOrigin =
  process.env.APP_ORIGIN || process.env.VITE_APP_URL || 'http://localhost:5173';

if (!token) {
  console.error('\n❌ Hata: TELEGRAM_BOT_TOKEN belirtilmedi!');
  console.error('Kullanım:');
  console.error(
    '  $env:TELEGRAM_BOT_TOKEN="<bot_token>"; pnpm tsx scripts/telegram-bot.ts',
  );
  console.error('  veya');
  console.error('  pnpm tsx scripts/telegram-bot.ts <bot_token>\n');
  process.exit(1);
}

const API_BASE = `https://api.telegram.org/bot${token}`;

async function apiRequest<T = unknown>(
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json()) as {
    ok: boolean;
    result: T;
    description?: string;
  };
  if (!json.ok) {
    throw new Error(
      `Telegram API Hatası (${method}): ${json.description || 'Bilinmeyen hata'}`,
    );
  }
  return json.result;
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

async function main() {
  console.log('\n======================================================');
  console.log('🚀 Project Empire — Telegram MVP Bot Servisi Başlatılıyor');
  console.log('======================================================');

  try {
    const me = await apiRequest<TelegramUser>('getMe');
    console.log(`🤖 Bot Adı: ${me.first_name} (@${me.username || 'isimsiz'})`);
    console.log(`🆔 Bot ID:  ${me.id}`);
    console.log(`🌐 Mini App URL: ${appOrigin}`);
    console.log(`👑 Yetkili Yöneticiler: @Barandnz, @Mberked (Süper Yönetici)`);
    console.log('------------------------------------------------------');
    console.log(
      '📡 Bot dinlemede (long-polling aktif). Durdurmak için Ctrl+C tuşlayın.\n',
    );

    let offset = 0;
    let isRunning = true;

    const stop = () => {
      console.log('\n🛑 Bot servisi durduruluyor...');
      isRunning = false;
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);

    while (isRunning) {
      try {
        const updates = await apiRequest<TelegramUpdate[]>('getUpdates', {
          offset,
          timeout: 25,
          allowed_updates: ['message'],
        });

        for (const update of updates) {
          offset = update.update_id + 1;
          const msg = update.message;
          if (!msg || !msg.text) continue;

          const chatId = msg.chat.id;
          const text = msg.text.trim();
          const from = msg.from;
          const username = from?.username;
          const firstName = from?.first_name || 'Girişimci';
          const isAdmin = isDesignatedAdmin(username);

          console.log(
            `[${new Date().toLocaleTimeString()}] 💬 Mesaj: "${text}" | Gönderen: ${firstName} (@${username || 'yok'}) ${isAdmin ? '[🛡️ ADMIN]' : ''}`,
          );

          const { replyText, replyMarkup, photoUrl } = buildBotResponse({
            text,
            firstName,
            username,
            appOrigin,
            languageCode: from?.language_code,
          });

          if (photoUrl && text.startsWith('/start')) {
            try {
              await apiRequest('sendPhoto', {
                chat_id: chatId,
                photo: photoUrl,
                caption: replyText,
                parse_mode: 'Markdown',
                reply_markup: replyMarkup,
              });
            } catch {
              await apiRequest('sendMessage', {
                chat_id: chatId,
                text: replyText,
                parse_mode: 'Markdown',
                reply_markup: replyMarkup,
              });
            }
          } else {
            await apiRequest('sendMessage', {
              chat_id: chatId,
              text: replyText,
              parse_mode: 'Markdown',
              reply_markup: replyMarkup,
            });
          }

          console.log(
            `[${new Date().toLocaleTimeString()}] ✅ Yanıt iletildi -> Chat ID: ${chatId}`,
          );
        }
      } catch (err) {
        if (!isRunning) break;
        console.error(
          '⚠️ Yoklama döngüsü hatası:',
          err instanceof Error ? err.message : err,
        );
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  } catch (err) {
    console.error(
      '❌ Bot başlatılamadı:',
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
}

void main();
