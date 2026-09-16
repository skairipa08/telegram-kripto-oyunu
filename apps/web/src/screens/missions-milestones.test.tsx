import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MissionsScreen, STREAK_MILESTONES } from './missions-screen';

describe('MissionsScreen: Extended Streak Milestone Track', () => {
  it('exports all 5 required compounding milestone tiers with correct constants', () => {
    expect(STREAK_MILESTONES).toHaveLength(5);

    const [d7, d30, d90, d180, d365] = STREAK_MILESTONES;

    expect(d7?.days).toBe(7);
    expect(d7?.cashBonus).toBe(500);
    expect(d7?.sruMultiplier).toContain('1.0x SRU');

    expect(d30?.days).toBe(30);
    expect(d30?.cashBonus).toBe(5000);
    expect(d30?.sruMultiplier).toContain('2.5x SRU');

    expect(d90?.days).toBe(90);
    expect(d90?.cashBonus).toBe(25000);
    expect(d90?.sruMultiplier).toContain('5.0x SRU');

    expect(d180?.days).toBe(180);
    expect(d180?.cashBonus).toBe(100000);
    expect(d180?.sruMultiplier).toContain('10.0x SRU');

    expect(d365?.days).toBe(365);
    expect(d365?.cashBonus).toBe(500000);
    expect(d365?.sruMultiplier).toContain('25.0x SRU');
    expect(d365?.badgeName).toBe('İmparatorluk Kıdemlisi');
  });

  it('renders milestone track with all 5 milestone cards and reward pills', () => {
    const markup = renderToStaticMarkup(
      <MissionsScreen
        resource={{
          status: 'ready',
          data: {
            streak: 5,
            missions: [],
          },
        }}
      />,
    );

    expect(markup).toContain('missions-milestones-track');
    expect(markup).toContain('KIDEM KİLOMETRE TAŞLARI');
    expect(markup).toContain('Uzun Vadeli Seri Hedefleri');
    expect(markup).toContain('Mevcut Seri: <strong>5 gün</strong>');

    // All milestones labels
    expect(markup).toContain('7 Gün (1 Hafta)');
    expect(markup).toContain('30 Gün (1 Ay)');
    expect(markup).toContain('90 Gün (3 Ay)');
    expect(markup).toContain('180 Gün (6 Ay)');
    expect(markup).toContain('365 Gün (1 Yıl)');

    // Reward pills
    expect(markup).toContain('+500 Nakit');
    expect(markup).toContain('+5.000 Nakit');
    expect(markup).toContain('+25.000 Nakit');
    expect(markup).toContain('+100.000 Nakit');
    expect(markup).toContain('+500.000 Nakit');
    expect(markup).toContain('İmparatorluk Kıdemlisi');
  });

  it('correctly marks milestone states: Day 10 player has unlocked 7-day, targets 30-day, and remaining locked', () => {
    const markup = renderToStaticMarkup(
      <MissionsScreen
        resource={{
          status: 'ready',
          data: {
            streak: 10,
            missions: [],
          },
        }}
      />,
    );

    // 7-day milestone should be unlocked
    expect(markup).toContain('✓ AÇILDI');
    expect(markup).toContain('Ödül hakkı tamamlandı');

    // 30-day milestone should be the current target
    expect(markup).toContain('HEDEF');
    expect(markup).toContain('20 gün kaldı');
    expect(markup).toContain('10 / 30 gün');
    expect(markup).toContain('%33');

    // Higher milestones should be locked
    expect(markup).toContain('🔒 KİLİTLİ');
    expect(markup).toContain('80 gün kaldı');
    expect(markup).toContain('170 gün kaldı');
    expect(markup).toContain('355 gün kaldı');
  });

  it('marks all milestones achieved including "İmparatorluk Kıdemlisi" for Day 365 veteran', () => {
    const markup = renderToStaticMarkup(
      <MissionsScreen
        resource={{
          status: 'ready',
          data: {
            streak: 365,
            missions: [],
          },
        }}
      />,
    );

    expect(markup).not.toContain('🔒 KİLİTLİ');
    expect(markup).not.toContain('HEDEF');

    // All 5 should be unlocked
    const matches = markup.match(/✓ AÇILDI/g);
    expect(matches).toHaveLength(5);
    expect(markup).toContain('İmparatorluk Kıdemlisi');
  });
});
