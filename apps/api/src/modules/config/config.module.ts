import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { envSchema } from './env.schema';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: (raw): Record<string, unknown> => {
        const parsed = envSchema.safeParse(raw);
        if (!parsed.success) {
          // eslint-disable-next-line no-console
          console.error('[config] Env validation failed:', parsed.error.format());
          throw new Error('Invalid environment variables');
        }
        return parsed.data;
      },
    }),
  ],
})
export class ConfigModule {}
