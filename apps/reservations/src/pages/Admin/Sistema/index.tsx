import { useMemo, useState, useEffect, useRef } from 'react';
import { Server, RefreshCw, Database, Wifi, Cpu } from 'lucide-react';
import { createAppsScriptService } from '../../../services/appsScript';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { useSystemHealth } from '../../../hooks/useSystemHealth';
import type { HealthStatus } from '../../../hooks/useSystemHealth';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } from '../../../config';

// ─────────────────────────────────────────────────────────────
// AdminSistemaPage — F6.6
//
// Painel de monitoramento de infraestrutura em tempo real.
// Auto-refresh a cada 30s via useSystemHealth (setTimeout recursivo).
// Design: "Engineering Monitor" — precisão, densidade de dados,
// indicadores de status ao estilo painel de controle.
// ─────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hours}h ${rem}min` : `${hours}h`;
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Manaus',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `há ${diff}s`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `há ${mins}min`;
  return `há ${Math.floor(mins / 60)}h`;
}

function statusBadge(s: HealthStatus): {
  label: string;
  color: string;
  bg: string;
  border: string;
} {
  switch (s) {
    case 'ok':
      return {
        label: 'Online',
        color: 'var(--color-green)',
        bg: 'var(--color-green-l)',
        border: 'var(--color-green)',
      };
    case 'down':
      return {
        label: 'Offline',
        color: 'var(--color-red)',
        bg: 'var(--color-red-l)',
        border: 'var(--color-red)',
      };
    case 'unknown':
      return {
        label: 'Desconhecido',
        color: 'var(--color-subtle)',
        bg: 'var(--color-surface-2)',
        border: 'var(--color-border)',
      };
  }
}

// ─── Dot de status animado ────────────────────────────────────
function StatusDot({ status }: { status: HealthStatus }): JSX.Element {
  const color =
    status === 'ok'
      ? 'var(--color-green)'
      : status === 'down'
        ? 'var(--color-red)'
        : 'var(--color-subtle)';
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 10,
        height: 10,
      }}
    >
      {status === 'ok' && (
        <span
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: color,
            opacity: 0.35,
            animation: 'sysPulse 2s ease-in-out infinite',
          }}
        />
      )}
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
          position: 'relative',
        }}
      />
    </span>
  );
}

// ─── Card de status de serviço ────────────────────────────────
interface ServiceCardProps {
  icon: JSX.Element;
  label: string;
  status: HealthStatus;
  sub: string;
  na?: boolean;
}

