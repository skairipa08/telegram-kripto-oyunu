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
  upgradeCost: z.number().positive(),
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
  upgradeCost: z.number().nonnegative(),
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
  cash: z.number().nonnegative(),
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
  claimedAmount: z.number().nonnegative(),
  newBalance: z.number().nonnegative(),
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
  remainingCash: z.number().nonnegative(),
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

export const inviteeMilestoneStatusSchema = z.object({
  targetCash: z.number().nonnegative(),
  rewardCash: z.number().nonnegative(),
  label: z.string(),
  completed: z.boolean(),
  claimed: z.boolean(),
});
export type InviteeMilestoneStatus = z.infer<
  typeof inviteeMilestoneStatusSchema
>;

export const playerReferralOverviewSchema = z.object({
  referralCode: z.string(),
  deepLink: z.string(),
  totalInvites: z.number().int().nonnegative(),
  qualifiedCount: z.number().int().nonnegative(),
  totalEarnedPoints: z.number().int().nonnegative(),
  unlockedBadges: z.array(z.string()),
  totalKickbackCashEarned: z.number().nonnegative().optional(),
  unclaimedKickbackCash: z.number().nonnegative().optional(),
  commissionRatePercent: z.number().nonnegative().optional(),
  inviteeMilestones: z.array(inviteeMilestoneStatusSchema).optional(),
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
  starterCashBoost: z.number().nonnegative(),
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

export const claimReferralKickbackRequestSchema = z
  .object({
    requestId: z.uuid(),
  })
  .strict();
export type ClaimReferralKickbackRequest = z.infer<
  typeof claimReferralKickbackRequestSchema
>;

export const claimReferralKickbackResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  claimedCash: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
  claimedAt: z.iso.datetime(),
});
export type ClaimReferralKickbackResponse = z.infer<
  typeof claimReferralKickbackResponseSchema
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

export const invoiceStatusDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  sku: z.string(),
  starsAmount: z.number().int().positive(),
  status: z.enum(['pending', 'completed', 'failed', 'refunded']),
  telegramPaymentChargeId: z.string().nullable(),
  invoicePayload: z.string(),
  currency: z.literal('XTR').default('XTR'),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});
export type InvoiceStatusDto = z.infer<typeof invoiceStatusDtoSchema>;

export const invoiceStatusResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  invoice: invoiceStatusDtoSchema,
});
export type InvoiceStatusResponse = z.infer<typeof invoiceStatusResponseSchema>;

export const telegramPreCheckoutQuerySchema = z.object({
  id: z.string(),
  from: z.object({
    id: z.number(),
    is_bot: z.boolean().optional(),
    first_name: z.string().optional(),
    username: z.string().optional(),
  }),
  currency: z.string(),
  total_amount: z.number().int().positive(),
  invoice_payload: z.string(),
});
export type TelegramPreCheckoutQuery = z.infer<
  typeof telegramPreCheckoutQuerySchema
>;

export const telegramSuccessfulPaymentSchema = z.object({
  currency: z.string(),
  total_amount: z.number().int().positive(),
  invoice_payload: z.string(),
  telegram_payment_charge_id: z.string(),
  provider_payment_charge_id: z.string().optional(),
});
export type TelegramSuccessfulPayment = z.infer<
  typeof telegramSuccessfulPaymentSchema
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

// --- Requirement R3: Anti-Fraud & Admin Review DTO Schemas ---

export const adminFraudFlagDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  targetType: z.enum(['user', 'reward', 'transaction', 'referral', 'session']),
  targetId: z.string(),
  riskScore: z.number().int().min(0).max(100),
  reasonCodes: z.array(z.string()).min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['pending', 'investigating', 'resolved', 'dismissed']),
  metadata: z.record(z.string(), z.unknown()),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().nullable(),
  resolutionNotes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  user: z
    .object({
      telegramId: z.string(),
      username: z.string().nullable(),
      firstName: z.string(),
      status: z.string(),
      userRiskScore: z.number().int(),
    })
    .optional(),
});
export type AdminFraudFlagDto = z.infer<typeof adminFraudFlagDtoSchema>;

