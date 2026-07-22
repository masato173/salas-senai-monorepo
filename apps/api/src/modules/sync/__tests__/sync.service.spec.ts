import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import { SyncService } from '../sync.service';

// ─── Mock do PrismaService ────────────────────────────────────
const mockScheduleDelegate = {
  deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  createMany: vi.fn().mockResolvedValue({ count: 0 }),
  count: vi.fn().mockResolvedValue(0),
};

const mockAuditLogDelegate = {
  create: vi.fn().mockResolvedValue({}),
};

const mockPrisma = {
  schedule: mockScheduleDelegate,
  auditLog: mockAuditLogDelegate,
};

// ─── Mock do ConfigService ────────────────────────────────────
const mockConfig = {
  get: vi.fn((key: string) => {
    if (key === 'APPS_SCRIPT_URL') return 'http://apps-script.example.com/exec';
    if (key === 'APPS_SCRIPT_TOKEN') return 'test-token';
    return undefined;
  }),
};

// ─── Fábrica ─────────────────────────────────────────────────
function makeService(): SyncService {
  // Reseta o lock estático entre testes
  (SyncService as unknown as { isRunning: boolean }).isRunning = false;
  return new SyncService(mockPrisma as never, mockConfig as never);
}

// ─── Payload de dados válido ──────────────────────────────────
const DADO_VALIDO = {
  data: '2026-07-22',
  sala: '01 Sala',
  turma: 'INF-2A',
  mes: 'Julho',
  turno: 'M',
};

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (SyncService as unknown as { isRunning: boolean }).isRunning = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Guard: retorno vazio ──────────────────────────────────────

  describe('guard de retorno vazio (proteção de dados históricos)', () => {
    it('NAO executa deleteMany quando Apps Script retorna dados: []', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ ok: true, dados: [] }),
        }),
      );

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
      expect(mockScheduleDelegate.createMany).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.fromAppsScript).toBe(0);
    });

    it('NAO executa deleteMany quando Apps Script retorna dados ausente (undefined)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ ok: true }), // dados ausente → ?? [] → []
        }),
      );

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
    });

    it('retorna SyncResult valido (com syncId, startedAt, finishedAt) mesmo no abort', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ dados: [] }),
        }),
      );

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(result.syncId).toBeTruthy();
      expect(result.startedAt).toBeTruthy();
      expect(result.finishedAt).toBeTruthy();
      expect(result.timestamp).toBe(result.finishedAt);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('NAO registra em AuditLog quando abortado por retorno vazio', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ dados: [] }),
        }),
      );

      const service = makeService();
      await service.syncSchedules('user-1');

      expect(mockAuditLogDelegate.create).not.toHaveBeenCalled();
    });
  });

  // ── Caminho feliz ─────────────────────────────────────────────

  describe('caminho feliz (dados presentes)', () => {
    it('executa deleteMany e createMany quando ha dados', async () => {
      const DADOS = [DADO_VALIDO];
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ ok: true, dados: DADOS }),
        }),
      );
      mockScheduleDelegate.count.mockResolvedValue(1);

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).toHaveBeenCalledOnce();
      expect(mockScheduleDelegate.createMany).toHaveBeenCalledOnce();
      expect(result.synced).toBe(1);
      expect(result.fromAppsScript).toBe(1);
    });

    it('registra em AuditLog apos sync bem-sucedido', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ dados: [DADO_VALIDO] }),
        }),
      );
      mockScheduleDelegate.count.mockResolvedValue(1);

      const service = makeService();
      await service.syncSchedules('user-1');

      expect(mockAuditLogDelegate.create).toHaveBeenCalledOnce();
      const callArgs = mockAuditLogDelegate.create.mock.calls[0][0] as {
        data: { action: string; entityType: string; userId: string };
      };
      expect(callArgs.data.action).toBe('SYNC_SCHEDULES');
      expect(callArgs.data.entityType).toBe('Schedule');
      expect(callArgs.data.userId).toBe('user-1');
    });

    it('mapeia turno M para inicio 07:00 e fim 12:30 no createMany', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ dados: [{ ...DADO_VALIDO, turno: 'M' }] }),
        }),
      );
      mockScheduleDelegate.count.mockResolvedValue(1);

      const service = makeService();
      await service.syncSchedules('user-1');

      const createArgs = mockScheduleDelegate.createMany.mock.calls[0][0] as {
        data: { inicio: string; fim: string }[];
      };
      expect(createArgs.data[0].inicio).toBe('07:00');
      expect(createArgs.data[0].fim).toBe('12:30');
    });
  });

  // ── Lock concorrente ──────────────────────────────────────────

  describe('lock de execucao concorrente', () => {
    it('lanca ConflictException quando ja esta em andamento', async () => {
      const service = makeService();
      // Simula lock ativo APÓS criação do service (makeService reseta o lock)
      (SyncService as unknown as { isRunning: boolean }).isRunning = true;

      await expect(service.syncSchedules('user-1')).rejects.toThrow(ConflictException);
    });
  });

  // ── Erros de configuracao ─────────────────────────────────────

  describe('erros de configuracao', () => {
    it('lanca InternalServerErrorException quando APPS_SCRIPT_URL ausente', async () => {
      const configSemUrl = { get: vi.fn().mockReturnValue(undefined) };
      (SyncService as unknown as { isRunning: boolean }).isRunning = false;
      const service = new SyncService(mockPrisma as never, configSemUrl as never);

      await expect(service.syncSchedules('user-1')).rejects.toThrow(InternalServerErrorException);
    });

    it('lanca InternalServerErrorException quando Apps Script retorna campo error', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          json: () => Promise.resolve({ error: 'Unauthorized', dados: undefined }),
        }),
      );

      const service = makeService();
      await expect(service.syncSchedules('user-1')).rejects.toThrow(InternalServerErrorException);
      // Deve lancar ANTES de tentar deleteMany
      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
    });
  });
});
