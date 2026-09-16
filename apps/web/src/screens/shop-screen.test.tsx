import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ShopScreen } from './shop-screen';
import type { ScreenResource, ShopView } from '../game/types';
import {
  getInvoiceStatusFeedback,
  handleInvoicePaidSuccess,
  type TelegramInvoiceStatus,
} from '../game/live-game-model';
import type { QueryClient } from '@tanstack/react-query';

const mockShopData: ShopView = {
  passActive: false,
  expiresAt: null,
  products: [
    {
      sku: 'convenience_pass_30d',
      name: '30 Günlük Convenience Pass',
      description: '12 saat çevrimdışı kazanç kapasitesi.',
      price: 250,
      type: 'convenience_pass',
      durationDays: 30,
    },
    {
      sku: 'cosmetic_frame_gold',
      name: 'Altın Çerçeve',
      description: 'Profilin için özel altın çerçeve.',
      price: 150,
      type: 'cosmetic',
      durationDays: null,
    },
    {
      sku: 'cosmetic_emblem_founder',
      name: 'Kurucu Amblemi',
      description: 'İlk sezon katılımcılarına özel amblem.',
      price: 300,
      type: 'cosmetic',
      durationDays: null,
    },
  ],
};

const mockReadyResource: ScreenResource<ShopView> = {
  status: 'ready',
  data: mockShopData,
};

describe('ShopScreen R2 Stars payments & feature flag controls', () => {
  it('displays "Yakında" badge and disables all buy buttons when starsPaymentsEnabled is false', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen resource={mockReadyResource} starsPaymentsEnabled={false} />,
    );

    expect(markup).toContain('sa-badge-soon');
    expect(markup).toContain('Yakında');
    expect(markup).toContain('Satışlar yakında');
    // Header row and cosmetic rows both contain Yakında badge
    expect(markup).toContain('sa-pass-header-row');
    expect(markup).toContain('sa-cosmetic-title-row');

    // Both Pass and Cosmetic buttons must be disabled
    const disabledMatches = markup.match(/disabled=""/g);
    expect(disabledMatches?.length).toBeGreaterThanOrEqual(3);
  });

  it('defaults starsPaymentsEnabled to false when omitted', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen resource={mockReadyResource} />,
    );

    expect(markup).toContain('sa-badge-soon');
    expect(markup).toContain('Satışlar yakında');
  });

  it('renders active purchase buttons and removes "Yakında" badges when starsPaymentsEnabled is true', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen resource={mockReadyResource} starsPaymentsEnabled={true} />,
    );

    expect(markup).not.toContain('sa-badge-soon');
    expect(markup).not.toContain('Satışlar yakında');
    expect(markup).toContain('Empire Pass Al');
    expect(markup).toContain('Satın Al');

    // Pass and cosmetic buttons should not be disabled
    expect(markup).toContain('sa-buy-button');
    expect(markup).toContain('sa-cosmetic-buy');
  });

  it('displays active pass badge and disables pass button when passActive is true', () => {
    const activeResource: ScreenResource<ShopView> = {
      status: 'ready',
      data: {
        ...mockShopData,
        passActive: true,
        expiresAt: '2026-10-15T12:00:00.000Z',
      },
    };

    const markup = renderToStaticMarkup(
      <ShopScreen resource={activeResource} starsPaymentsEnabled={true} />,
    );

    expect(markup).toContain('Empire Pass aktif');
    expect(markup).toContain('Empire Pass Aktif');
    expect(markup).toContain('sa-active-badge');
  });

  it('disables buttons and displays "Ödeme açılıyor…" when pass purchase is pending', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchasingSku="convenience_pass_30d"
      />,
    );

    expect(markup).toContain('Ödeme açılıyor…');
    const disabledMatches = markup.match(/disabled=""/g);
    expect(disabledMatches?.length).toBeGreaterThanOrEqual(3);
  });

  it('disables buttons and displays "Ödeme açılıyor…" on the matching cosmetic when cosmetic purchase is pending', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchasingSku="cosmetic_frame_gold"
      />,
    );

    expect(markup).toContain('Ödeme açılıyor…');
    // All buttons should be disabled while one is purchasing
    const disabledMatches = markup.match(/disabled=""/g);
    expect(disabledMatches?.length).toBeGreaterThanOrEqual(3);
  });

  it('renders accessible status feedback banner with role="status" and aria-live="polite"', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchaseFeedback={{
          kind: 'status',
          message: 'Ödeme penceresi hazırlanıyor…',
        }}
      />,
    );

    expect(markup).toContain('sa-feedback-banner status');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('Ödeme penceresi hazırlanıyor…');
  });

  it('renders accessible success feedback banner with role="status"', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchaseFeedback={{
          kind: 'success',
          message:
            'Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı.',
        }}
      />,
    );

    expect(markup).toContain('sa-feedback-banner success');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Ödeme tamamlandı!');
  });

  it('renders accessible error feedback banner with role="alert"', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchaseFeedback={{
          kind: 'error',
          message: 'Ödeme bağlantısı oluşturulamadı. Lütfen tekrar dene.',
        }}
      />,
    );

    expect(markup).toContain('sa-feedback-banner error');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Ödeme bağlantısı oluşturulamadı.');
  });

  it('does not render feedback banner when purchaseFeedback is null', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={mockReadyResource}
        starsPaymentsEnabled={true}
        purchaseFeedback={null}
      />,
    );

    expect(markup).not.toContain('sa-feedback-banner');
  });

  it('renders loading notice when resource is loading', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={{ status: 'loading', data: null }}
        starsPaymentsEnabled={true}
      />,
    );

    expect(markup).toContain('skeleton-line');
  });

  it('renders error notice when resource is in error state', () => {
    const markup = renderToStaticMarkup(
      <ShopScreen
        resource={{ status: 'error', data: null }}
        starsPaymentsEnabled={true}
      />,
    );

    expect(markup).toContain('Şu anda yüklenemedi');
    expect(markup).toContain('role="status"');
  });
});

