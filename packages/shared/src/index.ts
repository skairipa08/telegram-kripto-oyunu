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
  paybackPeriodSeconds: z
    .number()
    .nonnegative()
    .or(z.literal(Infinity))
    .optional(),
  marginalRoi: z.number().nonnegative().optional(),
  nextProductionPerSecond: z.number().nonnegative().optional(),
});
export type PlayerBusiness = z.infer<typeof playerBusinessSchema>;

export const optimalUpgradeRecommendationSchema = z.object({
  slug: z.string(),
  name: z.string(),
  currentLevel: z.number().int().nonnegative(),
  upgradeCost: z.number().int().nonnegative(),
  paybackPeriodSeconds: z.number().nonnegative().or(z.literal(Infinity)),
  marginalRoi: z.number().nonnegative(),
  isAffordable: z.boolean(),
});
export type OptimalUpgradeRecommendation = z.infer<
  typeof optimalUpgradeRecommendationSchema
>;

export const economyRoiResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  currentCash: z.number().nonnegative(),
  totalProductionPerSecond: z.number().nonnegative(),
  optimalUpgrade: optimalUpgradeRecommendationSchema.nullable(),
  businesses: z.array(playerBusinessSchema),
  multipliers: z
    .object({
      offlineCapSeconds: z.number().int().positive(),
      upgradeCostGrowth: z.number().positive(),
      productionLevelGrowth: z.number().positive(),
      hasConveniencePass: z.boolean(),
    })
    .optional(),
});
export type EconomyRoiResponse = z.infer<typeof economyRoiResponseSchema>;

export const economySimulationResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  durationSeconds: z.number().int().positive(),
  totalCashEarned: z.number().nonnegative(),
  finalCashBalance: z.number().nonnegative(),
  finalProductionPerSecond: z.number().nonnegative(),
  unlockedBusinessCount: z.number().int().nonnegative(),
  businessLevels: z.record(z.string(), z.number().int().nonnegative()),
  timeToUnlockSeconds: z.record(z.string(), z.number().nullable()),
  totalUpgradesPurchased: z.number().int().nonnegative().optional(),
  conveniencePassImpact: z
    .object({
      cashEarnedFree: z.number().nonnegative(),
      cashEarnedPass: z.number().nonnegative(),
      wastedOfflineSecondsFree: z.number().nonnegative(),
      wastedOfflineSecondsPass: z.number().nonnegative(),
      efficiencyGainMultiplier: z.number().nonnegative(),
    })
    .optional(),
});
export type EconomySimulationResponse = z.infer<
  typeof economySimulationResponseSchema
>;

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

// --- Step 7: Leaderboard DTO Schemas (Blueprint R6) ---

export const leaderboardScopeSchema = z.enum(['global', 'friends']);
export type LeaderboardScope = z.infer<typeof leaderboardScopeSchema>;

export const leaderboardEntryDtoSchema = z.object({
  rank: z.number().int().positive(),
  userId: z.uuid(),
  username: z.string().nullable(),
  firstName: z.string(),
  points: z.number().int().nonnegative(),
  missionPoints: z.number().int().nonnegative(),
  referralPoints: z.number().int().nonnegative(),
  isCurrentUser: z.boolean(),
});
export type LeaderboardEntryDto = z.infer<typeof leaderboardEntryDtoSchema>;

export const leaderboardPinnedUserSchema = z.object({
  rank: z.number().int().positive().nullable(),
  points: z.number().int().nonnegative(),
  missionPoints: z.number().int().nonnegative(),
  referralPoints: z.number().int().nonnegative(),
});
export type LeaderboardPinnedUser = z.infer<typeof leaderboardPinnedUserSchema>;

export const leaderboardResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  seasonId: z.uuid(),
  scope: leaderboardScopeSchema,
  entries: z.array(leaderboardEntryDtoSchema),
  currentUser: leaderboardPinnedUserSchema,
  totalCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type LeaderboardResponseDto = z.infer<typeof leaderboardResponseSchema>;

export const freezeSeasonRequestSchema = z
  .object({
    seasonId: z.uuid(),
    requestId: z.uuid(),
    reason: z.string().max(256).optional(),
  })
  .strict();
