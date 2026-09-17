import { describe, expect, it } from 'vitest';
import {
  calculateClanLevel,
  calculateClanProductionBonus,
  calculateClanLeaderDividend,
  calculateClanCapacity,
  generateClanRefLink,
  parseClanRefParam,
  CLAN_CREATION_CASH_COST,
  CLAN_CREATION_MIN_EMPIRE_LEVEL,
} from './clans';

describe('Clans & Cartels Core Domain Logic', () => {
  it('calculates clan level monotonically based on member empire levels', () => {
    expect(calculateClanLevel(0)).toBe(1);
    expect(calculateClanLevel(10)).toBe(1);
    expect(calculateClanLevel(25)).toBe(2);
    expect(calculateClanLevel(100)).toBe(5);
    expect(calculateClanLevel(500)).toBe(21);
    expect(calculateClanLevel(2000)).toBe(50); // Capped at 50
  });

  it('calculates production bonus multiplier scaled from +2% to +10%', () => {
    expect(calculateClanProductionBonus(1)).toBeCloseTo(0.02, 3);
    expect(calculateClanProductionBonus(50)).toBeCloseTo(0.1, 3);
    const midBonus = calculateClanProductionBonus(25);
    expect(midBonus).toBeGreaterThan(0.02);
    expect(midBonus).toBeLessThan(0.1);
  });

  it('calculates clan leader 1% dividend accurately', () => {
    expect(calculateClanLeaderDividend(0)).toBe(0);
    expect(calculateClanLeaderDividend(100)).toBe(1);
    expect(calculateClanLeaderDividend(10000)).toBe(100);
    expect(calculateClanLeaderDividend(1234567)).toBe(12345);
  });

  it('calculates clan member capacity scaling from 50 to 250', () => {
    expect(calculateClanCapacity(1)).toBe(50);
    expect(calculateClanCapacity(50)).toBe(250);
    expect(calculateClanCapacity(100)).toBe(250); // Capped at 250
  });

  it('generates compliant Telegram dual startapp referral links', () => {
    const link = generateClanRefLink('EmpireBot', 'user_777', 'clan_alpha');
    expect(link).toBe(
      'https://t.me/EmpireBot?startapp=ref_user_777_clan_clan_alpha',
    );
  });

  it('correctly parses dual ref + clan startapp parameters and fallback standard refs', () => {
    const parsedDual = parseClanRefParam('ref_user_123_clan_syndicate_99');
    expect(parsedDual).toEqual({
      inviterId: 'user_123',
      clanId: 'syndicate_99',
    });

    const parsedStandard = parseClanRefParam('ref_user_888');
    expect(parsedStandard).toEqual({
      inviterId: 'user_888',
      clanId: null,
    });

    expect(parseClanRefParam('')).toBeNull();
    expect(parseClanRefParam('invalid_code')).toBeNull();
  });

  it('enforces creation prerequisites', () => {
    expect(CLAN_CREATION_CASH_COST).toBe(50000);
    expect(CLAN_CREATION_MIN_EMPIRE_LEVEL).toBe(10);
  });
});
