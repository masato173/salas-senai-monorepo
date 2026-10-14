import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConflictException, InternalServerErrorException, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import * as https from 'node:https';
import { SyncService, isAllowedRedirectTarget } from '../sync.service';

vi.mock('node:https', () => ({ request: vi.fn() }));

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

// ─── Mock de node:https (Apps Script responde /exec com um redirect 302
// para o link do resultado — ver comentário em sync.service.ts) ──
type HttpsResponseSpec = {
  status: number;
  location?: string;
  body: string;
  contentType?: string;
  // Não responde: só emite 'error' quando o signal da requisição abortar.
  hang?: boolean;
};

interface RecordedCall {
  url: URL;
  options: { method: string; headers?: Record<string, unknown>; signal?: AbortSignal };
  writes: string[];
}

function mockAppsScript(responses: HttpsResponseSpec[]): {
  writes: string[];
  calls: RecordedCall[];
} {
  const writes: string[] = [];
  const calls: RecordedCall[] = [];
  let call = 0;
  (https.request as ReturnType<typeof vi.fn>).mockImplementation(
    (url: URL, options: RecordedCall['options'], callback: (res: unknown) => void) => {
      const spec = responses[Math.min(call, responses.length - 1)];
      call++;
      const recorded: RecordedCall = { url, options, writes: [] };
      calls.push(recorded);
      const req = new EventEmitter() as EventEmitter & {
        write: (chunk: string) => void;
        end: () => void;
      };
      req.write = (chunk: string) => {
        writes.push(chunk);
        recorded.writes.push(chunk);
      };
      req.end = () => {
        if (spec.hang) {
          options.signal?.addEventListener('abort', () => {
            req.emit(
              'error',
              Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
            );
          });
          return;
        }
        const res = new EventEmitter() as EventEmitter & {
          statusCode?: number;
          headers: Record<string, string>;
          setEncoding: (enc: string) => void;
        };
        res.statusCode = spec.status;
        res.headers = {
          ...(spec.location ? { location: spec.location } : {}),
          ...(spec.contentType ? { 'content-type': spec.contentType } : {}),
        };
        res.setEncoding = () => {};
        callback(res);
        queueMicrotask(() => {
          res.emit('data', spec.body);
          res.emit('end');
        });
      };
      return req;
    },
  );
  return { writes, calls };
}

