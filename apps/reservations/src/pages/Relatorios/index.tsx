import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function RelatoriosPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="page-subtitle">Métricas, exportações e análises</p>
        </div>
        <span className="badge-wip">Fase 5 — SaaS completo</span>
      </div>

      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px',
        alignItems: 'start',
      }}>
        {/* Preview do módulo */}
        <div style={{
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-s)', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontWeight: 600, fontSize: '13px' }}>Módulo — preview</span>
          </div>
        <div key="Salas mais usadas" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-blue-l)', color: 'var(--color-blue)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Salas mais usadas</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Ranking mensal</div>
          </div>
        </div>
        <div key="Taxa de ocupação" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-green-l)', color: 'var(--color-green)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Taxa de ocupação</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Por turno/sala</div>
          </div>
        </div>
        <div key="Exportação PDF/Excel" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-amber-l)', color: 'var(--color-amber)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Exportação PDF/Excel</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Relatórios gerenciais</div>
          </div>
        </div>
        <div key="Audit Trail" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-red-l)', color: 'var(--color-red)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Audit Trail</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Log de ações</div>
          </div>
        </div>
        </div>

        {/* Estado em desenvolvimento */}
        <div className="empty-page" style={{ minHeight: 200, gap: 12 }}>
          <div className="empty-page-icon">📊</div>
          <div className="empty-page-title">Relatórios</div>
          <p className="empty-page-sub">Exportação PDF/Excel, salas mais usadas, horários mais ocupados e audit trail.</p>
          <span className="badge-wip">
            <BarChart3 size={12} strokeWidth={2} />
            {" "}Fase 5 — SaaS completo
          </span>
        </div>
      </div>
    </div>
  );
}
