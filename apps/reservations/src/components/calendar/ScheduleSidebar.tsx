import React from 'react';
import { Clock, MapPin, User, ChevronRight } from 'lucide-react';
import type { Turno } from '../../types';

// ── Tipos locais ───────────────────────────────────────────────
export interface SidebarEntry {
  id:     string;
  sala:   string;
  turma:  string;
  turno:  Turno | null;
  start:  string;
  end:    string;
  status: 'free' | 'busy' | 'pending';
}

interface ScheduleSidebarProps {
  date:      string;
  entries:   SidebarEntry[];
  isLoading: boolean;
  onSelect?: (entry: SidebarEntry) => void;
}

// ── Config visual por turno ────────────────────────────────────
const TURNO_CFG: Record<string, { label: string; color: string; bg: string }> = {
  M: { label: 'Matutino',   color: '#92400e', bg: '#fef3c7' },
  V: { label: 'Vespertino', color: '#14532d', bg: '#dcfce7' },
  N: { label: 'Noturno',    color: '#4c1d95', bg: '#ede9fe' },
};

const STATUS_CFG = {
  free:    { label: 'Livre',     dot: 'var(--color-green)' },
  busy:    { label: 'Ocupada',   dot: 'var(--color-red)'   },
  pending: { label: 'Pendente',  dot: 'var(--color-amber)' },
};

// ── Skeleton row ───────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div style={{
      padding: '10px 14px',
      borderBottom: '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column', gap: '6px',
    }}>
      {[80, 60, 50].map((w, i) => (
        <div key={i} style={{
          height: 10, width: `${w}%`, borderRadius: 4,
          background: 'var(--color-border)',
          animation: 'skeletonPulse 1.2s ease-in-out infinite',
        }} />
      ))}
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────
function EntryRow({ entry, onSelect }: { entry: SidebarEntry; onSelect?: (e: SidebarEntry) => void }) {
  const turno  = entry.turno ? TURNO_CFG[entry.turno] : null;
  const status = STATUS_CFG[entry.status];

  return (
    <button
      onClick={() => onSelect?.(entry)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: '10px 14px',
        borderBottom: '1px solid var(--color-border)',
        background: 'none', border: 'none', borderBottomColor: 'var(--color-border)',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'background .12s',
      }}
      onMouseEnter={e => { if (onSelect) (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-2)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
    >
      {/* Sala + status dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: status.dot, flexShrink: 0,
            boxShadow: `0 0 0 2px ${status.dot}30`,
          }} />
          <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text)' }}>
            {entry.sala}
          </span>
        </div>
        {onSelect && <ChevronRight size={12} style={{ color: 'var(--color-subtle)', flexShrink: 0 }} />}
      </div>

      {/* Horário */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <Clock size={10} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
        <span style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: 'var(--color-muted)' }}>
          {entry.start} – {entry.end}
        </span>
      </div>

      {/* Turma */}
      {entry.turma && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
          <User size={10} style={{ color: 'var(--color-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', color: 'var(--color-muted)' }}>{entry.turma}</span>
        </div>
      )}

      {/* Turno badge */}
      {turno && (
        <span style={{
          display: 'inline-block', fontSize: '9px', fontWeight: 700,
          padding: '1px 7px', borderRadius: '20px',
          background: turno.bg, color: turno.color,
          marginTop: '2px',
        }}>
          {turno.label}
        </span>
      )}
    </button>
  );
}

// ── Componente principal ───────────────────────────────────────
export function ScheduleSidebar({ date, entries, isLoading, onSelect }: ScheduleSidebarProps) {
  const d = new Date(date + 'T12:00:00');
  const dateLabel = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

  const busyCount = entries.filter(e => e.status === 'busy').length;
  const freeCount = entries.filter(e => e.status === 'free').length;

  return (
    <aside style={{
      width: '240px', flexShrink: 0,
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-s)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      minHeight: '400px',
    }}>
      {/* Cabeçalho do painel */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
      }}>
        <div style={{ fontWeight: 600, fontSize: '12px', color: 'var(--color-text)' }}>
          <MapPin size={11} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Ocupações · {dateLabel}
        </div>
        {!isLoading && (
          <div style={{ fontSize: '10px', color: 'var(--color-muted)', marginTop: '4px', display: 'flex', gap: '8px' }}>
            <span style={{ color: 'var(--color-red)' }}>● {busyCount} ocupadas</span>
            <span style={{ color: 'var(--color-green)' }}>● {freeCount} livres</span>
          </div>
        )}
      </div>

      {/* Lista */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isLoading ? (
          [1,2,3,4,5].map(i => <SkeletonRow key={i} />)
        ) : entries.length === 0 ? (
          <div style={{
            padding: '32px 14px', textAlign: 'center',
            color: 'var(--color-subtle)', fontSize: '12px',
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px', opacity: .3 }}>📭</div>
            Nenhuma ocupação encontrada
          </div>
        ) : (
          entries.map(entry => (
            <EntryRow key={entry.id} entry={entry} onSelect={onSelect} />
          ))
        )}
      </div>
    </aside>
  );
}
