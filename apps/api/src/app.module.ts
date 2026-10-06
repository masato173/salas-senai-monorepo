import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { ConfigModule } from './modules/config/config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { AvailabilityModule } from './modules/availability/availability.module';
import { AuditModule } from './modules/audit/audit.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { SyncModule } from './modules/sync/sync.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { throttlerOptionsFactory } from './common/throttler-options';

const isProduction = process.env['NODE_ENV'] === 'production';

@Module({
  imports: [
    // F9.4 — logging estruturado: JSON em produção, pino-pretty legível em dev.
    // Cada requisição ganha um UUID (req.id) presente em todos os logs dela.
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: () => randomUUID(),
        redact: ['req.headers.authorization'],
        ...(isProduction
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              },
            }),
      },
    }),
    // F9.2 — rate limiting global: 100 req/min por IP (ttl em ms).
    // Rotas sensíveis têm limite mais restrito via @Throttle (auth.controller).
    // THROTTLE_SKIP=true desliga o throttling — usado no CI E2E, cujo helper
    // wait-for-backend faz polling em POST /auth/login e estouraria o limite.
    // Lido via ConfigService (validado; proibido em produção) — ver
    // common/throttler-options.ts.
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: throttlerOptionsFactory,
    }),
    ScheduleModule.forRoot(), // F7.2 — habilita @Cron em toda a aplicação
    ConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    HealthModule,
    RoomsModule,
    ReservationsModule,
    AvailabilityModule,
    AuditModule,
    RealtimeModule,
    SyncModule,
    SchedulesModule,
    DashboardModule,
    NotificationsModule,
  ],
  providers: [
    // Ordem importa: throttling roda ANTES da autenticação — brute force em
    // /auth/login é barrado sem gastar CPU com bcrypt, e rotas @Public()
    // continuam acessíveis (throttling e auth são mecanismos independentes).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
