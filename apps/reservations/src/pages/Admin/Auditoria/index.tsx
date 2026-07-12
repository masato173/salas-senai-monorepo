import { ScrollText } from 'lucide-react';

export default function AdminAuditoriaPage(): JSX.Element {
  return (
    <div style={{ padding: '32px 28px', maxWidth: 680, margin: '0 auto' }}>
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '40px 32px',
          textAlign: 'center',
        }}
      >
        <ScrollText size={40} style={{ color: 'var(--color-brand)', marginBottom: 16 }} />
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          Auditoria
        </h1>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: 'var(--color-muted)',
          }}
        >
          Trilha completa de todas as ações realizadas no sistema
        </p>
        <span
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            background: 'var(--color-amber-l)',
            color: 'var(--color-amber)',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Disponível em F6.4
        </span>
      </div>
    </div>
  );
}
