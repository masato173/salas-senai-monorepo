import { useEffect, useState, type CSSProperties } from 'react';
import { X } from 'lucide-react';
import type { DayReservationItem, DayReservationsResponse } from '../../services/apiTypes';

// Painel do dia — clique numa data do calendário abre isto. Diferente da
// lista/calendário da página (que usam GET /reservations, restrito ao
// próprio usuário pra PROFESSOR), este painel chama GET /reservations/day
// via service.getDayReservations — sem restrictToOwn, então PROFESSOR vê
// as reservas dos colegas também. O backend já reduz o shape por
// privacidade (sem `professor` pra PROFESSOR) — este componente só
// renderiza o que veio, não decide o que esconder.

interface DayReservationsPanelService {
  getDayReservations(date: string): Promise<DayReservationsResponse>;
}

interface DayReservationsPanelProps {
  date: string; // YYYY-MM-DD
  service: DayReservationsPanelService;
  userRole: string;
  onClose: () => void;
  onReservationClick: (id: string) => void;
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  APPROVED: 'Aprovada',
};

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  PENDING: { bg: 'var(--color-amber-l)', color: 'var(--color-amber)' },
  APPROVED: { bg: 'var(--color-green-l)', color: 'var(--color-green)' },
};

function formatDataBR(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function DayReservationsPanel({
  date,
  service,
  userRole,
  onClose,
  onReservationClick,
}: DayReservationsPanelProps) {
  const [items, setItems] = useState<DayReservationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isPrivileged = userRole === 'COORDENADOR' || userRole === 'ADMIN';

  // Busca sempre que a data muda — painel é remontado/reaberto por data
  // (chave natural: cada clique no calendário é uma data diferente).
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void service.getDayReservations(date).then(res => {
      if (cancelled) return;
      if (res.ok && res.data) {
        setItems(res.data);
      } else {
        setError(res.error?.message ?? 'Erro ao carregar reservas do dia.');
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date, service]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div onClick={onClose} style={overlayStyle}>
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Reservas de ${formatDataBR(date)}`}
        style={panelStyle}
      >
        <div style={headerStyle}>
          <h2 style={titleStyle}>Reservas de {formatDataBR(date)}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" style={closeButtonStyle}>
            <X size={16} />
          </button>
        </div>

        {/* Mesmo padrão de texto simples do ReservationCalendar (sem ícone
            girando — não existe classe de spin animation no projeto). */}
        {loading && <div style={centerMsgStyle}>Carregando…</div>}

        {!loading && error && (
          <div style={{ ...centerMsgStyle, color: 'var(--color-red)' }}>{error}</div>
        )}

        {!loading && !error && items.length === 0 && (
          <div style={centerMsgStyle}>Nenhuma reserva neste dia.</div>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {items.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onReservationClick(item.id)}
                style={itemStyle}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <span style={itemSalaStyle}>{item.sala}</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 10px',
                      borderRadius: 20,
                      background: STATUS_COLOR[item.status]?.bg ?? 'var(--color-surface-2)',
                      color: STATUS_COLOR[item.status]?.color ?? 'var(--color-muted)',
                      flexShrink: 0,
                    }}
                  >
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
                <div style={itemMetaStyle}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {item.inicio}–{item.fim}
                  </span>
                  {item.turma && <span>· {item.turma}</span>}
                  {isPrivileged && item.professor && <span>· {item.professor}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Styles — receita de vidro (surface + backdrop-filter + glass-sheen),
// mesma dos demais painéis/modais do app. Drawer ancorado à direita
// (mesmo espírito do off-canvas da sidebar mobile), não centrado como o
// ReservationDetailsModal — evita confundir os dois quando abertos juntos.
// ─────────────────────────────────────────────────────────────

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  background: 'rgba(0,0,0,.4)',
};

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 'min(400px, 100vw)',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '20px',
  overflowY: 'auto',
  background: 'var(--color-surface)',
  backdropFilter: 'blur(var(--glass-blur-s)) saturate(150%)',
  WebkitBackdropFilter: 'blur(var(--glass-blur-s)) saturate(150%)',
  borderLeft: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-m), var(--glass-sheen)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--color-text)',
};

const closeButtonStyle: CSSProperties = {
  width: '28px',
  height: '28px',
  display: 'grid',
  placeItems: 'center',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface)',
  color: 'var(--color-muted)',
  cursor: 'pointer',
  flexShrink: 0,
};

const centerMsgStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  padding: '24px 4px',
  fontSize: '13px',
  color: 'var(--color-muted)',
};

const itemStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  width: '100%',
  textAlign: 'left',
  padding: '10px 12px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-s)',
  background: 'var(--color-surface-2)',
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'background var(--dur) var(--ease), border-color var(--dur) var(--ease)',
};

const itemSalaStyle: CSSProperties = {
  fontSize: '13px',
  fontWeight: 600,
  color: 'var(--color-text)',
};

const itemMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '12px',
  color: 'var(--color-muted)',
};
