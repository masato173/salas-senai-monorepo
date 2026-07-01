import { Settings } from 'lucide-react';

export default function ConfiguracoesPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Configurações</h1>
          <p className="page-subtitle">Preferências e administração do sistema</p>
        </div>
        <span className="badge-wip">Fase 4 — NestJS + RBAC</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        {/* Preview do módulo */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-s)',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Módulo — preview</span>
          </div>
          <div
            key="Usuários"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--color-blue-l)',
                color: 'var(--color-blue)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              ▸
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Usuários</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                Professores e coordenadores
              </div>
            </div>
          </div>
          <div
            key="Permissões RBAC"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--color-amber-l)',
                color: 'var(--color-amber)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              ▸
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Permissões RBAC</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                Professor / Coordenador / Admin
              </div>
            </div>
          </div>
          <div
            key="Integrações"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--color-green-l)',
                color: 'var(--color-green)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              ▸
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Integrações</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>
                Google Sheets, Apps Script
              </div>
            </div>
          </div>
        </div>

        {/* Estado em desenvolvimento */}
        <div className="empty-page" style={{ minHeight: 200, gap: 12 }}>
          <div className="empty-page-icon">⚙️</div>
          <div className="empty-page-title">Configurações</div>
          <p className="empty-page-sub">
            Gerenciamento de usuários, permissões RBAC, integrações e preferências gerais.
          </p>
          <span className="badge-wip">
            <Settings size={12} strokeWidth={2} /> Fase 4 — NestJS + RBAC
          </span>
        </div>
      </div>
    </div>
  );
}
