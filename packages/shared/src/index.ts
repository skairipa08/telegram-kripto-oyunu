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