export type FreezeSeasonRequest = z.infer<typeof freezeSeasonRequestSchema>;

export const freezeSeasonResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  seasonId: z.uuid(),
  status: z.literal('frozen'),
  frozenAt: z.iso.datetime(),
  archivedParticipantsCount: z.number().int().nonnegative(),
});
export type FreezeSeasonResponse = z.infer<typeof freezeSeasonResponseSchema>;

// --- Step 8: Stars Monetization & Pass Entitlement DTO Schemas (Blueprint R7) ---

export const shopSkuDtoSchema = z.object({
  sku: z.enum([
    'convenience_pass_30d',
    'cosmetic_frame_gold',
    'cosmetic_emblem_founder',
  ]),
  name: z.string(),
  description: z.string(),
  starsPrice: z.number().int().positive(),
  type: z.enum(['pass', 'cosmetic']),
  durationDays: z.number().int().positive().optional(),
});
export type ShopSkuDto = z.infer<typeof shopSkuDtoSchema>;

export const conveniencePassDtoSchema = z.object({
  isActive: z.boolean(),
  expiresAt: z.iso.datetime().nullable(),
  offlineCapSeconds: z.number().int().positive(),
  upgradeQueueSlots: z.number().int().positive(),
  missionRerolls: z.number().int().positive(),
  autoClaimEnabled: z.boolean(),
  seasonPointsMultiplier: z.number().nonnegative(),
});
export type ConveniencePassDto = z.infer<typeof conveniencePassDtoSchema>;

export const shopCatalogResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  skus: z.array(shopSkuDtoSchema),
  pass: conveniencePassDtoSchema,
});
export type ShopCatalogResponseDto = z.infer<typeof shopCatalogResponseSchema>;

export const createInvoiceRequestSchema = z
  .object({
    sku: z.string().min(1).max(64),
    requestId: z.uuid(),
  })
  .strict();
export type CreateInvoiceRequest = z.infer<typeof createInvoiceRequestSchema>;

export const createInvoiceResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  sku: z.string(),
  starsPrice: z.number().int().positive(),
  invoicePayload: z.string(),
  invoiceLink: z.string(),
});
export type CreateInvoiceResponse = z.infer<typeof createInvoiceResponseSchema>;

export const fulfillPaymentRequestSchema = z
  .object({
    telegramPaymentChargeId: z.string().min(1).max(256),
    invoicePayload: z.string().min(16).max(128),
    starsAmount: z.number().int().positive(),
    sku: z.string().optional(),
  })
  .strict();
export type FulfillPaymentRequest = z.infer<typeof fulfillPaymentRequestSchema>;

export const fulfillPaymentResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  duplicate: z.boolean(),
  purchaseId: z.uuid(),
  newPassExpiresAt: z.iso.datetime().nullable(),
});
export type FulfillPaymentResponse = z.infer<
  typeof fulfillPaymentResponseSchema
>;

// --- Step 9: Admin Remote Config & Feature Flags DTO Schemas (Blueprint R8) ---

export const economyConfigDtoSchema = z.object({
  offlineCapFreeSec: z.number().int().positive(),
  offlineCapPassSec: z.number().int().positive(),
  upgradeCostGrowth: z.number().positive(),
  productionLevelGrowth: z.number().positive(),
  seasonSruBase: z.number().int().positive(),
  seasonSruRefQap: z.number().int().positive(),
  seasonSruExponent: z.number(),
  seasonSruMin: z.number().int().positive(),
  seasonSruMax: z.number().int().positive(),
  referralBindWindowMin: z.number().int().positive(),
  referralDiminishThreshold: z.number().int().positive(),
  referralDiminishFloor: z.number().positive(),
  passPriceStars: z.number().int().positive(),
  passDurationDays: z.number().int().positive(),
  missionDailySlots: z.number().int().positive(),
  missionFreeRerolls: z.number().int().nonnegative(),
  missionPassRerolls: z.number().int().positive(),
  featureToken: z.boolean(),
  featureStarsPayments: z.boolean(),
  featureLeaderboard: z.boolean(),
  featureReferrals: z.boolean(),
});
export type EconomyConfigDto = z.infer<typeof economyConfigDtoSchema>;

