import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { resolveCorsOrigins } from './common/cors-origins.util';

async function bootstrap(): Promise<void> {
  // bufferLogs: segura os logs do boot até o Pino assumir (useLogger abaixo)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // F9.4 — logger estruturado (Pino) substitui o logger padrão do Nest
  app.useLogger(app.get(Logger));

  // F9.2 — headers de segurança HTTP (Helmet) antes de qualquer outra camada
  app.use(helmet());

  // req.ip (rate limiting por IP) vem do X-Forwarded-For só até o número de
  // proxies confiáveis da topologia: TRUST_PROXY, validado no boot e
  // obrigatório em produção (1 = nginx do infra/docker ou borda do Railway;
  // false = sem proxy). Já chega como number | false (ADR-009, #21).
  app.set('trust proxy', app.get(ConfigService).getOrThrow<number | false>('TRUST_PROXY'));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // F9.1 — origens CORS configuráveis via CORS_ORIGIN. Mesma função usada
  // pelo CORS do WebSocket em RealtimeGateway (Fase C3) — não duplicar o
  // fallback de localhost nos dois lugares.
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[api] NestJS running on http://localhost:${port}`);
}

void bootstrap();
