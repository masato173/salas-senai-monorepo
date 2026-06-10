import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAppsScriptService,
  type CreateReservationRequest,
  type CreateReservationRangeRequest,
  type CancelReservationRequest,
} from '../appsScript';

const MOCK_PAYLOAD = {
  ok: true,
  total: 2,
  dados: [
    { data: '2026-06-15', sala: '603 Sala', turma: 'APB.OPL.015', mes: 'Junho' },
    { data: '2026-06-15', sala: '607 Sala', turma: 'APB.ADM.148', mes: 'Junho' },
  ],
  turnoMap: { 'APB.OPL.015': 'V', 'APB.ADM.148': 'M' },
};

describe('createAppsScriptService()', () => {
  const config = { url: 'https://script.google.com/exec', token: 'test' };

  beforeEach(() => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve(MOCK_PAYLOAD),
    } as Response);
  });

  afterEach(() => {vi.restoreAllMocks()});

  it('busca e normaliza dados corretamente', async () => {
    const svc = createAppsScriptService(config);
    const result = await svc.fetchSchedule();
    expect(result.registros).toHaveLength(2);
    expect(result.turnoMap['APB.OPL.015']).toBe('V');
  });

  it('enriquece registro com turno do map', async () => {
    const svc = createAppsScriptService(config);
    const result = await svc.fetchSchedule();
    const reg = result.registros.find(r => r.turma === 'APB.OPL.015');
    expect(reg?.turno).toBe('V');
  });

  it('registros sem turno ficam com null', async () => {
    const svc = createAppsScriptService(config);
    const result = await svc.fetchSchedule();
    // APB.ADM.148 está no turnoMap como 'M'
    const reg = result.registros.find(r => r.turma === 'APB.ADM.148');
    expect(reg?.turno).toBe('M');
  });

  it('lança erro amigável se API retornar error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ error: 'Acesso negado.' }),
    } as Response);
    const svc = createAppsScriptService(config);
    await expect(svc.fetchSchedule()).rejects.toThrow('Falha ao carregar dados.');
  });

  it('retorna listas vazias se campos ausentes no payload', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
    } as Response);
    const svc = createAppsScriptService(config);
    const result = await svc.fetchSchedule();
    expect(result.registros).toEqual([]);
    expect(result.turnoMap).toEqual({});
  });

  it('sanitiza campos de texto contra XSS', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({
        ok: true,
        dados: [{ data: '2026-06-15', sala: '<script>xss</script>', turma: 'APB.X', mes: 'Junho' }],
        turnoMap: {},
      }),
    } as Response);
    const svc = createAppsScriptService(config);
    const result = await svc.fetchSchedule();
    expect(result.registros[0].sala).not.toContain('<script>');
    expect(result.registros[0].sala).toBe('&lt;script&gt;xss&lt;/script&gt;');
  });
});

// ─────────────────────────────────────────────────────────────
// createReservation — POST text/plain, envelope { ok, data, error }
// ─────────────────────────────────────────────────────────────

const VALID_REQUEST: CreateReservationRequest = {
  userEmail: 'professor@senai.edu',
  payload: {
    sala:       '603 Sala',
    data:       '2026-12-10',
    inicio:     '08:00',
    fim:        '10:00',
    professor:  'Fulano',
    turma:      'ADS-A',
    observacao: '',
  },
};

const OK_ENVELOPE = {
  ok:    true,
  data:  { id: 'reserva-42' },
  error: null,
};

const CONFLICT_ENVELOPE = {
  ok:    false,
  data:  null,
  error: { code: 'CONFLICT', message: 'Já existe reserva no horário.' },
};

