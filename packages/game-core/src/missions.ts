/**
 * Pure deterministic missions, streak, and season progression logic for Project Empire.
 * Side-effect free, independent of network, database, or UI.
 */

export type MissionDifficulty = 'easy' | 'normal' | 'hard' | 'weekly';

export interface MissionDefinition {
  readonly key: string;
  readonly difficulty: MissionDifficulty;
  readonly title: string;
  readonly description: string;
  readonly target: number;
  readonly sruMultiplier: number;
}

export const MISSION_SRU_MULTIPLIERS: Record<MissionDifficulty, number> = {
  easy: 0.75,
  normal: 1.0,
  hard: 1.25,
  weekly: 5.0,
};

export const STREAK_SRU_MULTIPLIER = 0.25;

export const DEFAULT_MISSIONS: readonly MissionDefinition[] = [
  // Easy Pool (0.75x SRU)
  {
    key: 'upgrade_any_3',
    difficulty: 'easy',
    title: 'Hızlı Yatırım',
    description: 'Herhangi bir işletmeyi 3 kez yükselt',
    target: 3,
    sruMultiplier: 0.75,
  },
  {
    key: 'claim_cash_2',
    difficulty: 'easy',
    title: 'Tahsilat Zamanı',
    description: 'İşletmelerden 2 kez gelir topla',
    target: 2,
    sruMultiplier: 0.75,
  },
  {
    key: 'view_friends',
    difficulty: 'easy',
    title: 'Ağını Genişlet',
    description: 'Arkadaşlar sekmesini ziyaret et',
    target: 1,
    sruMultiplier: 0.75,
  },

  // Normal Pool (1.00x SRU)
  {
    key: 'upgrade_any_10',
    difficulty: 'normal',
    title: 'Büyüme Dalgası',
    description: 'Toplam 10 kez işletme yükseltmesi yap',
    target: 10,
    sruMultiplier: 1.0,
  },
  {
    key: 'reach_milestone',
    difficulty: 'normal',
    title: 'Dönüm Noktası',
    description:
      'Bir işletmeyi seviye dönüm noktasına (10, 25, 50 vb.) ulaştır',
    target: 1,
    sruMultiplier: 1.0,
  },
  {
    key: 'claim_cash_5',
    difficulty: 'normal',
    title: 'Düzenli Gelir',
    description: '5 kez gelir topla',
    target: 5,
    sruMultiplier: 1.0,
  },

  // Hard Pool (1.25x SRU)
  {
    key: 'claim_offline_4h',
    difficulty: 'hard',
    title: 'Büyük Hasat',
    description:
      'En az 4 saatlik çevrimdışı birikmiş kazancı tek seferde topla',
    target: 1,
    sruMultiplier: 1.25,
  },
  {
    key: 'upgrade_factory_tier',
    difficulty: 'hard',
    title: 'Sanayi Devrimi',
    description: 'Fabrika veya üst düzey bir işletmeyi en az 1 kez yükselt',
    target: 1,
    sruMultiplier: 1.25,
  },

  // Weekly Pool (5.00x SRU)
  {
    key: 'weekly_complete_15_dailies',
    difficulty: 'weekly',
    title: 'Haftalık Azim',
    description: 'Hafta boyunca toplam 15 günlük görevi başarıyla tamamla',
    target: 15,
    sruMultiplier: 5.0,
  },
] as const;

/**
 * Calculates the exact Season Points reward for a mission given current SRU.
 * Formula: round(multiplier * currentSRU)
 */
export function calculateMissionReward(
  difficulty: MissionDifficulty,
  currentSRU: number,
): number {
  const multiplier = MISSION_SRU_MULTIPLIERS[difficulty];
  return Math.round(multiplier * currentSRU);
}

/**
 * Calculates the Season Points reward for daily login streak.
 * Daily: 0.25 * SRU.
 * Day 7 (Cycle completion): 1.00 * SRU bonus.
 */
export function calculateStreakReward(
  streakDays: number,
  currentSRU: number,
): {
  readonly points: number;
  readonly isCycleBonus: boolean;
} {
  const isCycleBonus = streakDays > 0 && streakDays % 7 === 0;
  const multiplier = isCycleBonus ? 1.0 : STREAK_SRU_MULTIPLIER;
  const points = Math.round(multiplier * currentSRU);

  return {
    points,
    isCycleBonus,
  };
}

/**
 * Evaluates consecutive daily login streak.
 * Dates are ISO YYYY-MM-DD strings in UTC.
 */
export function evaluateStreak(
  lastClaimDate: string | null,
  currentDate: string,
  currentStreak: number,
): {
  readonly canClaim: boolean;
  readonly nextStreak: number;
  readonly wasReset: boolean;
} {
  if (!lastClaimDate) {
    return {
      canClaim: true,
      nextStreak: 1,
      wasReset: false,
    };
  }

  if (lastClaimDate === currentDate) {
    return {
      canClaim: false,
      nextStreak: currentStreak,
      wasReset: false,
    };
  }

  const lastDate = new Date(lastClaimDate);
  const curDate = new Date(currentDate);
  const diffDays = Math.round(
    (curDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 1) {
    // Exactly consecutive day
    const nextStreak = currentStreak >= 7 ? 1 : currentStreak + 1;
    return {
      canClaim: true,
      nextStreak,
      wasReset: false,
    };
  }

  if (diffDays > 1) {
    // Missed a day: resets to day 1
    return {
      canClaim: true,
      nextStreak: 1,
      wasReset: true,
    };
  }

  // Current date is in the past compared to lastClaimDate (clock anomaly)
  return {
    canClaim: false,
    nextStreak: currentStreak,
    wasReset: false,
  };
}

/**
 * Checks if a mission instance has reached its completion target.
 */
export function isMissionCompleted(progress: number, target: number): boolean {
  return progress >= target;
}
