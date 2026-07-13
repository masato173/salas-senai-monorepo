import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Sun, Moon, RefreshCw, Server, Database, Info } from 'lucide-react';
import { createAppsScriptService } from '../../../services/appsScript';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } from '../../../config';

// ─────────────────────────────────────────────────────────────
// AdminConfiguracoesPage — F6.8
//
// Configurações globais do painel admin:
//   1. Aparência (tema claro/escuro — localStorage)
//   2. Sincronização (link rápido + último sync)
//   3. Sistema (versão da API + link para /admin/sistema)
//   4. Informações do build (stack hardcoded)
// ─────────────────────────────────────────────────────────────

const BUILD_INFO = [
  {
    icon: <Database size={13} />,
    label: 'Banco de dados',
    value: 'Supabase PostgreSQL (São Paulo)',
  },
  { icon: null, label: 'Frontend', value: 'React 18 + Vite 5' },
  { icon: null, label: 'Backend', value: 'NestJS 10 + Prisma 5.22' },
  { icon: null, label: 'WebSocket', value: '/rooms (Socket.IO — F7.3)' },
  { icon: null, label: 'Monorepo', value: 'pnpm workspaces' },
];

function SectionCard({
  icon,
  title,
  children,
}: {
  icon: JSX.Element;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
        }}
      >
        <span style={{ color: 'var(--color-brand)' }}>{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text)' }}>{title}</span>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

export default function AdminConfiguracoesPage(): JSX.Element {
  const service = useMemo(() => {
    const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
    return createNestjsApiService(appsScript);
  }, []);

  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(() => {
    const t = document.documentElement.dataset['theme'];
    return t === 'dark' ? 'dark' : 'light';
  });
  const [lastSync, setLastSync] = useState<{ timestamp: string } | null | undefined>(undefined);
  const [healthVersion, setHealthVersion] = useState<string | null>(null);

  useEffect(() => {
    void service.fetchAuditLastSync().then(res => {
      setLastSync(res.ok ? res.data : null);
    });
    void service.fetchHealth().then(res => {
      if (res.ok && res.data !== null) setHealthVersion(res.data.version);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function applyTheme(next: 'light' | 'dark'): void {
    // TODO(F7): mover tema para Zustand themeStore.
    // Hoje: escrita dupla para efeito imediato sem alterar AppLayout.
    document.documentElement.dataset['theme'] = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* noop */
    }
    setLocalTheme(next);
  }

  function timeAgo(isoDate: string): string {
    const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
    if (diff < 60) return `há ${diff}s`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `há ${mins}min`;
    const hours = Math.floor(mins / 60);
    return `há ${hours}h`;
  }

  const btnBase = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 18px',
    borderRadius: 7,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    border: '1px solid var(--color-border)',
    transition: 'background 150ms, color 150ms',
  } as const;

  const btnActive = {
    ...btnBase,
    background: 'var(--color-brand)',
    color: '#fff',
    border: '1px solid var(--color-brand)',
  } as const;

  const btnInactive = {
    ...btnBase,
    background: 'var(--color-surface)',
    color: 'var(--color-muted)',
  } as const;

  const linkStyle = {
    color: 'var(--color-brand)',
    fontWeight: 500,
    textDecoration: 'none',
    fontSize: 13,
  } as const;

  return (
    <div style={{ padding: '28px 24px', maxWidth: 720 }}>
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
          <Settings size={18} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
            Configurações
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
            Parâmetros globais e preferências do painel administrativo.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─ Seção 1: Aparência ─ */}
        <SectionCard icon={<Sun size={15} />} title="Aparência">
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-muted)' }}>
            Preferência salva localmente no navegador.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={localTheme === 'light' ? btnActive : btnInactive}
              onClick={() => applyTheme('light')}
            >
              <Sun size={14} /> Claro
            </button>
            <button
              type="button"
              style={localTheme === 'dark' ? btnActive : btnInactive}
              onClick={() => applyTheme('dark')}
            >
              <Moon size={14} /> Escuro
            </button>
          </div>
        </SectionCard>

        {/* ─ Seção 2: Sincronização ─ */}
        <SectionCard icon={<RefreshCw size={15} />} title="Sincronização">
          <p
            style={{
              margin: '0 0 10px',
              fontSize: 13,
              color: 'var(--color-text)',
              fontFamily: lastSync !== undefined ? undefined : 'monospace',
            }}
          >
            {lastSync === undefined
              ? 'Carregando...'
              : lastSync === null
                ? 'Nunca sincronizado.'
                : `Última sincronização: ${timeAgo(lastSync.timestamp)}`}
          </p>
          <Link to="/admin/sync" style={linkStyle}>
            Ir para Sincronização →
          </Link>
        </SectionCard>

        {/* ─ Seção 3: Sistema ─ */}
        <SectionCard icon={<Server size={15} />} title="Sistema">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>
              Versão da API:{' '}
              <span
                style={{
                  fontFamily: 'DM Mono, monospace',
                  fontSize: 12,
                  color: 'var(--color-muted)',
                }}
              >
                {healthVersion ?? '—'}
              </span>
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>
              Ambiente:{' '}
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 8px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: 'var(--color-green-l)',
                  color: 'var(--color-green)',
                  border: '1px solid rgba(22,163,74,.25)',
                }}
              >
                Production
              </span>
            </p>
          </div>
          <Link to="/admin/sistema" style={linkStyle}>
            Ver status completo →
          </Link>
        </SectionCard>

        {/* ─ Seção 4: Informações do build ─ */}
        <SectionCard icon={<Info size={15} />} title="Informações do build">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {BUILD_INFO.map(({ icon, label, value }) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td
                    style={{
                      padding: '7px 0',
                      fontSize: 12,
                      color: 'var(--color-muted)',
                      width: '40%',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      {icon !== null && (
                        <span style={{ color: 'var(--color-subtle)', flexShrink: 0 }}>{icon}</span>
                      )}
                      {label}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '7px 0 7px 12px',
                      fontSize: 12,
                      color: 'var(--color-text)',
                      fontFamily: 'DM Mono, monospace',
                    }}
                  >
                    {value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}
