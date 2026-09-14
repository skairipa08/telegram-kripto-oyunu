import { z } from 'zod';

export const healthResponseSchema = z.object({
  apiVersion: z.literal('v1'),
  status: z.literal('ok'),
  service: z.literal('empire-api'),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
