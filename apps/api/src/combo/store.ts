import {
  verifyDailyComboSelection,
  verifyDailyCipherSubmission,
  DAILY_COMBO_REWARD,
  DAILY_CIPHER_REWARD,
} from '@empire/game-core';

export interface ComboStore {
  getComboStatus(
    userId: string,
    date: string,
  ): Promise<{ isCompleted: boolean; claimedAt: string | null }>;
  claimDailyCombo(
    userId: string,
    date: string,
    selectedSlugs: string[],
  ): Promise<{
    success: boolean;
    rewardCash: number;
    rewardSeasonPoints: number;
    newCash: number;
    error?: string;
  }>;
  claimDailyCipher(
    userId: string,
    date: string,
    solvedWord: string,
  ): Promise<{
    success: boolean;
    rewardCash: number;
    rewardSeasonPoints: number;
    newCash: number;
    error?: string;
  }>;
}

export class MemoryComboStore implements ComboStore {
  private comboClaims = new Map<string, string>(); // `${userId}_${date}` -> claimedAt
  private cipherClaims = new Map<string, string>(); // `${userId}_${date}` -> claimedAt
  private userCash = new Map<string, number>();

  setPlayerCash(userId: string, cash: number) {
    this.userCash.set(userId, cash);
  }

  getPlayerCash(userId: string): number {
    return this.userCash.get(userId) ?? 50000;
  }

  async getComboStatus(
    userId: string,
    date: string,
  ): Promise<{ isCompleted: boolean; claimedAt: string | null }> {
    const key = `${userId}_${date}`;
    const claimedAt = this.comboClaims.get(key) ?? null;
    return { isCompleted: claimedAt !== null, claimedAt };
  }

  async claimDailyCombo(
    userId: string,
    date: string,
    selectedSlugs: string[],
  ): Promise<{
    success: boolean;
    rewardCash: number;
    rewardSeasonPoints: number;
    newCash: number;
    error?: string;
  }> {
    const key = `${userId}_${date}`;
    if (this.comboClaims.has(key)) {
      return {
        success: false,
        rewardCash: 0,
        rewardSeasonPoints: 0,
        newCash: this.getPlayerCash(userId),
        error: 'ALREADY_CLAIMED',
      };
    }

    const isValid = verifyDailyComboSelection(selectedSlugs, date);
    if (!isValid) {
      return {
        success: false,
        rewardCash: 0,
        rewardSeasonPoints: 0,
        newCash: this.getPlayerCash(userId),
        error: 'INCORRECT_COMBO',
      };
    }

    const currentCash = this.getPlayerCash(userId);
    const newCash = currentCash + DAILY_COMBO_REWARD.cash;
    this.setPlayerCash(userId, newCash);
    this.comboClaims.set(key, new Date().toISOString());

    return {
      success: true,
      rewardCash: DAILY_COMBO_REWARD.cash,
      rewardSeasonPoints: DAILY_COMBO_REWARD.seasonPoints,
      newCash,
    };
  }

  async claimDailyCipher(
    userId: string,
    date: string,
    solvedWord: string,
  ): Promise<{
    success: boolean;
    rewardCash: number;
    rewardSeasonPoints: number;
    newCash: number;
    error?: string;
  }> {
    const key = `${userId}_${date}`;
    if (this.cipherClaims.has(key)) {
      return {
        success: false,
        rewardCash: 0,
        rewardSeasonPoints: 0,
        newCash: this.getPlayerCash(userId),
        error: 'ALREADY_CLAIMED',
      };
    }

    const isValid = verifyDailyCipherSubmission(solvedWord, date);
    if (!isValid) {
      return {
        success: false,
        rewardCash: 0,
        rewardSeasonPoints: 0,
        newCash: this.getPlayerCash(userId),
        error: 'INCORRECT_CIPHER',
      };
    }

    const currentCash = this.getPlayerCash(userId);
    const newCash = currentCash + DAILY_CIPHER_REWARD.cash;
    this.setPlayerCash(userId, newCash);
    this.cipherClaims.set(key, new Date().toISOString());

    return {
      success: true,
      rewardCash: DAILY_CIPHER_REWARD.cash,
      rewardSeasonPoints: DAILY_CIPHER_REWARD.seasonPoints,
      newCash,
    };
  }
}

export class SupabaseComboStore implements ComboStore {
  constructor(
    private supabaseUrl?: string,
    private serviceKey?: string,
    private fallbackMemory = new MemoryComboStore(),
  ) {}

  async getComboStatus(
    userId: string,
    date: string,
  ): Promise<{ isCompleted: boolean; claimedAt: string | null }> {
    return this.fallbackMemory.getComboStatus(userId, date);
  }

  async claimDailyCombo(
    userId: string,
    date: string,
    selectedSlugs: string[],
  ): Promise<{
    success: boolean;
    rewardCash: number;
    rewardSeasonPoints: number;
    newCash: number;
    error?: string;
  }> {
    return this.fallbackMemory.claimDailyCombo(userId, date, selectedSlugs);
  }

  async claimDailyCipher(
    userId: string,
    date: string,
    solvedWord: string,
  ): Promise<{
    success: boolean;
    rewardCash: number;
    rewardSeasonPoints: number;
    newCash: number;
    error?: string;
  }> {
    return this.fallbackMemory.claimDailyCipher(userId, date, solvedWord);
  }
}
