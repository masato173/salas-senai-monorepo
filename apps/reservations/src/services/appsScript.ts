import { esc } from '../utils/sanitize';
import type { AppsScriptPayload, RegistroLegado, TurnoMap } from '../types';

interface AppsScriptConfig {
  url:   string;
  token: string;
}

interface ScheduleResult {
  registros: RegistroLegado[];
  turnoMap:  TurnoMap;
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
  code:    BackendErrorCode;
  message: string;
  // Extensão para createReservationRange: lista de datas (YYYY-MM-DD) que conflitaram.
  // Opcional para preservar compatibilidade com erros do createReservation.
  details?: {
    conflicts?: string[];
  };
}

export interface BackendEnvelope<T> {
  ok:    boolean;
  data:  T | null;
  error: BackendError | null;
}

export interface ReservationPayload {
  sala:       string; // NOME real ("603 Sala"), não o id interno
  data:       string; // YYYY-MM-DD
  inicio:     string; // HH:MM
  fim:        string; // HH:MM
  professor:  string;
  turma:      string;
  observacao: string;
}

export interface CreateReservationRequest {
  userEmail:        string;
  payload:          ReservationPayload;
  clientRequestId?: string; // omitido → service gera via crypto.randomUUID
}

// TODO(tech-debt): tipo vago. CreatedReservationRow (abaixo) já reflete o shape real
// retornado por rowToObj no backend. Apertar este aqui exige revisar useCreateReservation
// e ReservationForm — adiar para cleanup futuro junto com os erros pré-existentes do tsc.
export type CreateReservationResponse = BackendEnvelope<{ id?: string } & Record<string, unknown>>;

// ── Reserva em período (multi-dia, mesma sala/horário) ──
export interface ReservationRangePayload {
  sala:       string; // NOME real ("603 Sala")
  dataInicio: string; // YYYY-MM-DD (inclusivo)
  dataFim:    string; // YYYY-MM-DD (inclusivo)
  diasSemana: number[]; // 0=dom .. 6=sáb
  inicio:     string; // HH:MM
  fim:        string; // HH:MM
  professor:  string;
  turma:      string;
  observacao: string;
}

export interface CreateReservationRangeRequest {
  userEmail:        string;
  payload:          ReservationRangePayload;
  clientRequestId?: string;
}

// Espelha rowToObj() do backend (codigo.gs) — 12 campos base + groupId (opcional).
// clientRequestId é metadado de linha (col M), não exposto no retorno.
// groupId (col N, Sprint 4 Fase A): única → groupId === id; período → UUID único compartilhado
// por todas as linhas. Opcional para reservas legacy criadas antes da Fase A (devolve '').
export interface CreatedReservationRow {
  id:         string;
  sala:       string;
  data:       string;  // YYYY-MM-DD
  inicio:     string;  // HH:MM
  fim:        string;  // HH:MM
  professor:  string;
  turma:      string;
  observacao: string;
  status:     string;  // 'ACTIVE' por enquanto
  createdBy:  string;  // userEmail
  createdAt:  string;  // ISO
  updatedAt:  string;  // ISO
  groupId?:   string;  // Sprint 4 Fase A — vazio para reservas legacy
}

export type CreateReservationRangeResponse = BackendEnvelope<{
  count:        number;
  reservations: CreatedReservationRow[];
}>;

// ── Sprint 3: listReservations + cancelReservation ──

// TODO(tech-debt): shape `{ count, reservations }` é duplicado entre
// CreateReservationRangeResponse e ListReservationsResponse. Unificar
// em cleanup futuro pra evitar tocar código estável agora.
export type ListReservationsResponse = BackendEnvelope<{
  count:        number;
  reservations: CreatedReservationRow[];
}>;

export interface ListReservationsOptions {
  includeCancelled?: boolean;
}

export interface CancelReservationPayload {
  id: string;
}

export interface CancelReservationRequest {
  userEmail:        string;
  payload:          CancelReservationPayload;
  clientRequestId?: string;
}

export type CancelReservationResponse = BackendEnvelope<CreatedReservationRow>;

interface AppsScriptService {
  fetchSchedule:          () => Promise<ScheduleResult>;
  createReservation:      (req: CreateReservationRequest)      => Promise<CreateReservationResponse>;
  createReservationRange: (req: CreateReservationRangeRequest) => Promise<CreateReservationRangeResponse>;
  listReservations:       (options?: ListReservationsOptions)  => Promise<ListReservationsResponse>;
  cancelReservation:      (req: CancelReservationRequest)      => Promise<CancelReservationResponse>;
}

/**
 * Adapter para o Google Apps Script existente.
 * Mantém compatibilidade total com o payload legado.
 * Enriquece cada registro com o turno do turnoMap.
 * Sanitiza todos os campos de texto contra XSS.
 */
export function createAppsScriptService(config: AppsScriptConfig): AppsScriptService {
  return {
    async fetchSchedule(): Promise<ScheduleResult> {
      const url  = `${config.url}?token=${encodeURIComponent(config.token)}`;
      const res  = await fetch(url);
      const data = await res.json() as Partial<AppsScriptPayload> & { error?: string };

      if (data.error) {
        throw new Error('Falha ao carregar dados.');
      }

      const rawDados    = data.dados    ?? [];
      const turnoMap    = data.turnoMap ?? {};

      // Enriquece + sanitiza cada registro
      const registros: RegistroLegado[] = rawDados.map(r => {
        // Resolve turno — suporta "APB.X/APB.Y"
        const turno = resolveTurno(r.turma, turnoMap);

        return {
          data:  r.data,
          sala:  esc(r.sala),   // sanitiza contra XSS
          turma: esc(r.turma),  // sanitiza contra XSS
          mes:   esc(r.mes),
          turno,
        };
      });

      return { registros, turnoMap };
    },

    async createReservation(req): Promise<CreateReservationResponse> {
      const body = JSON.stringify({
        action:          'createReservation',
        clientRequestId: req.clientRequestId ?? crypto.randomUUID(),
        userEmail:       req.userEmail,
        payload:         req.payload,
      });

      // Content-Type "text/plain" evita preflight CORS no Apps Script.
      const res = await fetch(config.url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });

      return (await res.json()) as CreateReservationResponse;
    },

    async createReservationRange(req): Promise<CreateReservationRangeResponse> {
      const body = JSON.stringify({
        action:          'createReservationRange',
        clientRequestId: req.clientRequestId ?? crypto.randomUUID(),
        userEmail:       req.userEmail,
        payload:         req.payload,
      });

      const res = await fetch(config.url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });

      return (await res.json()) as CreateReservationRangeResponse;
    },

    async listReservations(options): Promise<ListReservationsResponse> {
      const params = new URLSearchParams({
        token:  config.token,
        action: 'listReservations',
      });
      if (options?.includeCancelled) params.set('includeCancelled', 'true');

      const res = await fetch(`${config.url}?${params.toString()}`);
      return (await res.json()) as ListReservationsResponse;
    },

    async cancelReservation(req): Promise<CancelReservationResponse> {
      const body = JSON.stringify({
        action:          'cancelReservation',
        clientRequestId: req.clientRequestId ?? crypto.randomUUID(),
        userEmail:       req.userEmail,
        payload:         req.payload,
      });

      const res = await fetch(config.url, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });

      return (await res.json()) as CancelReservationResponse;
    },
  };
}

function resolveTurno(turma: string, map: TurnoMap) {
  const chave = turma.trim();
  if (map[chave]) return map[chave];
  for (const parte of chave.split('/')) {
    const t = map[parte.trim()];
    if (t) return t;
  }
  return null;
}
