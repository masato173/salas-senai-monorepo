import React from 'react';
import type { ReservationStatus, Turno } from '../../types';

const STATUS_CONFIG: Record<ReservationStatus, { label: string; className: string }> = {
  PENDING:   { label: 'Pendente',   className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  APPROVED:  { label: 'Aprovada',   className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  REJECTED:  { label: 'Rejeitada',  className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
  CANCELLED: { label: 'Cancelada',  className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
};

const TURNO_CONFIG: Record<Turno, { label: string; className: string }> = {
  M: { label: 'Matutino',    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' },
  V: { label: 'Vespertino',  className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
  N: { label: 'Noturno',     className: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200' },
};

export function StatusBadge({ status }: { status: ReservationStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

export function TurnoBadge({ turno }: { turno: Turno | null }) {
  if (!turno) return <span className="text-xs text-gray-400">—</span>;
  const cfg = TURNO_CONFIG[turno];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}
