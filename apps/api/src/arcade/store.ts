import { createHash, randomUUID } from 'node:crypto';
import {
  calculateEnergyState,
  calculateTapPower,
  calculateTapClick,
  calculateTapUpgradeCost,
  calculateTapBotEarnings,
  DEFAULT_NOTCOIN_CONFIG,
  calculateBoardPassiveRate,
  executeSingleMerge,
  executeMove,
  executeUnboxParcel,
  solveAutoMergeBoard,
  DEFAULT_CATIZEN_CONFIG,
  generateAdaptiveCrashMultiplier,
  validateCrashStake,
  type PlayerCrashAdaptiveContext,
  settleCrashBet,
  calculateCipherReward,
} from '@empire/game-core';
import type { TapGameStateDto, MergeBoardStateDto } from '@empire/shared';

export interface ArcadeStore {
  getTapState(userId: string): Promise<TapGameStateDto>;
  recordTapClick(
    userId: string,
    tapCount: number,
    requestId: string,
  ): Promise<{
    tapsExecuted: number;
    coinsEarned: number;
    newCash: number;
    remainingEnergy: number;
    criticalHitsCount: number;
    energyRechargeRate: number;
    error?: string | undefined;
  }>;
  upgradeTap(
    userId: string,
    upgradeType: 'multitap' | 'capacity' | 'recharge_speed' | 'unlock_bot',
    currency: 'cash' | 'stars',
    requestId: string,
  ): Promise<{
    upgradeType: string;
    newLevel: number;
    cashCost: number;
    newCash: number;
    error?: string | undefined;
  }>;
  claimTapBot(
    userId: string,
    requestId: string,
  ): Promise<{
    claimedCash: number;
    newCash: number;
    offlineSecondsElapsed: number;
    botTapsCount: number;
    error?: string | undefined;
  }>;
  getMergeState(userId: string): Promise<MergeBoardStateDto>;
  executeMergeAction(
    userId: string,
    sourceIndex: number,
    targetIndex: number,
    actionType: 'move' | 'merge' | 'unbox_parcel',
    requestId: string,
  ): Promise<{
    grid: number[];
    rewardCash: number;
    newCash: number;
    unlockedTier?: number | undefined;
    error?: string | undefined;
  }>;
  executeMergeAuto(
    userId: string,
    autoUnbox: boolean,
    requestId: string,
  ): Promise<{
    grid: number[];
    totalMergesExecuted: number;
    parcelsOpened: number;
    totalRewardCash: number;
    newCash: number;
    newPassiveRatePerSecond: number;
    error?: string | undefined;
  }>;
  claimMergePassive(
    userId: string,
    requestId: string,
  ): Promise<{
    claimedCash: number;
    newCash: number;
    elapsedSeconds: number;
    error?: string | undefined;
  }>;
  startCrashRound(
    userId: string,
    stake: number,
    clientSeed?: string | undefined,
    requestId?: string | undefined,
  ): Promise<{
    roundId: string;
    stake: number;
    serverSeedHash: string;
    startTime: string;
    error?: string | undefined;
  }>;
  cashoutCrashRound(
    userId: string,
    roundId: string,
    claimMultiplier: number,
    requestId: string,
  ): Promise<{
    roundId: string;
    status: 'won' | 'crashed';
    crashMultiplier: number;
    cashoutMultiplier: number;
    payoutCash: number;
    netProfit: number;
    newCash: number;
    serverSeed: string;
    error?: string | undefined;
  }>;
  submitCipher(
    userId: string,
    round: number,
    combo: number,
    completedSuccessfully: boolean,
    requestId: string,
  ): Promise<{
    round: number;
    combo: number;
    rewardCash: number;
    newCash: number;
    error?: string | undefined;
  }>;
}

interface PlayerArcadeMemory {
  cash: number;
  // Notcoin Tap
  energy: number;
  multitapLevel: number;
  energyCapacityLevel: number;
  rechargeSpeedLevel: number;
  tapBotUnlocked: boolean;
  tapBotOfflineCapSeconds: number;
  lastEnergyUpdateMs: number;
  lastTapBotClaimMs: number;
  // Catizen Merge
  mergeGrid: number[];
  lastPassiveClaimMs: number;
  lastParcelDropMs: number;
  // Crypto Crash
  crashRounds: Map<
    string,
    {
      stake: number;
      serverSeed: string;
      serverSeedHash: string;
      clientSeed: string;
      nonce: number;
      startTime: string;
      status: 'active' | 'won' | 'crashed';
      settled?: boolean;
      adaptiveContext?: PlayerCrashAdaptiveContext;
    }
  >;
  crashNonce: number;
  crashAdaptive: {
    recentStakes: number[];
    consecutiveWins: number;
  };
  // Dynasty Cipher
  dailyCipherEarned: number;
  lastCipherClaimMs: number;
  // Idempotency
  requestCache: Map<string, unknown>;
}

