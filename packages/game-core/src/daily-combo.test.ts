import { describe, expect, it } from 'vitest';
import {
  getDailyCombo,
  getDailyCipher,
  textToMorse,
  verifyDailyComboSelection,
  verifyDailyCipherSubmission,
  getUtcDateString,
  DAILY_COMBO_REWARD,
  DAILY_CIPHER_REWARD,
} from './daily-combo';

describe('Daily Mystery Combo & Daily Cipher Logic', () => {
  it('generates exactly 3 distinct businesses for any given date', () => {
    const combo = getDailyCombo('2026-09-16');
    expect(combo.comboSlugs).toHaveLength(3);
    expect(combo.comboNames).toHaveLength(3);

    // Verify all 3 slugs are unique
    const uniqueSlugs = new Set(combo.comboSlugs);
    expect(uniqueSlugs.size).toBe(3);
    expect(combo.rewardCash).toBe(DAILY_COMBO_REWARD.cash);
    expect(combo.rewardSeasonPoints).toBe(DAILY_COMBO_REWARD.seasonPoints);
  });

  it('is completely deterministic: same date produces exact same combo', () => {
    const combo1 = getDailyCombo('2026-10-01');
    const combo2 = getDailyCombo('2026-10-01');
    expect(combo1).toEqual(combo2);
  });

  it('rotates across different dates over 30 days without crash', () => {
    const combos = new Set<string>();
    for (let day = 1; day <= 28; day++) {
      const dStr = `2026-02-${String(day).padStart(2, '0')}`;
      const c = getDailyCombo(dStr);
      combos.add(c.comboSlugs.join(','));
    }
    // High entropy: at least 15 different combinations across 28 days
    expect(combos.size).toBeGreaterThan(15);
  });

  it('verifies correct daily combo selection order-independently', () => {
    const date = '2026-09-16';
    const combo = getDailyCombo(date);
    const [s1, s2, s3] = combo.comboSlugs;

    // Correct permutations
    expect(verifyDailyComboSelection([s1!, s2!, s3!], date)).toBe(true);
    expect(verifyDailyComboSelection([s3!, s1!, s2!], date)).toBe(true);
    expect(verifyDailyComboSelection([s2!, s3!, s1!], date)).toBe(true);

    // Wrong slugs or invalid counts
    expect(verifyDailyComboSelection([s1!, s2!, 'fake_business'], date)).toBe(
      false,
    );
    expect(verifyDailyComboSelection([s1!, s2!], date)).toBe(false);
    expect(verifyDailyComboSelection([s1!, s1!, s2!], date)).toBe(false); // Duplicates
  });

  it('translates words to Morse code correctly', () => {
    expect(textToMorse('TON')).toBe('- --- -.');
    expect(textToMorse('EMPIRE')).toBe('. -- .--. .. .-. .');
  });

  it('generates deterministic daily cipher word and verifies submissions', () => {
    const date = '2026-09-16';
    const cipher = getDailyCipher(date);

    expect(cipher.word.length).toBeGreaterThanOrEqual(4);
    expect(cipher.morseCode.length).toBeGreaterThan(0);
    expect(cipher.rewardCash).toBe(DAILY_CIPHER_REWARD.cash);
    expect(cipher.rewardSeasonPoints).toBe(DAILY_CIPHER_REWARD.seasonPoints);

    // Case-insensitive verification
    expect(verifyDailyCipherSubmission(cipher.word, date)).toBe(true);
    expect(verifyDailyCipherSubmission(cipher.word.toLowerCase(), date)).toBe(
      true,
    );
    expect(verifyDailyCipherSubmission(` ${cipher.word}  `, date)).toBe(true);

    // Wrong submission
    expect(verifyDailyCipherSubmission('INCORRECT_CODE', date)).toBe(false);
    expect(verifyDailyCipherSubmission('', date)).toBe(false);
  });

  it('produces valid UTC date string format YYYY-MM-DD', () => {
    const str = getUtcDateString();
    expect(str).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
