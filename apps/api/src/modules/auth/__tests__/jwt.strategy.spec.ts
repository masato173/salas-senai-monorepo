import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtStrategy, type JwtPayload } from '../strategies/jwt.strategy';

// Issue 6 — o papel efetivo da requisição vem do BANCO, não do token: rebaixar
// um ADMIN/COORDENADOR vale na próxima requisição, sem esperar o access token
// (até 15 min) expirar. Mesmo efeito imediato que desativar a conta já tinha.

const mockRepo = { findById: vi.fn() };
const mockConfig = { getOrThrow: vi.fn(() => 'segredo-de-teste-com-mais-de-32-caracteres') };

function makeStrategy(): JwtStrategy {
  return new JwtStrategy(mockConfig as never, mockRepo as never);
}

function dbUser(overrides: { role?: Role; active?: boolean; email?: string } = {}) {
  return {
    id: 'user-1',
    name: 'Usuário Ficticio',
    email: overrides.email ?? 'atual@senai.edu',
    passwordHash: 'hash',
    role: overrides.role ?? Role.PROFESSOR,
    active: overrides.active ?? true,
  };
}

// Token emitido quando o usuário ainda era ADMIN, com o e-mail antigo.
const payload: JwtPayload = { sub: 'user-1', email: 'antigo@senai.edu', role: 'ADMIN' };

describe('JwtStrategy.validate — papel efetivo vem do banco (issue 6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('token diz ADMIN e o banco diz PROFESSOR → devolve PROFESSOR', async () => {
    mockRepo.findById.mockResolvedValue(dbUser({ role: Role.PROFESSOR }));

    const user = await makeStrategy().validate(payload);

    expect(user.role).toBe(Role.PROFESSOR);
    expect(user.userId).toBe('user-1');
  });

  it('e-mail também vem do banco, não do token', async () => {
    mockRepo.findById.mockResolvedValue(dbUser({ email: 'atual@senai.edu' }));

    const user = await makeStrategy().validate(payload);

    expect(user.email).toBe('atual@senai.edu');
  });

  it('mesmo token, papel alterado no banco entre duas chamadas → reflete na hora, sem novo login', async () => {
    const strategy = makeStrategy();
    mockRepo.findById.mockResolvedValueOnce(dbUser({ role: Role.COORDENADOR }));
    mockRepo.findById.mockResolvedValueOnce(dbUser({ role: Role.PROFESSOR }));

    const antes = await strategy.validate(payload);
    const depois = await strategy.validate(payload);

    expect(antes.role).toBe(Role.COORDENADOR);
    expect(depois.role).toBe(Role.PROFESSOR);
  });

  it('não faz consulta extra: uma busca por id por requisição', async () => {
    mockRepo.findById.mockResolvedValue(dbUser());

    await makeStrategy().validate(payload);

    expect(mockRepo.findById).toHaveBeenCalledTimes(1);
    expect(mockRepo.findById).toHaveBeenCalledWith('user-1');
  });

  it('usuário inexistente → UnauthorizedException', async () => {
    mockRepo.findById.mockResolvedValue(null);

    await expect(makeStrategy().validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('usuário inativo → UnauthorizedException', async () => {
    mockRepo.findById.mockResolvedValue(dbUser({ active: false }));

    await expect(makeStrategy().validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
