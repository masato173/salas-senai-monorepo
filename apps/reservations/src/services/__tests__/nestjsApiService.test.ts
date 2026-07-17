import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNestjsApiService, clearRoomCache } from '../nestjsApiService';
import { useAuthStore } from '../../store/authStore';
import { createAppsScriptService } from '../appsScript';

// AppsScriptService não é exportado por appsScript.ts — mesmo padrão do
// arquivo testado: shape derivado de ReturnType<typeof createAppsScriptService>.
type AppsScriptService = ReturnType<typeof createAppsScriptService>;

// Mock do apiClient — isolado do fetch real
vi.mock('../apiClient', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    status: number;
    code: string | undefined;
    constructor(status: number, message: string, code?: string) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.code = code;
    }
  },
}));

import { apiFetch, ApiError } from '../apiClient';
const mockApiFetch = apiFetch as ReturnType<typeof vi.fn>;

// Fallback mínimo para métodos não migrados
const fallback: AppsScriptService = {
  fetchSchedule: vi.fn(),
  createReservation: vi.fn(),
  createReservationRange: vi.fn(),
  listReservations: vi.fn(),
  cancelReservation: vi.fn(),
  updateReservation: vi.fn(),
  updateReservationGroup: vi.fn(),
  updateReservationSelected: vi.fn(),
};

const MOCK_ROOMS = [
  { id: 'r-603', name: '603 Sala' },
  { id: 'r-708', name: '708 Lab. CLP' },
];

const MOCK_USER = {
  id: 'u-1',
  name: 'Prof. Teste',
  email: 'prof@senai.edu',
  role: 'PROFESSOR',
};

const MOCK_NEST_RESERVATION = {
  id: 'res-1',
  userId: 'u-1',
  roomId: 'r-603',
  groupId: null,
  date: '2026-12-01',
  inicio: '08:00',
  fim: '10:00',
  status: 'PENDING',
  notes: 'Aula prática',
  clientRequestId: null,
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
  deletedAt: null,
  room: { id: 'r-603', name: '603 Sala' },
  user: { id: 'u-1', name: 'Prof. Teste', email: 'prof@senai.edu' },
};