describe('createAppsScriptService().createReservation()', () => {
  const config = { url: 'https://script.google.com/macros/s/abc/exec', token: 'test' };

  function mockFetchOnce(payload: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(payload),
    } as Response);
  }

  afterEach(() => {vi.restoreAllMocks()});

  it('envia POST com Content-Type text/plain para evitar preflight CORS', async () => {
    const fetchSpy = mockFetchOnce(OK_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.createReservation(VALID_REQUEST);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(config.url);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toMatch(/^text\/plain/i);
  });

  it('serializa body com action, clientRequestId, userEmail e payload', async () => {
    const fetchSpy = mockFetchOnce(OK_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.createReservation({ ...VALID_REQUEST, clientRequestId: 'fixed-uuid-1' });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.action).toBe('createReservation');
    expect(body.clientRequestId).toBe('fixed-uuid-1');
    expect(body.userEmail).toBe('professor@senai.edu');
    expect(body.payload.sala).toBe('603 Sala');
    expect(body.payload.inicio).toBe('08:00');
  });

  it('gera clientRequestId via crypto.randomUUID se não fornecido', async () => {
    const fetchSpy = mockFetchOnce(OK_ENVELOPE);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
    const svc = createAppsScriptService(config);

    await svc.createReservation(VALID_REQUEST);

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.clientRequestId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('retorna envelope ok=true intacto em sucesso', async () => {
    mockFetchOnce(OK_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.createReservation(VALID_REQUEST);

    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ id: 'reserva-42' });
    expect(result.error).toBeNull();
  });

  it('retorna envelope ok=false intacto em CONFLICT (não lança)', async () => {
    mockFetchOnce(CONFLICT_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.createReservation(VALID_REQUEST);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('CONFLICT');
    expect(result.error?.message).toContain('Já existe');
  });

  it('propaga falha de rede como rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network down'));
    const svc = createAppsScriptService(config);

    await expect(svc.createReservation(VALID_REQUEST)).rejects.toThrow('Network down');
  });
});

// ─────────────────────────────────────────────────────────────
// createReservationRange — POST text/plain, envelope com count+reservations
// ─────────────────────────────────────────────────────────────

const VALID_RANGE_REQUEST: CreateReservationRangeRequest = {
  userEmail: 'professor@senai.edu',
  payload: {
    sala:       '603 Sala',
    dataInicio: '2026-12-10',
    dataFim:    '2026-12-15',
    diasSemana: [2, 4],
    inicio:     '08:00',
    fim:        '10:00',
    professor:  'Fulano',
    turma:      'ADS-A',
    observacao: '',
  },
};

const OK_RANGE_ENVELOPE = {
  ok:   true,
  data: {
    count: 2,
    reservations: [
      { id: 'r-1', sala: '603 Sala', data: '2026-12-10', inicio: '08:00', fim: '10:00' },
      { id: 'r-2', sala: '603 Sala', data: '2026-12-15', inicio: '08:00', fim: '10:00' },
    ],
  },
  error: null,
};

const CONFLICT_RANGE_ENVELOPE = {
  ok:    false,
  data:  null,
  error: {
    code:    'CONFLICT',
    message: 'Conflito em 2 data(s).',
    details: { conflicts: ['2026-12-10', '2026-12-15'] },
  },
};

