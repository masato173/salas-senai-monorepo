import { useState, useRef, useEffect, type CSSProperties } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications, type AppNotification } from '../../hooks/useNotifications';

// Pura e exportada — testável sem renderizar (padrão do projeto: nenhum
// teste de componente monta JSX, só funções puras extraídas).
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffMs = now.getTime() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  // getUTCDate/getUTCMonth, não getDate/getMonth — evita off-by-one por
  // timezone (bug histórico do projeto, ver scheduleDateUtils.ts).
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Sino de notificação persistente (Fase C2) — coexiste com o indicador
// efêmero da sidebar (AppLayout.tsx, notifyPath); este é o histórico
// completo, sobrevive a reload/novo login. Vidro translúcido no dropdown
// (mesma receita de 3 partes do resto do projeto — ver DESIGN.md e o
// popover do FullCalendar em global.css).
export function NotificationBell(): JSX.Element {
  const { data, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleNotificationClick(n: AppNotification): void {
    if (!n.read) markRead(n.id);
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="topbar-btn icon-only"
        onClick={() => setOpen(o => !o)}
        aria-label={unreadCount > 0 ? `Notificações (${unreadCount} não lidas)` : 'Notificações'}
        style={{ position: 'relative' }}
      >
        <Bell size={15} strokeWidth={1.75} />
        {unreadCount > 0 && (
          <span style={badgeCountStyle} aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={panelStyle}>
          <div style={panelHeaderStyle}>
            <span style={panelTitleStyle}>Notificações</span>
            {unreadCount > 0 && (
              <button type="button" onClick={() => markAllRead()} style={markAllButtonStyle}>
                <CheckCheck size={12} strokeWidth={2} />
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div style={panelListStyle}>
            {data.length === 0 ? (
              <div style={emptyStyle}>Nenhuma notificação</div>
            ) : (
              data.slice(0, 20).map(n => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    ...notificationRowStyle,
                    ...(n.read ? {} : notificationRowUnreadStyle),
                  }}
                >
                  <div style={notificationRowTopStyle}>
                    <span style={notificationTitleStyle}>{n.title}</span>
                    {!n.read && <span style={unreadDotStyle} aria-hidden="true" />}
                  </div>
                  <span style={notificationBodyStyle}>{n.body}</span>
                  <span style={notificationTimeStyle}>{formatRelativeTime(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles (tokens do DS apenas) ──────────────────────────────────────

const badgeCountStyle: CSSProperties = {
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  minWidth: '15px',
  height: '15px',
  padding: '0 3px',
  borderRadius: '20px',
  background: 'var(--color-accent)',
  color: '#fff',
  fontSize: '9px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontVariantNumeric: 'tabular-nums',
  lineHeight: 1,
};

// Receita de 3 partes (glass) — mesma de .fc-popover em global.css.
const panelStyle: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: '320px',
  maxHeight: '400px',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-surface)',
  backdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(140%)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius)',
  boxShadow: 'var(--shadow-m), var(--glass-sheen)',
  overflow: 'hidden',
  zIndex: 300,
};

const panelHeaderStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '10px 14px',
  borderBottom: '1px solid var(--color-border)',
  background: 'var(--color-surface-2)',
};

const panelTitleStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
};

const markAllButtonStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--color-muted)',
  fontSize: '11px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const panelListStyle: CSSProperties = {
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const emptyStyle: CSSProperties = {
  padding: '24px 14px',
  textAlign: 'center',
  fontSize: '12px',
  color: 'var(--color-subtle)',
};

const notificationRowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '3px',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  background: 'none',
  border: 'none',
  borderBottom: '1px solid var(--color-border)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const notificationRowUnreadStyle: CSSProperties = {
  background: 'var(--color-surface-2)',
};

const notificationRowTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
};

const notificationTitleStyle: CSSProperties = {
  fontSize: '12px',
  fontWeight: 600,
  color: 'var(--color-text)',
};

const unreadDotStyle: CSSProperties = {
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: 'var(--color-accent)',
  flexShrink: 0,
};

const notificationBodyStyle: CSSProperties = {
  fontSize: '11px',
  color: 'var(--color-muted)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
};

const notificationTimeStyle: CSSProperties = {
  fontSize: '10px',
  color: 'var(--color-subtle)',
  fontVariantNumeric: 'tabular-nums',
};
