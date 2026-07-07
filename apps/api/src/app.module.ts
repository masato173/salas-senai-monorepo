import { Module } from '@nestjs/common';
import { ConfigModule } from './modules/config/config.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [ConfigModule, PrismaModule, HealthModule],
})
export class AppModule {}