describe('createAppsScriptService().createReservationRange()', () => {
  const config = { url: 'https://script.google.com/macros/s/abc/exec', token: 'test' };

  function mockFetchOnce(payload: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(payload),
    } as Response);
  }

  afterEach(() => { vi.restoreAllMocks(); });

  it('envia POST com Content-Type text/plain para evitar preflight CORS', async () => {
    const fetchSpy = mockFetchOnce(OK_RANGE_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.createReservationRange(VALID_RANGE_REQUEST);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(config.url);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toMatch(/^text\/plain/i);
  });

  it('serializa body com action=createReservationRange e campos dataInicio/dataFim/diasSemana', async () => {
    const fetchSpy = mockFetchOnce(OK_RANGE_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.createReservationRange({ ...VALID_RANGE_REQUEST, clientRequestId: 'fixed-uuid-1' });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.action).toBe('createReservationRange');
    expect(body.clientRequestId).toBe('fixed-uuid-1');
    expect(body.userEmail).toBe('professor@senai.edu');
    expect(body.payload.sala).toBe('603 Sala');
    expect(body.payload.dataInicio).toBe('2026-12-10');
    expect(body.payload.dataFim).toBe('2026-12-15');
    expect(body.payload.diasSemana).toEqual([2, 4]);
    expect(body.payload.inicio).toBe('08:00');
  });

  it('gera clientRequestId via crypto.randomUUID se não fornecido', async () => {
    const fetchSpy = mockFetchOnce(OK_RANGE_ENVELOPE);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
    const svc = createAppsScriptService(config);

    await svc.createReservationRange(VALID_RANGE_REQUEST);

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.clientRequestId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('retorna envelope ok=true intacto em sucesso (count + reservations)', async () => {
    mockFetchOnce(OK_RANGE_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.createReservationRange(VALID_RANGE_REQUEST);

    expect(result.ok).toBe(true);
    expect(result.data?.count).toBe(2);
    expect(result.data?.reservations).toHaveLength(2);
    expect(result.error).toBeNull();
  });

  it('retorna envelope ok=false intacto em CONFLICT com details.conflicts', async () => {
    mockFetchOnce(CONFLICT_RANGE_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.createReservationRange(VALID_RANGE_REQUEST);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('CONFLICT');
    expect(result.error?.details?.conflicts).toEqual(['2026-12-10', '2026-12-15']);
  });

  it('propaga falha de rede como rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network down'));
    const svc = createAppsScriptService(config);

    await expect(svc.createReservationRange(VALID_RANGE_REQUEST)).rejects.toThrow('Network down');
  });
});

// ─────────────────────────────────────────────────────────────
// listReservations + cancelReservation (Sprint 3)
// ─────────────────────────────────────────────────────────────

const VALID_CANCEL_REQUEST: CancelReservationRequest = {
  userEmail: 'professor@senai.edu',
  payload: { id: 'r-42' },
};

const OK_LIST_ENVELOPE = {
  ok:   true,
  data: {
    count: 2,
    reservations: [
      { id: 'r-1', sala: '603 Sala', data: '2026-12-10', inicio: '08:00', fim: '10:00' },
      { id: 'r-2', sala: '603 Sala', data: '2026-12-15', inicio: '08:00', fim: '10:00' },
    ],
  },
  error: null,
};

const OK_CANCEL_ENVELOPE = {
  ok:   true,
  data: {
    id:         'r-42',
    sala:       '603 Sala',
    data:       '2026-12-10',
    inicio:     '08:00',
    fim:        '10:00',
    professor:  'Fulano',
    turma:      'ADS-A',
    observacao: '',
    status:     'CANCELLED',
    createdBy:  'professor@senai.edu',
    createdAt:  '2026-06-01T12:00:00.000Z',
    updatedAt:  '2026-06-09T15:00:00.000Z',
  },
  error: null,
};

const NOT_FOUND_ENVELOPE = {
  ok:    false,
  data:  null,
  error: { code: 'NOT_FOUND', message: 'Reserva não encontrada.' },
};

const FORBIDDEN_ENVELOPE = {
  ok:    false,
  data:  null,
  error: { code: 'FORBIDDEN', message: 'Apenas o criador pode cancelar a reserva.' },
};

const INTERNAL_LIST_ENVELOPE = {
  ok:    false,
  data:  null,
  error: { code: 'INTERNAL', message: 'Erro interno ao listar reservas.' },
};