export class MemoryArcadeStore implements ArcadeStore {
  private readonly players = new Map<string, PlayerArcadeMemory>();

  private getOrCreate(userId: string): PlayerArcadeMemory {
    let p = this.players.get(userId);
    if (!p) {
      const now = Date.now();
      p = {
        cash: 10_000, // Starter cash for arcade plays
        energy: DEFAULT_NOTCOIN_CONFIG.baseEnergy,
        multitapLevel: 1,
        energyCapacityLevel: 1,
        rechargeSpeedLevel: 1,
        tapBotUnlocked: false,
        tapBotOfflineCapSeconds: DEFAULT_NOTCOIN_CONFIG.baseOfflineCapSeconds,
        lastEnergyUpdateMs: now,
        lastTapBotClaimMs: now,
        mergeGrid: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        lastPassiveClaimMs: now,
        lastParcelDropMs: now,
        crashRounds: new Map(),
        crashNonce: 1,
        crashAdaptive: {
          recentStakes: [],
          consecutiveWins: 0,
        },
        dailyCipherEarned: 0,
        lastCipherClaimMs: now,
        requestCache: new Map(),
      };
      this.players.set(userId, p);
    }
    return p;
  }

  private getCached<T>(
    p: PlayerArcadeMemory,
    requestId: string,
  ): T | undefined {
    return p.requestCache.get(requestId) as T | undefined;
  }

  async getTapState(userId: string): Promise<TapGameStateDto> {
    const p = this.getOrCreate(userId);
    const now = Date.now();

    const energyState = calculateEnergyState({
      currentEnergy: p.energy,
      energyCapacityLevel: p.energyCapacityLevel,
      rechargeSpeedLevel: p.rechargeSpeedLevel,
      lastUpdateTimestampMs: p.lastEnergyUpdateMs,
      currentTimestampMs: now,
    });
    p.energy = energyState.energy;
    p.lastEnergyUpdateMs = now;

    const tapPower = calculateTapPower(p.multitapLevel);

    let unclaimedTapBotCash = 0;
    if (p.tapBotUnlocked) {
      const botEarnings = calculateTapBotEarnings({
        lastClaimTimestampMs: p.lastTapBotClaimMs,
        currentTimestampMs: now,
        currentEnergy: p.energy,
        multitapLevel: p.multitapLevel,
        energyCapacityLevel: p.energyCapacityLevel,
        rechargeSpeedLevel: p.rechargeSpeedLevel,
      });
      unclaimedTapBotCash = botEarnings.coinsEarned;
    }

    return {
      energy: p.energy,
      maxEnergy: energyState.maxEnergy,
      rechargeRate: energyState.rechargeRate,
      multitapLevel: p.multitapLevel,
      energyCapacityLevel: p.energyCapacityLevel,
      rechargeSpeedLevel: p.rechargeSpeedLevel,
      tapPower,
      tapBotUnlocked: p.tapBotUnlocked,
      tapBotOfflineCapSeconds: p.tapBotOfflineCapSeconds,
      lastEnergyUpdateAt: new Date(p.lastEnergyUpdateMs).toISOString(),
      lastTapBotClaimAt: new Date(p.lastTapBotClaimMs).toISOString(),
      unclaimedTapBotCash,
    };
  }

