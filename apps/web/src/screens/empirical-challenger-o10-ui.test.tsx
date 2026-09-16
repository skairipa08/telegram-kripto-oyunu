import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CryptoCrashGame, QUICK_CHIPS } from '../components/crypto-crash-game';
import { MissionsScreen, STREAK_MILESTONES } from './missions-screen';

describe('EMPIRICAL CHALLENGER UI & STREAK SUITE (o10)', () => {
  // =========================================================================
  // UI 1: Free Stake Input & Clamping Invariants
  // =========================================================================
  describe('UI 1: Free Stake Input & Clamping Invariants', () => {
    it('verifies QUICK_CHIPS matches expected list [10, 50, 100, 250, 500]', () => {
      expect(QUICK_CHIPS).toEqual([10, 50, 100, 250, 500]);
    });

    it('renders disabled launch button and explicit error message when playerCash is 0', () => {
      const markup = renderToStaticMarkup(
        <CryptoCrashGame preview playerCash={0} />,
      );

      expect(markup).toContain('Yetersiz bakiye! Maksimum: 0 Nakit');
      expect(markup).toContain('has-error');
      expect(markup).toContain('disabled=""');
    });

    it('renders disabled launch button when playerCash is 5 (below min stake 10)', () => {
      const markup = renderToStaticMarkup(
        <CryptoCrashGame preview playerCash={5} />,
      );

      expect(markup).toContain('Yetersiz bakiye! Maksimum: 5 Nakit');
      expect(markup).toContain('disabled=""');
    });

    it('clamps default stake to 10 when player has exactly 10 Cash and enables launch button', () => {
      const markup = renderToStaticMarkup(
        <CryptoCrashGame preview playerCash={10} />,
      );

      expect(markup).toContain('value="10"');
      expect(markup).toContain('🚀 BOĞA BAŞLAT (10 NAKİT)');
      expect(markup).not.toContain('disabled=""');
      expect(markup).not.toContain('has-error');
    });

    it('renders correctly with large player cash without layout breaking', () => {
      const markup = renderToStaticMarkup(
        <CryptoCrashGame preview playerCash={10_000_000} />,
      );

      expect(markup).toContain('Bakiye: <strong>10000000 Nakit</strong>');
      expect(markup).toContain('🚀 BOĞA BAŞLAT (100 NAKİT)');
      expect(markup).not.toContain('disabled=""');
    });
  });

  // =========================================================================
  // UI 2: Extended Streak Milestone Track Rendering Across All Milestones
  // =========================================================================
  describe('UI 2: Extended Streak Milestone Track Rendering', () => {
    it('exports all 5 milestones with correct cash, SRU and badge metadata', () => {
      expect(STREAK_MILESTONES).toHaveLength(5);
      const [d7, d30, d90, d180, d365] = STREAK_MILESTONES;

      expect(d7?.days).toBe(7);
      expect(d7?.cashBonus).toBe(500);
      expect(d7?.sruMultiplier).toBe('1.0x SRU');

      expect(d30?.days).toBe(30);
      expect(d30?.cashBonus).toBe(5000);
      expect(d30?.sruMultiplier).toBe('2.5x SRU');

      expect(d90?.days).toBe(90);
      expect(d90?.cashBonus).toBe(25000);
      expect(d90?.sruMultiplier).toBe('5.0x SRU');

      expect(d180?.days).toBe(180);
      expect(d180?.cashBonus).toBe(100000);
      expect(d180?.sruMultiplier).toBe('10.0x SRU');

      expect(d365?.days).toBe(365);
      expect(d365?.cashBonus).toBe(500000);
      expect(d365?.sruMultiplier).toBe('25.0x SRU');
      expect(d365?.badgeName).toBe('İmparatorluk Kıdemlisi');
    });

    it('fuzzes streak milestone UI across test matrix: 0, 1, 6, 7, 8, 29, 30, 31, 89, 90, 91, 179, 180, 181, 364, 365, 366, 1000 days', () => {
      const testDays = [
        0, 1, 6, 7, 8, 29, 30, 31, 89, 90, 91, 179, 180, 181, 364, 365, 366,
        1000,
      ];

      for (const day of testDays) {
        const markup = renderToStaticMarkup(
          <MissionsScreen
            resource={{
              status: 'ready',
              data: {
                streak: day,
                missions: [],
              },
            }}
          />,
        );

        const expectedDayStr = day >= 1000 ? '1.000' : String(day);
        expect(markup).toContain(
          `Mevcut Seri: <strong>${expectedDayStr} gün</strong>`,
        );

        // Check Milestone Status Consistency
        if (day < 7) {
          // 7-day is the current target
          expect(markup).toContain('HEDEF');
          expect(markup).toContain(`${7 - day} gün kaldı`);
        } else if (day >= 7 && day < 30) {
          // 7-day achieved, 30-day is target
          expect(markup).toContain('✓ AÇILDI');
          expect(markup).toContain(`${30 - day} gün kaldı`);
        } else if (day >= 30 && day < 90) {
          // 30-day achieved, 90-day is target
          expect(markup).toContain(`${90 - day} gün kaldı`);
        } else if (day >= 90 && day < 180) {
          // 90-day achieved, 180-day is target
          expect(markup).toContain(`${180 - day} gün kaldı`);
        } else if (day >= 180 && day < 365) {
          // 180-day achieved, 365-day is target
          expect(markup).toContain(`${365 - day} gün kaldı`);
        } else if (day >= 365) {
          // All 5 milestones achieved!
          // No locked milestones remaining
          expect(markup).not.toContain('🔒 KİLİTLİ');
          expect(markup).not.toContain('HEDEF');
          // All 5 cards must have "✓ AÇILDI"
          const countAchieved = (markup.match(/✓ AÇILDI/g) || []).length;
          expect(countAchieved).toBe(5);
        }
      }
    });
  });
});
