import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
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
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
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
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