  async recordTapClick(
    userId: string,
    tapCount: number,
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['recordTapClick']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['recordTapClick']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    const now = Date.now();
    const energyState = calculateEnergyState({
      currentEnergy: p.energy,
      energyCapacityLevel: p.energyCapacityLevel,
      rechargeSpeedLevel: p.rechargeSpeedLevel,
      lastUpdateTimestampMs: p.lastEnergyUpdateMs,
      currentTimestampMs: now,
    });
    p.energy = energyState.energy;
    p.lastEnergyUpdateMs = now;

    const tapResult = calculateTapClick({
      requestedTaps: tapCount,
      currentEnergy: p.energy,
      multitapLevel: p.multitapLevel,
    });

    p.energy = tapResult.remainingEnergy;
    p.cash += tapResult.totalCoinsEarned;

    const res = {
      tapsExecuted: tapResult.tapsExecuted,
      coinsEarned: tapResult.totalCoinsEarned,
      newCash: p.cash,
      remainingEnergy: p.energy,
      criticalHitsCount: tapResult.criticalHitsCount,
      energyRechargeRate: energyState.rechargeRate,
    };

    p.requestCache.set(requestId, res);
    return res;
  }

  async upgradeTap(
    userId: string,
    upgradeType: 'multitap' | 'capacity' | 'recharge_speed' | 'unlock_bot',
    currency: 'cash' | 'stars',
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['upgradeTap']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['upgradeTap']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    if (currency === 'stars') {
      if (upgradeType === 'unlock_bot') {
        p.tapBotUnlocked = true;
        const res = {
          upgradeType,
          newLevel: 1,
          cashCost: 0,
          newCash: p.cash,
        };
        p.requestCache.set(requestId, res);
        return res;
      }
      return {
        upgradeType,
        newLevel: 1,
        cashCost: 0,
        newCash: p.cash,
      };
    }

    // Cash currency upgrade
    let currentLevel = 1;
    if (upgradeType === 'multitap') currentLevel = p.multitapLevel;
    else if (upgradeType === 'capacity') currentLevel = p.energyCapacityLevel;
    else if (upgradeType === 'recharge_speed')
      currentLevel = p.rechargeSpeedLevel;
    else if (upgradeType === 'unlock_bot')
      currentLevel = p.tapBotUnlocked ? 1 : 0;

    const cost = calculateTapUpgradeCost(
      upgradeType === 'unlock_bot' ? 'bot_unlock' : upgradeType,
      currentLevel + (upgradeType === 'unlock_bot' ? 1 : 0),
    );

    if (p.cash < cost) {
      return {
        upgradeType,
        newLevel: currentLevel,
        cashCost: cost,
        newCash: p.cash,
        error: 'INSUFFICIENT_CASH',
      };
    }

    p.cash -= cost;
    let newLevel = currentLevel + 1;

    if (upgradeType === 'multitap') p.multitapLevel = newLevel;
    else if (upgradeType === 'capacity') p.energyCapacityLevel = newLevel;
    else if (upgradeType === 'recharge_speed') p.rechargeSpeedLevel = newLevel;
    else if (upgradeType === 'unlock_bot') {
      p.tapBotUnlocked = true;
      newLevel = 1;
    }

    const res = {
      upgradeType,
      newLevel,
      cashCost: cost,
      newCash: p.cash,
    };
    p.requestCache.set(requestId, res);
    return res;
  }

  async claimTapBot(
    userId: string,
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['claimTapBot']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['claimTapBot']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    if (!p.tapBotUnlocked) {
      return {
        claimedCash: 0,
        newCash: p.cash,
        offlineSecondsElapsed: 0,
        botTapsCount: 0,
        error: 'BOT_NOT_UNLOCKED',
      };
    }

    const now = Date.now();
    const earnings = calculateTapBotEarnings({
      lastClaimTimestampMs: p.lastTapBotClaimMs,
      currentTimestampMs: now,
      currentEnergy: p.energy,
      multitapLevel: p.multitapLevel,
      energyCapacityLevel: p.energyCapacityLevel,
      rechargeSpeedLevel: p.rechargeSpeedLevel,
    });

    p.cash += earnings.coinsEarned;
    p.energy = earnings.remainingEnergy;
    p.lastTapBotClaimMs = now;
    p.lastEnergyUpdateMs = now;

    const res = {
      claimedCash: earnings.coinsEarned,
      newCash: p.cash,
      offlineSecondsElapsed: earnings.offlineSecondsElapsed,
      botTapsCount: earnings.actualTaps,
    };
    p.requestCache.set(requestId, res);
    return res;
  }

