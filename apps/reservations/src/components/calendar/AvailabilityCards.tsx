import React from 'react';
import { CheckCircle2, XCircle, Clock, Building2 } from 'lucide-react';

// ── Tipos ──────────────────────────────────────────────────────
interface SummaryData {
  totalSalas:     number;
  livres:         number;
  ocupadas:       number;
  reservasPendentes: number;
}

interface AvailabilityCardsProps {
  data:      SummaryData;
  isLoading: boolean;
}

// ── Skeleton de um card ────────────────────────────────────────
function CardSkeleton() {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      boxShadow: 'var(--shadow-s)',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: 'var(--color-border)',
        animation: 'skeletonPulse 1.2s ease-in-out infinite',
        flexShrink: 0,
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          height: 18, width: '50%', borderRadius: 4,
          background: 'var(--color-border)',
          animation: 'skeletonPulse 1.2s ease-in-out infinite',
          marginBottom: 6,
        }} />
        <div style={{
          height: 11, width: '70%', borderRadius: 4,
          background: 'var(--color-surface-2)',
          animation: 'skeletonPulse 1.2s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes skeletonPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .4; }
        }
      `}</style>
    </div>
  );
}

// ── Card individual ────────────────────────────────────────────
interface StatCardProps {
  icon:  React.ReactNode;
  value: number;
  label: string;
  color: string;
  bg:    string;
  hint?: string;
}

function StatCard({ icon, value, label, color, bg, hint }: StatCardProps) {
  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      padding: '14px 16px',
      boxShadow: 'var(--shadow-s)',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 8,
        background: bg, color,
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        {icon}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, color }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 2 }}>{label}</div>
        {hint && <div style={{ fontSize: 10, color: 'var(--color-subtle)', marginTop: 1 }}>{hint}</div>}
      </div>
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────
export function AvailabilityCards({ data, isLoading }: AvailabilityCardsProps) {
  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[1,2,3,4].map(i => <CardSkeleton key={i} />)}
      </div>
    );
  }

  const taxaOcupacao = data.totalSalas > 0
    ? Math.round((data.ocupadas / data.totalSalas) * 100)
    : 0;

  const cards: StatCardProps[] = [
    {
      icon:  <Building2 size={16} />,
      value: data.totalSalas,
      label: 'Salas ativas',
      color: 'var(--color-blue)',
      bg:    'var(--color-blue-l)',
    },
    {
      icon:  <CheckCircle2 size={16} />,
      value: data.livres,
      label: 'Disponíveis',
      color: 'var(--color-green)',
      bg:    'var(--color-green-l)',
      hint:  `${100 - taxaOcupacao}% do total`,
    },
    {
      icon:  <XCircle size={16} />,
      value: data.ocupadas,
      label: 'Ocupadas',
      color: 'var(--color-red)',
      bg:    'var(--color-red-l)',
      hint:  `${taxaOcupacao}% do total`,
    },
    {
      icon:  <Clock size={16} />,
      value: data.reservasPendentes,
      label: 'Pendentes',
      color: 'var(--color-amber)',
      bg:    'var(--color-amber-l)',
      hint:  'Aguardando aprovação',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '12px', marginBottom: '16px',
    }}>
      {cards.map(c => <StatCard key={c.label} {...c} />)}
    </div>
  );
}
