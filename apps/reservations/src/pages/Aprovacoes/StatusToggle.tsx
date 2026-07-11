import type { ReactNode } from 'react';

export type ApprovalMode = 'PENDING' | 'all';

interface StatusToggleProps {
  value: ApprovalMode;
  onChange: (value: ApprovalMode) => void;
  pendingCount: number;
}

export function StatusToggle({ value, onChange, pendingCount }: StatusToggleProps): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Filtrar por status"
      style={{
        display: 'inline-flex',
        padding: 3,
        gap: 2,
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
        borderRadius: 999,
      }}
    >
      <ToggleButton active={value === 'PENDING'} onClick={() => onChange('PENDING')}>
        Pendentes
        {pendingCount > 0 && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 18,
              height: 18,
              padding: '0 5px',
              borderRadius: 999,
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            {pendingCount}
          </span>
        )}
      </ToggleButton>
      <ToggleButton active={value === 'all'} onClick={() => onChange('all')}>
        Histórico
      </ToggleButton>
    </div>
  );
}

interface ToggleButtonProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToggleButton({ active, onClick, children }: ToggleButtonProps): JSX.Element {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        border: 'none',
        borderRadius: 999,
        background: active ? 'var(--color-surface)' : 'transparent',
        color: active ? 'var(--color-brand)' : 'var(--color-muted)',
        boxShadow: active ? 'var(--shadow-s)' : 'none',
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'background var(--dur) var(--ease), color var(--dur) var(--ease)',
      }}
    >
      {children}
    </button>
  );
}