describe('createAppsScriptService().listReservations()', () => {
  const config = { url: 'https://script.google.com/macros/s/abc/exec', token: 'test' };

  function mockFetchOnce(payload: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(payload),
    } as Response);
  }

  afterEach(() => { vi.restoreAllMocks(); });

  it('faz GET com token e action=listReservations (sem includeCancelled por padrão)', async () => {
    const fetchSpy = mockFetchOnce(OK_LIST_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.listReservations();

    const [url, init] = fetchSpy.mock.calls[0];
    expect(init?.method ?? 'GET').toBe('GET');
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe(config.url);
    expect(parsed.searchParams.get('token')).toBe('test');
    expect(parsed.searchParams.get('action')).toBe('listReservations');
    expect(parsed.searchParams.has('includeCancelled')).toBe(false);
  });

  it('com includeCancelled=true adiciona o param na query', async () => {
    const fetchSpy = mockFetchOnce(OK_LIST_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.listReservations({ includeCancelled: true });

    const [url] = fetchSpy.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.searchParams.get('includeCancelled')).toBe('true');
  });

  it('retorna envelope ok=true intacto (count + reservations)', async () => {
    mockFetchOnce(OK_LIST_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.listReservations();

    expect(result.ok).toBe(true);
    expect(result.data?.count).toBe(2);
    expect(result.data?.reservations).toHaveLength(2);
    expect(result.error).toBeNull();
  });

  it('retorna envelope ok=false com code INTERNAL intacto', async () => {
    mockFetchOnce(INTERNAL_LIST_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.listReservations();

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INTERNAL');
  });

  it('propaga falha de rede como rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network down'));
    const svc = createAppsScriptService(config);

    await expect(svc.listReservations()).rejects.toThrow('Network down');
  });
});

describe('createAppsScriptService().cancelReservation()', () => {
  const config = { url: 'https://script.google.com/macros/s/abc/exec', token: 'test' };

  function mockFetchOnce(payload: unknown) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok:   true,
      json: () => Promise.resolve(payload),
    } as Response);
  }

  afterEach(() => { vi.restoreAllMocks(); });

  it('envia POST com Content-Type text/plain', async () => {
    const fetchSpy = mockFetchOnce(OK_CANCEL_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.cancelReservation(VALID_CANCEL_REQUEST);

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe(config.url);
    expect(init?.method).toBe('POST');
    const headers = new Headers(init?.headers);
    expect(headers.get('content-type')).toMatch(/^text\/plain/i);
  });

  it('serializa body com action, clientRequestId, userEmail e payload.id', async () => {
    const fetchSpy = mockFetchOnce(OK_CANCEL_ENVELOPE);
    const svc = createAppsScriptService(config);

    await svc.cancelReservation({ ...VALID_CANCEL_REQUEST, clientRequestId: 'fixed-uuid-1' });

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.action).toBe('cancelReservation');
    expect(body.clientRequestId).toBe('fixed-uuid-1');
    expect(body.userEmail).toBe('professor@senai.edu');
    expect(body.payload.id).toBe('r-42');
  });

  it('gera clientRequestId via crypto.randomUUID se não fornecido', async () => {
    const fetchSpy = mockFetchOnce(OK_CANCEL_ENVELOPE);
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '11111111-2222-3333-4444-555555555555',
    );
    const svc = createAppsScriptService(config);

    await svc.cancelReservation(VALID_CANCEL_REQUEST);

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.clientRequestId).toBe('11111111-2222-3333-4444-555555555555');
  });

  it('retorna envelope ok=true intacto (reserva com status=CANCELLED)', async () => {
    mockFetchOnce(OK_CANCEL_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.cancelReservation(VALID_CANCEL_REQUEST);

    expect(result.ok).toBe(true);
    expect(result.data?.id).toBe('r-42');
    expect(result.data?.status).toBe('CANCELLED');
    expect(result.error).toBeNull();
  });

  it('retorna envelope ok=false com code NOT_FOUND intacto', async () => {
    mockFetchOnce(NOT_FOUND_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.cancelReservation(VALID_CANCEL_REQUEST);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
  });

  it('retorna envelope ok=false com code FORBIDDEN intacto', async () => {
    mockFetchOnce(FORBIDDEN_ENVELOPE);
    const svc = createAppsScriptService(config);

    const result = await svc.cancelReservation(VALID_CANCEL_REQUEST);

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('FORBIDDEN');
  });

  it('propaga falha de rede como rejection', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network down'));
    const svc = createAppsScriptService(config);

    await expect(svc.cancelReservation(VALID_CANCEL_REQUEST)).rejects.toThrow('Network down');
  });
});
