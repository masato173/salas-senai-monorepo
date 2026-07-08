import { Controller, Get, Query } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import type { AvailabilityResult } from './availability.service';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('availability')
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Get()
  getAvailability(
    @Query('date') date?: string,
    @Query('turno') turno?: string,
  ): Promise<AvailabilityResult> {
    const params = AvailabilityService.validateParams(date, turno);
    return this.availabilityService.getAvailability(params);
  }
}