export const adminFraudFlagsResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  flags: z.array(adminFraudFlagDtoSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type AdminFraudFlagsResponse = z.infer<
  typeof adminFraudFlagsResponseSchema
>;

export const adminFrozenRewardDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  fraudFlagId: z.string().uuid().nullable(),
  rewardType: z.enum([
    'cash_claim',
    'mission_reward',
    'referral_bonus',
    'streak_bonus',
    'airdrop',
  ]),
  amountCash: z.number().nonnegative(),
  amountSeasonPoints: z.number().int().nonnegative(),
  status: z.enum(['frozen', 'approved', 'rejected']),
  freezeReason: z.string(),
  sourceRefId: z.string().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  frozenAt: z.string(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().nullable(),
  reviewNotes: z.string().nullable(),
  user: z
    .object({
      telegramId: z.string(),
      username: z.string().nullable(),
      firstName: z.string(),
      currentCash: z.number().nullable().optional(),
      currentSeasonPoints: z.number().int().nullable().optional(),
    })
    .optional(),
});
export type AdminFrozenRewardDto = z.infer<typeof adminFrozenRewardDtoSchema>;

export const adminFrozenRewardsResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  rewards: z.array(adminFrozenRewardDtoSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type AdminFrozenRewardsResponse = z.infer<
  typeof adminFrozenRewardsResponseSchema
>;

export const adminFraudReviewRequestSchema = z
  .object({
    rewardId: z.string().uuid(),
    decision: z.enum(['approve', 'reject']),
    reason: z.string().min(1).max(1000),
  })
  .strict();
export type AdminFraudReviewRequest = z.infer<
  typeof adminFraudReviewRequestSchema
>;

export const adminFraudReviewResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  decision: z.enum(['approved', 'rejected']),
  frozenRewardId: z.string().uuid(),
  creditedCash: z.number().nonnegative().optional(),
  creditedSeasonPoints: z.number().int().nonnegative().optional(),
  canceledCash: z.number().nonnegative().optional(),
  canceledSeasonPoints: z.number().int().nonnegative().optional(),
  newCash: z.number().nonnegative().optional(),
  newSeasonPoints: z.number().int().nonnegative().optional(),
  reviewedAt: z.string(),
});
export type AdminFraudReviewResponse = z.infer<
  typeof adminFraudReviewResponseSchema
>;

// ============================================================================
// 12. Arcade Minigames Schemas & DTOs
// ============================================================================

// --- Notcoin Tap ---
export const tapGameStateDtoSchema = z.object({
  energy: z.number().int().nonnegative(),
  maxEnergy: z.number().int().positive(),
  rechargeRate: z.number().int().positive(),
  multitapLevel: z.number().int().positive(),
  energyCapacityLevel: z.number().int().positive(),
  rechargeSpeedLevel: z.number().int().positive(),
  tapPower: z.number().int().positive(),
  tapBotUnlocked: z.boolean(),
  tapBotOfflineCapSeconds: z.number().int().positive(),
  lastEnergyUpdateAt: z.string(),
  lastTapBotClaimAt: z.string(),
  unclaimedTapBotCash: z.number().nonnegative(),
});
export type TapGameStateDto = z.infer<typeof tapGameStateDtoSchema>;

export const tapClickRequestSchema = z
  .object({
    tapCount: z.number().int().min(1).max(100),
    requestId: z.string().uuid(),
  })
  .strict();
export type TapClickRequest = z.infer<typeof tapClickRequestSchema>;

export const tapClickResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  tapsExecuted: z.number().int().nonnegative(),
  coinsEarned: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
  remainingEnergy: z.number().int().nonnegative(),
  criticalHitsCount: z.number().int().nonnegative(),
  energyRechargeRate: z.number().int().positive(),
});
export type TapClickResponse = z.infer<typeof tapClickResponseSchema>;

export const tapUpgradeRequestSchema = z
  .object({
    upgradeType: z.enum([
      'multitap',
      'capacity',
      'recharge_speed',
      'unlock_bot',
    ]),
    currency: z.enum(['cash', 'stars']),
    requestId: z.string().uuid(),
  })
  .strict();
export type TapUpgradeRequest = z.infer<typeof tapUpgradeRequestSchema>;

export const tapUpgradeResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  upgradeType: z.string(),
  newLevel: z.number().int().positive(),
  cashCost: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
});
export type TapUpgradeResponse = z.infer<typeof tapUpgradeResponseSchema>;

