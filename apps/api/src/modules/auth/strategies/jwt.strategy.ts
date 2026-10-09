import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersRepository } from '../../users/users.repository';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export interface RequestUser {
  userId: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersRepository: UsersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Issue 6 — o token só identifica (sub); papel e e-mail vêm do usuário já
  // carregado do banco. Rebaixar um ADMIN/COORDENADOR vale na próxima
  // requisição, sem esperar o access token expirar — mesmo efeito imediato
  // que desativar a conta já tinha. Sem consulta extra: é a mesma busca que
  // já checava `active`.
  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.usersRepository.findById(payload.sub);
    if (!user?.active) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }
    return { userId: user.id, email: user.email, role: user.role };
  }
}
