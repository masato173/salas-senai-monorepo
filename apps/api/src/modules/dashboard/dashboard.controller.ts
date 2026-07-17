import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getStats(@Query('date') date?: string) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Parâmetro "date" é obrigatório no formato YYYY-MM-DD.');
    }
    return this.dashboardService.getStats(date);
  }
}