  async getMergeState(userId: string): Promise<MergeBoardStateDto> {
    const p = this.getOrCreate(userId);
    const now = Date.now();
    const passiveRate = calculateBoardPassiveRate(p.mergeGrid);

    const elapsedSeconds = Math.max(
      0,
      Math.floor((now - p.lastPassiveClaimMs) / 1000),
    );
    const unclaimedPassiveCash = elapsedSeconds * passiveRate;

    const elapsedSinceParcel = Math.max(
      0,
      Math.floor((now - p.lastParcelDropMs) / 1000),
    );
    const nextParcelDropSeconds = Math.max(
      0,
      DEFAULT_CATIZEN_CONFIG.parcelDropIntervalSeconds -
        (elapsedSinceParcel % DEFAULT_CATIZEN_CONFIG.parcelDropIntervalSeconds),
    );

    return {
      grid: [...p.mergeGrid],
      passiveRatePerSecond: passiveRate,
      unclaimedPassiveCash,
      lastPassiveClaimAt: new Date(p.lastPassiveClaimMs).toISOString(),
      nextParcelDropSeconds,
    };
  }

  async executeMergeAction(
    userId: string,
    sourceIndex: number,
    targetIndex: number,
    actionType: 'move' | 'merge' | 'unbox_parcel',
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['executeMergeAction']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['executeMergeAction']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    if (actionType === 'merge') {
      const result = executeSingleMerge(p.mergeGrid, sourceIndex, targetIndex);
      if (!result.success) {
        return {
          grid: [...p.mergeGrid],
          rewardCash: 0,
          newCash: p.cash,
          error: result.error,
        };
      }
      p.mergeGrid = result.newGrid;
      p.cash += result.rewardCash;
      const res = {
        grid: [...p.mergeGrid],
        rewardCash: result.rewardCash,
        newCash: p.cash,
        unlockedTier: result.mergedTier,
      };
      p.requestCache.set(requestId, res);
      return res;
    } else if (actionType === 'move') {
      const result = executeMove(p.mergeGrid, sourceIndex, targetIndex);
      if (!result.success) {
        return {
          grid: [...p.mergeGrid],
          rewardCash: 0,
          newCash: p.cash,
          error: result.error,
        };
      }
      p.mergeGrid = result.newGrid;
      const res = {
        grid: [...p.mergeGrid],
        rewardCash: 0,
        newCash: p.cash,
      };
      p.requestCache.set(requestId, res);
      return res;
    } else {
      // unbox_parcel
      const result = executeUnboxParcel(p.mergeGrid, sourceIndex);
      if (!result.success) {
        return {
          grid: [...p.mergeGrid],
          rewardCash: 0,
          newCash: p.cash,
          error: result.error,
        };
      }
      p.mergeGrid = result.newGrid;
      const res = {
        grid: [...p.mergeGrid],
        rewardCash: 0,
        newCash: p.cash,
        unlockedTier: result.unboxedTier,
      };
      p.requestCache.set(requestId, res);
      return res;
    }
  }

  async executeMergeAuto(
    userId: string,
    autoUnbox: boolean,
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['executeMergeAuto']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['executeMergeAuto']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    const result = solveAutoMergeBoard(p.mergeGrid, { autoUnbox });
    p.mergeGrid = result.newGrid;
    p.cash += result.totalRewardCash;

    const res = {
      grid: [...p.mergeGrid],
      totalMergesExecuted: result.totalMergesExecuted,
      parcelsOpened: result.parcelsOpened,
      totalRewardCash: result.totalRewardCash,
      newCash: p.cash,
      newPassiveRatePerSecond: result.newPassiveRatePerSecond,
    };
    p.requestCache.set(requestId, res);
    return res;
  }

  async claimMergePassive(
    userId: string,
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['claimMergePassive']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['claimMergePassive']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    const now = Date.now();
    const rate = calculateBoardPassiveRate(p.mergeGrid);
    const elapsedSeconds = Math.max(
      0,
      Math.floor((now - p.lastPassiveClaimMs) / 1000),
    );
    const claimedCash = elapsedSeconds * rate;

    p.cash += claimedCash;
    p.lastPassiveClaimMs = now;

    const res = {
      claimedCash,
      newCash: p.cash,
      elapsedSeconds,
    };
    p.requestCache.set(requestId, res);
    return res;
  }

  async startCrashRound(
    userId: string,
    stake: number,
    clientSeed: string = 'client_default',
    requestId: string = randomUUID(),
  ): Promise<Awaited<ReturnType<ArcadeStore['startCrashRound']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['startCrashRound']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    const validation = validateCrashStake(stake, p.cash);
    if (!validation.valid) {
      return {
        roundId: '',
        stake,
        serverSeedHash: '',
        startTime: '',
        error: validation.error,
      };
    }

