// ─────────────────────────────────────────────────────────────
// Tipos centrais do domínio — fonte da verdade para todo o app
// ─────────────────────────────────────────────────────────────

export type Turno  = 'M' | 'V' | 'N';
export type TurnoFiltro = Turno | 'TODOS';
export type ReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RoomType = 'SALA_COMUM' | 'LAB_GERAL' | 'LAB_INFORMATICA' | 'LAB_CLP' | 'LAB_ELETRICA' | 'LAB_SMT' | 'LAB_ELETRONICA';

// Slot de tempo
export interface TimeSlot {
  start: string; // 'HH:MM'
  end:   string; // 'HH:MM'
  turno?: Turno;
  label?: string;
}

// Registro vindo do Apps Script (planilha de ocupação)
export interface RegistroLegado {
  data:  string;
  sala:  string;
  turma: string;
  mes:   string;
  turno: Turno | null; // enriquecido via turnoMap
}

// Mapa turma→turno vindo do Apps Script
export interface TurnoMap {
  [turma: string]: Turno;
}

// Payload completo do Apps Script
export interface AppsScriptPayload {
  ok:       boolean;
  total:    number;
  dados:    Array<{ data: string; sala: string; turma: string; mes: string }>;
  turnoMap: TurnoMap;
}

// Sala
export interface Room {
  id:        string;
  name:      string;
  type:      RoomType;
  capacity?: number;
  floor?:    number;
  available: boolean;
}

// Reserva
export interface Reservation {
  id:        string;
  roomId:    string;
  userId:    string;
  date:      string; // YYYY-MM-DD
  start:     string; // HH:MM
  end:       string; // HH:MM
  turno:     Turno;
  status:    ReservationStatus;
  reason:    string;
  createdAt?: string;
  updatedAt?: string;
}

// DTO para criar reserva
export interface CreateReservationInput {
  roomId: string;
  userId: string;
  date:   string;
  start:  string;
  end:    string;
  turno:  Turno;
  reason: string;
}

// Resultado de validação
export interface ValidationResult {
  ok:      boolean;
  errors:  string[];
}

// Resultado de validação de slot
export interface SlotValidationResult {
  ok:     boolean;
  error?: string;
}
