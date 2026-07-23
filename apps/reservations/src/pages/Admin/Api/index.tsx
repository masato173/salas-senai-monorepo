import { Braces } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// AdminApiPage — F6.8
//
// Página estática: documentação dos endpoints REST + WebSocket.
// Usa <details> nativo para agrupamento por módulo.
// ─────────────────────────────────────────────────────────────

interface Endpoint {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'WS';
  path: string;
  auth: '@Public' | 'JWT' | 'COORDENADOR+' | 'ADMIN';
  desc: string;
}

interface ApiModule {
  name: string;
  endpoints: Endpoint[];
}

const API_MODULES: ApiModule[] = [
  {
    name: 'Auth',
    endpoints: [
      {
        method: 'POST',
        path: '/auth/login',
        auth: '@Public',
        desc: 'Autenticar usuário e obter tokens JWT.',
      },
      {
        method: 'POST',
        path: '/auth/refresh',
        auth: '@Public',
        desc: 'Renovar accessToken via refreshToken.',
      },
      { method: 'POST', path: '/auth/logout', auth: 'JWT', desc: 'Revogar refreshToken atual.' },
    ],
  },
  {
    name: 'Health',
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        auth: '@Public',
        desc: 'Status, versão e uptime do servidor.',
      },
    ],
  },
  {
    name: 'Rooms',
    endpoints: [
      {
        method: 'GET',
        path: '/rooms',
        auth: '@Public',
        desc: 'Listar salas disponíveis (34 salas).',
      },
      { method: 'GET', path: '/rooms/:id', auth: '@Public', desc: 'Detalhes de uma sala.' },
      {
        method: 'GET',
        path: '/rooms/admin/all',
        auth: 'ADMIN',
        desc: 'Listar todas as salas (incluindo inativas).',
      },
      { method: 'POST', path: '/rooms', auth: 'ADMIN', desc: 'Criar nova sala.' },
      { method: 'PATCH', path: '/rooms/:id', auth: 'ADMIN', desc: 'Atualizar sala existente.' },
      { method: 'DELETE', path: '/rooms/:id', auth: 'ADMIN', desc: 'Remover sala.' },
    ],
  },
  {
    name: 'Reservations',
    endpoints: [
      {
        method: 'GET',
        path: '/reservations',
        auth: 'JWT',
        desc: 'Listar reservas (filtros: roomId, date, status, mine).',
      },
      { method: 'GET', path: '/reservations/:id', auth: 'JWT', desc: 'Detalhes de uma reserva.' },
      { method: 'POST', path: '/reservations', auth: 'JWT', desc: 'Criar nova reserva.' },
      {
        method: 'PATCH',
        path: '/reservations/:id/status',
        auth: 'COORDENADOR+',
        desc: 'Aprovar ou rejeitar reserva.',
      },
      {
        method: 'PATCH',
        path: '/reservations/:id',
        auth: 'JWT',
        desc: 'Atualizar reserva existente.',
      },
      { method: 'DELETE', path: '/reservations/:id', auth: 'JWT', desc: 'Cancelar reserva.' },
    ],
  },
  {
    name: 'Availability',
    endpoints: [
      {
        method: 'GET',
        path: '/availability',
        auth: '@Public',
        desc: 'Disponibilidade por sala para uma data (date obrigatório, turno opcional). Retorna: livre | reserva | aula | conflito.',
      },
    ],
  },
  {
    name: 'Schedules',
    endpoints: [
      {
        method: 'GET',
        path: '/schedules',
        auth: '@Public',
        desc: 'Aulas sincronizadas do Apps Script ({ registros, turnoMap }).',
      },
    ],
  },
  {
    name: 'Sync',
    endpoints: [
      {
        method: 'POST',
        path: '/sync/schedules',
        auth: 'ADMIN',
        desc: 'Sincronizar aulas do Apps Script para o banco (DELETE + INSERT batch 500).',
      },
    ],
  },
  {
    name: 'Audit',
    endpoints: [
      {
        method: 'GET',
        path: '/audit',
        auth: 'ADMIN',
        desc: 'Trilha de auditoria (filtros: entityType, entityId, userId, action, from, to, page, limit max 100).',
      },
    ],
  },
  {
    name: 'Users',
    endpoints: [
      {
        method: 'GET',
        path: '/users',
        auth: 'ADMIN',
        desc: 'Listar usuários (filtros: name, email, role, page, limit max 50).',
      },
      {
        method: 'PATCH',
        path: '/users/:id/role',
        auth: 'ADMIN',
        desc: 'Alterar role de usuário (proíbe auto-rebaixamento).',
      },
      {
        method: 'PATCH',
        path: '/users/:id/active',
        auth: 'ADMIN',
        desc: 'Ativar ou desativar usuário (proíbe auto-desativação).',
      },
    ],
  },
  {
    name: 'WebSocket',
    endpoints: [
      {
        method: 'WS',
        path: '/rooms',
        auth: 'JWT',
        desc: 'Conexão WebSocket (namespace /rooms). Eventos: reservation.created | updated | approved | rejected | cancelled. JWT obrigatório no handshake.',
      },
    ],
  },
];

