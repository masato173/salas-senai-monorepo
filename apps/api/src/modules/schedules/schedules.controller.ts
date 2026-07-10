import { Controller, Get } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import type { ScheduleResult } from './schedules.service';
import { Public } from '../../common/decorators/public.decorator';

// @Public: aulas são dados institucionais não-sensíveis.
// Dashboard (não-autenticado) precisa acessar este endpoint.
@Public()
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  getAll(): Promise<ScheduleResult> {
    return this.schedulesService.getAll();
  }
}
