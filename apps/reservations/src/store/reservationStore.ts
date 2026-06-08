import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Reservation, ReservationStatus, CreateReservationInput } from '../types';
import { detectConflicts } from '../hooks/useConflict';
import { validateReservation } from '../validators/reservation';
import { validateTimeInput } from '../validators/conflict';

interface ReservationStore {
  // Estado
  reservations: Reservation[];
  isLoading:    boolean;
  error:        string | null;

  // Actions
  addReservation:    (input: CreateReservationInput) => { ok: boolean; errors?: string[]; reservation?: Reservation };
  removeReservation: (id: string) => void;
  cancelReservation: (id: string, userId: string) => boolean;
  approveReservation:(id: string) => boolean;
  rejectReservation: (id: string) => boolean;
  clearError:        () => void;
}

let nextId = 1;

export const useReservationStore = create<ReservationStore>()(
  devtools(
    (set, get) => ({
      reservations: [],
      isLoading:    false,
      error:        null,

      addReservation(input) {
        // 1. Valida campos do DTO
        const dtValidation = validateReservation(input);
        if (!dtValidation.ok) {
          return { ok: false, errors: dtValidation.errors };
        }

        // 2. Valida horário (formato, duração, data futura)
        const timeValidation = validateTimeInput({
          start: input.start,
          end:   input.end,
          date:  input.date,
        });
        if (!timeValidation.ok) {
          return { ok: false, errors: [timeValidation.error!] };
        }

        // 3. Verifica conflito — REGRA MAIS IMPORTANTE
        const conflicts = detectConflicts(get().reservations, {
          roomId: input.roomId,
          date:   input.date,
          start:  input.start,
          end:    input.end,
        });
        if (conflicts.length > 0) {
          return {
            ok: false,
            errors: [`Conflito detectado com reserva(s): ${conflicts.map(c => c.id).join(', ')}`],
          };
        }

        // 4. Cria reserva com status PENDING
        const reservation: Reservation = {
          ...input,
          id:        `res-${nextId++}`,
          status:    'PENDING',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(s => ({ reservations: [...s.reservations, reservation] }));
        return { ok: true, reservation };
      },

      removeReservation(id) {
        set(s => ({ reservations: s.reservations.filter(r => r.id !== id) }));
      },

      cancelReservation(id, userId) {
        const r = get().reservations.find(r => r.id === id);
        if (!r || r.userId !== userId || r.status !== 'PENDING') return false;
        set(s => ({
          reservations: s.reservations.map(r =>
            r.id === id ? { ...r, status: 'CANCELLED' as ReservationStatus, updatedAt: new Date().toISOString() } : r,
          ),
        }));
        return true;
      },

      approveReservation(id) {
        const r = get().reservations.find(r => r.id === id);
        if (!r || r.status !== 'PENDING') return false;
        set(s => ({
          reservations: s.reservations.map(r =>
            r.id === id ? { ...r, status: 'APPROVED' as ReservationStatus, updatedAt: new Date().toISOString() } : r,
          ),
        }));
        return true;
      },

      rejectReservation(id) {
        const r = get().reservations.find(r => r.id === id);
        if (!r || r.status !== 'PENDING') return false;
        set(s => ({
          reservations: s.reservations.map(r =>
            r.id === id ? { ...r, status: 'REJECTED' as ReservationStatus, updatedAt: new Date().toISOString() } : r,
          ),
        }));
        return true;
      },

      clearError() { set({ error: null }); },
    }),
    { name: 'reservation-store' },
  ),
);
