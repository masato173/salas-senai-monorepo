import { useMemo, type CSSProperties } from 'react';

import { SALAS } from '../../config';
import type { Turno, AvailabilityResult } from '../../types';
import { formatDataBR, todayYmd } from './scheduleDateUtils';
import type { DashboardStats as BackendStats } from '../../hooks/useDashboardStats';

// Sprint A3.3 — cards de resumo do Dashboard.
// Unificação Schedule+Reservation: a fonte deixou de ser `filtered`
// (RegistroLegado[] vindo de Schedule/planilha) — agora tudo deriva de
// `disponibilidade` (GET /availability, aula+reserva já misturados) e
// `dashboardStats` (GET /dashboard, quando disponível sobrescreve as
// contagens locais). Componente PURO de apresentação — não busca nada.

interface DashboardStatsProps {
  hoje: string; // YYYY-MM-DD passado pelo pai (já UTC-safe)
  // Sempre presente na Dashboard unificada (só fica ausente antes do
  // primeiro fetch resolver — os cards degradam pra 0 graciosamente).
  disponibilidade?: AvailabilityResult;
  // F8.5 — stats do backend via SQL. Quando presente, substitui cálculo local.
  dashboardStats?: BackendStats | null;
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
  hoje,
  disponibilidade,
  dashboardStats,
}: DashboardStatsProps): JSX.Element {
  const stats = useMemo(() => {
    const salas = disponibilidade?.salas ?? [];
    const eventos = salas.flatMap(s => s.eventos);

    // "Atividade" = aula OU reserva (qualquer coisa que não seja livre).
    const salasComAtividade = salas.filter(s => s.status !== 'livre').length;
    const ocupacoesHoje = eventos.length;
    // Na visão unificada só existe "hoje" (sem histórico multi-data como
    // no antigo Schedule) — mesma métrica de salasComAtividade.
    const salasHoje = salasComAtividade;

    const porTurno: Record<Turno, number> = { M: 0, V: 0, N: 0 };
    for (const e of eventos) {
      if (e.turno) porTurno[e.turno] += 1;
    }

    const salasLivres = salas.filter(s => s.status === 'livre').length;
    const salasComAula = salas.filter(s => s.status === 'aula' || s.status === 'conflito').length;
    // DashboardStats (backend) não expõe contagem de SALAS com reserva —
    // só `reservasHoje` (conta EVENTOS, não salas). Sempre derivado aqui.
    const salasComReserva = salas.filter(s => s.eventos.some(e => e.tipo === 'reserva')).length;

    return {
      salasComAtividade,
      ocupacoesHoje,
      salasHoje,
      porTurno,
      salasLivres,
      salasComAula,
      salasComReserva,
    };
  }, [disponibilidade]);

  // F8.5 — sobrescreve contagens locais com dados do backend quando disponível
  const porTurnoFinal = dashboardStats?.porTurno ?? stats.porTurno;
  const salasLivresFinal = dashboardStats?.salasLivres ?? stats.salasLivres;
  const salasComAulaFinal = dashboardStats?.salasComAula ?? stats.salasComAula;
  const salasComReservaFinal = stats.salasComReserva;
  const ocupacaoPercent = dashboardStats?.ocupacaoPercent ?? null;

  const totalOficial = dashboardStats?.totalSalas ?? SALAS.length;
  // Label dinâmico: "hoje" quando a data é hoje, "DD/MM/AAAA" quando filtrada.
  const dataLabel = hoje === todayYmd() ? 'hoje' : formatDataBR(hoje);

  return (
    <section style={gridStyle} aria-label="Resumo da ocupação">
      <Card
        label="Salas com atividade hoje"
        value={stats.salasComAtividade}
        sub={`de ${totalOficial}`}
      />

      <Card
        label={`Ocupações ${dataLabel}`}
        value={stats.ocupacoesHoje}
        sub={`em ${stats.salasHoje} sala${stats.salasHoje === 1 ? '' : 's'}`}
      />

      <TurnoCard turno="M" value={porTurnoFinal.M} />
      <TurnoCard turno="V" value={porTurnoFinal.V} />
      <TurnoCard turno="N" value={porTurnoFinal.N} />
      {ocupacaoPercent !== null && (
        <Card label="Ocupação" value={ocupacaoPercent} sub="% das salas com aula" />
      )}
      {disponibilidade && (
        <>
          <Card
            label={`Salas livres ${dataLabel}`}
            value={salasLivresFinal}
            sub={`de ${totalOficial} salas`}
          />
          <Card label={`Com aula ${dataLabel}`} value={salasComAulaFinal} sub="salas ocupadas" />
          <Card
            label={`Com reserva ${dataLabel}`}
            value={salasComReservaFinal}
            sub="salas reservadas"
          />
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
