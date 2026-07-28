import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
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

  // Atrás do proxy do Railway, req.ip deve refletir o cliente real (X-Forwarded-For).
  // Sem isso, o rate limiting por IP trataria todos os clientes como um só.
  app.set('trust proxy', 1);

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