export const tapClaimBotRequestSchema = z
  .object({
    requestId: z.string().uuid(),
  })
  .strict();
export type TapClaimBotRequest = z.infer<typeof tapClaimBotRequestSchema>;

export const tapClaimBotResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  claimedCash: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
  offlineSecondsElapsed: z.number().int().nonnegative(),
  botTapsCount: z.number().int().nonnegative(),
});
export type TapClaimBotResponse = z.infer<typeof tapClaimBotResponseSchema>;

// --- Catizen Merge ---
export const mergeBoardStateDtoSchema = z.object({
  grid: z.array(z.number().int()),
  passiveRatePerSecond: z.number().nonnegative(),
  unclaimedPassiveCash: z.number().nonnegative(),
  lastPassiveClaimAt: z.string(),
  nextParcelDropSeconds: z.number().int().nonnegative(),
});
export type MergeBoardStateDto = z.infer<typeof mergeBoardStateDtoSchema>;

export const mergeActionRequestSchema = z
  .object({
    sourceIndex: z.number().int().min(0).max(15),
    targetIndex: z.number().int().min(0).max(15),
    actionType: z.enum(['move', 'merge', 'unbox_parcel']),
    requestId: z.string().uuid(),
  })
  .strict();
export type MergeActionRequest = z.infer<typeof mergeActionRequestSchema>;

export const mergeActionResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  grid: z.array(z.number().int()),
  rewardCash: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
  unlockedTier: z.number().int().optional(),
});
export type MergeActionResponse = z.infer<typeof mergeActionResponseSchema>;

export const mergeAutoRequestSchema = z
  .object({
    autoUnbox: z.boolean(),
    requestId: z.string().uuid(),
  })
  .strict();
export type MergeAutoRequest = z.infer<typeof mergeAutoRequestSchema>;

export const mergeAutoResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  grid: z.array(z.number().int()),
  totalMergesExecuted: z.number().int().nonnegative(),
  parcelsOpened: z.number().int().nonnegative(),
  totalRewardCash: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
  newPassiveRatePerSecond: z.number().nonnegative(),
});
export type MergeAutoResponse = z.infer<typeof mergeAutoResponseSchema>;

export const mergeClaimPassiveRequestSchema = z
  .object({
    requestId: z.string().uuid(),
  })
  .strict();
export type MergeClaimPassiveRequest = z.infer<
  typeof mergeClaimPassiveRequestSchema
>;

export const mergeClaimPassiveResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  claimedCash: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
  elapsedSeconds: z.number().int().nonnegative(),
});
export type MergeClaimPassiveResponse = z.infer<
  typeof mergeClaimPassiveResponseSchema
>;

// --- Crypto Crash ---
export const crashStartRequestSchema = z
  .object({
    stake: z.number().min(10),
    clientSeed: z.string().min(1).max(128).optional(),
    requestId: z.string().uuid(),
  })
  .strict();
export type CrashStartRequest = z.infer<typeof crashStartRequestSchema>;

export const crashStartResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  roundId: z.string().uuid(),
  stake: z.number().positive(),
  serverSeedHash: z.string(),
  startTime: z.string(),
});
export type CrashStartResponse = z.infer<typeof crashStartResponseSchema>;

export const crashCashoutRequestSchema = z
  .object({
    roundId: z.string().uuid(),
    claimMultiplier: z.number().positive(),
    requestId: z.string().uuid(),
  })
  .strict();
export type CrashCashoutRequest = z.infer<typeof crashCashoutRequestSchema>;

export const crashCashoutResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  roundId: z.string().uuid(),
  status: z.enum(['won', 'crashed']),
  crashMultiplier: z.number(),
  cashoutMultiplier: z.number(),
  payoutCash: z.number().nonnegative(),
  netProfit: z.number(),
  newCash: z.number().nonnegative(),
  serverSeed: z.string(),
});
export type CrashCashoutResponse = z.infer<typeof crashCashoutResponseSchema>;

// --- Dynasty Cipher ---
export const cipherSubmitRequestSchema = z
  .object({
    round: z.number().int().min(1),
    combo: z.number().int().min(1),
    completedSuccessfully: z.boolean(),
    requestId: z.string().uuid(),
  })
  .strict();
export type CipherSubmitRequest = z.infer<typeof cipherSubmitRequestSchema>;

