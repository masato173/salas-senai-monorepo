import React from 'react';
import { CalendarDays, Layers, ArrowRight } from 'lucide-react';

interface CalendarPlaceholderProps {
  date: string;
}

// Grade visual de horas do dia — sem dado, só estrutura
const HOURS = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00',
               '14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00'];

export function CalendarPlaceholder({ date }: CalendarPlaceholderProps) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  const nowH  = now.getHours();

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius)',
      boxShadow: 'var(--shadow-s)',
      overflow: 'hidden',
      flex: 1,
    }}>
      {/* Header da área */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarDays size={14} style={{ color: 'var(--color-muted)' }} />
          <span style={{ fontWeight: 600, fontSize: '12px' }}>Visualização diária</span>
        </div>
        <span style={{
          fontSize: '10px', fontWeight: 700,
          padding: '2px 10px', borderRadius: '20px',
          background: 'var(--color-accent-l)',
          color: 'var(--color-accent)',
          textTransform: 'uppercase', letterSpacing: '.05em',
        }}>
          FullCalendar — Fase 3
        </span>
      </div>

      {/* Grade de horas */}
      <div style={{ position: 'relative', padding: '0' }}>
        {HOURS.map((hour) => {
          const h       = parseInt(hour);
          const isNowH  = date === today && h === nowH;
          return (
            <div
              key={hour}
              style={{
                display: 'flex', alignItems: 'stretch',
                minHeight: '42px',
                borderBottom: '1px solid var(--color-border)',
                position: 'relative',
              }}
            >
              {/* Coluna de hora */}
              <div style={{
                width: '52px', flexShrink: 0,
                padding: '4px 8px 0',
                fontSize: '10px', fontFamily: 'DM Mono, monospace',
                color: isNowH ? 'var(--color-blue)' : 'var(--color-subtle)',
                fontWeight: isNowH ? 600 : 400,
                borderRight: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
              }}>
                {hour}
              </div>

              {/* Área de eventos — placeholder animado */}
              <div style={{ flex: 1, padding: '4px 8px', position: 'relative' }}>
                {/* Linha "agora" */}
                {isNowH && (
                  <div style={{
                    position: 'absolute', left: 0, right: 0,
                    top: `${(now.getMinutes() / 60) * 100}%`,
                    height: '2px', background: 'var(--color-blue)',
                    opacity: .7, zIndex: 1,
                  }} />
                )}

                {/* Slot vazio com animação suave */}
                <div style={{
                  height: '28px', borderRadius: 'var(--radius-s)',
                  background: 'transparent',
                  border: '1px dashed var(--color-border)',
                  opacity: .4,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer com CTA */}
      <div style={{
        padding: '16px', textAlign: 'center',
        borderTop: '1px solid var(--color-border)',
        background: 'var(--color-surface-2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Layers size={14} style={{ color: 'var(--color-muted)' }} />
          <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
            Calendário interativo com drag &amp; drop, visualização semanal e mensal
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            fontSize: '11px', fontWeight: 600, color: 'var(--color-brand)',
          }}>
            Fase 3 <ArrowRight size={10} />
          </span>
        </div>
      </div>
    </div>
  );
}
