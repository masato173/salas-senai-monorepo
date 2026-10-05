import type { ConfigService } from '@nestjs/config';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

// Forma objeto (com throttlers + skipIf) do union ThrottlerModuleOptions.
type ThrottlerObjectOptions = Exclude<ThrottlerModuleOptions, unknown[]>;

// F9.2 — rate limiting global: 100 req/min por IP (ttl em ms). Rotas
// sensíveis têm limite mais restrito via @Throttle (auth.controller).
//
// THROTTLE_SKIP vem do ConfigService (env validado pelo envSchema, que já
// rejeita THROTTLE_SKIP=true com NODE_ENV=production) — nunca de process.env
// cru. Lido uma vez: env não muda em runtime.
export function throttlerOptionsFactory(config: ConfigService): ThrottlerObjectOptions {
  const skip = config.get<string>('THROTTLE_SKIP') === 'true';
  return {
    throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
    skipIf: () => skip,
  };
}
