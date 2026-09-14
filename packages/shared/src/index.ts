import { z } from 'zod';

export const healthResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  status: z.literal('ok'),
  service: z.literal('empire-api'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const telegramLoginSchema = z
  .object({
    initData: z.string().min(1).max(16384),
    requestId: z.uuid(),
  })
  .strict();

export const playerBusinessSchema = z.object({
  slug: z.string(),
  name: z.string(),
  level: z.number().int().nonnegative(),
  baseCost: z.number().positive(),
  baseIncome: z.number().positive(),
  upgradeCost: z.number().int().positive(),
  productionPerSecond: z.number().nonnegative(),
  lastClaimAt: z.iso.datetime(),
});
export type PlayerBusiness = z.infer<typeof playerBusinessSchema>;

export const playerEconomyStateSchema = z.object({
  cash: z.number().int().nonnegative(),
  seasonPoints: z.number().int().nonnegative(),
  totalProductionPerSecond: z.number().nonnegative(),
  offlineCapSeconds: z.number().int().positive(),
  businesses: z.array(playerBusinessSchema),
});
export type PlayerEconomyState = z.infer<typeof playerEconomyStateSchema>;

export const playerStateSchema = z.object({
  apiVersion: z.literal('v1'),
  user: z.object({
    id: z.uuid(),
    telegramId: z.string().regex(/^[1-9][0-9]*$/),
    firstName: z.string(),
    username: z.string().nullable(),
    language: z.string().nullable(),
  }),
  session: z.object({ expiresAt: z.iso.datetime() }),
  game: z.union([
    z.object({ status: z.literal('not_initialized') }),
    z.object({
      status: z.literal('active'),
      economy: playerEconomyStateSchema,
    }),
  ]),
});

export type PlayerState = z.infer<typeof playerStateSchema>;

export const claimCashRequestSchema = z
  .object({
    requestId: z.uuid(),
  })
  .strict();
export type ClaimCashRequest = z.infer<typeof claimCashRequestSchema>;

export const claimCashResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  claimedAmount: z.number().int().nonnegative(),
  newBalance: z.number().int().nonnegative(),
  claimedAt: z.iso.datetime(),
  isCapped: z.boolean(),
});
export type ClaimCashResponse = z.infer<typeof claimCashResponseSchema>;

export const upgradeBusinessRequestSchema = z
  .object({
    businessSlug: z.string().min(1).max(64),
    requestId: z.uuid(),
  })
  .strict();
export type UpgradeBusinessRequest = z.infer<
  typeof upgradeBusinessRequestSchema
>;

export const upgradeBusinessResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  business: playerBusinessSchema,
  remainingCash: z.number().int().nonnegative(),
  totalProductionPerSecond: z.number().nonnegative(),
});
export type UpgradeBusinessResponse = z.infer<
  typeof upgradeBusinessResponseSchema
>;

export const seasonStatusSchema = z.enum([
  'upcoming',
  'active',
  'frozen',
  'ended',
]);
export type SeasonStatus = z.infer<typeof seasonStatusSchema>;

export const seasonDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: seasonStatusSchema,
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  sruSnapshot: z.number().int().positive(),
});
export type SeasonDto = z.infer<typeof seasonDtoSchema>;

export const missionDifficultySchema = z.enum([
  'easy',
  'normal',
  'hard',
  'weekly',
]);
export type MissionDifficultyDto = z.infer<typeof missionDifficultySchema>;

export const playerMissionInstanceSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  difficulty: missionDifficultySchema,
  title: z.string(),
  description: z.string(),
  progress: z.number().int().nonnegative(),
  target: z.number().int().positive(),
  status: z.enum(['in_progress', 'completed', 'claimed']),
  rewardPoints: z.number().int().positive(),
  assignedDate: z.string(),
  claimedAt: z.iso.datetime().nullable(),
});
export type PlayerMissionInstance = z.infer<typeof playerMissionInstanceSchema>;

export const playerStreakDtoSchema = z.object({
  currentStreak: z.number().int().nonnegative(),
  longestStreak: z.number().int().nonnegative(),
  lastClaimDate: z.string().nullable(),
  canClaimToday: z.boolean(),
  todayRewardPoints: z.number().int().positive(),
  isCycleBonusToday: z.boolean(),
});
export type PlayerStreakDto = z.infer<typeof playerStreakDtoSchema>;

export const claimMissionRequestSchema = z
  .object({
    missionInstanceId: z.uuid(),
    requestId: z.uuid(),
  })
  .strict();
export type ClaimMissionRequest = z.infer<typeof claimMissionRequestSchema>;

export const claimMissionResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  missionInstanceId: z.uuid(),
  rewardPoints: z.number().int().positive(),
  newSeasonPoints: z.number().int().nonnegative(),
  claimedAt: z.iso.datetime(),
});
export type ClaimMissionResponse = z.infer<typeof claimMissionResponseSchema>;

export const claimStreakRequestSchema = z
  .object({
    requestId: z.uuid(),
  })
  .strict();
export type ClaimStreakRequest = z.infer<typeof claimStreakRequestSchema>;

export const claimStreakResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  rewardPoints: z.number().int().positive(),
  newStreak: z.number().int().positive(),
  newSeasonPoints: z.number().int().nonnegative(),
  isCycleBonus: z.boolean(),
  claimedAt: z.iso.datetime(),
});
export type ClaimStreakResponse = z.infer<typeof claimStreakResponseSchema>;

export const referralMilestoneSchema = z.enum([
  'activation',
  'retained_d2',
  'retained_d7',
  'progression',
]);
export type ReferralMilestoneDto = z.infer<typeof referralMilestoneSchema>;

export const playerReferralOverviewSchema = z.object({
  referralCode: z.string(),
  deepLink: z.string(),
  totalInvites: z.number().int().nonnegative(),
  qualifiedCount: z.number().int().nonnegative(),
  totalEarnedPoints: z.number().int().nonnegative(),
  unlockedBadges: z.array(z.string()),
});
export type PlayerReferralOverview = z.infer<
  typeof playerReferralOverviewSchema
>;

export const bindReferralRequestSchema = z
  .object({
    referralCode: z.string().min(4).max(32),
    requestId: z.uuid(),
  })
  .strict();
export type BindReferralRequest = z.infer<typeof bindReferralRequestSchema>;

export const bindReferralResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  starterCashBoost: z.number().int().nonnegative(),
});
export type BindReferralResponse = z.infer<typeof bindReferralResponseSchema>;

export const referralEventItemSchema = z.object({
  id: z.uuid(),
  milestone: referralMilestoneSchema,
  rewardAmount: z.number().int().positive(),
  qualifiedAt: z.iso.datetime(),
  status: z.enum(['pending', 'claimed', 'frozen']),
  claimedAt: z.iso.datetime().nullable(),
});
export type ReferralEventItem = z.infer<typeof referralEventItemSchema>;

export const claimReferralRewardRequestSchema = z
  .object({
    eventId: z.uuid(),
    requestId: z.uuid(),
  })
  .strict();
export type ClaimReferralRewardRequest = z.infer<
  typeof claimReferralRewardRequestSchema
>;

export const claimReferralRewardResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  eventId: z.uuid(),
  rewardPoints: z.number().int().positive(),
  newSeasonPoints: z.number().int().nonnegative(),
  claimedAt: z.iso.datetime(),
});
export type ClaimReferralRewardResponse = z.infer<
  typeof claimReferralRewardResponseSchema
>;
