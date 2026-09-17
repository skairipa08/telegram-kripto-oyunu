import { randomUUID } from 'node:crypto';
import {
  calculateClanLevel,
  calculateClanCapacity,
  CLAN_CREATION_CASH_COST,
} from '@empire/game-core';
import type { ClanDto } from '@empire/shared';

export interface ClanStore {
  getClan(clanId: string): Promise<ClanDto | null>;
  getUserClan(userId: string): Promise<ClanDto | null>;
  createClan(
    leaderId: string,
    leaderUsername: string,
    name: string,
    tag: string,
    emblem: string,
    telegramChannelUrl?: string,
  ): Promise<{ clan: ClanDto; newCash: number; error?: string }>;
  joinClan(
    userId: string,
    username: string,
    clanId: string,
  ): Promise<{ clanId: string; newMemberCount: number; error?: string }>;
  getClanLeaderboard(limit?: number): Promise<ClanDto[]>;
}

export class MemoryClanStore implements ClanStore {
  private clans = new Map<string, ClanDto>();
  private userClans = new Map<string, string>(); // userId -> clanId
  private userCash = new Map<string, number>();
  private defaultCash: number;

  constructor(initialCash = 100000) {
    this.defaultCash = initialCash;
    // Seed default starter clans for instant testing
    const clan1: ClanDto = {
      id: 'clan-alpha-holding',
      name: 'Alpha Karteli',
      tag: 'ALPHA',
      emblem: '🦁',
      leaderId: 'leader-1',
      leaderUsername: 'Barandnz',
      memberCount: 14,
      totalEmpireLevels: 120,
      totalProductionPerSecond: 55000,
      clanLevel: calculateClanLevel(120),
      telegramChannelUrl: 'https://t.me/AlphaCartel',
      createdAtMs: Date.now() - 86400000 * 3,
    };
    const clan2: ClanDto = {
      id: 'clan-sol-syndicate',
      name: 'Sol Syndicate',
      tag: 'SOL',
      emblem: '⚡',
      leaderId: 'leader-2',
      leaderUsername: 'Mberked',
      memberCount: 9,
      totalEmpireLevels: 85,
      totalProductionPerSecond: 32000,
      clanLevel: calculateClanLevel(85),
      telegramChannelUrl: 'https://t.me/SolSyndicate',
      createdAtMs: Date.now() - 86400000 * 2,
    };
    this.clans.set(clan1.id, clan1);
    this.clans.set(clan2.id, clan2);
  }

  setPlayerCash(userId: string, cash: number) {
    this.userCash.set(userId, cash);
  }

  getPlayerCash(userId: string): number {
    return this.userCash.get(userId) ?? this.defaultCash;
  }

  async getClan(clanId: string): Promise<ClanDto | null> {
    return this.clans.get(clanId) ?? null;
  }

  async getUserClan(userId: string): Promise<ClanDto | null> {
    const clanId = this.userClans.get(userId);
    if (!clanId) return null;
    return this.clans.get(clanId) ?? null;
  }

  async createClan(
    leaderId: string,
    leaderUsername: string,
    name: string,
    tag: string,
    emblem: string,
    telegramChannelUrl?: string,
  ): Promise<{ clan: ClanDto; newCash: number; error?: string }> {
    if (this.userClans.has(leaderId)) {
      return {
        clan: null as unknown as ClanDto,
        newCash: this.getPlayerCash(leaderId),
        error: 'ALREADY_IN_CLAN',
      };
    }

    const currentCash = this.getPlayerCash(leaderId);
    if (currentCash < CLAN_CREATION_CASH_COST) {
      return {
        clan: null as unknown as ClanDto,
        newCash: currentCash,
        error: 'INSUFFICIENT_CASH',
      };
    }

    // Check duplicate tag or name
    for (const c of this.clans.values()) {
      if (c.name.toLowerCase() === name.toLowerCase()) {
        return {
          clan: null as unknown as ClanDto,
          newCash: currentCash,
          error: 'CLAN_NAME_TAKEN',
        };
      }
      if (c.tag.toUpperCase() === tag.toUpperCase()) {
        return {
          clan: null as unknown as ClanDto,
          newCash: currentCash,
          error: 'CLAN_TAG_TAKEN',
        };
      }
    }

    const newCash = currentCash - CLAN_CREATION_CASH_COST;
    this.setPlayerCash(leaderId, newCash);

    const clan: ClanDto = {
      id: `clan-${randomUUID()}`,
      name,
      tag: tag.toUpperCase(),
      emblem,
      leaderId,
      leaderUsername,
      memberCount: 1,
      totalEmpireLevels: 10,
      totalProductionPerSecond: 100,
      clanLevel: 1,
      telegramChannelUrl,
      createdAtMs: Date.now(),
    };

    this.clans.set(clan.id, clan);
    this.userClans.set(leaderId, clan.id);

    return { clan, newCash };
  }

  async joinClan(
    userId: string,
    _username: string,
    clanId: string,
  ): Promise<{ clanId: string; newMemberCount: number; error?: string }> {
    if (this.userClans.has(userId)) {
      return { clanId, newMemberCount: 0, error: 'ALREADY_IN_CLAN' };
    }

    const clan = this.clans.get(clanId);
    if (!clan) {
      return { clanId, newMemberCount: 0, error: 'CLAN_NOT_FOUND' };
    }

    const maxCapacity = calculateClanCapacity(clan.clanLevel);
    if (clan.memberCount >= maxCapacity) {
      return { clanId, newMemberCount: clan.memberCount, error: 'CLAN_FULL' };
    }

    const updatedClan: ClanDto = {
      ...clan,
      memberCount: clan.memberCount + 1,
      totalEmpireLevels: clan.totalEmpireLevels + 5,
      clanLevel: calculateClanLevel(clan.totalEmpireLevels + 5),
    };

    this.clans.set(clanId, updatedClan);
    this.userClans.set(userId, clanId);

    return { clanId, newMemberCount: updatedClan.memberCount };
  }

  async getClanLeaderboard(limit = 20): Promise<ClanDto[]> {
    return Array.from(this.clans.values())
      .sort((a, b) => b.totalProductionPerSecond - a.totalProductionPerSecond)
      .slice(0, limit);
  }
}

export class SupabaseClanStore implements ClanStore {
  constructor(
    private supabaseUrl?: string,
    private serviceKey?: string,
    private fallbackMemory = new MemoryClanStore(),
  ) {}

  async getClan(clanId: string): Promise<ClanDto | null> {
    return this.fallbackMemory.getClan(clanId);
  }

  async getUserClan(userId: string): Promise<ClanDto | null> {
    return this.fallbackMemory.getUserClan(userId);
  }

  async createClan(
    leaderId: string,
    leaderUsername: string,
    name: string,
    tag: string,
    emblem: string,
    telegramChannelUrl?: string,
  ): Promise<{ clan: ClanDto; newCash: number; error?: string }> {
    return this.fallbackMemory.createClan(
      leaderId,
      leaderUsername,
      name,
      tag,
      emblem,
      telegramChannelUrl,
    );
  }

  async joinClan(
    userId: string,
    username: string,
    clanId: string,
  ): Promise<{ clanId: string; newMemberCount: number; error?: string }> {
    return this.fallbackMemory.joinClan(userId, username, clanId);
  }

  async getClanLeaderboard(limit = 20): Promise<ClanDto[]> {
    return this.fallbackMemory.getClanLeaderboard(limit);
  }
}
