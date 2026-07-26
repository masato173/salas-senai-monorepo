import { AlertCircle, X } from 'lucide-react';
import type { Reservation } from '../../types';

interface ConflictAlertProps {
  conflicts: Reservation[];
  onDismiss: () => void;
}

// F-fix — este componente usava classes Tailwind, mas o projeto nunca
// teve Tailwind instalado (renderizava sem nenhum estilo em produção).
// Reescrito com tokens do design system, reaproveitando a mesma
// linguagem visual do bloco de erro de Dashboard/index.tsx
// (AlertCircle + var(--color-red-l)/var(--color-red)).
export function ConflictAlert({ conflicts, onDismiss }: ConflictAlertProps) {
  if (conflicts.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        borderRadius: 'var(--radius-s)',
        border: '1px solid var(--color-red)',
        background: 'var(--color-red-l)',
        padding: '10px 14px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <AlertCircle
          size={14}
          style={{ color: 'var(--color-red)', flexShrink: 0, marginTop: '1px' }}
        />
        <div>
          <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--color-red)' }}>
            Conflito de horário detectado
          </p>
          <ul
            style={{
              margin: '4px 0 0',
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              fontSize: '12px',
              color: 'var(--color-red)',
            }}
          >
            {conflicts.map(c => (
              <li key={c.id}>
                Sala {c.roomId} · {c.date} · {c.start}–{c.end} · {c.status}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar alerta"
        className="conflict-alert-close"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-red)',
          padding: 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        <X size={14} />
      </button>
      <style>{`
        .conflict-alert-close { opacity: 0.7; transition: opacity var(--dur); }
        .conflict-alert-close:hover { opacity: 1; }
      `}</style>
    </div>
  );
}
