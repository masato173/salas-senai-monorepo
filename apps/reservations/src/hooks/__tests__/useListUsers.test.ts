import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeListUsers } from '../useListUsers';
import type { UserListParams } from '../../types';

const BASE_PARAMS: UserListParams = { page: 1, limit: 20 };

const USER_ROW = {
  id: 'u1',
  name: 'Ana Lima',
  email: 'ana@senai.br',
  role: 'PROFESSOR' as const,
  active: true,
  createdAt: '2026-07-01T00:00:00.000Z',
};

const PAGINATED_OK = {
  ok: true,
  data: { data: [USER_ROW], total: 1, page: 1, limit: 20 },
  error: null,
};

const mockService = { listUsers: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeListUsers()', () => {
  it('retorna dados paginados em caso de sucesso', async () => {
    mockService.listUsers.mockResolvedValue(PAGINATED_OK);
    const res = await executeListUsers(mockService, BASE_PARAMS);
    expect(res.ok).toBe(true);
    expect(res.data?.total).toBe(1);
    expect(res.data?.data[0]?.name).toBe('Ana Lima');
  });

  it('passa signal ao service quando fornecido', async () => {
    mockService.listUsers.mockResolvedValue(PAGINATED_OK);
    const ctrl = new AbortController();
    await executeListUsers(mockService, BASE_PARAMS, ctrl.signal);
    expect(mockService.listUsers).toHaveBeenCalledWith(BASE_PARAMS, ctrl.signal);
  });

  it('não passa signal quando undefined', async () => {
    mockService.listUsers.mockResolvedValue(PAGINATED_OK);
    await executeListUsers(mockService, BASE_PARAMS);
    expect(mockService.listUsers).toHaveBeenCalledWith(BASE_PARAMS, undefined);
  });

  it('retorna ok=false em caso de erro do backend', async () => {
    mockService.listUsers.mockResolvedValue({
      ok: false,
      data: null,
      error: { code: 'INTERNAL', message: 'Falha ao listar.' },
    });
    const res = await executeListUsers(mockService, BASE_PARAMS);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
  });

  it('chama o service exatamente 1 vez', async () => {
    mockService.listUsers.mockResolvedValue(PAGINATED_OK);
    await executeListUsers(mockService, BASE_PARAMS);
    expect(mockService.listUsers).toHaveBeenCalledTimes(1);
  });

  it('repassa role e search nos params', async () => {
    mockService.listUsers.mockResolvedValue(PAGINATED_OK);
    const params: UserListParams = { page: 1, limit: 10, role: 'ADMIN', search: 'Ana' };
    await executeListUsers(mockService, params);
    expect(mockService.listUsers).toHaveBeenCalledWith(params, undefined);
  });
});
