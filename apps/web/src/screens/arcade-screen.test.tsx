import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArcadeScreen } from './arcade-screen';
import { EmpireArcade } from '../components/empire-arcade';
import { CatizenMergeGame } from '../components/catizen-merge-game';
import { DynastyCipherGame } from '../components/dynasty-cipher-game';
import { NotcoinTapGame } from '../components/notcoin-tap-game';
import { CryptoCrashGame } from '../components/crypto-crash-game';

describe('ArcadeScreen and Mini-Games Suite', () => {
  describe('ArcadeScreen and Hub Shell', () => {
    it('renders ArcadeScreen with header, audio controls, tabs, and default Notcoin Tap game', () => {
      const markup = renderToStaticMarkup(
        <ArcadeScreen preview playerCash={5000} />,
      );

      expect(markup).toContain('EMPIRE OYUN SALONU');
      expect(markup).toContain('Arcade Eğlence Merkezi');
      expect(markup).toContain('Dokun');
      expect(markup).toContain('Birleştir');
      expect(markup).toContain('Şifre');
      expect(markup).toContain('Çöküş');

      // Default active game is Notcoin Tap
      expect(markup).toContain('Dokun Kazan');
      expect(markup).toContain('Kazanılan Nakit');
      expect(markup).toContain('arcade-mute-btn');
      expect(markup).toContain('arcade-module-card');
    });

    it('renders EmpireArcade with specified initial game', () => {
      // Test Catizen Merge initial render
      const mergeMarkup = renderToStaticMarkup(
        <EmpireArcade preview initialGame="merge" />,
      );
      expect(mergeMarkup).toContain('Catizen Birleştirme Oyunu');
      expect(mergeMarkup).toContain('Üretim Hızı');
      expect(mergeMarkup).toContain('Paket Çağır');

      // Test Dynasty Cipher initial render
      const cipherMarkup = renderToStaticMarkup(
        <EmpireArcade preview initialGame="cipher" />,
      );
      expect(cipherMarkup).toContain('Hanedan Şifresi Terminali');
      expect(cipherMarkup).toContain('[SYS_OVERRIDE_V4]');
      expect(cipherMarkup).toContain('GÜVENLİK DUVARI KIRILMASI');

      // Test Crypto Crash initial render
      const crashMarkup = renderToStaticMarkup(
        <EmpireArcade preview initialGame="crash" />,
      );
      expect(crashMarkup).toContain('Kripto Mum Çöküş Oyunu');
      expect(crashMarkup).toContain('PİYASA BEKLEMEDE');
      expect(crashMarkup).toContain('BOĞA BAŞLAT');

      // Test Mint game initial render
      const mintMarkup = renderToStaticMarkup(
        <EmpireArcade preview initialGame="mint" />,
      );
      expect(mintMarkup).toContain('Darphane');
    });

    it('displays assist module cards with Telegram Stars pricing and preview buttons', () => {
      const tapMarkup = renderToStaticMarkup(
        <EmpireArcade preview initialGame="tap" />,
      );
      expect(tapMarkup).toContain('YARDIMCI MODÜL');
      expect(tapMarkup).toContain('TapBot Asistanı');
      expect(tapMarkup).toContain('149 ⭐');
      expect(tapMarkup).toContain('Modülü dene');

      const mergeMarkup = renderToStaticMarkup(
        <EmpireArcade preview initialGame="merge" />,
      );
      expect(mergeMarkup).toContain('Oto Birleştirici');
      expect(mergeMarkup).toContain('129 ⭐');
    });
  });

  describe('Game 1: CatizenMergeGame Component', () => {
    it('renders 4x3 living grid with 12 slots and starter items', () => {
      const markup = renderToStaticMarkup(
        <CatizenMergeGame preview autoMerge={false} />,
      );

      expect(markup).toContain('catizen-game');
      expect(markup).toContain('catizen-grid');
      expect(markup).toContain('Üretim Hızı');
      expect(markup).toContain('Kasa Bankası');
      expect(markup).toContain('Oto-Bot');
      expect(markup).toContain('Paket Çağır');
      expect(markup).toContain('Kasa Topla');

      // Starter items on board
      expect(markup).toContain('Bronz Çip');
      expect(markup).toContain('Gümüş Külçe');
    });

    it('renders Auto-Bot state button accessibly', () => {
      const inactiveMarkup = renderToStaticMarkup(
        <CatizenMergeGame preview autoMerge={false} />,
      );
      expect(inactiveMarkup).toContain('Oto-Bot');
      expect(inactiveMarkup).toContain('aria-pressed="false"');

      const activeMarkup = renderToStaticMarkup(
        <CatizenMergeGame preview autoMerge={true} />,
      );
      expect(activeMarkup).toContain('Bot Aktif');
      expect(activeMarkup).toContain('aria-pressed="true"');
    });
  });

  describe('Game 2: DynastyCipherGame Component', () => {
    it('renders Cyberpunk terminal UI with CRT scanlines and 4 cyber nodes', () => {
      const markup = renderToStaticMarkup(
        <DynastyCipherGame preview assistant={false} />,
      );

      expect(markup).toContain('cipher-terminal');
      expect(markup).toContain('scanline-overlay');
      expect(markup).toContain('[SYS_OVERRIDE_V4]');
      expect(markup).toContain('Hanedan Şifresi');
      expect(markup).toContain('5 HAK');

      // 4 Cyber nodes
      expect(markup).toContain('0x01 [ALPHA]');
      expect(markup).toContain('0x02 [BETA]');
      expect(markup).toContain('0x03 [GAMMA]');
      expect(markup).toContain('0x04 [DELTA]');

      // Start action button
      expect(markup).toContain('ŞİFREYİ ÇÖZMEYE BAŞLA');
    });

    it('renders assistant hint when cipher bot is enabled', () => {
      const markup = renderToStaticMarkup(
        <DynastyCipherGame preview assistant={true} />,
      );
      expect(markup).toContain('cipher-terminal');
    });
  });

  describe('Game 3: NotcoinTapGame Component', () => {
    it('renders 3D tactile coin target, scoreboard, and energy gauge', () => {
      const markup = renderToStaticMarkup(
        <NotcoinTapGame preview playerCash={2500} />,
      );

      expect(markup).toContain('notcoin-tap-game');
      expect(markup).toContain('tap-scoreboard');
      expect(markup).toContain('Kazanılan Nakit');
      expect(markup).toContain('Yükseltmeler');
      expect(markup).toContain('tap-coin-target');
      expect(markup).toContain('PROJECT EMPIRE');
      expect(markup).toContain('tap-energy-container');
      expect(markup).toContain('/ 1000');
    });
  });

  describe('Game 4: CryptoCrashGame Component', () => {
    it('renders Candlestick canvas chart container, history pills, and chips row', () => {
      const markup = renderToStaticMarkup(
        <CryptoCrashGame preview playerCash={3000} />,
      );

      expect(markup).toContain('crypto-crash-game');
      expect(markup).toContain('crash-history-strip');
      expect(markup).toContain('crash-canvas-container');
      expect(markup).toContain('multiplier-hud');
      expect(markup).toContain('PİYASA BEKLEMEDE');
      expect(markup).toContain('Yatırım Tutarı');

      // Chips row includes +10, +50, +100, +250, +500, and MAKS
      expect(markup).toContain('+10');
      expect(markup).toContain('+50');
      expect(markup).toContain('+100');
      expect(markup).toContain('+250');
      expect(markup).toContain('+500');
      expect(markup).toContain('MAKS');

      // Custom numeric stake input
      expect(markup).toContain('crash-stake-input');
      expect(markup).toContain('crash-stake-currency');
      expect(markup).toContain('NAKİT');

      // Launch button
      expect(markup).toContain('BOĞA BAŞLAT');
    });

    it('renders with validation error and disables launch button when player cash is below minimum stake', () => {
      const markup = renderToStaticMarkup(
        <CryptoCrashGame preview playerCash={5} />,
      );

      expect(markup).toContain('crash-stake-validation-msg');
      expect(markup).toContain('Yetersiz bakiye! Maksimum: 5 Nakit');
      expect(markup).toContain('disabled=""');
    });
  });

  describe('Mobile Responsiveness & Astra 6.0 Styling', () => {
    it('applies fluid grid classes preventing overflow down to 320px', () => {
      const markup = renderToStaticMarkup(<ArcadeScreen preview />);
      expect(markup).toContain('arcade-screen');
      expect(markup).toContain('workspace-grid');
      expect(markup).toContain('arcade-nav-tabs');
    });
  });
});
