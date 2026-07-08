import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

interface HealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  version: string;
}

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  @Public()
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
      version: '0.0.0-f4.0',
    };
  }
}
