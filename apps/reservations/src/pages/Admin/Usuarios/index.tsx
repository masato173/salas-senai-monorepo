import { UserCog } from 'lucide-react';

export default function AdminUsuariosPage(): JSX.Element {
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
        <UserCog size={40} style={{ color: 'var(--color-brand)', marginBottom: 16 }} />
        <h1
          style={{
            margin: '0 0 8px',
            fontSize: 20,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          Gerenciamento de Usuários
        </h1>
        <p
          style={{
            margin: '0 0 20px',
            fontSize: 13,
            color: 'var(--color-muted)',
          }}
        >
          Cadastro, edição e controle de acesso dos usuários
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
          Disponível em F6.7
        </span>
      </div>
    </div>
  );
}
