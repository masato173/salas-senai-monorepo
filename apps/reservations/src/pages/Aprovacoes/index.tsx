import { useMemo, useState, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
import { createAppsScriptService } from '../../services/appsScript';
import { createNestjsApiService } from '../../services/nestjsApiService';
import { usePendingReservations } from '../../hooks/usePendingReservations';
import { useRealtimeSocket } from '../../hooks/useRealtimeSocket';
import { useApproveReservation } from '../../hooks/useApproveReservation';
import { useRejectReservation } from '../../hooks/useRejectReservation';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } from '../../config';
import { StatusToggle, type ApprovalMode } from './StatusToggle';
import { SearchBar } from './SearchBar';
import { ReservationApprovalCard } from './ReservationApprovalCard';
import { EmptyState } from './EmptyState';

interface InFlight {
  approving: Set<string>;
  rejecting: Set<string>;
}

export default function AprovacoesPage(): JSX.Element {
  const service = useMemo(() => {
    const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
    return createNestjsApiService(appsScript);
  }, []);

  const [mode, setMode] = useState<ApprovalMode>('PENDING');
  const [search, setSearch] = useState('');
  const [inFlight, setInFlight] = useState<InFlight>({
    approving: new Set(),
    rejecting: new Set(),
  });

  // Busca o conjunto completo uma vez — toggle e busca filtram client-side.
  // Preparado para Socket.IO — F6.2 adicionará socket.on('reservation.*', refetch)
  const { data, status, error, refetch } = usePendingReservations(service, {
    status: 'PENDING',
  });

  // F7.3b — realtime: recarrega aprovações quando evento chega.
  // Aprovação/rejeição dispara reservation.approved ou reservation.rejected.
  useRealtimeSocket({
    onReservationEvent: (_event, _payload) => {
      void refetch();
    },
  });
  const approver = useApproveReservation(service);
  const rejecter = useRejectReservation(service);

  const reservations = data?.reservations ?? [];

  const pendingCount = useMemo(
    () => reservations.filter(r => r.status === 'PENDING').length,
    [reservations],
  );

  const visible = useMemo(() => {
    const scoped = reservations.filter(r =>
      mode === 'PENDING' ? r.status === 'PENDING' : r.status !== 'PENDING',
    );
    const q = search.trim().toLowerCase();
    if (q === '') return scoped;
    return scoped.filter(r => r.professor.toLowerCase().includes(q));
  }, [reservations, mode, search]);

  const handleApprove = useCallback(
    async (id: string) => {
      setInFlight(prev => ({ ...prev, approving: new Set(prev.approving).add(id) }));
      try {
        const res = await approver.execute(id);
        if (res.ok) void refetch();
      } finally {
        setInFlight(prev => {
          const approving = new Set(prev.approving);
          approving.delete(id);
          return { ...prev, approving };
        });
      }
    },
    [approver, refetch],
  );

  const handleReject = useCallback(
    async (id: string) => {
      setInFlight(prev => ({ ...prev, rejecting: new Set(prev.rejecting).add(id) }));
      try {
        const res = await rejecter.execute(id);
        if (res.ok) void refetch();
      } finally {
        setInFlight(prev => {
          const rejecting = new Set(prev.rejecting);
          rejecting.delete(id);
          return { ...prev, rejecting };
        });
      }
    },
    [rejecter, refetch],
  );

  const actionError = approver.error ?? rejecter.error;
  const isLoading = status === 'idle' || status === 'loading';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Aprovações</h1>
          <p className="page-subtitle">Solicitações de reserva aguardando decisão</p>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <StatusToggle value={mode} onChange={setMode} pendingCount={pendingCount} />
        <SearchBar value={search} onChange={setSearch} />
      </div>

      {actionError !== null && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            marginBottom: 16,
            borderRadius: 'var(--radius-s)',
            background: 'var(--color-red-l)',
            color: 'var(--color-red)',
            fontSize: 12.5,
          }}
        >
          <AlertCircle size={15} aria-hidden="true" />
          <span>{actionError.message}</span>
        </div>
      )}

      {isLoading && data === null ? (
        <CardListSkeleton />
      ) : status === 'error' ? (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '16px 18px',
            borderRadius: 'var(--radius)',
            background: 'var(--color-red-l)',
            color: 'var(--color-red)',
            fontSize: 13,
          }}
        >
          <AlertCircle size={18} aria-hidden="true" />
          <span style={{ flex: 1 }}>{error?.message ?? 'Erro ao carregar reservas.'}</span>
          <button
            type="button"
            onClick={() => void refetch()}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 'var(--radius-s)',
              border: '1px solid var(--color-red)',
              background: 'transparent',
              color: 'var(--color-red)',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Tentar novamente
          </button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState mode={mode} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map(r => (
            <ReservationApprovalCard
              key={r.id}
              reservation={r}
              isApproving={inFlight.approving.has(r.id)}
              isRejecting={inFlight.rejecting.has(r.id)}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Skeleton simples — CSS puro, sem biblioteca. Mínimo 3 linhas.
function CardListSkeleton(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div
            style={{
              width: '40%',
              height: 14,
              borderRadius: 4,
              background: 'var(--color-surface-2)',
              animation: 'apr-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.12}s`,
            }}
          />
          <div
            style={{
              width: '65%',
              height: 12,
              borderRadius: 4,
              background: 'var(--color-surface-2)',
              animation: 'apr-pulse 1.4s ease-in-out infinite',
              animationDelay: `${i * 0.12 + 0.05}s`,
            }}
          />
        </div>
      ))}
      <style>{`
        @keyframes apr-pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
