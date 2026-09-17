/**
 * Pure deterministic clan / cartel / syndicate domain logic for Project Empire.
 * Independent of network, database, or UI.
 */

export interface Clan {
  readonly id: string;
  readonly name: string;
  readonly tag: string; // 3-5 character identifier e.g. "ALPHA"
  readonly emblem: string; // Emoji or icon identifier e.g. "🦁"
  readonly leaderId: string;
  readonly leaderUsername: string;
  readonly memberCount: number;
  readonly totalEmpireLevels: number;
  readonly totalProductionPerSecond: number;
  readonly clanLevel: number;
  readonly telegramChannelUrl?: string;
  readonly createdAtMs: number;
}

export interface ClanMember {
  readonly userId: string;
  readonly username: string;
  readonly role: 'leader' | 'officer' | 'member';
  readonly empireLevel: number;
  readonly productionPerSecond: number;
  readonly joinedAtMs: number;
}

export interface ClanLeaderboardEntry {
  readonly rank: number;
  readonly clanId: string;
  readonly name: string;
  readonly tag: string;
  readonly emblem: string;
  readonly memberCount: number;
  readonly clanLevel: number;
  readonly totalProductionPerSecond: number;
}

export const CLAN_CREATION_CASH_COST = 50000;
export const CLAN_CREATION_MIN_EMPIRE_LEVEL = 10;
export const CLAN_MAX_MEMBERS_BASE = 50;
export const CLAN_MAX_MEMBERS_CAP = 250;
export const CLAN_LEADER_TAX_RATE = 0.01; // 1% passive leadership dividend

/**
 * Calculates Clan Level (1 to 50) based on combined empire levels of all members.
 */
export function calculateClanLevel(totalEmpireLevels: number): number {
  if (totalEmpireLevels <= 0) return 1;
  const level = Math.floor(totalEmpireLevels / 25) + 1;
  return Math.min(50, Math.max(1, level));
}

/**
 * Calculates member passive production bonus multiplier (+2% to +10%) based on clan level.
 */
export function calculateClanProductionBonus(clanLevel: number): number {
  const safeLevel = Math.min(50, Math.max(1, clanLevel));
  // Scaled from +2% (0.02) at Lv 1 to +10% (0.10) at Lv 50
  return 0.02 + ((safeLevel - 1) / 49) * 0.08;
}

/**
 * Calculates leader's 1% dividend from a member's generated cash.
 */
export function calculateClanLeaderDividend(memberEarnedCash: number): number {
  if (memberEarnedCash <= 0) return 0;
  return Math.floor(memberEarnedCash * CLAN_LEADER_TAX_RATE);
}

/**
 * Calculates member capacity based on clan level (50 to 250 members).
 */
export function calculateClanCapacity(clanLevel: number): number {
  const safeLevel = Math.min(50, Math.max(1, clanLevel));
  return Math.min(
    CLAN_MAX_MEMBERS_CAP,
    CLAN_MAX_MEMBERS_BASE + Math.round(((safeLevel - 1) / 49) * 200),
  );
}

/**
 * Builds a dual ref + clan startapp referral link.
 * Example: https://t.me/EmpireCryptoBot?startapp=ref_123_clan_456
 */
export function generateClanRefLink(
  botUsername: string,
  inviterUserId: string,
  clanId: string,
): string {
  const cleanBot = botUsername.replace(/^@/, '');
  return `https://t.me/${cleanBot}?startapp=ref_${inviterUserId}_clan_${clanId}`;
}

export interface ParsedClanRef {
  readonly inviterId: string;
  readonly clanId: string | null;
}

/**
 * Parses raw startapp param which may contain both inviter and clan ID.
 * Accepts formats:
 * - "ref_123" -> { inviterId: "123", clanId: null }
 * - "ref_123_clan_456" -> { inviterId: "123", clanId: "456" }
 */
export function parseClanRefParam(startappParam: string): ParsedClanRef | null {
  if (!startappParam || typeof startappParam !== 'string') return null;

  const withClanMatch = startappParam.match(
    /^ref_([A-Za-z0-9_-]+)_clan_([A-Za-z0-9_-]+)$/,
  );
  if (withClanMatch && withClanMatch[1] && withClanMatch[2]) {
    return {
      inviterId: withClanMatch[1],
      clanId: withClanMatch[2],
    };
  }

  const standardRefMatch = startappParam.match(/^ref_([A-Za-z0-9_-]+)$/);
  if (standardRefMatch && standardRefMatch[1]) {
    return {
      inviterId: standardRefMatch[1],
      clanId: null,
    };
  }

  return null;
}
