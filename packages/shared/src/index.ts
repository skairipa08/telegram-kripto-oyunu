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
  game: z.object({ status: z.literal('not_initialized') }),
});

export type PlayerState = z.infer<typeof playerStateSchema>;
