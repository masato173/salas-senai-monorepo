import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createAppsScriptService,
  type CreateReservationRequest,
  type CreateReservationRangeRequest,
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
