import { apiFetch } from './apiClient';
import type { PaginatedResponse, AuditLog, AuditQuery, AdminUser, UserListParams } from '../types';
import type { SyncResult } from '@salas-senai/shared';
import { useAuthStore, selectUser } from '../store/authStore';
// F8.9 — createAppsScriptService removido: NestJS é fonte única de verdade.
import type {
  BackendEnvelope,
  BackendError,
  BackendErrorCode,
  CancelReservationRequest,
  CancelReservationResponse,
  CreateReservationRangeRequest,
  CreateReservationRangeResponse,
  CreateReservationRequest,
  CreateReservationResponse,
  CreatedReservationRow,
  ListReservationsOptions,
  ListReservationsResponse,
  ScheduleResult,
  UpdateReservationGroupRequest,
  UpdateReservationGroupResponse,
  UpdateReservationRequest,
  UpdateReservationResponse,
  UpdateReservationSelectedRequest,
  UpdateReservationSelectedResponse,
} from './apiTypes';

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

// F8.9 — Interface explícita (antes derivada via ReturnType de createAppsScriptService).
interface AppsScriptService {
  fetchSchedule(): Promise<ScheduleResult>;
  createReservation(req: CreateReservationRequest): Promise<CreateReservationResponse>;
  createReservationRange(
    req: CreateReservationRangeRequest,
  ): Promise<CreateReservationRangeResponse>;
  listReservations(options?: ListReservationsOptions): Promise<ListReservationsResponse>;
  cancelReservation(req: CancelReservationRequest): Promise<CancelReservationResponse>;
  updateReservation(req: UpdateReservationRequest): Promise<UpdateReservationResponse>;
  updateReservationGroup(
    req: UpdateReservationGroupRequest,
  ): Promise<UpdateReservationGroupResponse>;
  updateReservationSelected(
    req: UpdateReservationSelectedRequest,
  ): Promise<UpdateReservationSelectedResponse>;
}

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
  turma: string | null;
  notes: string | null;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  room?: NestRoom;
  user?: NestUser;
}

// ─── Status mapper ─────────────────────────────────────────────
// Preserva o status real do backend (PENDING/APPROVED/REJECTED/CANCELLED).
// Mantido como função para facilitar extensão futura.
function mapStatus(s: string): string {
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
    turma: r.turma ?? '',
    observacao: r.notes ?? '',
    status: mapStatus(r.status),
    createdBy: r.user?.email ?? '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    // exactOptionalPropertyTypes: spread condicional evita { groupId: undefined }
    ...(r.groupId !== null && r.groupId !== undefined ? { groupId: r.groupId } : {}),
  };
}

// ─── Tipos admin (F6.1) ───────────────────────────────────────
// Contrato das funcionalidades administrativas exclusivas do NestJS.
// Não altera AppsScriptService — mantém compatibilidade com legado.
// Filtros preparados para crescimento: F6.1 usa só status; os demais
// serão passados ao backend quando os endpoints suportarem.
export interface ReservationAdminFilters {
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  professor?: string; // client-side em F6.1
  sala?: string; // futuro: roomId=
  data?: string; // futuro: date=
}

// ─── Tipos admin F6.3 ────────────────────────────────────────
// Shape real de GET /health (health.controller.ts confirmado)
interface NestHealthResponse {
  status: 'ok';
  timestamp: string;
  uptime: number; // segundos desde start do servidor
  version: string;
}

// Shape de um registro de AuditLog (GET /audit)
// user sempre presente via include no AuditService.findAll
interface NestAuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  before: unknown;
  after: unknown;
  ip: string | null;
  timestamp: string;
  user: { id: string; name: string; email: string };
}