function ServiceCard({ icon, label, status, sub, na = false }: ServiceCardProps): JSX.Element {
  const badge = na
    ? {
        label: 'N/A',
        color: 'var(--color-subtle)',
        bg: 'var(--color-surface-2)',
        border: 'var(--color-border)',
      }
    : statusBadge(status);

  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${badge.border}`,
        borderRadius: 8,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--color-muted)' }}>{icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{label}</span>
        </div>
        {!na && <StatusDot status={status} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '3px 10px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.02em',
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-subtle)', fontStyle: 'italic' }}>
          {sub}
        </span>
      </div>
    </div>
  );
}

// ─── Skeleton de card ─────────────────────────────────────────
function SkeletonCard(): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--color-border)',
        borderRadius: 8,
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          height: 14,
          width: '55%',
          borderRadius: 4,
          background: 'var(--color-surface-2)',
          animation: 'dtPulse 1.4s ease-in-out infinite',
        }}
      />
      <div
        style={{
          height: 22,
          width: '40%',
          borderRadius: 20,
          background: 'var(--color-surface-2)',
          animation: 'dtPulse 1.4s ease-in-out infinite 0.2s',
        }}
      />
    </div>
  );
}

// ─── Linha da tabela de informações ──────────────────────────
function InfoRow({
  label,
  value,
  mono = false,
  last = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  last?: boolean;
}): JSX.Element {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px 1fr',
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        alignItems: 'baseline',
        gap: 16,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-muted)' }}>{label}</span>
      <span
        style={{
          fontSize: 13,
          color: 'var(--color-text)',
          fontFamily: mono ? "'Courier New', Courier, monospace" : 'inherit',
          letterSpacing: mono ? '0.02em' : 'normal',
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Barra de progresso do countdown ─────────────────────────
function CountdownBar({ seconds, total }: { seconds: number; total: number }): JSX.Element {
  const pct = (seconds / total) * 100;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          width: 80,
          height: 3,
          borderRadius: 2,
          background: 'var(--color-surface-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            borderRadius: 2,
            background: 'var(--color-brand)',
            transition: 'width 1s linear',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-subtle)',
          fontFamily: "'Courier New', monospace",
          minWidth: 28,
        }}
      >
        {seconds}s
      </span>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function AdminSistemaPage(): JSX.Element {
  const service = useMemo(() => {
    const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
    return createNestjsApiService(appsScript);
  }, []);

  const { data, status, error, refetch } = useSystemHealth(service, {
    autoFetch: true,
    refreshInterval: 30_000,
  });

  // Countdown regressivo — reiniciado a cada fetch concluído
  const [nextRefresh, setNextRefresh] = useState(30);
  const countRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status !== 'success' && status !== 'error') return;
    setNextRefresh(30);
    const tick = () => {
      setNextRefresh(prev => {
        if (prev <= 1) return 30;
        return prev - 1;
      });
      countRef.current = setTimeout(tick, 1000);
    };
    countRef.current = setTimeout(tick, 1000);
    return () => {
      if (countRef.current) clearTimeout(countRef.current);
    };
  }, [status]);

  const isLoading = status === 'loading' || status === 'idle';
  const showSkeleton = data === null && isLoading;

  const allOk = data?.apiStatus === 'ok' && data?.dbStatus === 'ok';

  return (
    <div style={{ padding: '28px 24px', maxWidth: 860 }}>
      {/* ── Keyframes ─────────────────────────────────────── */}
      <style>{`
        @keyframes sysPulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50%       { transform: scale(2.2); opacity: 0; }
        }
        @keyframes dtPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }
        @keyframes sysSpinRefresh {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── ZONA 1: Header ──────────────────────────────── */}
      <div
        style={{
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Título */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <Server size={18} style={{ color: 'var(--color-brand)' }} />
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
                Sistema
              </h1>
              {/* Indicador LIVE */}
              {data && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    background: allOk ? 'var(--color-green-l)' : 'var(--color-surface-2)',
                    color: allOk ? 'var(--color-green)' : 'var(--color-subtle)',
                    border: `1px solid ${allOk ? 'var(--color-green)' : 'var(--color-border)'}`,
                  }}
                >
                  <StatusDot status={allOk ? 'ok' : 'unknown'} />
                  {allOk ? 'Live' : 'Verificando'}
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
              Status e informações do servidor em tempo real.
            </p>
          </div>

          {/* Controles */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Countdown */}
              {(status === 'success' || status === 'error') && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>próxima em</span>
                  <CountdownBar seconds={nextRefresh} total={30} />
                </div>
              )}
              {isLoading && (
                <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>Verificando…</span>
              )}

              {/* Botão */}
              <button
                onClick={() => void refetch()}
                disabled={isLoading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  background: 'var(--color-surface)',
                  color: isLoading ? 'var(--color-subtle)' : 'var(--color-text)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <RefreshCw
                  size={12}
                  style={
                    isLoading ? { animation: 'sysSpinRefresh 0.7s linear infinite' } : undefined
                  }
                />
                Verificar agora
              </button>
            </div>

            {/* Última verificação */}
            {data?.lastCheckedAt && (
              <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>
                Verificado {timeAgo(data.lastCheckedAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── ZONA 2: Cards de status ──────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 28,
        }}
      >
        {showSkeleton ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : (
          <>
            <ServiceCard
              icon={<Server size={15} />}
              label="API"
              status={data?.apiStatus ?? 'unknown'}
              sub="/health"
            />
            <ServiceCard
              icon={<Database size={15} />}
              label="Banco de Dados"
              status={data?.dbStatus ?? 'unknown'}
              sub={data?.dbStatus === 'ok' ? 'inferido da API' : '—'}
            />
            <ServiceCard
              icon={<Wifi size={15} />}
              label="WebSocket"
              status="unknown"
              sub="Disponível em F7.3"
            />
            <ServiceCard
              icon={<Cpu size={15} />}
              label="Node.js"
              status="unknown"
              sub="N/A no frontend"
              na
            />
          </>
        )}
      </div>

      {/* ── ZONA 3: Tabela de informações ────────────────── */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho da tabela */}
        <div
          style={{
            padding: '12px 20px',
            background: 'var(--color-surface-2)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--color-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Informações do servidor
          </span>
        </div>

        {/* Banner de erro */}
        {status === 'error' && error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '10px 20px',
              background: 'var(--color-red-l)',
              borderBottom: '1px solid var(--color-border)',
              color: 'var(--color-red)',
              fontSize: 12,
            }}
          >
            <span>Falha ao verificar servidor: {error.message}</span>
            <button
              onClick={() => void refetch()}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-red)',
                fontSize: 12,
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
                whiteSpace: 'nowrap',
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* Linhas */}
        <div style={{ padding: '0 20px' }}>
          <InfoRow label="Versão da API" value={data?.version ?? '—'} mono />
          <InfoRow
            label="Uptime"
            value={
              data?.uptime !== null && data?.uptime !== undefined ? formatUptime(data.uptime) : '—'
            }
            mono
          />
          <InfoRow
            label="Timestamp API"
            value={data?.serverTimestamp ? formatTimestamp(data.serverTimestamp) : '—'}
            mono
          />
          <InfoRow label="Banco" value="Supabase PostgreSQL (inferido)" />
          <InfoRow label="WebSocket" value="Disponível em F7.3" />
          <InfoRow label="Node.js" value="N/A (não disponível no frontend)" last />
        </div>
      </div>
    </div>
  );
}