const METHOD_STYLE: Record<Endpoint['method'], { bg: string; color: string }> = {
  GET: { bg: 'var(--color-blue-l)', color: 'var(--color-blue)' },
  POST: { bg: 'var(--color-green-l)', color: 'var(--color-green)' },
  PATCH: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
  DELETE: { bg: 'var(--color-red-l)', color: 'var(--color-red)' },
  WS: { bg: 'var(--color-surface-2)', color: 'var(--color-muted)' },
};

const AUTH_STYLE: Record<Endpoint['auth'], { bg: string; color: string; border: string }> = {
  '@Public': {
    bg: 'var(--color-surface-2)',
    color: 'var(--color-subtle)',
    border: 'var(--color-border)',
  },
  JWT: {
    bg: 'var(--color-blue-l)',
    color: 'var(--color-blue)',
    border: 'rgba(37,99,235,.25)',
  },
  'COORDENADOR+': {
    bg: 'var(--color-accent-l)',
    color: 'var(--color-accent)',
    border: 'rgba(224,124,43,.25)',
  },
  ADMIN: {
    bg: 'var(--color-brand)',
    color: '#fff',
    border: 'transparent',
  },
};

function MethodBadge({ method }: { method: Endpoint['method'] }): JSX.Element {
  const s = METHOD_STYLE[method];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '.04em',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        background: s.bg,
        color: s.color,
        flexShrink: 0,
        minWidth: 46,
        textAlign: 'center',
      }}
    >
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: Endpoint['auth'] }): JSX.Element {
  const s = AUTH_STYLE[auth];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 7px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.03em',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        flexShrink: 0,
      }}
    >
      {auth}
    </span>
  );
}

export default function AdminApiPage(): JSX.Element {
  return (
    <>
      <style>{`
        details > *:not(summary) { animation: apiReveal 150ms ease; }
        @keyframes apiReveal { from { opacity: 0; } to { opacity: 1; } }
        details summary { cursor: pointer; list-style: none; }
        details summary::-webkit-details-marker { display: none; }
      `}</style>

      <div style={{ padding: '28px 24px', maxWidth: 900 }}>
        {/* ─ Header ─ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <Braces size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                API Reference
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
                Documentação dos endpoints REST da plataforma.
              </p>
            </div>
          </div>
          <span
            style={{
              display: 'inline-block',
              padding: '5px 12px',
              borderRadius: 6,
              fontSize: 12,
              fontFamily: 'DM Sans, system-ui, sans-serif',
              fontVariantNumeric: 'tabular-nums',
              background: 'var(--color-surface-2)',
              color: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              alignSelf: 'center',
            }}
          >
            http://localhost:3000 (dev)
          </span>
        </div>

        {/* ─ Modules ─ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {API_MODULES.map(mod => (
            <details
              key={mod.name}
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 9,
                overflow: 'hidden',
              }}
            >
              <summary
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'var(--color-surface-2)',
                  borderBottom: '1px solid var(--color-border)',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text)' }}>
                  {mod.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-subtle)',
                    fontFamily: 'DM Sans, system-ui, sans-serif',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {mod.endpoints.length} endpoint{mod.endpoints.length !== 1 ? 's' : ''}
                </span>
              </summary>

              <div style={{ padding: '6px 0' }}>
                {mod.endpoints.map((ep, i) => (
                  <div
                    key={`${ep.method}-${ep.path}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '9px 16px',
                      borderBottom:
                        i < mod.endpoints.length - 1 ? '1px solid var(--color-border)' : 'none',
                    }}
                  >
                    <MethodBadge method={ep.method} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          flexWrap: 'wrap',
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'DM Sans, system-ui, sans-serif',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: 12,
                            color: 'var(--color-text)',
                            fontWeight: 500,
                          }}
                        >
                          {ep.path}
                        </span>
                        <AuthBadge auth={ep.auth} />
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>{ep.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}
