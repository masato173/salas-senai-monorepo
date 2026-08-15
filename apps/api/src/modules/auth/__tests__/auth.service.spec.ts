import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { AuthService } from '../auth.service';

const mockJwtService = { sign: vi.fn() };
const mockPrisma = {
  refreshToken: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
};
const mockUsersService = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  validatePassword: vi.fn(),
  create: vi.fn(),
};

function makeService(): AuthService {
  return new AuthService(mockJwtService as never, mockPrisma as never, mockUsersService as never);
}

describe('AuthService.register()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('chama usersService.create() só com name/email/password (nunca role)', async () => {
    mockUsersService.create.mockResolvedValue({
      id: 'u1',
      name: 'Ana Souza',
      email: 'ana@senai.edu',
      role: 'PROFESSOR',
    });

    await makeService().register('Ana Souza', 'ana@senai.edu', 'senha123');

    expect(mockUsersService.create).toHaveBeenCalledTimes(1);
    expect(mockUsersService.create).toHaveBeenCalledWith({
      name: 'Ana Souza',
      email: 'ana@senai.edu',
      password: 'senha123',
    });
    const callArg = mockUsersService.create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg).not.toHaveProperty('role');
  });

  it('propaga ConflictException quando o email já existe', async () => {
    mockUsersService.create.mockRejectedValue(new ConflictException('Email já cadastrado.'));

    await expect(makeService().register('Ana Souza', 'ana@senai.edu', 'senha123')).rejects.toThrow(
      ConflictException,
    );
  });

  it('não emite tokens de sessão (sem auto-login)', async () => {
    mockUsersService.create.mockResolvedValue({
      id: 'u1',
      name: 'Ana Souza',
      email: 'ana@senai.edu',
      role: 'PROFESSOR',
    });

    const result = await makeService().register('Ana Souza', 'ana@senai.edu', 'senha123');

    expect(result).toBeUndefined();
    expect(mockJwtService.sign).not.toHaveBeenCalled();
    expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
  });
});
