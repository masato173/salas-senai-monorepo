import { type CSSProperties, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Shield, LogOut } from 'lucide-react';
import { useAuthStore, selectUser } from '../../store/authStore';

const ROLE_LABEL: Record<string, string> = {
  PROFESSOR: 'Professor',
  COORDENADOR: 'Coordenador',
  ADMIN: 'Administrador',
};

const ROLE_COLOR: Record<string, { bg: string; color: string }> = {
  PROFESSOR: { bg: 'var(--color-blue-l)', color: 'var(--color-blue)' },
  COORDENADOR: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
  ADMIN: { bg: 'var(--color-red-l)', color: 'var(--color-red)' },
};

export default function PerfilPage(): JSX.Element {
  const user = useAuthStore(selectUser);
  const clearAuth = useAuthStore(s => s.clearAuth);
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) {
      void navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  if (user === null) return <></>;

  function handleLogout(): void {
    clearAuth();
    void navigate('/login', { replace: true });
  }

  const initial = (user.name ?? 'U').charAt(0).toUpperCase();
  const roleLabel = ROLE_LABEL[user.role] ?? user.role;
  const roleColor = ROLE_COLOR[user.role] ?? {
    bg: 'var(--color-surface-2)',
    color: 'var(--color-muted)',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Meu Perfil</h1>
          <p className="page-subtitle">Informações da sua conta</p>
        </div>
      </div>

      <div style={{ maxWidth: 480 }}>
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-s)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '32px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'var(--color-brand)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '-0.5px',
                userSelect: 'none',
              }}
            >
              {initial}
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--color-text)' }}>
                {user.name}
              </div>
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 12px',
                  borderRadius: 20,
                  background: roleColor.bg,
                  color: roleColor.color,
                }}
              >
                {roleLabel}
              </span>
            </div>
          </div>

          <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={fieldStyle}>
                <Mail
                  size={15}
                  strokeWidth={1.75}
                  style={{ color: 'var(--color-muted)', flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <div style={labelStyle}>E-mail</div>
                  <div style={valueStyle}>{user.email}</div>
                </div>
              </div>
              <div style={{ ...fieldStyle, borderBottom: 'none' }}>
                <Shield
                  size={15}
                  strokeWidth={1.75}
                  style={{ color: 'var(--color-muted)', flexShrink: 0, marginTop: 2 }}
                />
                <div>
                  <div style={labelStyle}>Papel</div>
                  <div style={valueStyle}>{roleLabel}</div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                marginTop: 24,
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '10px 16px',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                background: 'var(--color-surface)',
                color: 'var(--color-red)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <LogOut size={15} strokeWidth={1.75} />
              Sair da conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 12,
  padding: '12px 0',
  borderBottom: '1px solid var(--color-border)',
};

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: 2,
};

const valueStyle: CSSProperties = {
  fontSize: 13,
  color: 'var(--color-text)',
};
