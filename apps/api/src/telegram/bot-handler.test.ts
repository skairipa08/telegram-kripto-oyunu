import { describe, expect, it, vi } from 'vitest';
import {
  buildBotResponse,
  buildMiniAppUrl,
  handleTelegramBotMessage,
  isDesignatedAdmin,
} from './bot-handler';

describe('Telegram Bot Handler & MVP Integration', () => {
  describe('Admin designation detection', () => {
    it('recognizes @Barandnz and @Mberked across various casing and @ prefixes', () => {
      expect(isDesignatedAdmin('Barandnz')).toBe(true);
      expect(isDesignatedAdmin('@Barandnz')).toBe(true);
      expect(isDesignatedAdmin('barandnz')).toBe(true);
      expect(isDesignatedAdmin('Mberked')).toBe(true);
      expect(isDesignatedAdmin('@mberked')).toBe(true);
      expect(isDesignatedAdmin('MBERKED')).toBe(true);
      expect(isDesignatedAdmin('normal_user')).toBe(false);
      expect(isDesignatedAdmin(null)).toBe(false);
      expect(isDesignatedAdmin(undefined)).toBe(false);
    });
  });

  describe('Mini App URL construction', () => {
    it('constructs clean base URL without trailing duplicate slashes', () => {
      expect(buildMiniAppUrl('https://empire.example')).toBe(
        'https://empire.example/',
      );
      expect(buildMiniAppUrl('https://empire.example/')).toBe(
        'https://empire.example/',
      );
    });

    it('attaches referral startapp parameter cleanly', () => {
      const url = buildMiniAppUrl('https://empire.example', 'ref_BARAN123');
      expect(url).toContain('startapp=ref_BARAN123');
      expect(url).toContain('tgWebAppStartParam=ref_BARAN123');
    });
  });

  describe('buildBotResponse commands', () => {
    const appOrigin = 'https://empire.example';

    it('generates rich /start welcome message with Web App launch button for regular players', () => {
      const { replyText, replyMarkup } = buildBotResponse({
        text: '/start',
        firstName: 'Ahmet',
        username: 'ahmet_player',
        appOrigin,
      });

      expect(replyText).toContain("Project Empire'a Hoş Geldin, Ahmet!");
      expect(replyText).toContain('İşletmeler satın al ve yükselt');
      expect(replyMarkup).toHaveProperty('inline_keyboard');
      const keyboard = replyMarkup.inline_keyboard as Array<
        Array<{ text: string; web_app?: { url: string } }>
      >;
      expect(keyboard[0]?.[0]?.text).toBe('🎮 İmparatorluğu Başlat');
      expect(keyboard[0]?.[0]?.web_app?.url).toBe('https://empire.example/');
    });

    it('includes referral bonus note when player starts with ref parameter', () => {
      const { replyText, replyMarkup } = buildBotResponse({
        text: '/start ref_VIP999',
        firstName: 'Mehmet',
        username: 'mehmet_player',
        appOrigin,
      });

      expect(replyText).toContain('Tavsiye Kodu Algılandı:* `ref_VIP999`');
      const keyboard = replyMarkup.inline_keyboard as Array<
        Array<{ text: string; web_app?: { url: string } }>
      >;
      expect(keyboard[0]?.[0]?.web_app?.url).toContain('startapp=ref_VIP999');
    });

    it('highlights superadmin privileges in /start greeting for @Barandnz', () => {
      const { replyText } = buildBotResponse({
        text: '/start',
        firstName: 'Baran',
        username: 'Barandnz',
        appOrigin,
      });

      expect(replyText).toContain(
        'Yönetici Yetkisi Tanımlandı: Süper Yönetici (@Barandnz)',
      );
    });

    it('allows /admin command for designated admin @Mberked with admin button', () => {
      const { replyText, replyMarkup } = buildBotResponse({
        text: '/admin',
        firstName: 'Berke',
        username: 'Mberked',
        appOrigin,
      });

      expect(replyText).toContain('Yönetici Kontrol Paneli');
      expect(replyText).toContain('Süper Yönetici (Superadmin)');
      const keyboard = replyMarkup.inline_keyboard as Array<
        Array<{ text: string; web_app?: { url: string } }>
      >;
      expect(keyboard[0]?.[0]?.text).toContain('Yönetici Paneli');
    });

    it('rejects /admin command with 403-equivalent notice for non-admin players', () => {
      const { replyText } = buildBotResponse({
        text: '/admin',
        firstName: 'Ali',
        username: 'ali_normal',
        appOrigin,
      });

      expect(replyText).toContain('Yetkisiz Erişim');
      expect(replyText).toContain('@Barandnz, @Mberked');
    });

    it('provides gameplay guide for /help command', () => {
      const { replyText } = buildBotResponse({
        text: '/help',
        firstName: 'Ayşe',
        username: 'ayse_99',
        appOrigin,
      });

      expect(replyText).toContain('Yardım ve Rehber');
      expect(replyText).toContain('İşletmeler');
      expect(replyText).toContain('Pasif Gelir');
    });
  });

  describe('handleTelegramBotMessage dispatcher', () => {
    it('sends sendMessage HTTP POST request to Telegram Bot API', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      });

      const result = await handleTelegramBotMessage({
        token: '123456:FAKE_TELEGRAM_TOKEN',
        appOrigin: 'https://empire.example',
        chatId: 987654321,
        text: '/start',
        username: 'Barandnz',
        firstName: 'Baran',
        fetcher: mockFetch as unknown as typeof fetch,
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('start');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(calledUrl).toBe(
        'https://api.telegram.org/bot123456:FAKE_TELEGRAM_TOKEN/sendMessage',
      );
      const sentPayload = JSON.parse(String(calledInit.body)) as {
        chat_id: number;
        text: string;
        parse_mode: string;
        reply_markup: { inline_keyboard: unknown[] };
      };
      expect(sentPayload.chat_id).toBe(987654321);
      expect(sentPayload.parse_mode).toBe('Markdown');
      expect(sentPayload.reply_markup.inline_keyboard.length).toBeGreaterThan(
        0,
      );
    });
  });
});