    const sanitizedStake = validation.sanitizedStake!;
    p.cash -= sanitizedStake;

    const avgStake =
      p.crashAdaptive.recentStakes.length > 0
        ? p.crashAdaptive.recentStakes.reduce((a, b) => a + b, 0) /
          p.crashAdaptive.recentStakes.length
        : sanitizedStake;

    const adaptiveContext: PlayerCrashAdaptiveContext = {
      recentStakes: [...p.crashAdaptive.recentStakes],
      averageStake: avgStake,
      consecutiveWins: p.crashAdaptive.consecutiveWins,
      currentStake: sanitizedStake,
    };

    const roundId = randomUUID();
    const serverSeed =
      randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '');
    const serverSeedHash = createHash('sha256')
      .update(serverSeed)
      .digest('hex');
    const startTime = new Date().toISOString();

    p.crashRounds.set(roundId, {
      stake: sanitizedStake,
      serverSeed,
      serverSeedHash,
      clientSeed,
      nonce: p.crashNonce++,
      startTime,
      status: 'active',
      adaptiveContext,
    });

    const res = {
      roundId,
      stake: sanitizedStake,
      serverSeedHash,
      startTime,
    };
    p.requestCache.set(requestId, res);
    return res;
  }

  async cashoutCrashRound(
    userId: string,
    roundId: string,
    claimMultiplier: number,
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['cashoutCrashRound']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['cashoutCrashRound']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    const round = p.crashRounds.get(roundId);
    if (!round || round.settled) {
      return {
        roundId,
        status: 'crashed' as const,
        crashMultiplier: 1.0,
        cashoutMultiplier: claimMultiplier,
        payoutCash: 0,
        netProfit: 0,
        newCash: p.cash,
        serverSeed: '',
        error: 'ROUND_NOT_FOUND_OR_SETTLED',
      };
    }

    const crashResult = generateAdaptiveCrashMultiplier(
      round.serverSeed,
      round.clientSeed,
      round.nonce,
      round.adaptiveContext,
    );

    const settlement = settleCrashBet({
      stake: round.stake,
      crashMultiplier: crashResult.crashMultiplier,
      cashoutMultiplier: claimMultiplier,
    });

    round.settled = true;
    round.status = settlement.status;

    if (settlement.status === 'won') {
      p.cash += settlement.payoutCash;
      p.crashAdaptive.consecutiveWins += 1;
    } else {
      p.crashAdaptive.consecutiveWins = 0;
    }

    p.crashAdaptive.recentStakes.push(round.stake);
    if (p.crashAdaptive.recentStakes.length > 10) {
      p.crashAdaptive.recentStakes.shift();
    }

    const res = {
      roundId,
      status: settlement.status,
      crashMultiplier: crashResult.crashMultiplier,
      cashoutMultiplier: settlement.finalMultiplier,
      payoutCash: settlement.payoutCash,
      netProfit: settlement.netProfit,
      newCash: p.cash,
      serverSeed: round.serverSeed,
    };

    p.requestCache.set(requestId, res);
    return res;
  }

  async submitCipher(
    userId: string,
    round: number,
    combo: number,
    completedSuccessfully: boolean,
    requestId: string,
  ): Promise<Awaited<ReturnType<ArcadeStore['submitCipher']>>> {
    const p = this.getOrCreate(userId);
    const cached = this.getCached<
      Awaited<ReturnType<ArcadeStore['submitCipher']>>
    >(p, requestId);
    if (cached) {
      return cached;
    }

    if (!completedSuccessfully) {
      const res = {
        round,
        combo,
        rewardCash: 0,
        newCash: p.cash,
      };
      p.requestCache.set(requestId, res);
      return res;
    }

    const rewardResult = calculateCipherReward(
      round,
      combo,
      p.dailyCipherEarned,
    );
    p.cash += rewardResult.rewardCash;
    p.dailyCipherEarned += rewardResult.rewardCash;

    const res = {
      round,
      combo,
      rewardCash: rewardResult.rewardCash,
      newCash: p.cash,
    };
    p.requestCache.set(requestId, res);
    return res;
  }
}

export class SupabaseArcadeStore extends MemoryArcadeStore {
  constructor(
    private readonly url?: string,
    private readonly serviceKey?: string,
  ) {
    super();
  }
}
