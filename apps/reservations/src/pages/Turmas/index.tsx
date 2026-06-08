import React from 'react';
import { Users } from 'lucide-react';

export default function TurmasPage() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Turmas</h1>
          <p className="page-subtitle">Listagem e gestão de turmas e turnos</p>
        </div>
        <span className="badge-wip">Fase 4 — NestJS + PostgreSQL</span>
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
        <div key="Matutino (M)" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-amber-l)', color: 'var(--color-amber)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Matutino (M)</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Manhã · 07:30–12:00</div>
          </div>
        </div>
        <div key="Vespertino (V)" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-green-l)', color: 'var(--color-green)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Vespertino (V)</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Tarde · 13:00–17:30</div>
          </div>
        </div>
        <div key="Noturno (N)" style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--color-blue-l)', color: 'var(--color-blue)', display: 'grid', placeItems: 'center', flexShrink: 0, fontSize: '16px' }}>
            ▸
          </span>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 500 }}>Noturno (N)</div>
            <div style={{ fontSize: '11px', color: 'var(--color-muted)' }}>Noite · 18:30–22:00</div>
          </div>
        </div>
        </div>

        {/* Estado em desenvolvimento */}
        <div className="empty-page" style={{ minHeight: 200, gap: 12 }}>
          <div className="empty-page-icon">👥</div>
          <div className="empty-page-title">Turmas</div>
          <p className="empty-page-sub">Turmas organizadas por turno (M/V/N) com vinculação automática via Google Sheets.</p>
          <span className="badge-wip">
            <Users size={12} strokeWidth={2} />
            {" "}Fase 4 — NestJS + PostgreSQL
          </span>
        </div>
      </div>
    </div>
  );
}
