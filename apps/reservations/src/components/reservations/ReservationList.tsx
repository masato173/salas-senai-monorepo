import React from 'react';
import { useReservationStore } from '../../store/reservationStore';
import { StatusBadge, TurnoBadge } from '../ui/StatusBadge';

interface ReservationListProps {
  userId?:       string;   // filtra por usuário se fornecido
  showApproval?: boolean;  // exibe botões de aprovação (coordenador)
}

export function ReservationList({ userId, showApproval = false }: ReservationListProps) {
  const { reservations, cancelReservation, approveReservation, rejectReservation } =
    useReservationStore();

  const filtered = userId
    ? reservations.filter(r => r.userId === userId)
    : reservations;

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-4xl mb-3">📅</p>
        <p className="font-medium">Nenhuma reserva encontrada</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="text-left py-3 px-4 font-semibold">Data</th>
            <th className="text-left py-3 px-4 font-semibold">Sala</th>
            <th className="text-left py-3 px-4 font-semibold">Horário</th>
            <th className="text-left py-3 px-4 font-semibold">Turno</th>
            <th className="text-left py-3 px-4 font-semibold">Status</th>
            <th className="text-left py-3 px-4 font-semibold">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {filtered.map(r => (
            <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
              <td className="py-3 px-4 font-medium">{r.date}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{r.roomId}</td>
              <td className="py-3 px-4 text-gray-600 dark:text-gray-300">{r.start}–{r.end}</td>
              <td className="py-3 px-4"><TurnoBadge turno={r.turno} /></td>
              <td className="py-3 px-4"><StatusBadge status={r.status} /></td>
              <td className="py-3 px-4">
                <div className="flex gap-2">
                  {showApproval && r.status === 'PENDING' && (
                    <>
                      <button
                        onClick={() => approveReservation(r.id)}
                        className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 font-medium"
                        aria-label={`Aprovar reserva ${r.id}`}
                      >
                        Aprovar
                      </button>
                      <button
                        onClick={() => rejectReservation(r.id)}
                        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 font-medium"
                        aria-label={`Rejeitar reserva ${r.id}`}
                      >
                        Rejeitar
                      </button>
                    </>
                  )}
                  {!showApproval && r.status === 'PENDING' && r.userId === userId && (
                    <button
                      onClick={() => cancelReservation(r.id, r.userId)}
                      className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-medium"
                      aria-label={`Cancelar reserva ${r.id}`}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
