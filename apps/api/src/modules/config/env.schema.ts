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
    // Saltos de proxy confiáveis no X-Forwarded-For (Express 'trust proxy',
    // define req.ip → rate limiting). Inteiro >= 0 = quantos proxies há à
    // frente da api; 'false' = nenhum. 'true' é recusado: confiaria em
    // qualquer X-Forwarded-For enviado pelo cliente. Convertido aqui porque o
    // Express lê string como lista de IPs ('1' viraria o IP 0.0.0.1).
    // Obrigatório em produção; fora dela, ausente = false (ADR-009, #21).
    TRUST_PROXY: z
      .string()
      .regex(/^(\d+|false)$/, "TRUST_PROXY deve ser um inteiro >= 0 ou 'false'.")
      .transform(v => (v === 'false' ? false : Number(v)))
      .optional(),
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
    // Sem default em produção: o número de proxies depende da topologia
    // (nginx no infra/docker, borda do Railway) e um palpite errado reabre a
    // forja de X-Forwarded-For ou junta todos os clientes num IP só.
    if (env.NODE_ENV === 'production' && env.TRUST_PROXY === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TRUST_PROXY'],
        message:
          "TRUST_PROXY e obrigatoria em producao (proxies a frente da api, ex.: 1; ou 'false').",
      });
    }
  })
  .transform(env => ({ ...env, TRUST_PROXY: env.TRUST_PROXY ?? false }));

export type Env = z.infer<typeof envSchema>;