export interface ReservationAdminApi {
  listPendingReservations(filters?: ReservationAdminFilters): Promise<ListReservationsResponse>;
  updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
  ): Promise<BackendEnvelope<CreatedReservationRow>>;
  // F6.3 — Dashboard Admin
  fetchHealth(): Promise<BackendEnvelope<NestHealthResponse>>;
  fetchAuditLastSync(): Promise<BackendEnvelope<NestAuditLog | null>>;
  // F6.4 — Auditoria
  // TODO: renomear ReservationAdminApi → AdminApi pós-F6.8 quando split for feito
  listAuditLogs(
    q: AuditQuery,
    signal?: AbortSignal,
  ): Promise<BackendEnvelope<PaginatedResponse<AuditLog>>>;
  // F6.5 — Sincronização
  triggerSync(): Promise<BackendEnvelope<SyncResult>>;
  // F6.7 — Usuários
  listUsers(
    params: UserListParams,
    signal?: AbortSignal,
  ): Promise<BackendEnvelope<PaginatedResponse<AdminUser>>>;
  updateUserRole(id: string, role: AdminUser['role']): Promise<BackendEnvelope<AdminUser>>;
  setUserActive(id: string, isActive: boolean): Promise<BackendEnvelope<AdminUser>>;
}

// ─── Row mapper admin ─────────────────────────────────────────
// Variante do toRow que preserva o status bruto do NestJS.
// listPendingReservations usa esta função para que a UI de aprovações
// veja 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' — não 'ACTIVE'.
function toAdminRow(r: NestReservation): CreatedReservationRow {
  return { ...toRow(r), status: r.status };
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
export function createNestjsApiService(): AppsScriptService & ReservationAdminApi {
  return {
    // ── Migrado: GET /schedules ──────────────────────────────
    // Apps Script não é mais chamado para aulas após F5.7.
    async fetchSchedule(): Promise<ScheduleResult> {
      // F8.6 — NestJS é fonte única de verdade para Schedule.
      // Fallback para Apps Script removido: banco tem 1.522 registros sincronizados.
      // Se falhar, lança erro — useSchedule retentar automaticamente (maxRetries=2).
      return await apiFetch<ScheduleResult>('/schedules');
    },
    async createReservationRange(req) {
      try {
        const roomId = await resolveRoomId(req.payload.sala);
        if (roomId === null) {
          return {
            ok: false,
            data: null,
            error: {
              code: 'VALIDATION' as const,
              message: `Sala "${req.payload.sala}" não encontrada no sistema.`,
            },
          };
        }
        const authUser = selectUser(useAuthStore.getState());
        const result = await apiFetch<{ count: number; reservations: NestReservation[] }>(
          '/reservations/range',
          {
            method: 'POST',
            body: JSON.stringify({
              roomId,
              dateInicio: req.payload.dataInicio,
              dateFim: req.payload.dataFim,
              diasSemana: req.payload.diasSemana,
              inicio: req.payload.inicio,
              fim: req.payload.fim,
              turma: req.payload.turma !== '' ? req.payload.turma : undefined,
              notes: req.payload.observacao !== '' ? req.payload.observacao : undefined,
              ...(req.payload.ownerUserId ? { ownerUserId: req.payload.ownerUserId } : {}),
            }),
          },
        );
        const reservations = result.reservations.map(r => ({
          ...toRow(r),
          sala: req.payload.sala,
          professor: authUser?.name ?? req.payload.professor,
          turma: req.payload.turma ?? '',
          createdBy: authUser?.email ?? req.userEmail,
        }));
        return {
          ok: true,
          data: { count: result.count, reservations },
          error: null,
        };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },
    async updateReservation(req): Promise<UpdateReservationResponse> {
      try {
        const roomId = req.payload.sala ? await resolveRoomId(req.payload.sala) : undefined;
        const updated = await apiFetch<NestReservation>(`/reservations/${req.payload.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...(roomId !== null && roomId !== undefined ? { roomId } : {}),
            date: req.payload.data,
            inicio: req.payload.inicio,
            fim: req.payload.fim,
            turma: req.payload.turma !== '' ? req.payload.turma : undefined,
            notes: req.payload.observacao !== '' ? req.payload.observacao : undefined,
          }),
        });
        const authUser = selectUser(useAuthStore.getState());
        const row: CreatedReservationRow = {
          ...toRow(updated),
          sala: req.payload.sala,
          professor: authUser?.name ?? req.userEmail,
          turma: req.payload.turma ?? '',
          createdBy: authUser?.email ?? req.userEmail,
        };
        return { ok: true, data: row, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },
    async updateReservationGroup(req): Promise<UpdateReservationGroupResponse> {
      try {
        const roomId = req.payload.sala ? await resolveRoomId(req.payload.sala) : undefined;
        const result = await apiFetch<{ count: number; reservations: NestReservation[] }>(
          `/reservations/group/${req.payload.groupId}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              ...(roomId !== null && roomId !== undefined ? { roomId } : {}),
              inicio: req.payload.inicio,
              fim: req.payload.fim,
              turma: req.payload.turma !== '' ? req.payload.turma : undefined,
              notes: req.payload.observacao !== '' ? req.payload.observacao : undefined,
            }),
          },
        );
        const authUser = selectUser(useAuthStore.getState());
        const reservations = result.reservations.map(r => ({
          ...toRow(r),
          sala: req.payload.sala,
          professor: authUser?.name ?? req.userEmail,
          turma: req.payload.turma ?? '',
          createdBy: authUser?.email ?? req.userEmail,
        }));
        return { ok: true, data: { count: result.count, reservations }, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },
    async updateReservationSelected(req): Promise<UpdateReservationSelectedResponse> {
      try {
        const roomId = req.payload.sala ? await resolveRoomId(req.payload.sala) : undefined;
        const result = await apiFetch<{ count: number; reservations: NestReservation[] }>(
          '/reservations/selected',
          {
            method: 'PATCH',
            body: JSON.stringify({
              ids: req.payload.ids,
              ...(roomId !== null && roomId !== undefined ? { roomId } : {}),
              inicio: req.payload.inicio,
              fim: req.payload.fim,
              turma: req.payload.turma !== '' ? req.payload.turma : undefined,
              notes: req.payload.observacao !== '' ? req.payload.observacao : undefined,
            }),
          },
        );
        const authUser = selectUser(useAuthStore.getState());
        const reservations = result.reservations.map(r => ({
          ...toRow(r),
          sala: req.payload.sala,
          professor: authUser?.name ?? req.userEmail,
          turma: req.payload.turma ?? '',
          createdBy: authUser?.email ?? req.userEmail,
        }));
        return { ok: true, data: { count: result.count, reservations }, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

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
            turma: req.payload.turma !== '' ? req.payload.turma : undefined,
            notes: req.payload.observacao !== '' ? req.payload.observacao : undefined,
            ...(req.payload.ownerUserId ? { ownerUserId: req.payload.ownerUserId } : {}),
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
          turma: req.payload.turma ?? '',
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

    // ── F6.1: listPendingReservations ────────────────────────
    // Usa toAdminRow (status bruto) para que a UI de aprovações veja
    // PENDING/APPROVED/REJECTED/CANCELLED em vez de ACTIVE.
    // professor é filtro client-side — backend não tem esse parâmetro.
    async listPendingReservations(
      filters?: ReservationAdminFilters,
    ): Promise<ListReservationsResponse> {
      try {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.data) params.set('date', filters.data);
        const query = params.toString();
        const raw = await apiFetch<NestReservation[]>(
          query ? `/reservations?${query}` : '/reservations',
        );
        const reservations = raw.map(toAdminRow);
        return { ok: true, data: { count: reservations.length, reservations }, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.1: updateStatus ───────────────────────────────────
    // PATCH /reservations/:id/status — aprovação e rejeição.
    // Retorna o status bruto (sem mapper) para o adapter admin.
    async updateStatus(
      id: string,
      status: 'APPROVED' | 'REJECTED',
    ): Promise<BackendEnvelope<CreatedReservationRow>> {
      try {
        const updated = await apiFetch<NestReservation>(`/reservations/${id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
        return { ok: true, data: toAdminRow(updated), error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.3: fetchHealth ─────────────────────────────────────
    // GET /health é @Public — JWT enviado mas ignorado pelo backend.
    async fetchHealth(): Promise<BackendEnvelope<NestHealthResponse>> {
      try {
        const data = await apiFetch<NestHealthResponse>('/health');
        return { ok: true, data, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.4: listAuditLogs ───────────────────────────────────
    // GET /audit com filtros server-side + paginação.
    // signal suportado nativamente pelo fetch (AbortController no hook).
    async listAuditLogs(
      q: AuditQuery,
      signal?: AbortSignal,
    ): Promise<BackendEnvelope<PaginatedResponse<AuditLog>>> {
      try {
        const params = new URLSearchParams();
        if (q.action) params.set('action', q.action);
        if (q.entityType) params.set('entityType', q.entityType);
        if (q.from) params.set('from', q.from);
        if (q.to) params.set('to', q.to);
        params.set('page', String(q.page));
        params.set('limit', String(q.limit));
        const raw = await apiFetch<PaginatedResponse<NestAuditLog>>(
          `/audit?${params.toString()}`,
          signal ? { signal } : undefined,
        );
        // NestAuditLog e AuditLog têm o mesmo shape — cast seguro
        const data = raw.data as unknown as AuditLog[];
        return { ok: true, data: { ...raw, data }, error: null };
      } catch (e) {
        // AbortError é cancelamento intencional — não é erro real
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, data: null, error: { code: 'INTERNAL', message: 'ABORTED' } };
        }
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.3: fetchAuditLastSync ──────────────────────────────
    // GET /audit?action=SYNC_SCHEDULES&limit=1 — requer ADMIN JWT.
    // Retorna o último registro de sync ou null se nunca sincronizou.
    async fetchAuditLastSync(): Promise<BackendEnvelope<NestAuditLog | null>> {
      try {
        const res = await apiFetch<{ data: NestAuditLog[]; total: number }>(
          '/audit?action=SYNC_SCHEDULES&limit=1',
        );
        return { ok: true, data: res.data[0] ?? null, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.5: triggerSync ─────────────────────────────────────
    // POST /sync/schedules — ADMIN only.
    // Dispara sincronização Apps Script → banco. Pode levar 30-60s.
    async triggerSync(): Promise<BackendEnvelope<SyncResult>> {
      try {
        const data = await apiFetch<SyncResult>('/sync/schedules', { method: 'POST' });
        return { ok: true, data, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.7: listUsers ───────────────────────────────────────
    // GET /users — ADMIN only.
    async listUsers(
      params: UserListParams,
      signal?: AbortSignal,
    ): Promise<BackendEnvelope<PaginatedResponse<AdminUser>>> {
      try {
        const q = new URLSearchParams();
        if (params.role !== undefined) q.set('role', params.role);
        if (params.search !== undefined) q.set('search', params.search);
        if (params.isActive !== undefined) q.set('isActive', String(params.isActive));
        q.set('page', String(params.page));
        q.set('limit', String(params.limit));
        const data = await apiFetch<PaginatedResponse<AdminUser>>(
          `/users?${q.toString()}`,
          signal !== undefined ? { signal } : undefined,
        );
        return { ok: true, data, error: null };
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') {
          return { ok: false, data: null, error: { code: 'INTERNAL', message: 'ABORTED' } };
        }
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.7: updateUserRole ──────────────────────────────────
    // PATCH /users/:id/role — ADMIN only.
    async updateUserRole(id: string, role: AdminUser['role']): Promise<BackendEnvelope<AdminUser>> {
      try {
        const data = await apiFetch<AdminUser>(`/users/${id}/role`, {
          method: 'PATCH',
          body: JSON.stringify({ role }),
        });
        return { ok: true, data, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },

    // ── F6.7: setUserActive ───────────────────────────────────
    // PATCH /users/:id/active — ADMIN only.
    async setUserActive(id: string, isActive: boolean): Promise<BackendEnvelope<AdminUser>> {
      try {
        const data = await apiFetch<AdminUser>(`/users/${id}/active`, {
          method: 'PATCH',
          body: JSON.stringify({ isActive }),
        });
        return { ok: true, data, error: null };
      } catch (e) {
        return { ok: false, data: null, error: toBackendError(e) };
      }
    },
  };
}
