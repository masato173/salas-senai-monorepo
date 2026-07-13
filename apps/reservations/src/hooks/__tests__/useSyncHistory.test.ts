import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSyncHistory } from '../useSyncHistory';
import type { AuditLog, PaginatedResponse, AuditQuery } from '../../types';

const AUDIT_LOG: AuditLog = {
  id: 'log-001',
  action: 'SYNC_SCHEDULES',
  entityType: 'Schedule',
  entityId: 'abc-123-def',
  userId: 'user-admin-1',
  before: null,
  after: { synced: 1522, fromAppsScript: 1522, duration: 4200 },
  ip: null,
  timestamp: '2026-07-13T10:00:04.200Z',
  user: { id: 'user-admin-1', name: 'Admin SENAI', email: 'admin@senai.edu' },
};

const PAGED: PaginatedResponse<AuditLog> = {
  data: [AUDIT_LOG],
  total: 1,
  page: 1,
  limit: 10,
};

const OK_RES = { ok: true, data: PAGED, error: null };
const ERR_RES = { ok: false, data: null, error: { code: 'INTERNAL' as const, message: 'Erro.' } };

const mockService = { listAuditLogs: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeSyncHistory()', () => {
  it('chama listAuditLogs com action=SYNC_SCHEDULES, page=1, limit=10', async () => {
    mockService.listAuditLogs.mockResolvedValue(OK_RES);
    await executeSyncHistory(mockService);
    const q = mockService.listAuditLogs.mock.calls[0]?.[0] as AuditQuery;
    expect(q.action).toBe('SYNC_SCHEDULES');
    expect(q.page).toBe(1);
    expect(q.limit).toBe(10);
  });

  it('retorna histórico de syncs quando ok=true', async () => {
    mockService.listAuditLogs.mockResolvedValue(OK_RES);
    const res = await executeSyncHistory(mockService);
    expect(res.ok).toBe(true);
    expect(res.data?.data[0]?.action).toBe('SYNC_SCHEDULES');
    expect(res.data?.data[0]?.entityType).toBe('Schedule');
    expect(res.data?.total).toBe(1);
  });

  it('retorna envelope de erro quando ok=false', async () => {
    mockService.listAuditLogs.mockResolvedValue(ERR_RES);
    const res = await executeSyncHistory(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
  });

  it('passa AbortSignal para o service', async () => {
    mockService.listAuditLogs.mockResolvedValue(OK_RES);
    const controller = new AbortController();
    await executeSyncHistory(mockService, controller.signal);
    expect(mockService.listAuditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SYNC_SCHEDULES' }),
      controller.signal,
    );
  });

  it('passa undefined como signal quando nenhum é fornecido', async () => {
    mockService.listAuditLogs.mockResolvedValue(OK_RES);
    await executeSyncHistory(mockService);
    const callArgs = mockService.listAuditLogs.mock.calls[0];
    expect(callArgs?.[1]).toBeUndefined();
  });

  it('campos do AuditLog do sync têm before=null e after com métricas', async () => {
    mockService.listAuditLogs.mockResolvedValue(OK_RES);
    const res = await executeSyncHistory(mockService);
    const log = res.data?.data[0];
    expect(log?.before).toBeNull();
    expect(log?.after).toEqual(expect.objectContaining({ synced: 1522, duration: 4200 }));
  });
});
