import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().url().optional(),
    REDIS_URL: z.string().url().optional(),
    // Apps Script — usado pelo SyncModule (POST /sync/schedules)
    APPS_SCRIPT_URL: z.string().url().optional(),
    APPS_SCRIPT_TOKEN: z.string().optional(),
    // CORS — lista de origens separada por vírgula (ex.: "https://app.exemplo.com")
    CORS_ORIGIN: z.string().optional(),
    // Rate limiting — 'true' desliga o throttling (CI E2E faz polling em /auth/login).
    // Rejeitado no boot com NODE_ENV=production (superRefine abaixo).
    THROTTLE_SKIP: z.enum(['true', 'false']).optional(),
    JWT_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default('15m'),
    JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  })
  // THROTTLE_SKIP=true desliga o rate limiting inteiro, inclusive o 5/min de
  // /auth/login e /auth/refresh. Em produção isso seria silencioso — o boot
  // aborta em vez de subir sem proteção contra força bruta.
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.THROTTLE_SKIP === 'true') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['THROTTLE_SKIP'],
        message: 'THROTTLE_SKIP=true e proibido em producao.',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;
