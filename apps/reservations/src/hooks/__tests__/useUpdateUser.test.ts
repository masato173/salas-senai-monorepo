import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeUpdateRole, executeSetActive } from '../useUpdateUser';
import type { AdminUser } from '../../types';

const USER: AdminUser = {
  id: 'u1',
  name: 'Ana Lima',
  email: 'ana@senai.br',
  role: 'PROFESSOR',
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const mockService = {
  updateUserRole: vi.fn(),
  setUserActive: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeUpdateRole()', () => {
  it('retorna usuário atualizado em caso de sucesso', async () => {
    const updated = { ...USER, role: 'ADMIN' as const };
    mockService.updateUserRole.mockResolvedValue({ ok: true, data: updated, error: null });
    const res = await executeUpdateRole(mockService, 'u1', 'ADMIN');
    expect(res.ok).toBe(true);
    expect(res.data?.role).toBe('ADMIN');
  });

  it('passa id e role ao service', async () => {
    mockService.updateUserRole.mockResolvedValue({ ok: true, data: USER, error: null });
    await executeUpdateRole(mockService, 'u1', 'COORDENADOR');
    expect(mockService.updateUserRole).toHaveBeenCalledWith('u1', 'COORDENADOR');
  });

  it('retorna ok=false em caso de erro do backend', async () => {
    mockService.updateUserRole.mockResolvedValue({
      ok: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
    });
    const res = await executeUpdateRole(mockService, 'u99', 'ADMIN');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('NOT_FOUND');
  });

  it('envolve exceção de rede em envelope INTERNAL', async () => {
    mockService.updateUserRole.mockRejectedValue(new Error('network fail'));
    const res = await executeUpdateRole(mockService, 'u1', 'ADMIN');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
    expect(res.error?.message).toBe('network fail');
  });

  it('envolve exceção não-Error em envelope INTERNAL', async () => {
    mockService.updateUserRole.mockRejectedValue('string error');
    const res = await executeUpdateRole(mockService, 'u1', 'ADMIN');
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
  });
});

describe('executeSetActive()', () => {
  it('retorna usuário desativado em caso de sucesso', async () => {
    const deactivated = { ...USER, active: false };
    mockService.setUserActive.mockResolvedValue({ ok: true, data: deactivated, error: null });
    const res = await executeSetActive(mockService, 'u1', false);
    expect(res.ok).toBe(true);
    expect(res.data?.active).toBe(false);
  });

  it('passa id e isActive ao service', async () => {
    mockService.setUserActive.mockResolvedValue({ ok: true, data: USER, error: null });
    await executeSetActive(mockService, 'u1', false);
    expect(mockService.setUserActive).toHaveBeenCalledWith('u1', false);
  });

  it('envolve exceção de rede em envelope INTERNAL', async () => {
    mockService.setUserActive.mockRejectedValue(new Error('timeout'));
    const res = await executeSetActive(mockService, 'u1', true);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
    expect(res.error?.message).toBe('timeout');
  });
});