describe('nestjsApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearRoomCache();
    useAuthStore.getState().setAuth({
      user: MOCK_USER,
      accessToken: 'tok',
      refreshToken: 'ref',
    });
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  // ── listReservations ────────────────────────────────────────
  describe('listReservations()', () => {
    it('mapeia reservas NestJS para BackendEnvelope com shape correto', async () => {
      mockApiFetch.mockResolvedValue([MOCK_NEST_RESERVATION]);

      const svc = createNestjsApiService(fallback);
      const result = await svc.listReservations();

      expect(result.ok).toBe(true);
      expect(result.data?.count).toBe(1);
      const row = result.data?.reservations[0];
      expect(row?.id).toBe('res-1');
      expect(row?.sala).toBe('603 Sala');
      expect(row?.data).toBe('2026-12-01');
      expect(row?.inicio).toBe('08:00');
      expect(row?.fim).toBe('10:00');
      expect(row?.professor).toBe('Prof. Teste');
      expect(row?.observacao).toBe('Aula prática');
      expect(row?.createdBy).toBe('prof@senai.edu');
    });

    it('PENDING preserva status PENDING', async () => {
      mockApiFetch.mockResolvedValue([{ ...MOCK_NEST_RESERVATION, status: 'PENDING' }]);
      const result = await createNestjsApiService(fallback).listReservations();
      expect(result.data?.reservations[0]?.status).toBe('PENDING');
    });
    it('APPROVED preserva status APPROVED', async () => {
      mockApiFetch.mockResolvedValue([{ ...MOCK_NEST_RESERVATION, status: 'APPROVED' }]);
      const result = await createNestjsApiService(fallback).listReservations();
      expect(result.data?.reservations[0]?.status).toBe('APPROVED');
    });

    it('CANCELLED → CANCELLED no status', async () => {
      mockApiFetch.mockResolvedValue([{ ...MOCK_NEST_RESERVATION, status: 'CANCELLED' }]);
      const result = await createNestjsApiService(fallback).listReservations();
      expect(result.data?.reservations[0]?.status).toBe('CANCELLED');
    });

    it('retorna BackendEnvelope de erro em falha de rede', async () => {
      mockApiFetch.mockRejectedValue(new ApiError(500, 'Erro interno'));
      const result = await createNestjsApiService(fallback).listReservations();
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('INTERNAL');
    });
  });

  // ── createReservation ───────────────────────────────────────
  // Cada teste configura seu próprio mock completo para evitar
  // contaminação de fila entre testes (beforeEach contaminaria o 409).
  describe('createReservation()', () => {
    const REQ = {
      userEmail: 'prof@senai.edu',
      payload: {
        sala: '603 Sala',
        data: '2026-12-01',
        inicio: '08:00',
        fim: '10:00',
        professor: 'Prof. Teste',
        turma: 'INF-01',
        observacao: 'Aula prática',
      },
    };

    const SUCCESS_POST = { ...MOCK_NEST_RESERVATION, room: undefined, user: undefined };

    it('resolve sala name → roomId via cache e cria reserva', async () => {
      mockApiFetch
        .mockResolvedValueOnce(MOCK_ROOMS) // GET /rooms
        .mockResolvedValueOnce(SUCCESS_POST); // POST /reservations
      const result = await createNestjsApiService(fallback).createReservation(REQ);
      expect(result.ok).toBe(true);
      expect(result.data?.sala).toBe('603 Sala');
      expect(result.data?.professor).toBe('Prof. Teste'); // do authStore
    });

    it('usa cache na segunda chamada (sem re-fetch de rooms)', async () => {
      mockApiFetch
        .mockResolvedValueOnce(MOCK_ROOMS) // GET /rooms (1ª criação)
        .mockResolvedValueOnce(SUCCESS_POST) // POST (1ª criação)
        .mockResolvedValueOnce(SUCCESS_POST); // POST (2ª criação — sem GET /rooms)
      const svc = createNestjsApiService(fallback);
      await svc.createReservation(REQ);
      await svc.createReservation(REQ);
      const getCalls = mockApiFetch.mock.calls.filter(c => (c[0] as string) === '/rooms');
      expect(getCalls).toHaveLength(1);
    });

    it('retorna erro VALIDATION se sala não encontrada no cache', async () => {
      mockApiFetch.mockResolvedValueOnce(MOCK_ROOMS); // GET /rooms
      const result = await createNestjsApiService(fallback).createReservation({
        ...REQ,
        payload: { ...REQ.payload, sala: 'Sala Inexistente' },
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('VALIDATION');
    });

    it('409 → CONFLICT no error.code', async () => {
      mockApiFetch
        .mockResolvedValueOnce(MOCK_ROOMS) // GET /rooms
        .mockRejectedValueOnce(new ApiError(409, 'Sala já reservada neste horário.'));
      const result = await createNestjsApiService(fallback).createReservation(REQ);
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('CONFLICT');
    });
  });

  // ── cancelReservation ───────────────────────────────────────
  describe('cancelReservation()', () => {
    it('faz GET então DELETE e retorna row com status CANCELLED', async () => {
      mockApiFetch
        .mockResolvedValueOnce(MOCK_NEST_RESERVATION) // GET /:id
        .mockResolvedValueOnce(null); // DELETE /:id

      const result = await createNestjsApiService(fallback).cancelReservation({
        userEmail: 'prof@senai.edu',
        payload: { id: 'res-1' },
      });

      expect(result.ok).toBe(true);
      expect(result.data?.id).toBe('res-1');
      expect(result.data?.status).toBe('CANCELLED');
      expect(result.data?.sala).toBe('603 Sala');
      expect(mockApiFetch).toHaveBeenCalledTimes(2);
    });

    it('404 no GET → NOT_FOUND no error.code', async () => {
      mockApiFetch.mockRejectedValueOnce(new ApiError(404, 'Reserva não encontrada.'));
      const result = await createNestjsApiService(fallback).cancelReservation({
        userEmail: 'prof@senai.edu',
        payload: { id: 'nao-existe' },
      });
      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  // ── fallback ────────────────────────────────────────────────
  describe('fetchSchedule (F8.6 — NestJS direto)', () => {
    it('chama apiFetch em /schedules', async () => {
      mockApiFetch.mockResolvedValue({ registros: [], turnoMap: {} });
      await createNestjsApiService(fallback).fetchSchedule();
      expect(mockApiFetch).toHaveBeenCalledWith('/schedules');
    });

    it('nao delega ao fallback quando NestJS responde', async () => {
      mockApiFetch.mockResolvedValue({ registros: [], turnoMap: {} });
      await createNestjsApiService(fallback).fetchSchedule();
      expect(fallback.fetchSchedule).not.toHaveBeenCalled();
    });

    it('lanca erro quando apiFetch falha', async () => {
      mockApiFetch.mockRejectedValue(new Error('Falha de rede'));
      await expect(createNestjsApiService(fallback).fetchSchedule()).rejects.toThrow(
        'Falha de rede',
      );
    });
  });
});
