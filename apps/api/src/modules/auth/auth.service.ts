import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './strategies/jwt.strategy';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: { id: string; name: string; email: string; role: string };
}

const REFRESH_EXPIRES_DAYS = 7;

@Injectable()
export class AuthService {
  // F9.4 — eventos de autenticação logados de forma estruturada (via Pino).
  // Nunca logar senha nem token — apenas email/userId e o resultado.
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.usersService.findByEmail(email);
    if (!user?.active) {
      this.logger.warn(`login falhou (usuário inexistente ou inativo) email=${email}`);
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const valid = await this.usersService.validatePassword(password, user.passwordHash);
    if (!valid) {
      this.logger.warn(`login falhou (senha incorreta) email=${email}`);
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    const tokens = await this.issueTokenPair(user.id, user.email, user.role);
    this.logger.log(`login ok email=${email} userId=${user.id}`);
    return {
      ...tokens,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    };
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!stored) {
      this.logger.warn('refresh falhou (token inválido, expirado ou revogado)');
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const user = await this.usersService.findById(stored.userId);
    if (!user?.active) {
      this.logger.warn(`refresh falhou (usuário inexistente ou inativo) userId=${stored.userId}`);
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }
    this.logger.log(`refresh ok email=${user.email} userId=${user.id}`);
    return this.issueTokenPair(user.id, user.email, user.role);
  }

  async logout(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    this.logger.log(`logout ok userId=${userId}`);
  }

  private async issueTokenPair(userId: string, email: string, role: string): Promise<TokenPair> {
    const payload: JwtPayload = { sub: userId, email, role };
    const accessToken = this.jwtService.sign(payload);
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
    await this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
    return { accessToken, refreshToken: rawToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
