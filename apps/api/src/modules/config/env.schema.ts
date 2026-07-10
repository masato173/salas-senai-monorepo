import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
  // Apps Script — usado pelo SyncModule (POST /sync/schedules)
  APPS_SCRIPT_URL: z.string().url().optional(),
  APPS_SCRIPT_TOKEN: z.string().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
});

export type Env = z.infer<typeof envSchema>;