export const publicConfigResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  config: economyConfigDtoSchema,
  featureFlags: z.record(z.string(), z.boolean()),
});
export type PublicConfigResponse = z.infer<typeof publicConfigResponseSchema>;

export const adminAuditLogDtoSchema = z.object({
  id: z.uuid(),
  adminUserId: z.uuid().nullable(),
  action: z.enum([
    'update_config',
    'set_feature_flag',
    'freeze_season',
    'ban_user',
    'refund_purchase',
  ]),
  targetType: z.enum([
    'economy_config',
    'feature_flag',
    'season',
    'user',
    'purchase',
  ]),
  targetKey: z.string(),
  oldValue: z.unknown(),
  newValue: z.unknown(),
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type AdminAuditLogDto = z.infer<typeof adminAuditLogDtoSchema>;

export const updateConfigRequestSchema = z
  .object({
    key: z.string().min(1).max(128),
    value: z.unknown(),
    reason: z.string().max(256).optional(),
    requestId: z.uuid(),
  })
  .strict();
export type UpdateConfigRequest = z.infer<typeof updateConfigRequestSchema>;

export const updateConfigResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  key: z.string(),
  updatedValue: z.unknown(),
  auditLogId: z.uuid(),
});
export type UpdateConfigResponse = z.infer<typeof updateConfigResponseSchema>;

// --- Step 11: Analytics Pipeline DTO Schemas (Blueprint R10 & Section 18) ---

export const canonicalAnalyticsEventSchema = z.enum([
  'app_open',
  'auth_success',
  'tutorial_complete',
  'business_upgrade',
  'cash_claim',
  'mission_assigned',
  'mission_complete',
  'mission_claim',
  'streak_claim',
  'referral_link_copy',
  'referral_bound',
  'referral_milestone_qualified',
  'referral_reward_claim',
  'leaderboard_view',
  'shop_view',
  'invoice_created',
  'payment_success',
  'payment_refund',
  'fraud_flag_created',
  'reward_frozen',
  'pass_activated',
]);
export type CanonicalAnalyticsEvent = z.infer<
  typeof canonicalAnalyticsEventSchema
>;

export const trackAnalyticsEventItemSchema = z.object({
  eventName: canonicalAnalyticsEventSchema,
  properties: z.record(z.string(), z.unknown()).default({}),
  sessionId: z.uuid().optional(),
  timestamp: z.iso.datetime().optional(),
});
export type TrackAnalyticsEventItem = z.infer<
  typeof trackAnalyticsEventItemSchema
>;

export const trackAnalyticsEventsRequestSchema = z
  .object({
    events: z.array(trackAnalyticsEventItemSchema).min(1).max(50),
    requestId: z.uuid(),
  })
  .strict();
export type TrackAnalyticsEventsRequest = z.infer<
  typeof trackAnalyticsEventsRequestSchema
>;

export const trackAnalyticsEventsResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  acceptedCount: z.number().int().nonnegative(),
  receivedAt: z.iso.datetime(),
});
export type TrackAnalyticsEventsResponse = z.infer<
  typeof trackAnalyticsEventsResponseSchema
>;

export const retentionCohortDtoSchema = z.object({
  cohortDate: z.string(),
  totalSignups: z.number().int().nonnegative(),
  d1Count: z.number().int().nonnegative(),
  d1Rate: z.number().nonnegative(),
  d2Count: z.number().int().nonnegative(),
  d2Rate: z.number().nonnegative(),
  d7Count: z.number().int().nonnegative(),
  d7Rate: z.number().nonnegative(),
});
export type RetentionCohortDto = z.infer<typeof retentionCohortDtoSchema>;

export const analyticsMetricsResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  activationRate: z.number().nonnegative(),
  payerConversionRate: z.number().nonnegative(),
  totalStarsRevenue: z.number().int().nonnegative(),
  arppu: z.number().nonnegative(),
  cohorts: z.array(retentionCohortDtoSchema),
});
export type AnalyticsMetricsResponse = z.infer<
  typeof analyticsMetricsResponseSchema
>;
