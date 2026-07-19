import { Controller, Post, Body, HttpCode, HttpStatus, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { RefreshDto } from './dtos/refresh.dto';
import { Public } from '../../common/decorators/public.decorator';

interface AuthRequest {
  user: { userId: string };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // F9.2 — limite restrito contra brute force de credenciais (ttl em ms)
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  // F9.2 — mesmo limite do login: refresh token também é alvo de força bruta
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Request() req: AuthRequest): Promise<void> {
    await this.authService.logout(req.user.userId);
  }
}
