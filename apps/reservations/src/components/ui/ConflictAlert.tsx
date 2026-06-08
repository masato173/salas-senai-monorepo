import React from 'react';
import type { Reservation } from '../../types';
import { OFFICIAL_SLOTS } from '../../validators/conflict';

interface ConflictAlertProps {
  conflicts: Reservation[];
  onDismiss: () => void;
}

export function ConflictAlert({ conflicts, onDismiss }: ConflictAlertProps) {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-red-600 text-lg" aria-hidden="true">⚠</span>
          <div>
            <p className="font-semibold text-red-800 dark:text-red-200 text-sm">
              Conflito de horário detectado
            </p>
            <ul className="mt-1 text-xs text-red-700 dark:text-red-300 space-y-1">
              {conflicts.map(c => (
                <li key={c.id}>
                  Sala {c.roomId} · {c.date} · {c.start}–{c.end} · {c.status}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Fechar alerta"
          className="text-red-500 hover:text-red-700 text-lg leading-none"
        >
          ×
        </button>
      </div>
    </div>
  );
}
