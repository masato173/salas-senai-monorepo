// F8.9 — Tipos extraídos de appsScript.ts para remover dependência do legado.
// Fonte única de verdade para contratos da API.

import type { RegistroLegado, TurnoMap } from '../types';

export interface ScheduleResult {
  registros: RegistroLegado[];
  turnoMap: TurnoMap;
}

export type BackendErrorCode =
  | 'CONFLICT'
  | 'VALIDATION'
  | 'LOCK_TIMEOUT'
  | 'DUPLICATE'
  | 'INTERNAL'
  | 'NOT_FOUND'
  | 'FORBIDDEN';

export interface BackendError {
  code: BackendErrorCode;
  message: string;
  // Extensão para createReservationRange: lista de datas (YYYY-MM-DD) que conflitaram.
  // Opcional para preservar compatibilidade com erros do createReservation.
  details?: {
    conflicts?: string[];
  };
}

export interface BackendEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: BackendError | null;
}

export interface ReservationPayload {
  sala: string; // NOME real ("603 Sala"), não o id interno
  data: string; // YYYY-MM-DD
  inicio: string; // HH:MM
  fim: string; // HH:MM
  professor: string;
  turma: string;
  observacao: string;
  ownerUserId?: string; // COORDENADOR/ADMIN: cria em nome deste professor
}

export interface CreateReservationRequest {
  userEmail: string;
  payload: ReservationPayload;
  clientRequestId?: string; // omitido → service gera via crypto.randomUUID
}

// TODO(tech-debt): tipo vago. CreatedReservationRow (abaixo) já reflete o shape real
// retornado por rowToObj no backend. Apertar este aqui exige revisar useCreateReservation
// e ReservationForm — adiar para cleanup futuro junto com os erros pré-existentes do tsc.
export type CreateReservationResponse = BackendEnvelope<{ id?: string } & Record<string, unknown>>;

// ── Reserva em período (multi-dia, mesma sala/horário) ──
export interface ReservationRangePayload {
  sala: string; // NOME real ("603 Sala")
  dataInicio: string; // YYYY-MM-DD (inclusivo)
  dataFim: string; // YYYY-MM-DD (inclusivo)
  diasSemana: number[]; // 0=dom .. 6=sáb
  inicio: string; // HH:MM
  fim: string; // HH:MM
  professor: string;
  turma: string;
  observacao: string;
  ownerUserId?: string; // COORDENADOR/ADMIN: cria em nome deste professor
}

export interface CreateReservationRangeRequest {
  userEmail: string;
  payload: ReservationRangePayload;
  clientRequestId?: string;
}

// Espelha rowToObj() do backend (codigo.gs) — 12 campos base + groupId (opcional).
// clientRequestId é metadado de linha (col M), não exposto no retorno.
// groupId (col N, Sprint 4 Fase A): única → groupId === id; período → UUID único compartilhado
// por todas as linhas. Opcional para reservas legacy criadas antes da Fase A (devolve '').
export interface CreatedReservationRow {
  id: string;
  sala: string;
  data: string; // YYYY-MM-DD
  inicio: string; // HH:MM
  fim: string; // HH:MM
  professor: string;
  turma: string;
  observacao: string;
  status: string; // 'ACTIVE' por enquanto
  createdBy: string; // userEmail
  createdAt: string; // ISO
  updatedAt: string; // ISO
  groupId?: string; // Sprint 4 Fase A — vazio para reservas legacy
}

export type CreateReservationRangeResponse = BackendEnvelope<{
  count: number;
  reservations: CreatedReservationRow[];
}>;

// ── Sprint 3: listReservations + cancelReservation ──

// TODO(tech-debt): shape `{ count, reservations }` é duplicado entre
// CreateReservationRangeResponse e ListReservationsResponse. Unificar
// em cleanup futuro pra evitar tocar código estável agora.
export type ListReservationsResponse = BackendEnvelope<{
  count: number;
  reservations: CreatedReservationRow[];
}>;

export interface ListReservationsOptions {
  includeCancelled?: boolean;
}

export interface CancelReservationPayload {
  id: string;
}

export interface CancelReservationRequest {
  userEmail: string;
  payload: CancelReservationPayload;
  clientRequestId?: string;
}

export type CancelReservationResponse = BackendEnvelope<CreatedReservationRow>;

// ── Sprint 4 C1 / C2: updateReservation + updateReservationGroup ──

export interface UpdateReservationPayload {
  id: string;
  sala: string;
  data: string; // YYYY-MM-DD
  inicio: string; // HH:MM
  fim: string; // HH:MM
  turma: string;
  observacao: string;
}

export interface UpdateReservationRequest {
  userEmail: string;
  payload: UpdateReservationPayload;
  clientRequestId?: string;
}

export type UpdateReservationResponse = BackendEnvelope<CreatedReservationRow>;

// updateReservationGroup (Sprint 4 C2) — edita TODAS as ACTIVE de um grupo.
// NÃO inclui `data` — cada linha mantém a sua data própria.
export interface UpdateReservationGroupPayload {
  groupId: string;
  sala: string;
  inicio: string; // HH:MM
  fim: string; // HH:MM
  turma: string;
  observacao: string;
}

export interface UpdateReservationGroupRequest {
  userEmail: string;
  payload: UpdateReservationGroupPayload;
  clientRequestId?: string;
}

// TODO(tech-debt): mesmo shape de CreateReservationRangeResponse e
// ListReservationsResponse. Unificar em cleanup futuro.
export type UpdateReservationGroupResponse = BackendEnvelope<{
  count: number;
  reservations: CreatedReservationRow[];
}>;

// ── Sprint 4 C3: updateReservationSelected ──
// Remaneja ocorrências SELECIONADAS de um grupo (subconjunto por IDs).
// Difere do C2: recebe `ids: string[]` em vez de `groupId`.
// NÃO inclui `data` — cada ocorrência mantém a sua data própria (igual C2).
export interface UpdateReservationSelectedPayload {
  ids: string[]; // IDs das ocorrências selecionadas (1+)
  sala: string;
  inicio: string; // HH:MM
  fim: string; // HH:MM
  turma: string;
  observacao: string;
}

export interface UpdateReservationSelectedRequest {
  userEmail: string;
  payload: UpdateReservationSelectedPayload;
  clientRequestId?: string;
}

export type UpdateReservationSelectedResponse = BackendEnvelope<{
  count: number;
  reservations: CreatedReservationRow[];
}>;

// ── Painel de reservas do dia (GET /reservations/day) ──
// Espelha DayReservationItem do backend (reservations.service.ts). Shape
// reduzido por privacidade: PROFESSOR recebe sem professor/createdByUserId;
// COORDENADOR/ADMIN recebem os dois (os campos opcionais documentam que o
// shape reduzido é subconjunto do completo).
export interface DayReservationItem {
  id: string;
  sala: string;
  inicio: string; // HH:MM
  fim: string; // HH:MM
  status: string; // 'PENDING' | 'APPROVED'
  turma: string | null;
  professor?: string; // só COORDENADOR/ADMIN
  createdByUserId?: string; // só COORDENADOR/ADMIN
}

export type DayReservationsResponse = BackendEnvelope<DayReservationItem[]>;
