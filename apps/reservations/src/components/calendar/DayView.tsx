import { CalendarDays } from 'lucide-react';
import type { SidebarEntry } from './ScheduleSidebar';
import { todayYmd } from '../dashboard/scheduleDateUtils';

interface DayViewProps {
  date: string;
  entries: SidebarEntry[];
  selected: SidebarEntry | null;
}

// Grade visual de horas do dia — mesmo range do CalendarPlaceholder
const HOURS = [
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
];

const DAY_START_MIN = 7 * 60; // 07:00 em minutos
const DAY_TOTAL_MIN = 900; // 07:00 → 22:00
const ROW_HEIGHT_PX = 44;
// 15 intervalos de 1h entre as 16 marcações de hora (07:00..22:00) — mantém
// a área de conteúdo alinhada exatamente aos 900min usados no posicionamento
// dos blocos de evento (ver percentOfDay).
const GRID_HEIGHT_PX = ROW_HEIGHT_PX * (HOURS.length - 1);

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function percentOfDay(minutes: number): number {
  return ((minutes - DAY_START_MIN) / DAY_TOTAL_MIN) * 100;
}

const STATUS_COLOR: Record<'busy' | 'pending', string> = {
  busy: 'var(--color-red)',
  pending: 'var(--color-amber)',
};

export function DayView({ date, entries, selected }: DayViewProps) {
  const now = new Date();
  const today = todayYmd();
  const isToday = date === today;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine =
    isToday && nowMinutes >= DAY_START_MIN && nowMinutes <= DAY_START_MIN + DAY_TOTAL_MIN;
  const nowH = now.getHours();

  // Sala livre não tem bloco — só busy/pending ocupam a grade.
  const blocks = entries.filter(
    (e): e is SidebarEntry & { status: 'busy' | 'pending' } => e.status !== 'free',
  );

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-s)',
        overflow: 'hidden',
        flex: 1,
      }}
    >
      {/* Header da área */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface-2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <CalendarDays size={14} style={{ color: 'var(--color-muted)' }} />
        <span style={{ fontWeight: 600, fontSize: '12px' }}>Visualização diária</span>
      </div>

      {/* Grade de horas + eventos posicionados por tempo */}
      <div style={{ display: 'flex' }}>
        {/* Coluna de hora */}
        <div
          style={{
            width: '52px',
            flexShrink: 0,
            position: 'relative',
            height: `${GRID_HEIGHT_PX}px`,
            borderRight: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          {HOURS.map(hour => {
            const isNowHour = isToday && parseInt(hour, 10) === nowH;
            return (
              <div
                key={hour}
                style={{
                  position: 'absolute',
                  top: `${percentOfDay(toMinutes(hour))}%`,
                  left: 0,
                  right: 0,
                  transform: 'translateY(-6px)',
                  padding: '0 8px',
                  fontSize: '10px',
                  fontFamily: 'DM Sans, system-ui, sans-serif',
                  fontVariantNumeric: 'tabular-nums',
                  color: isNowHour ? 'var(--color-blue)' : 'var(--color-subtle)',
                  fontWeight: isNowHour ? 600 : 400,
                }}
              >
                {hour}
              </div>
            );
          })}
        </div>

        {/* Área de eventos */}
        <div style={{ flex: 1, position: 'relative', height: `${GRID_HEIGHT_PX}px` }}>
          {/* Linhas de hora de fundo */}
          {HOURS.map(hour => (
            <div
              key={hour}
              style={{
                position: 'absolute',
                top: `${percentOfDay(toMinutes(hour))}%`,
                left: 0,
                right: 0,
                borderTop: '1px solid var(--color-border)',
              }}
            />
          ))}

          {/* Linha "agora" */}
          {showNowLine && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${percentOfDay(nowMinutes)}%`,
                height: '2px',
                background: 'var(--color-blue)',
                opacity: 0.7,
                zIndex: 2,
              }}
            />
          )}

          {/* Estado vazio */}
          {entries.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '0 16px',
                color: 'var(--color-subtle)',
                fontSize: '12px',
              }}
            >
              Nenhuma ocupação para esta data
            </div>
          )}

          {/* Blocos de evento */}
          {blocks.map(entry => {
            const top = percentOfDay(toMinutes(entry.start));
            const height = ((toMinutes(entry.end) - toMinutes(entry.start)) / DAY_TOTAL_MIN) * 100;
            const isSelected = selected !== null && selected.id === entry.id;
            const color = STATUS_COLOR[entry.status];

            return (
              <div
                key={entry.id}
                title={`${entry.sala} · ${entry.start}–${entry.end}${entry.turma ? ` · ${entry.turma}` : ''}`}
                style={{
                  position: 'absolute',
                  left: '8px',
                  right: '8px',
                  top: `${top}%`,
                  height: `${height}%`,
                  minHeight: '24px',
                  background: color,
                  opacity: isSelected ? 1 : 0.8,
                  border: isSelected ? `2px solid ${color}` : '1px solid transparent',
                  boxShadow: isSelected ? 'var(--shadow-s)' : 'none',
                  borderRadius: 'var(--radius-s)',
                  padding: '2px 6px',
                  overflow: 'hidden',
                  color: '#fff',
                  zIndex: 1,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '10px', lineHeight: 1.3 }}>
                  {entry.sala}
                </div>
                {entry.turma && (
                  <div style={{ fontSize: '9px', opacity: 0.9, lineHeight: 1.3 }}>
                    {entry.turma}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
