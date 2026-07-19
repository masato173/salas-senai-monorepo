import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

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
