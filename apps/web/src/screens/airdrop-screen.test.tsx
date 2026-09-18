import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AirdropScreen } from './airdrop-screen';

describe('AirdropScreen', () => {
  it('renders initial state with SOON badge and fair distribution notices', () => {
    const markup = renderToStaticMarkup(
      <AirdropScreen
        userSeasonPoints={10000}
        userCash={500000}
        userStreak={14}
        userReferrals={5}
      />,
    );

    // Title & SOON banner
    expect(markup).toContain('🔒 FAZ 1 HAZIRLIK (ÇOK YAKINDA / SOON)');
    expect(markup).toContain('Airdrop Portalı');
    expect(markup).toContain('Parayla token satışı yoktur (Anti-P2W)');

    // Allocation points & Tier
    expect(markup).toContain('Airdrop Tahsisi');
    expect(markup).toContain('Puan');
    expect(markup).toContain('Sezon Puanı');
    expect(markup).toContain('Kasa Hacmi');
    expect(markup).toContain('Günlük Seri (14 Gün)');
    expect(markup).toContain('Cüzdan Bonusu');

    // Wallet card in disconnected state
    expect(markup).toContain('TON Cüzdanı Bağlantısı');
    expect(markup).toContain('Bekleniyor (Soon)');
    expect(markup).toContain('TON Cüzdanı Bağla (Yakında)');

    // Social growth tasks
    expect(markup).toContain('Airdrop Görevleri');
    expect(markup).toContain('Resmi Telegram Kanalına Katıl');
    expect(markup).toContain('X (Twitter) Hesabımızı Takip Et');
    expect(markup).toContain('TON Cüzdanını Bağla');
    expect(markup).toContain('Yakında (Soon)');

    // Security & Anti-Sybil policy
    expect(markup).toContain('Şeffaflık &amp; Güvenlik Politikası');
    expect(markup).toContain('her Telegram kullanıcısı yalnızca 1 TON cüzdanı bağlayabilir');
  });

  it('renders connected wallet state when initialWalletAddress is provided', () => {
    const mockAddress = 'EQCGScrZe1xwoMCUWmUbFTCxxtdMm-rP2x7IbQEfzsZ044-W';
    const markup = renderToStaticMarkup(
      <AirdropScreen
        userSeasonPoints={50000}
        userCash={2000000}
        userStreak={30}
        userReferrals={10}
        initialWalletAddress={mockAddress}
      />,
    );

    // Should indicate connected status
    expect(markup).toContain('TON Cüzdanı Bağlandı');
    expect(markup).toContain('Doğrulandı');
    expect(markup).toContain(mockAddress);
    expect(markup).toContain('Cüzdanı Kaldır');
    expect(markup).toContain('+1.000');
  });
});
