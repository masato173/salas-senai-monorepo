import { apiFetch } from './apiClient';
import { useAuthStore, selectUser } from '../store/authStore';
import { createAppsScriptService } from './appsScript';
import type {
  BackendError,
  BackendErrorCode,
  CancelReservationRequest,
  CancelReservationResponse,
  CreateReservationRequest,
  CreateReservationResponse,
  CreatedReservationRow,
  ListReservationsOptions,
  ListReservationsResponse,
} from './appsScript';

// ─────────────────────────────────────────────────────────────
// nestjsApiService — F5.3
//
// Adapter que implementa a interface AppsScriptService usando
// o NestJS como backend, mantendo compatibilidade total com os
// hooks existentes (drop-in replacement).
//
// Métodos migrados nesta sprint:
//   listReservations   → GET /reservations
//   createReservation  → POST /reservations  (+ room cache)
//   cancelReservation  → GET + DELETE /reservations/:id
//
// Métodos não migrados → delegam ao fallback (appsScriptService).
// F5.5 e F5.6 apenas trocam a instância nos orquestradores.
// ─────────────────────────────────────────────────────────────

// AppsScriptService não é exportado por appsScript.ts (interface interna ao
// módulo). Mesmo padrão já usado em EditSelectedView.tsx / ReservationDetailsModal.tsx:
// o objeto construído por createAppsScriptService já satisfaz este shape.
type AppsScriptService = ReturnType<typeof createAppsScriptService>;

// ─── Tipos internos (NestJS response shape) ──────────────────

interface NestRoom {
  id: string;
  name: string;
}

interface NestUser {
  id: string;
  name: string;
  email: string;
}

interface NestReservation {
  id: string;
  userId: string;
  roomId: string;
  groupId: string | null;
  date: string;
  inicio: string;
  fim: string;
  status: string;
  notes: string | null;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  room?: NestRoom;
  user?: NestUser;
}

// ─── Status mapper ────────────────────────────────────────────
// PENDING | APPROVED → 'ACTIVE' (paridade com Apps Script)
// REJECTED | CANCELLED → passam direto
function mapStatus(s: string): string {
  if (s === 'PENDING' || s === 'APPROVED') return 'ACTIVE';
  return s;
}

// ─── Error mapper ─────────────────────────────────────────────
function apiStatusToCode(status: number): BackendErrorCode {
  switch (status) {
    case 400:
      return 'VALIDATION';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    default:
      return 'INTERNAL';
  }
}

// Duck-typing em vez de instanceof — funciona mesmo com ApiError mockado em testes.
function isApiLike(e: unknown): e is { status: number; message: string } {
  return (
    e !== null &&
    typeof e === 'object' &&
    'status' in e &&
    typeof (e as Record<string, unknown>).status === 'number'
  );
}

function toBackendError(e: unknown): BackendError {
  if (isApiLike(e)) {
    return { code: apiStatusToCode(e.status), message: e.message };
  }
  return {
    code: 'INTERNAL',
    message: e instanceof Error ? e.message : 'Erro desconhecido.',
  };
}

// ─── Row mapper ───────────────────────────────────────────────
function toRow(r: NestReservation): CreatedReservationRow {
  return {
    id: r.id,
    sala: r.room?.name ?? '',
    data: r.date,
    inicio: r.inicio,
    fim: r.fim,
    professor: r.user?.name ?? '',
    turma: '', // F5.3: campo legado sem equivalente no NestJS (Decisão B)
    observacao: r.notes ?? '',
    status: mapStatus(r.status),
    createdBy: r.user?.email ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    // exactOptionalPropertyTypes: spread condicional evita { groupId: undefined }
    ...(r.groupId !== null && r.groupId !== undefined ? { groupId: r.groupId } : {}),
  };
}

// ─── Room cache ───────────────────────────────────────────────
// GET /rooms é @Public — não requer auth. Cache por sessão.
let roomCache: Map<string, string> | null = null;

async function resolveRoomId(salaName: string): Promise<string | null> {
  if (roomCache === null) {
    const rooms = await apiFetch<NestRoom[]>('/rooms');
    roomCache = new Map(rooms.map(r => [r.name.trim(), r.id]));
  }
  return roomCache.get(salaName.trim()) ?? null;
}

// Exposta para testes poderem limpar o cache entre cenários
export function clearRoomCache(): void {
  roomCache = null;
}

// ─── Factory ──────────────────────────────────────────────────
export function createNestjsApiService(fallback: AppsScriptService): AppsScriptService {
  return {
    // ── Não migrado — delega ao Apps Script ─────────────────
    fetchSchedule: () => fallback.fetchSchedule(),
    createReservationRange: req => fallback.createReservationRange(req),
    updateReservation: req => fallback.updateReservation(req),
    updateReservationGroup: req => fallback.updateReservationGroup(req),
    updateReservationSelected: req => fallback.updateReservationSelected(req),

    // ── Migrado: GET /reservations ───────────────────────────
    async listReservations(_options?: ListReservationsOptions): Promise<ListReservationsResponse> {
      try {
        const raw = await apiFetch<NestReservation[]>('/reservations');
        const reservations = raw.map(toRow);
        return { ok: true, data: { count: reservations.length, reservations }, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── Migrado: POST /reservations ──────────────────────────
    async createReservation(req: CreateReservationRequest): Promise<CreateReservationResponse> {
      try {
        const roomId = await resolveRoomId(req.payload.sala);
        if (roomId === null) {
          return {
            ok: false,
            data: null,
            error: {
              code: 'VALIDATION',
              message: `Sala "${req.payload.sala}" não encontrada no sistema.`,
            },
          };
        }

        const created = await apiFetch<NestReservation>('/reservations', {
          method: 'POST',
          body: JSON.stringify({
            roomId,
            date: req.payload.data,
            inicio: req.payload.inicio,
            fim: req.payload.fim,
            notes: req.payload.observacao !== '' ? req.payload.observacao : undefined,
          }),
        });

        // POST não inclui room/user — reconstruímos com dados do request e authStore
        const authUser = selectUser(useAuthStore.getState());
        const row: CreatedReservationRow = {
          id: created.id,
          sala: req.payload.sala,
          data: created.date,
          inicio: created.inicio,
          fim: created.fim,
          professor: authUser?.name ?? req.payload.professor,
          turma: '',
          observacao: created.notes ?? '',
          status: mapStatus(created.status),
          createdBy: authUser?.email ?? req.userEmail,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          // exactOptionalPropertyTypes: spread condicional evita { groupId: undefined }
          ...(created.groupId !== null && created.groupId !== undefined
            ? { groupId: created.groupId }
            : {}),
        };

        // CreateReservationResponse usa tipo vago no legado — cast necessário
        return {
          ok: true,
          data: row as unknown as Parameters<typeof toRow>[0] & Record<string, unknown>,
          error: null,
        };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── Migrado: DELETE /reservations/:id ────────────────────
    // GET antes do DELETE para preservar room.name e user.name
    // (DELETE não retorna includes no NestJS).
    async cancelReservation(req: CancelReservationRequest): Promise<CancelReservationResponse> {
      try {
        // 1. Busca dados completos (com includes) antes de cancelar
        const existing = await apiFetch<NestReservation>(`/reservations/${req.payload.id}`);

        // 2. Cancela
        await apiFetch<null>(`/reservations/${req.payload.id}`, {
          method: 'DELETE',
        });

        // 3. Monta row com os dados pré-cancelamento + status atualizado
        const row = toRow({ ...existing, status: 'CANCELLED' });
        return { ok: true, data: row, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },
  };
}