describe('Telegram Stars invoice status callbacks and invalidations', () => {
  it.each([
    [
      'paid',
      'success',
      'Ödeme tamamlandı! Satın aldığın ayrıcalık hesabına tanımlandı.',
    ],
    ['cancelled', 'status', 'Ödeme işlemi iptal edildi.'],
    [
      'failed',
      'error',
      'Ödeme tamamlanamadı. Lütfen Yıldız bakiyeni kontrol edip tekrar dene.',
    ],
    [
      'pending',
      'status',
      'Ödeme onay bekliyor. İşlem onaylandığında ürün hesabına aktarılacaktır.',
    ],
  ] as const)(
    'maps status %s to feedback kind %s with proper Turkish localized copy',
    (status: TelegramInvoiceStatus, expectedKind, expectedMessage) => {
      const feedback = getInvoiceStatusFeedback(status);
      expect(feedback.kind).toBe(expectedKind);
      expect(feedback.message).toBe(expectedMessage);
    },
  );

  it('optimistically activates pass and invalidates queries on paid convenience pass', async () => {
    const setQueryDataMock = vi.fn((key, updater) => {
      const prevData = {
        pass: { isActive: false, expiresAt: null },
      };
      return typeof updater === 'function' ? updater(prevData) : updater;
    });
    const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);

    const mockQueryClient = {
      setQueryData: setQueryDataMock,
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;

    await handleInvoicePaidSuccess(
      mockQueryClient,
      'player-123',
      'convenience_pass_30d',
    );

    expect(setQueryDataMock).toHaveBeenCalledWith(
      ['game-design', 'player-123', 'shop'],
      expect.any(Function),
    );

    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['game-design', 'player-123', 'shop'],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['game-design', 'player-123', 'economy'],
    });
    expect(invalidateQueriesMock).toHaveBeenCalledWith({
      queryKey: ['game-design', 'player-123', 'state'],
    });
  });

  it('invalidates queries without mutating pass on cosmetic purchase', async () => {
    const setQueryDataMock = vi.fn();
    const invalidateQueriesMock = vi.fn().mockResolvedValue(undefined);

    const mockQueryClient = {
      setQueryData: setQueryDataMock,
      invalidateQueries: invalidateQueriesMock,
    } as unknown as QueryClient;

    await handleInvoicePaidSuccess(
      mockQueryClient,
      'player-123',
      'cosmetic_frame_gold',
    );

    expect(setQueryDataMock).not.toHaveBeenCalled();
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(3);
  });
});
