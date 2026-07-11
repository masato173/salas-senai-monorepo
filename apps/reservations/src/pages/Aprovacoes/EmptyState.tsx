import { ClipboardCheck, Clock } from 'lucide-react';
import type { ApprovalMode } from './StatusToggle';

interface EmptyStateProps {
  mode: ApprovalMode;
}

export function EmptyState({ mode }: EmptyStateProps): JSX.Element {
  const Icon = mode === 'PENDING' ? ClipboardCheck : Clock;
  const message =
    mode === 'PENDING' ? 'Nenhuma reserva aguardando aprovação.' : 'Nenhum registro no histórico.';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '64px 24px',
        textAlign: 'center',
        color: 'var(--color-subtle)',
      }}
    >
      <Icon size={40} strokeWidth={1.5} aria-hidden="true" />
      <p style={{ margin: 0, fontSize: 13.5 }}>{message}</p>
    </div>
  );
}
