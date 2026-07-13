// ─────────────────────────────────────────────────────────────
// Tipos centrais do domínio — fonte da verdade para todo o app
// ─────────────────────────────────────────────────────────────

export type Turno = 'M' | 'V' | 'N';
export type TurnoFiltro = Turno | 'TODOS';
export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RoomType =
  | 'SALA_COMUM'
  | 'LAB_GERAL'
  | 'LAB_INFORMATICA'
  | 'LAB_CLP'
  | 'LAB_ELETRICA'
  | 'LAB_SMT'
  | 'LAB_ELETRONICA';

// Slot de tempo
export interface TimeSlot {
  start: string; // 'HH:MM'
  end: string; // 'HH:MM'
  turno?: Turno;
  label?: string;
}

// Registro vindo do Apps Script (planilha de ocupação)
export interface RegistroLegado {
  data: string;
  sala: string;
  turma: string;
  mes: string;
  turno: Turno | null; // enriquecido via turnoMap
}

// Mapa turma→turno vindo do Apps Script
export interface TurnoMap {
  [turma: string]: Turno;
}

// Payload completo do Apps Script
export interface AppsScriptPayload {
  ok: boolean;
  total: number;
  dados: Array<{ data: string; sala: string; turma: string; mes: string; turno?: Turno | null }>;
  turnoMap: TurnoMap;
}

// Sala
export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity?: number;
  floor?: number;
  available: boolean;
}

// Reserva
export interface Reservation {
  id: string;
  roomId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string; // HH:MM
  turno: Turno;
  status: ReservationStatus;
  reason: string;
  createdAt?: string;
  updatedAt?: string;
}

// DTO para criar reserva
export interface CreateReservationInput {
  roomId: string;
  userId: string;
  date: string;
  start: string;
  end: string;
  turno: Turno;
  reason: string;
}

// Resultado de validação
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

// Resultado de validação de slot
export interface SlotValidationResult {
  ok: boolean;
  error?: string;
}

// ─── Sprint Disponibilidade S1 ────────────────────────────────

/** Status dominante de uma sala num intervalo consultado. */
export type RoomStatus = 'livre' | 'aula' | 'reserva' | 'conflito';
// 'conflito' = aula + reserva sobrepostos (S4 resolve no backend)

/** Evento que ocupa uma sala num intervalo. */
export interface SalaEvento {
  tipo: 'aula' | 'reserva';
  sala: string;
  data: string; // YYYY-MM-DD
  inicio: string; // HH:MM
  fim: string; // HH:MM
  turno?: Turno | null; // presente em aula; ausente em reserva
  turma?: string; // presente em aula
  professor?: string; // presente em reserva
  id?: string; // id da reserva (tipo=reserva)
}

/** Disponibilidade de uma sala num dia (ou filtro de turno). */
export interface DisponibilidadeSala {
  sala: string;
  status: RoomStatus; // pior caso: conflito > aula > reserva > livre
  eventos: SalaEvento[];
}

/** Resultado do buildRoomAvailability. */
export interface AvailabilityResult {
  data: string; // YYYY-MM-DD consultado
  turno?: Turno; // filtro aplicado (undefined = dia todo)
  salas: DisponibilidadeSala[];
  geradoEm: string; // new Date().toISOString()
}

// ─── Paginação genérica — F6.4 ────────────────────────────────
// Reutilizável em Usuários (F6.7), Sync logs (F6.5), Relatórios.
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// AuditLog público — espelha AuditListResult do backend
export interface AuditLog {
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

// Query tipada para GET /audit
export interface AuditQuery {
  action?: string;
  entityType?: string;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  page: number;
  limit: number;
}