export const cipherSubmitResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  round: z.number().int().positive(),
  combo: z.number().int().positive(),
  rewardCash: z.number().nonnegative(),
  newCash: z.number().nonnegative(),
});
export type CipherSubmitResponse = z.infer<typeof cipherSubmitResponseSchema>;

// --- Clans & Cartels ---
export const clanDtoSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(32),
  tag: z.string().min(2).max(6),
  emblem: z.string().min(1).max(8),
  leaderId: z.string(),
  leaderUsername: z.string(),
  memberCount: z.number().int().nonnegative(),
  totalEmpireLevels: z.number().int().nonnegative(),
  totalProductionPerSecond: z.number().nonnegative(),
  clanLevel: z.number().int().min(1).max(50),
  telegramChannelUrl: z.string().optional(),
  createdAtMs: z.number().int(),
});
export type ClanDto = z.infer<typeof clanDtoSchema>;

export const createClanRequestSchema = z
  .object({
    name: z.string().trim().min(3).max(24),
    tag: z.string().trim().min(2).max(5).toUpperCase(),
    emblem: z.string().trim().min(1).max(4),
    telegramChannelUrl: z.string().trim().url().optional(),
    requestId: z.string().uuid(),
  })
  .strict();
export type CreateClanRequest = z.infer<typeof createClanRequestSchema>;

export const createClanResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  clan: clanDtoSchema,
  newCash: z.number().nonnegative(),
});
export type CreateClanResponse = z.infer<typeof createClanResponseSchema>;

export const joinClanRequestSchema = z
  .object({
    clanId: z.string().min(1),
    requestId: z.string().uuid(),
  })
  .strict();
export type JoinClanRequest = z.infer<typeof joinClanRequestSchema>;

export const joinClanResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  clanId: z.string(),
  joinedAt: z.iso.datetime(),
  newMemberCount: z.number().int().positive(),
});
export type JoinClanResponse = z.infer<typeof joinClanResponseSchema>;

export const clanLeaderboardEntrySchema = z.object({
  rank: z.number().int().positive(),
  clanId: z.string(),
  name: z.string(),
  tag: z.string(),
  emblem: z.string(),
  memberCount: z.number().int(),
  clanLevel: z.number().int(),
  totalProductionPerSecond: z.number(),
  telegramChannelUrl: z.string().optional(),
});
export type ClanLeaderboardEntry = z.infer<typeof clanLeaderboardEntrySchema>;

export const clanLeaderboardResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  clans: z.array(clanLeaderboardEntrySchema),
  userClanId: z.string().nullable(),
});
export type ClanLeaderboardResponse = z.infer<
  typeof clanLeaderboardResponseSchema
>;

// --- Daily Mystery Combo & Daily Cipher ---
export const dailyComboStatusResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  date: z.string(),
  isCompleted: z.boolean(),
  claimedAt: z.string().nullable(),
  rewardCash: z.number().positive(),
  rewardSeasonPoints: z.number().int().positive(),
});
export type DailyComboStatusResponse = z.infer<
  typeof dailyComboStatusResponseSchema
>;

export const submitDailyComboRequestSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    selectedSlugs: z.array(z.string().min(1)).length(3),
    requestId: z.string().uuid(),
  })
  .strict();
export type SubmitDailyComboRequest = z.infer<
  typeof submitDailyComboRequestSchema
>;

export const submitDailyComboResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  message: z.string(),
  rewardCash: z.number().nonnegative(),
  rewardSeasonPoints: z.number().int().nonnegative(),
  newCash: z.number().nonnegative(),
});
export type SubmitDailyComboResponse = z.infer<
  typeof submitDailyComboResponseSchema
>;

export const submitDailyCipherRequestSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    solvedWord: z.string().trim().min(2).max(32),
    requestId: z.string().uuid(),
  })
  .strict();
export type SubmitDailyCipherRequest = z.infer<
  typeof submitDailyCipherRequestSchema
>;

export const submitDailyCipherResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  success: z.boolean(),
  message: z.string(),
  rewardCash: z.number().nonnegative(),
  rewardSeasonPoints: z.number().int().nonnegative(),
  newCash: z.number().nonnegative(),
});
export type SubmitDailyCipherResponse = z.infer<
  typeof submitDailyCipherResponseSchema
>;
