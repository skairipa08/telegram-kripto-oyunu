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

export interface StreakMilestone {
  readonly day: number;
  readonly sruMultiplier: number;
  readonly cashReward: number;
  readonly badge?: string;
  readonly titleTr: string;
  readonly descriptionTr: string;
}

export const STREAK_MILESTONES: readonly StreakMilestone[] = [
  {
    day: 7,
    sruMultiplier: 1.0,
    cashReward: 500,
    titleTr: '7 Günlük Seri',
    descriptionTr: 'Bir haftalık kesintisiz imparatorluk disiplini.',
  },
  {
    day: 30,
    sruMultiplier: 2.5,
    cashReward: 5_000,
    titleTr: '1 Aylık Sadakat',
    descriptionTr: '30 günlük kararlı büyüme ve azim.',
  },
  {
    day: 90,
    sruMultiplier: 5.0,
    cashReward: 25_000,
    titleTr: '3 Aylık Çeyrek Ustalığı',
    descriptionTr: 'Üç aylık kesintisiz pazar hakimiyeti.',
  },
  {
    day: 180,
    sruMultiplier: 10.0,
    cashReward: 100_000,
    titleTr: '6 Aylık Yarım Yıl Hanedanı',
    descriptionTr: 'Altı aylık stratejik imparatorluk yükselişi.',
  },
  {
    day: 365,
    sruMultiplier: 25.0,
    cashReward: 500_000,
    badge: 'imperial_veteran',
    titleTr: '1 Yıllık İmparatorluk Kıdemlisi',
    descriptionTr: 'Tam 365 günlük efsanevi sadakat ve liderlik.',
  },
] as const;

export interface ExtendedStreakReward {
  readonly points: number;
  readonly cash: number;
  readonly sruMultiplier: number;
  readonly isCycleBonus: boolean;
  readonly isMilestone: boolean;
  readonly milestoneDay?: number | undefined;
  readonly badge?: string | undefined;
  readonly title?: string | undefined;
}

/**
 * Calculates compounding extended streak milestone rewards.
 * Day 7: 1.0x SRU + 500 Cash
 * Day 30: 2.5x SRU + 5,000 Cash
 * Day 90: 5.0x SRU + 25,000 Cash
 * Day 180: 10.0x SRU + 100,000 Cash
 * Day 365: 25.0x SRU + 500,000 Cash + "imperial_veteran" Badge
 */
export function calculateExtendedStreakReward(
  streakDays: number,
  currentSRU: number,
): ExtendedStreakReward {
  const milestone = STREAK_MILESTONES.find((m) => m.day === streakDays);

  if (milestone) {
    const points = Math.round(milestone.sruMultiplier * currentSRU);
    return {
      points,
      cash: milestone.cashReward,
      sruMultiplier: milestone.sruMultiplier,
      isCycleBonus: true,
      isMilestone: true,
      milestoneDay: milestone.day,
      badge: milestone.badge,
      title: milestone.titleTr,
    };
  }

  // 7-day cyclical bonus check (e.g. Day 14, 21, 28)
  const isCycleBonus = streakDays > 0 && streakDays % 7 === 0;
  const sruMultiplier = isCycleBonus ? 1.0 : STREAK_SRU_MULTIPLIER;
  const points = Math.round(sruMultiplier * currentSRU);

  return {
    points,
    cash: 0,
    sruMultiplier,
    isCycleBonus,
    isMilestone: false,
  };
}

/**
 * Calculates the Season Points reward for daily login streak.
 * Daily: 0.25 * SRU.
 * Day 7 (Cycle completion): 1.00 * SRU bonus.
 * Harmonized with calculateExtendedStreakReward.
 */
export function calculateStreakReward(
  streakDays: number,
  currentSRU: number,
): {
  readonly points: number;
  readonly isCycleBonus: boolean;
} {
  const extended = calculateExtendedStreakReward(streakDays, currentSRU);
  return {
    points: extended.points,
    isCycleBonus: extended.isCycleBonus,
  };
}

/**
 * Evaluates consecutive daily login streak.
 * Dates are ISO YYYY-MM-DD strings in UTC.
 * Continuous increment: advances currentStreak + 1 past Day 7 up to Day 365+.
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
    // Exactly consecutive day: continuous progression without 7-day modulo reset
    const nextStreak = currentStreak + 1;
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

/**
 * Deterministic string hashing function (FNV-1a 32-bit).
 */
export function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Returns the Monday date string (YYYY-MM-DD) for the given date in UTC.
 */
export function getIsoWeekDateString(dateInput: string | Date): string {
  const d =
    typeof dateInput === 'string'
      ? new Date(dateInput)
      : new Date(dateInput.getTime());
  const day = d.getUTCDay();
  // Monday is 1, Sunday is 0 -> diff to Monday:
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export interface SelectedMissionPool {
  readonly daily: MissionDefinition[];
  readonly weekly: MissionDefinition[];
  readonly all: MissionDefinition[];
}

/**
 * Deterministically selects 3 daily missions (1 easy, 1 normal, 1 hard)
 * and 1 weekly mission for a given user and calendar date.
 */
export function selectMissionPool(
  userId: string,
  dateStr: string,
  pool: readonly MissionDefinition[] = DEFAULT_MISSIONS,
): SelectedMissionPool {
  const normalizedDate = dateStr.slice(0, 10);
  const weekMonday = getIsoWeekDateString(normalizedDate);

  const easyMissions = pool.filter((m) => m.difficulty === 'easy');
  const normalMissions = pool.filter((m) => m.difficulty === 'normal');
  const hardMissions = pool.filter((m) => m.difficulty === 'hard');
  const weeklyMissions = pool.filter((m) => m.difficulty === 'weekly');

  const selectedDaily: MissionDefinition[] = [];

  if (easyMissions.length > 0) {
    const idx =
      hashString(`${userId}:${normalizedDate}:easy`) % easyMissions.length;
    selectedDaily.push(easyMissions[idx]!);
  }

  if (normalMissions.length > 0) {
    const idx =
      hashString(`${userId}:${normalizedDate}:normal`) % normalMissions.length;
    selectedDaily.push(normalMissions[idx]!);
  }

  if (hardMissions.length > 0) {
    const idx =
      hashString(`${userId}:${normalizedDate}:hard`) % hardMissions.length;
    selectedDaily.push(hardMissions[idx]!);
  }

  const selectedWeekly: MissionDefinition[] = [];
  if (weeklyMissions.length > 0) {
    const idx =
      hashString(`${userId}:${weekMonday}:weekly`) % weeklyMissions.length;
    selectedWeekly.push(weeklyMissions[idx]!);
  }

  return {
    daily: selectedDaily,
    weekly: selectedWeekly,
    all: [...selectedDaily, ...selectedWeekly],
  };
}
