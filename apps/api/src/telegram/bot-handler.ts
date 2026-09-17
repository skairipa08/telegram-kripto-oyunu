export interface TelegramBotMessageParams {
  token: string;
  appOrigin: string;
  chatId: number | string;
  text: string;
  username?: string | undefined;
  firstName?: string | undefined;
  languageCode?: string | undefined;
  withPhoto?: boolean | undefined;
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
  languageCode?: string | undefined;
}): {
  replyText: string;
  replyMarkup: Record<string, unknown>;
  photoUrl?: string | undefined;
} {
  const { text, firstName, username, appOrigin, languageCode } = params;
  const isAdmin = isDesignatedAdmin(username);
  const trimmed = text.trim();
  const base = appOrigin.replace(/\/+$/, '');

  const lang = (languageCode || 'tr').toLowerCase();
  const isTr = lang.startsWith('tr');
  const isRu = lang.startsWith('ru');
  const isEs = lang.startsWith('es');

  if (trimmed.startsWith('/start')) {
    const parts = trimmed.split(/\s+/);
    const startParam = parts[1] || undefined;
    const miniAppUrl = buildMiniAppUrl(appOrigin, startParam);
    const photoUrl = `${base}/assets/empire-coin.png`;

    let welcome: string;
    let buttonLabel: string;
    let guideLabel: string;
    let channelLabel: string;

    if (isRu) {
      buttonLabel = '🎮 Запустить Империю';
      guideLabel = '📖 Как играть?';
      channelLabel = '📢 Сообщество';
      welcome = `👑 *Добро пожаловать в Project Empire, ${firstName}!*

🎁 *СТАРТОВЫЙ БОНУС: +5 000 НАЛИЧНЫХ!*
Стартовый капитал +5 000 наличных зачислен на баланс для открытия первого бизнеса!

Построй свою крипто-империю с нуля:
💼 Покупай предприятия и улучшай производство
⚡ Собирай ежечасный пассивный доход
🏆 Соревнуйся в таблице лидеров за призы сезона
👥 Приглашай друзей и забирай бонусы`;

      if (startParam) {
        welcome += `\n\n🎁 *Реферальный код активирован:* \`${startParam}\` (Бонус ждёт тебя в игре!)`;
      }
      if (isAdmin) {
        welcome += `\n\n🛡️ *Права администратора: Главный администратор (@${username || 'Admin'})*`;
      }
      welcome += '\n\nНажми кнопку ниже, чтобы начать строить империю! 🚀';
    } else if (isEs) {
      buttonLabel = '🎮 Iniciar Imperio';
      guideLabel = '📖 ¿Cómo jugar?';
      channelLabel = '📢 Comunidad';
      welcome = `👑 *¡Bienvenido a Project Empire, ${firstName}!*

🎁 *¡BONO DE BIENVENIDA: +5.000 CASH!*
¡Se han añadido +5.000 Cash de capital inicial a tu cuenta para fundar tu primer negocio!

Construye tu imperio cripto desde cero:
💼 Compra negocios y acelera tus ingresos
⚡ Recauda ingresos pasivos por hora
🏆 Compite en la tabla de clasificación por premios de temporada
👥 Invita amigos y gana bonificaciones extra`;

      if (startParam) {
        welcome += `\n\n🎁 *Código de referido detectado:* \`${startParam}\` (¡Tu recompensa te espera en el juego!)`;
      }
      if (isAdmin) {
        welcome += `\n\n🛡️ *Permisos de administrador concedidos: Superadministrador (@${username || 'Admin'})*`;
      }
      welcome += '\n\n¡Toca el botón de abajo para empezar a construir tu imperio! 🚀';
    } else if (!isTr) {
      buttonLabel = '🎮 Launch Empire';
      guideLabel = '📖 How to Play?';
      channelLabel = '📢 Community Channel';
      welcome = `👑 *Welcome to Project Empire, ${firstName}!*

🎁 *STARTER BONUS: +5,000 CASH!*
Your +5,000 Cash starting capital has been credited to launch your first business!

Build your crypto empire from the ground up:
💼 Buy businesses and compound passive revenue
⚡ Collect hourly passive income
🏆 Climb the leaderboard and win season rewards
👥 Invite friends and unlock exclusive bonuses`;

      if (startParam) {
        welcome += `\n\n🎁 *Referral Code Detected:* \`${startParam}\` (Your starter bonus awaits in-game!)`;
      }
      if (isAdmin) {
        welcome += `\n\n🛡️ *Admin Privilege Verified: Superadmin (@${username || 'Admin'})*`;
      }
      welcome += '\n\nTap the button below to start building your empire now! 🚀';
    } else {
      // Default: Turkish
      buttonLabel = '🎮 İmparatorluğu Başlat';
      guideLabel = '📖 Nasıl Oynanır?';
      channelLabel = '📢 Topluluk Kanalı';
      welcome = `👑 *Project Empire'a Hoş Geldin, ${firstName}!*

🎁 *BAŞLANGIÇ HEDİYESİ: +5.000 NAKİT!*
İlk holdingini kurman için +5.000 Nakit sermaye hesabına tanımlandı.

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
      welcome += '\n\nAşağıdaki butona dokunarak hemen imparatorluğunu kurmaya başla! 🚀';
    }

    return {
      replyText: welcome,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: buttonLabel,
              web_app: { url: miniAppUrl },
            },
          ],
          [
            { text: guideLabel, callback_data: 'help_guide' },
            {
              text: channelLabel,
              url: 'https://t.me/telegram',
            },
          ],
        ],
      },
      photoUrl,
    };
  }

  if (trimmed.startsWith('/admin')) {
    if (!isAdmin) {
      return {
        replyText: isRu
          ? '⛔ *Доступ запрещён*\n\nЭта команда только для авторизованных администраторов (@Barandnz, @Mberked).'
          : isEs
            ? '⛔ *Acceso no autorizado*\n\nEste comando es solo para administradores autorizados (@Barandnz, @Mberked).'
            : !isTr
              ? '⛔ *Unauthorized Access*\n\nThis command is strictly reserved for designated administrators (@Barandnz, @Mberked).'
              : '⛔ *Yetkisiz Erişim*\n\nBu komut yalnızca yetkili yöneticiler (@Barandnz, @Mberked) içindir.',
        replyMarkup: {
          inline_keyboard: [
            [
              {
                text: isRu
                  ? '🎮 Начать игру'
                  : isEs
                    ? '🎮 Iniciar juego'
                    : !isTr
                      ? '🎮 Launch Game'
                      : '🎮 Oyunu Başlat',
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
    const helpText = isRu
      ? `ℹ️ *Project Empire — Справка и руководство*

1️⃣ **Бизнес**: Создавай киоски, кафе, фабрики и криптофермы для роста дохода.
2️⃣ **Пассивный доход**: Казна наполняется даже офлайн (до 4 часов, с VIP до 12 часов).
3️⃣ **Задания**: Выполняй ежедневные квесты и держи серию входов.
4️⃣ **Рефералы**: Приглашай друзей — получайте бонусы вдвоём.

Нажми кнопку ниже, чтобы вернуться в игру! 👇`
      : isEs
        ? `ℹ️ *Project Empire — Ayuda y Guía*

1️⃣ **Negocios**: Abre puestos, cafeterías, fábricas y minas cripto.
2️⃣ **Ingresos pasivos**: Tu caja sigue sumando ganancias fuera de línea (hasta 4h, con VIP 12h).
3️⃣ **Misiones**: Completa tareas diarias y mantén tu racha de actividad.
4️⃣ **Referidos**: Invita amigos; ambos recibirán bonificaciones.

¡Toca el botón abajo para volver al juego! 👇`
        : !isTr
          ? `ℹ️ *Project Empire — Help & Guide*

1️⃣ **Businesses**: Set up stands, cafes, factories, and crypto mines to compound earnings.
2️⃣ **Passive Income**: Vault accumulates income even while offline (up to 4 hours, 12 hours with VIP).
3️⃣ **Missions**: Complete daily tasks and maintain your streak for rewards.
4️⃣ **Referrals**: Invite friends; both of you receive instant cash and kickbacks.

Tap below to jump straight into the game! 👇`
          : `ℹ️ *Project Empire — Yardım ve Rehber*

1️⃣ **İşletmeler**: Stand, Kafe, Gece Kulübü ve Kripto Madencilik tesisi kurup gelirini katla.
2️⃣ **Pasif Gelir**: Çevrimdışı kaldığında bile kasan dolmaya devam eder (Maksimum 4 saat, VIP kartla 12 saat).
3️⃣ **Görevler**: Günlük görevleri tamamla, streak serisini bozma ve her 7 günde bir döngü bonusu al.
4️⃣ **Referans**: Arkadaşlarını davet et; hem sen hem arkadaşın bonus kazansın.

Hemen başlamak için aşağıdaki butona dokun! 👇`;

    const backButtonText = isRu
      ? '🎮 Вернуться в игру'
      : isEs
        ? '🎮 Volver al juego'
        : !isTr
          ? '🎮 Return to Game'
          : '🎮 Oyuna Dön';

    return {
      replyText: helpText,
      replyMarkup: {
        inline_keyboard: [
          [
            {
              text: backButtonText,
              web_app: { url: buildMiniAppUrl(appOrigin) },
            },
          ],
        ],
      },
    };
  }

  // Fallback for unknown messages
  const fallbackText = isRu
    ? `Добро пожаловать в Project Empire Bot! Нажми кнопку ниже, чтобы начать игру 👇`
    : isEs
      ? `¡Bienvenido a Project Empire Bot! Toca el botón de abajo para iniciar el juego 👇`
      : !isTr
        ? `Welcome to Project Empire Bot! Tap the button below to launch the game 👇`
        : `Project Empire Bot'a hoş geldin! Oyunu başlatmak için aşağıdaki butona dokunabilirsin 👇`;

  const fallbackBtn = isRu
    ? '🎮 Запустить Империю'
    : isEs
      ? '🎮 Iniciar Imperio'
      : !isTr
        ? '🎮 Launch Empire'
        : '🎮 İmparatorluğu Başlat';

  return {
    replyText: fallbackText,
    replyMarkup: {
      inline_keyboard: [
        [
          {
            text: fallbackBtn,
            web_app: { url: buildMiniAppUrl(appOrigin) },
          },
        ],
      ],
    },
  };
}

export async function handleTelegramBotMessage(
  params: TelegramBotMessageParams,
): Promise<{ success: boolean; action: string; method?: string }> {
  const {
    token,
    chatId,
    appOrigin,
    text,
    username,
    firstName = 'Girişimci',
    languageCode,
    withPhoto = false,
    fetcher = fetch,
  } = params;

  const { replyText, replyMarkup, photoUrl } = buildBotResponse({
    text,
    firstName,
    username,
    appOrigin,
    languageCode,
  });

  const action = text.startsWith('/start')
    ? 'start'
    : text.startsWith('/admin')
      ? 'admin'
      : text.startsWith('/help')
        ? 'help'
        : 'default';

  try {
    if (withPhoto && photoUrl) {
      try {
        const photoUrlEndpoint = `https://api.telegram.org/bot${token}/sendPhoto`;
        const photoRes = await fetcher(photoUrlEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: photoUrl,
            caption: replyText,
            parse_mode: 'Markdown',
            reply_markup: replyMarkup,
          }),
        });

        if (photoRes.ok) {
          return { success: true, action, method: 'sendPhoto' };
        }
      } catch {
        // Fallback gracefully to sendMessage if sendPhoto network/Telegram error occurs
      }
    }

    const messageEndpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetcher(messageEndpoint, {
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
      action,
      method: 'sendMessage',
    };
  } catch {
    return {
      success: false,
      action: 'error',
    };
  }
}
