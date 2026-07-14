import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncSchedulerService } from './sync-scheduler.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // ScheduleModule.forFeature() não existe — o forRoot() fica no AppModule.
    // Importamos UsersModule para que UsersRepository esteja disponível
    // no SyncSchedulerService via injeção de dependência.
    UsersModule,
  ],
  controllers: [SyncController],
  providers: [SyncService, SyncSchedulerService],
})
export class SyncModule {}
