import { Building2 } from 'lucide-react';

export default function SalasPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Salas</h1>
          <p className="page-subtitle">Cadastro e gestão das 35 salas oficiais</p>
        </div>
        <span className="badge-wip">Fase 4 — NestJS + PostgreSQL</span>
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
            key="Sala Comum"
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
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Sala Comum</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>20 salas</div>
            </div>
          </div>
          <div
            key="Lab. Informática"
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
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Lab. Informática</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>5 labs</div>
            </div>
          </div>
          <div
            key="Lab. CLP / Elétrica"
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
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Lab. CLP / Elétrica</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>6 labs</div>
            </div>
          </div>
          <div
            key="Lab. SMT / Eletrônica"
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
                background: 'var(--color-red-l)',
                color: 'var(--color-red)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                fontSize: '16px',
              }}
            >
              ▸
            </span>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Lab. SMT / Eletrônica</div>
              <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>4 labs</div>
            </div>
          </div>
        </div>

        {/* Estado em desenvolvimento */}
        <div className="empty-page" style={{ minHeight: 200, gap: 12 }}>
          <div className="empty-page-icon">🏛</div>
          <div className="empty-page-title">Salas</div>
          <p className="empty-page-sub">
            35 salas oficiais: comuns, laboratórios gerais, informática, CLP, elétrica, SMT e
            eletrônica.
          </p>
          <span className="badge-wip">
            <Building2 size={12} strokeWidth={2} /> Fase 4 — NestJS + PostgreSQL
          </span>
        </div>
      </div>
    </div>
  );
}
