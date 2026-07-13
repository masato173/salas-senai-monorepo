import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeTriggerSync } from '../useTriggerSync';
import type { BackendEnvelope } from '../../services/appsScript';
import type { SyncResult } from '@salas-senai/shared';

const SYNC_RESULT: SyncResult = {
  synced: 1522,
  fromAppsScript: 1522,
  duration: 4200,
  syncId: 'abc-123-def',
  startedAt: '2026-07-13T10:00:00.000Z',
  finishedAt: '2026-07-13T10:00:04.200Z',
  timestamp: '2026-07-13T10:00:04.200Z',
};

const mockService = { triggerSync: vi.fn() };

const OK_RES: BackendEnvelope<SyncResult> = { ok: true, data: SYNC_RESULT, error: null };
const ERR_RES: BackendEnvelope<SyncResult> = {
  ok: false,
  data: null,
  error: { code: 'INTERNAL', message: 'Erro interno.' },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('executeTriggerSync()', () => {
  it('delega ao service.triggerSync() e retorna ok=true com SyncResult', async () => {
    mockService.triggerSync.mockResolvedValue(OK_RES);
    const res = await executeTriggerSync(mockService);
    expect(mockService.triggerSync).toHaveBeenCalledOnce();
    expect(res.ok).toBe(true);
    expect(res.data?.synced).toBe(1522);
    expect(res.data?.fromAppsScript).toBe(1522);
    expect(res.data?.syncId).toBe('abc-123-def');
    expect(res.data?.duration).toBe(4200);
  });

  it('retorna INTERNAL quando service retorna ok=false', async () => {
    mockService.triggerSync.mockResolvedValue(ERR_RES);
    const res = await executeTriggerSync(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
    expect(res.error?.message).toBe('Erro interno.');
  });

  it('converte erro de rede em envelope INTERNAL', async () => {
    mockService.triggerSync.mockRejectedValue(new Error('timeout de rede'));
    const res = await executeTriggerSync(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
    expect(res.error?.message).toBe('timeout de rede');
  });

  it('propaga envelope CONFLICT quando sync já está em andamento', async () => {
    const conflictRes: BackendEnvelope<SyncResult> = {
      ok: false,
      data: null,
      error: { code: 'CONFLICT', message: 'Sincronização já está em andamento.' },
    };
    mockService.triggerSync.mockResolvedValue(conflictRes);
    const res = await executeTriggerSync(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('CONFLICT');
  });

  it('converte erro não-Error em mensagem genérica', async () => {
    mockService.triggerSync.mockRejectedValue('string error');
    const res = await executeTriggerSync(mockService);
    expect(res.ok).toBe(false);
    expect(res.error?.code).toBe('INTERNAL');
    expect(res.error?.message).toBe('Falha de rede.');
  });
});
