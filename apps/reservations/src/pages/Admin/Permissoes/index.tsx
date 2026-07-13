import { ShieldCheck, BookOpen, CheckSquare, Crown } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// AdminPermissoesPage — F6.7
//
// Documentação estática dos papéis e permissões do sistema.
// RBAC: PROFESSOR → COORDENADOR → ADMIN (hierárquico).
// ─────────────────────────────────────────────────────────────

interface Permission {
  label: string;
  granted: boolean;
}

interface RoleCard {
  role: 'PROFESSOR' | 'COORDENADOR' | 'ADMIN';
  label: string;
  description: string;
  icon: JSX.Element;
  accent: string;
  accentLight: string;
  accentBorder: string;
  permissions: Permission[];
}

const ROLES: RoleCard[] = [
  {
    role: 'PROFESSOR',
    label: 'Professor',
    description:
      'Acesso padrão para docentes. Pode reservar salas e gerenciar suas próprias reservas.',
    icon: <BookOpen size={20} />,
    accent: 'var(--color-blue)',
    accentLight: 'var(--color-blue-l)',
    accentBorder: 'rgba(37,99,235,.25)',
    permissions: [
      { label: 'Criar reserva de sala', granted: true },
      { label: 'Criar reserva em período (multi-dia)', granted: true },
      { label: 'Visualizar calendário de reservas', granted: true },
      { label: 'Cancelar próprias reservas', granted: true },
      { label: 'Aprovar / rejeitar reservas', granted: false },
      { label: 'Gerenciar usuários', granted: false },
      { label: 'Acessar painel administrativo', granted: false },
      { label: 'Executar sincronização', granted: false },
    ],
  },
  {
    role: 'COORDENADOR',
    label: 'Coordenador',
    description:
      'Papel intermediário com controle sobre aprovações e visualização de todas as reservas.',
    icon: <CheckSquare size={20} />,
    accent: 'var(--color-accent)',
    accentLight: 'var(--color-accent-l)',
    accentBorder: 'rgba(224,124,43,.25)',
    permissions: [
      { label: 'Criar reserva de sala', granted: true },
      { label: 'Criar reserva em período (multi-dia)', granted: true },
      { label: 'Visualizar calendário de reservas', granted: true },
      { label: 'Cancelar próprias reservas', granted: true },
      { label: 'Aprovar / rejeitar reservas', granted: true },
      { label: 'Visualizar todas as reservas', granted: true },
      { label: 'Gerenciar usuários', granted: false },
      { label: 'Acessar painel administrativo', granted: false },
    ],
  },
  {
    role: 'ADMIN',
    label: 'Administrador',
    description:
      'Acesso total ao sistema. Gerencia usuários, monitora infraestrutura e executa operações privilegiadas.',
    icon: <Crown size={20} />,
    accent: 'var(--color-red)',
    accentLight: 'var(--color-red-l)',
    accentBorder: 'rgba(220,38,38,.25)',
    permissions: [
      { label: 'Criar reserva de sala', granted: true },
      { label: 'Criar reserva em período (multi-dia)', granted: true },
      { label: 'Visualizar calendário de reservas', granted: true },
      { label: 'Cancelar qualquer reserva', granted: true },
      { label: 'Aprovar / rejeitar reservas', granted: true },
      { label: 'Gerenciar usuários e papéis', granted: true },
      { label: 'Acessar painel administrativo', granted: true },
      { label: 'Executar sincronização', granted: true },
    ],
  },
];

function PermissionItem({ label, granted }: Permission): JSX.Element {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 0',
        fontSize: 13,
        color: granted ? 'var(--color-text)' : 'var(--color-subtle)',
        borderBottom: '1px solid var(--color-border)',
        listStyle: 'none',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 16,
          height: 16,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          background: granted ? 'var(--color-green-l)' : 'var(--color-surface-2)',
          color: granted ? 'var(--color-green)' : 'var(--color-subtle)',
          border: `1px solid ${granted ? 'rgba(22,163,74,.3)' : 'var(--color-border)'}`,
        }}
      >
        {granted ? '✓' : '✕'}
      </span>
      {label}
    </li>
  );
}

export default function AdminPermissoesPage(): JSX.Element {
  return (
    <div style={{ padding: '28px 24px', maxWidth: 1100 }}>
      {/* ─ Header ─ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <ShieldCheck size={18} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
            Papéis e Permissões
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
            RBAC hierárquico — cada papel inclui as permissões do nível anterior
          </p>
        </div>
      </div>

      {/* ─ Role cards ─ */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 16,
        }}
      >
        {ROLES.map(card => (
          <div
            key={card.role}
            style={{
              background: 'var(--color-surface)',
              border: `1px solid ${card.accentBorder}`,
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Card header */}
            <div
              style={{
                padding: '16px 20px',
                background: card.accentLight,
                borderBottom: `1px solid ${card.accentBorder}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: card.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                    {card.label}
                  </div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '1px 8px',
                      borderRadius: 20,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '.05em',
                      textTransform: 'uppercase',
                      background: card.accent,
                      color: '#fff',
                    }}
                  >
                    {card.role}
                  </span>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)', lineHeight: 1.5 }}>
                {card.description}
              </p>
            </div>

            {/* Permissions list */}
            <ul style={{ margin: 0, padding: '8px 20px 12px' }}>
              {card.permissions.map(perm => (
                <PermissionItem key={perm.label} {...perm} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ─ Note ─ */}
      <div
        style={{
          marginTop: 20,
          padding: '10px 14px',
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--color-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <ShieldCheck size={13} style={{ flexShrink: 0 }} />
        Permissões são validadas no backend via guard JWT + RBAC. O frontend aplica restrições
        preventivas apenas como UX.
      </div>
    </div>
  );
}
