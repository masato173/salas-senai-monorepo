import { Controller, Get, Query } from '@nestjs/common';
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
  getAll(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<ScheduleResult> {
    // Mesma regra de GET /reservations: só inteiro positivo vira parâmetro
    // válido; qualquer outra coisa vira undefined e o service cai no teto.
    const resolvedPage = page !== undefined && /^\d+$/.test(page) ? Number(page) : undefined;
    const resolvedPageSize =
      pageSize !== undefined && /^\d+$/.test(pageSize) ? Number(pageSize) : undefined;

    return this.schedulesService.getAll({ page: resolvedPage, pageSize: resolvedPageSize });
  }
}