const ECHO_URL = 'https://script.googleusercontent.com/macros/echo?user_content_key=k-ficticia';
const JSON_VAZIO = { status: 200, body: JSON.stringify({ ok: true, dados: [] }) };

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

  // ── Guard: retorno vazio ──────────────────────────────────────

  describe('guard de retorno vazio (proteção de dados históricos)', () => {
    it('NAO executa deleteMany quando Apps Script retorna dados: []', async () => {
      mockAppsScript([{ status: 200, body: JSON.stringify({ ok: true, dados: [] }) }]);

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
      expect(mockScheduleDelegate.createMany).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
      expect(result.fromAppsScript).toBe(0);
    });

    it('NAO executa deleteMany quando Apps Script retorna dados ausente (undefined)', async () => {
      mockAppsScript([{ status: 200, body: JSON.stringify({ ok: true }) }]); // dados ausente → ?? [] → []

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
      expect(result.synced).toBe(0);
    });

    it('retorna SyncResult valido (com syncId, startedAt, finishedAt) mesmo no abort', async () => {
      mockAppsScript([{ status: 200, body: JSON.stringify({ dados: [] }) }]);

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(result.syncId).toBeTruthy();
      expect(result.startedAt).toBeTruthy();
      expect(result.finishedAt).toBeTruthy();
      expect(result.timestamp).toBe(result.finishedAt);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('NAO registra em AuditLog quando abortado por retorno vazio', async () => {
      mockAppsScript([{ status: 200, body: JSON.stringify({ dados: [] }) }]);

      const service = makeService();
      await service.syncSchedules('user-1');

      expect(mockAuditLogDelegate.create).not.toHaveBeenCalled();
    });
  });

  // ── Caminho feliz ─────────────────────────────────────────────

  describe('caminho feliz (dados presentes)', () => {
    it('executa deleteMany e createMany quando ha dados', async () => {
      const DADOS = [DADO_VALIDO];
      mockAppsScript([{ status: 200, body: JSON.stringify({ ok: true, dados: DADOS }) }]);
      mockScheduleDelegate.count.mockResolvedValue(1);

      const service = makeService();
      const result = await service.syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).toHaveBeenCalledOnce();
      expect(mockScheduleDelegate.createMany).toHaveBeenCalledOnce();
      expect(result.synced).toBe(1);
      expect(result.fromAppsScript).toBe(1);
    });

    it('registra em AuditLog apos sync bem-sucedido', async () => {
      mockAppsScript([{ status: 200, body: JSON.stringify({ dados: [DADO_VALIDO] }) }]);
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
      mockAppsScript([
        { status: 200, body: JSON.stringify({ dados: [{ ...DADO_VALIDO, turno: 'M' }] }) },
      ]);
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

  // ── Transporte do token (D1/D6) ─────────────────────────────────

  describe('transporte do token pro Apps Script', () => {
    it('envia o token no corpo da requisicao POST, nunca na URL', async () => {
      const { writes } = mockAppsScript([
        { status: 200, body: JSON.stringify({ ok: true, dados: [] }) },
      ]);

      const service = makeService();
      await service.syncSchedules('user-1');

      expect(https.request).toHaveBeenCalledOnce();
      const [calledUrl, calledOptions] = (https.request as ReturnType<typeof vi.fn>).mock
        .calls[0] as [URL, { method: string }];
      expect(calledOptions.method).toBe('POST');
      expect(calledUrl.toString()).not.toContain('token=');
      expect(writes[0]).toContain('test-token');
    });

    it('o primeiro POST leva action listSchedules e o token no corpo', async () => {
      const { calls } = mockAppsScript([JSON_VAZIO]);

      await makeService().syncSchedules('user-1');

      expect(JSON.parse(calls[0].writes.join(''))).toEqual({
        action: 'listSchedules',
        token: 'test-token',
      });
    });
  });

  // ── Redirecionamento do Apps Script (#1, ensaio local) ───────────
  // O Apps Script executa no primeiro POST e responde 302 com o link do
  // resultado. 301/302/303 → a próxima requisição é GET, sem corpo;
  // 307/308 mantêm método e corpo.
  describe('redirecionamento do Apps Script', () => {
    it.each([301, 302, 303])(
      '%i → segue com GET, sem corpo e sem Content-Type/Content-Length, para o Location',
      async status => {
        const { calls } = mockAppsScript([{ status, location: ECHO_URL, body: '' }, JSON_VAZIO]);

        await makeService().syncSchedules('user-1');

        expect(calls).toHaveLength(2);
        expect(calls[0].options.method).toBe('POST');
        expect(calls[1].options.method).toBe('GET');
        expect(calls[1].url.toString()).toBe(ECHO_URL);
        expect(calls[1].writes).toEqual([]);
        const headerNames = Object.keys(calls[1].options.headers ?? {}).map(h => h.toLowerCase());
        expect(headerNames).not.toContain('content-type');
        expect(headerNames).not.toContain('content-length');
      },
    );

    it('Location relativo é resolvido contra a URL atual', async () => {
      const { calls } = mockAppsScript([
        { status: 302, location: 'https://script.google.com/macros/s/x/exec', body: '' },
        { status: 302, location: '/macros/echo?x=1', body: '' },
        JSON_VAZIO,
      ]);

      await makeService().syncSchedules('user-1');

      expect(calls[2].url.toString()).toBe('https://script.google.com/macros/echo?x=1');
      expect(calls[2].options.method).toBe('GET');
    });

    it.each([307, 308])('%i → mantém POST com o mesmo corpo', async status => {
      const { calls } = mockAppsScript([{ status, location: ECHO_URL, body: '' }, JSON_VAZIO]);

      await makeService().syncSchedules('user-1');

      expect(calls[1].options.method).toBe('POST');
      expect(calls[1].writes.join('')).toBe(calls[0].writes.join(''));
    });

    it('JSON válido depois do 302 → fluxo atual (DELETE + INSERT)', async () => {
      mockAppsScript([
        { status: 302, location: ECHO_URL, body: '' },
        { status: 200, body: JSON.stringify({ ok: true, dados: [DADO_VALIDO] }) },
      ]);
      mockScheduleDelegate.count.mockResolvedValue(1);

      const result = await makeService().syncSchedules('user-1');

      expect(mockScheduleDelegate.deleteMany).toHaveBeenCalledOnce();
      expect(mockScheduleDelegate.createMany).toHaveBeenCalledOnce();
      expect(result.synced).toBe(1);
    });

    it('mais de 5 redirecionamentos → erro "redirecionamentos demais", sem 7ª requisição', async () => {
      const { calls } = mockAppsScript([{ status: 302, location: ECHO_URL, body: '' }]);

      await expect(makeService().syncSchedules('user-1')).rejects.toThrow(
        'redirecionamentos demais',
      );
      expect(calls).toHaveLength(6);
      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
    });

    it('3xx sem Location → erro claro', async () => {
      mockAppsScript([{ status: 302, body: '' }]);

      await expect(makeService().syncSchedules('user-1')).rejects.toThrow('sem header Location');
    });

    it.each([
      'http://script.googleusercontent.com/macros/echo?x=1',
      'https://evil.example.com/macros/echo?x=1',
      'https://evilgoogle.com/macros/x',
      'https://google.com.evil.io/macros/x',
    ])('Location para destino não permitido (%s) → erro, sem seguir', async location => {
      const { calls } = mockAppsScript([{ status: 302, location, body: '' }, JSON_VAZIO]);

      const err = (await makeService()
        .syncSchedules('user-1')
        .catch((e: unknown) => e)) as Error;

      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect(err.message).toContain('destino não permitido');
      expect(err.message).not.toContain('/macros'); // só protocolo//host, nunca a URL inteira
      expect(calls).toHaveLength(1);
      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('isAllowedRedirectTarget', () => {
    it.each([
      ['https://script.google.com/macros/s/x/exec', true],
      ['https://script.googleusercontent.com/macros/echo?x=1', true],
      ['https://google.com/', true],
      ['https://googleusercontent.com/', true],
      ['http://script.google.com/', false],
      ['https://evilgoogle.com/', false],
      ['https://google.com.evil.io/', false],
      ['https://script.googleusercontent.com.evil.io/', false],
      ['https://example.com/', false],
    ])('%s → %s', (url, expected) => {
      expect(isAllowedRedirectTarget(new URL(url))).toBe(expected);
    });
  });

  describe('resposta final do Apps Script', () => {
    it('corpo não-JSON → erro com status e content-type, SEM o corpo, e sem DELETE', async () => {
      mockAppsScript([
        { status: 302, location: ECHO_URL, body: '' },
        {
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: '<!DOCTYPE html><html><body>pagina de erro corpo-secreto</body></html>',
        },
      ]);

      const err = (await makeService()
        .syncSchedules('user-1')
        .catch((e: unknown) => e)) as Error;

      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect(err.message).toContain('status 200');
      expect(err.message).toContain('text/html');
      expect(err.message).not.toContain('<!DOCTYPE');
      expect(err.message).not.toContain('corpo-secreto');
      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
    });

    it('status final fora de 2xx → erro com o status, sem DELETE', async () => {
      mockAppsScript([
        {
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ dados: [DADO_VALIDO] }),
        },
      ]);

      await expect(makeService().syncSchedules('user-1')).rejects.toThrow('status 500');
      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
    });
  });

  describe('prazo total da busca', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('Apps Script não responde → erro depois de 60 s e o lock é liberado', async () => {
      vi.useFakeTimers();
      mockAppsScript([{ status: 200, body: '', hang: true }]);
      const service = makeService();

      const pending = service.syncSchedules('user-1').catch((e: unknown) => e);
      await vi.advanceTimersByTimeAsync(60_000);
      const err = (await pending) as Error;

      expect(err).toBeInstanceOf(InternalServerErrorException);
      expect(err.message).toContain('não respondeu em 60 s');
      vi.useRealTimers();

      // Lock liberado: a próxima execução não recebe 409.
      mockAppsScript([JSON_VAZIO]);
      await expect(service.syncSchedules('user-1')).resolves.toBeDefined();
    });
  });

  describe('o token nunca aparece em erro nem em log', () => {
    const cenarios: [string, HttpsResponseSpec[]][] = [
      ['não-JSON', [{ status: 200, contentType: 'text/html', body: '<!DOCTYPE html>test-token' }]],
      ['status 500', [{ status: 500, body: 'erro test-token' }]],
      [
        'destino não permitido',
        [{ status: 302, location: 'https://evil.example.com/?t=test-token', body: '' }],
      ],
      ['sem Location', [{ status: 302, body: '' }]],
      ['redirecionamentos demais', [{ status: 307, location: ECHO_URL, body: '' }]],
      ['erro do Apps Script', [{ status: 200, body: JSON.stringify({ error: 'Acesso negado.' }) }]],
    ];

    it.each(cenarios)('%s', async (_nome, responses) => {
      const spies = [
        vi.spyOn(Logger.prototype, 'log'),
        vi.spyOn(Logger.prototype, 'warn'),
        vi.spyOn(Logger.prototype, 'error'),
      ];
      mockAppsScript(responses);

      const err = (await makeService()
        .syncSchedules('user-1')
        .catch((e: unknown) => e)) as Error;

      expect(err).toBeInstanceOf(Error);
      expect(err.message).not.toContain('test-token');
      for (const spy of spies) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain('test-token');
        spy.mockRestore();
      }
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
      mockAppsScript([
        { status: 200, body: JSON.stringify({ error: 'Unauthorized', dados: undefined }) },
      ]);

      const service = makeService();
      await expect(service.syncSchedules('user-1')).rejects.toThrow(InternalServerErrorException);
      // Deve lancar ANTES de tentar deleteMany
      expect(mockScheduleDelegate.deleteMany).not.toHaveBeenCalled();
    });
  });
});
