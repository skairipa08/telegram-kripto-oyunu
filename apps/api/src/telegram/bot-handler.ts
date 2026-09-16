export interface TelegramBotMessageParams {
  token: string;
  appOrigin: string;
  chatId: number | string;
  text: string;
  username?: string | undefined;
  firstName?: string | undefined;
  fetcher?: typeof fetch | undefined;
}

export const DESIGNATED_ADMIN_USERNAMES = ['barandnz', 'mberked'];

export function isDesignatedAdmin(username?: string | null): boolean {
  if (!username) return false;
  const clean = username.toLowerCase().replace('@', '').trim();
  return DESIGNATED_ADMIN_USERNAMES.includes(clean);
}

export function buildMiniAppUrl(
  appOrigin: string,
  startParam?: string,
): string {
  const base = appOrigin.replace(/\/+$/, '');
  if (!startParam) return `${base}/`;
  const encoded = encodeURIComponent(startParam);
  return `${base}/?startapp=${encoded}#tgWebAppStartParam=${encoded}`;
}

export function buildBotResponse(params: {
  text: string;
  firstName: string;
  username?: string | undefined;
  appOrigin: string;
}): { replyText: string; replyMarkup: Record<string, unknown> } {
  const { text, firstName, username, appOrigin } = params;
  const isAdmin = isDesignatedAdmin(username);
  const trimmed = text.trim();

  if (trimmed.startsWith('/start')) {
    const parts = trimmed.split(/\s+/);
    const startParam = parts[1] || undefined;
    const miniAppUrl = buildMiniAppUrl(appOrigin, startParam);

    let welcome = `👑 *Project Empire'a Hoş Geldin, ${firstName}!*

Kendi kripto iş imparatorluğunu sıfırdan zirveye taşı:
💼 İşletmeler satın al ve yükselt
⚡ Saatlik pasif gelir topla
🏆 Liderlik tablosunda yarış ve sezon ödülleri kazan
👥 Arkadaşlarını davet et ve ekstra bonuslar kap`;

    if (startParam) {
      welcome += `\n\n🎁 *Tavsiye Kodu Algılandı:* \`${startParam}\` (Başlangıç ödülün oyunda seni bekliyor!)`;
    }

    if (isAdmin) {
      welcome += `\n\n🛡️ *Yönetici Yetkisi Tanımlandı: Süper Yönetici (@${username || 'Admin'})*`;
    }

    welcome +=
      '\n\nAşağıdaki butona dokunarak hemen imparatorluğunu kurmaya başla! 🚀';

    return {
      replyText: welcome,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '🎮 İmparatorluğu Başlat',
              web_app: { url: miniAppUrl },
            },
          ],
          [
            { text: '📖 Nasıl Oynanır?', callback_data: 'help_guide' },
            {
              text: '📢 Topluluk Kanalı',
              url: 'https://t.me/telegram',
            },
          ],
        ],
      },
    };
  }

  if (trimmed.startsWith('/admin')) {
    if (!isAdmin) {
      return {
        replyText:
          '⛔ *Yetkisiz Erişim*\n\nBu komut yalnızca yetkili yöneticiler (@Barandnz, @Mberked) içindir.',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: '🎮 Oyunu Başlat',
                web_app: { url: buildMiniAppUrl(appOrigin) },
              },
            ],
          ],
        },
      };
    }

    const adminPanelUrl = buildMiniAppUrl(appOrigin);
    return {
      replyText: `🛡️ *Project Empire — Yönetici Kontrol Paneli*

Yetkili: @${username}
Rol: **Süper Yönetici (Superadmin)**
Durum: 🟢 Sistem Aktif

Yapabileceğiniz işlemler:
• Hile Bayrakları İnceleme (\`/admin/fraud/flags\`)
• Dondurulan Ödül Onay/Ret (\`/admin/fraud/frozen\`)
• Oyuncu Bakiye ve Denetim Kayıtları

Yönetim panelini Mini App üzerinden açmak için aşağıdaki butona tıklayın:`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '🛡️ Yönetici Paneli & Oyunu Aç',
              web_app: { url: adminPanelUrl },
            },
          ],
        ],
      },
    };
  }

  if (trimmed.startsWith('/help')) {
    return {
      replyText: `ℹ️ *Project Empire — Yardım ve Rehber*

1️⃣ **İşletmeler**: Stand, Kafe, Gece Kulübü ve Kripto Madencilik tesisi kurup gelirini katla.
2️⃣ **Pasif Gelir**: Çevrimdışı kaldığında bile kasan dolmaya devam eder (Maksimum 4 saat, VIP kartla 12 saat).
3️⃣ **Görevler**: Günlük görevleri tamamla, streak serisini bozma ve her 7 günde bir döngü bonusu al.
4️⃣ **Referans**: Arkadaşlarını davet et; hem sen hem arkadaşın bonus kazansın.

Hemen başlamak için aşağıdaki butona dokun! 👇`,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: '🎮 Oyuna Dön',
              web_app: { url: buildMiniAppUrl(appOrigin) },
            },
          ],
        ],
      },
    };
  }

  // Fallback for unknown messages
  return {
    replyText: `Project Empire Bot'a hoş geldin! Oyunu başlatmak için aşağıdaki butona dokunabilirsin 👇`,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: '🎮 İmparatorluğu Başlat',
            web_app: { url: buildMiniAppUrl(appOrigin) },
          },
        ],
      ],
    },
  };
}

export async function handleTelegramBotMessage(
  params: TelegramBotMessageParams,
): Promise<{ success: boolean; action: string }> {
  const {
    token,
    chatId,
    appOrigin,
    text,
    username,
    firstName = 'Girişimci',
    fetcher = fetch,
  } = params;

  const { replyText, replyMarkup } = buildBotResponse({
    text,
    firstName,
    username,
    appOrigin,
  });

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
        parse_mode: 'Markdown',
        reply_markup: replyMarkup,
      }),
    });

    return {
      success: res.ok,
      action: text.startsWith('/start')
        ? 'start'
        : text.startsWith('/admin')
          ? 'admin'
          : text.startsWith('/help')
            ? 'help'
            : 'default',
    };
  } catch {
    return {
      success: false,
      action: 'error',
    };
  }
}
