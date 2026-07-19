import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

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

  // F9.1 — origens CORS configuráveis via CORS_ORIGIN (lista separada por vírgula).
  // Fallback preserva o comportamento local: dev server (5173) e preview (4173).
  const corsOrigins = process.env['CORS_ORIGIN']
    ? process.env['CORS_ORIGIN'].split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:4173'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[api] NestJS running on http://localhost:${port}`);
}

void bootstrap();
