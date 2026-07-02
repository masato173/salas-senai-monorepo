import { useMemo, type CSSProperties } from 'react';

import { SALAS } from '../../config';
import type { RegistroLegado, Turno, AvailabilityResult } from '../../types';

// Sprint A3.3 — cards de resumo do Dashboard. Componente PURO de apresentação:
// recebe `filtered` (mesmo array que alimenta a tabela em OccupancyDashboard)
// e re-deriva contagens com useMemo. Não busca nada.
//
// Convenção de cor dos turnos (espelha planilha mensal + TURNO_STYLE do
// OccupancyDashboard): Manhã=verde, Tarde=âmbar, Noite=azul. Tokens apenas.

interface DashboardStatsProps {
  filtered: RegistroLegado[]; // mesmo subset que vai pra tabela
  hoje: string; // YYYY-MM-DD passado pelo pai (já UTC-safe)
  // S5 — opcional, backward compat. Quando presente, renderiza 3 cards extras.
  disponibilidade?: AvailabilityResult;
}

// Detalhe visual: borda-esquerda na cor do turno. Reusa tokens existentes.
const TURNO_ACCENT: Record<Turno, string> = {
  M: 'var(--color-green)',
  V: 'var(--color-amber)',
  N: 'var(--color-blue)',
};

const TURNO_LABEL: Record<Turno, string> = {
  M: 'Manhã',
  V: 'Tarde',
  N: 'Noite',
};

export function DashboardStats({
  filtered,
  hoje,
  disponibilidade,
}: DashboardStatsProps): JSX.Element {
  const stats = useMemo(() => {
    const salasComAtividade = new Set(filtered.map(r => r.sala)).size;

    const registrosHoje = filtered.filter(r => r.data === hoje);
    const ocupacoesHoje = registrosHoje.length;
    const salasHoje = new Set(registrosHoje.map(r => r.sala)).size;

    const porTurno: Record<Turno, number> = { M: 0, V: 0, N: 0 };
    for (const r of filtered) {
      if (r.turno) porTurno[r.turno] += 1;
    }

    // S5 — contagens de disponibilidade (só se prop presente).
    const dispHoje = disponibilidade?.salas ?? [];
    const salasLivres = dispHoje.filter(s => s.status === 'livre').length;
    const salasComAula = dispHoje.filter(
      s => s.status === 'aula' || s.status === 'conflito',
    ).length;
    const salasComReserva = dispHoje.filter(
      s => s.status === 'reserva' || s.status === 'conflito',
    ).length;

    return {
      salasComAtividade,
      ocupacoesHoje,
      salasHoje,
      porTurno,
      salasLivres,
      salasComAula,
      salasComReserva,
    };
  }, [filtered, hoje, disponibilidade]);

  const totalOficial = SALAS.length;

  return (
    <section style={gridStyle} aria-label="Resumo da ocupação">
      <Card
        label="Salas com atividade"
        value={stats.salasComAtividade}
        sub={`de ${totalOficial}`}
      />

      <Card
        label="Ocupações hoje"
        value={stats.ocupacoesHoje}
        sub={`em ${stats.salasHoje} sala${stats.salasHoje === 1 ? '' : 's'}`}
      />

      <TurnoCard turno="M" value={stats.porTurno.M} />
      <TurnoCard turno="V" value={stats.porTurno.V} />
      <TurnoCard turno="N" value={stats.porTurno.N} />

      {/* S5 — disponibilidade de hoje (aditivo, só renderiza se prop presente). */}
      {disponibilidade && (
        <>
          <Card
            label="Salas livres hoje"
            value={stats.salasLivres}
            sub={`de ${totalOficial} salas`}
          />
          <Card label="Com aula hoje" value={stats.salasComAula} sub="salas ocupadas" />
          <Card label="Com reserva hoje" value={stats.salasComReserva} sub="salas reservadas" />
        </>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Card neutro (Salas com atividade / Ocupações hoje)
// ─────────────────────────────────────────────────────────────

interface CardProps {
  label: string;
  value: number;
  sub: string;
}

function Card({ label, value, sub }: CardProps): JSX.Element {
  return (
    <div style={cardStyle}>
      <span style={cardLabelStyle}>{label}</span>
      <span style={cardValueStyle}>{value}</span>
      <span style={cardSubStyle}>{sub}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Card de turno (Manhã/Tarde/Noite) — com borda-esquerda colorida
// ─────────────────────────────────────────────────────────────

interface TurnoCardProps {
  turno: Turno;
  value: number;
}

function TurnoCard({ turno, value }: TurnoCardProps): JSX.Element {
  return (
    <div
      style={{
        ...cardStyle,
        borderLeft: `3px solid ${TURNO_ACCENT[turno]}`,
        paddingLeft: 'calc(14px - 2px)', // compensa o 3px da borda pra alinhar texto
      }}
    >
      <span style={cardLabelStyle}>{TURNO_LABEL[turno]}</span>
      <span style={cardValueStyle}>{value}</span>
      <span style={cardSubStyle}>{value === 1 ? 'ocupação' : 'ocupações'}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — tokens only, sem hex cru.
// ─────────────────────────────────────────────────────────────

const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '12px',
};

const cardStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '14px',
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  boxShadow: 'var(--shadow-s)',
};

const cardLabelStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: 'var(--color-muted)',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

const cardValueStyle: CSSProperties = {
  fontSize: '26px',
  fontWeight: 700,
  color: 'var(--color-text)',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
  marginTop: '2px',
};

const cardSubStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
};
