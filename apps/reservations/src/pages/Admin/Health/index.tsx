import { useMemo, useState, useEffect, useCallback } from 'react';
import { HeartPulse, RefreshCw, Activity } from 'lucide-react';
import { createAppsScriptService } from '../../../services/appsScript';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { useSystemHealth } from '../../../hooks/useSystemHealth';
import type { HealthStatus } from '../../../hooks/useSystemHealth';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } from '../../../config';

// ─────────────────────────────────────────────────────────────
// AdminHealthPage — F6.8
//
// Monitor de saúde com auto-refresh a cada 15s.
// Mantém histórico da sessão (máx 20 verificações).
// ─────────────────────────────────────────────────────────────

interface HealthCheckEntry {
  checkedAt: Date;
  apiStatus: HealthStatus;
  uptime: number | null;
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}min ${secs}s` : `${mins}min`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}min` : `${hours}h`;
}

function statusBadge(s: HealthStatus): { label: string; color: string; bg: string } {
  switch (s) {
    case 'ok':
      return { label: '● Online', color: 'var(--color-green)', bg: 'var(--color-green-l)' };
    case 'down':
      return { label: '✗ Offline', color: 'var(--color-red)', bg: 'var(--color-red-l)' };
    case 'unknown':
      return {
        label: '◌ Desconhecido',
        color: 'var(--color-subtle)',
        bg: 'var(--color-surface-2)',
      };
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── ServiceCard ──────────────────────────────────────────────
function ServiceCard({
  name,
  badge,
  note,
}: {
  name: string;
  badge: { label: string; color: string; bg: string };
  note?: string;
}): JSX.Element {
  const isOk = badge.color === 'var(--color-green)';
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${badge.color}`,
        borderRadius: 9,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>{name}</span>
        {isOk && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--color-green)',
              display: 'inline-block',
              boxShadow: '0 0 0 3px rgba(22,163,74,.2)',
              animation: 'hpPulse 2s ease-in-out infinite',
            }}
          />
        )}
      </div>
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 700,
          fontFamily: 'DM Mono, monospace',
          background: badge.bg,
          color: badge.color,
        }}
      >
        {badge.label}
      </span>
      {note !== undefined && (
        <p style={{ margin: '6px 0 0', fontSize: 11, color: 'var(--color-subtle)' }}>{note}</p>
      )}
    </div>
  );
}

export default function AdminHealthPage(): JSX.Element {
  const service = useMemo(() => {
    const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
    return createNestjsApiService(appsScript);
  }, []);

  const { data, status, refetch } = useSystemHealth(service, { refreshInterval: 15_000 });

  const [history, setHistory] = useState<HealthCheckEntry[]>([]);
  const [checkCount, setCheckCount] = useState(0);
  const [lastFailureAt, setLastFailureAt] = useState<Date | null>(null);

  useEffect(() => {
    if (data === null) return;
    const entry: HealthCheckEntry = {
      checkedAt: data.lastCheckedAt ?? new Date(),
      apiStatus: data.apiStatus,
      uptime: data.uptime,
    };
    setHistory(prev => [entry, ...prev].slice(0, 20));
    setCheckCount(c => c + 1);
    if (data.apiStatus === 'down') setLastFailureAt(entry.checkedAt);
  }, [data]);

  const handleCheck = useCallback(() => {
    void refetch();
  }, [refetch]);

  const isLoading = status === 'loading';
  const apiBadge = statusBadge(data?.apiStatus ?? 'unknown');
  const dbBadge = statusBadge(data?.dbStatus ?? 'unknown');
  const wsBadge = statusBadge('unknown');
  const nodeBadge = { label: 'N/A', color: 'var(--color-subtle)', bg: 'var(--color-surface-2)' };

  return (
    <>
      <style>{`
        @keyframes hpPulse { 0%,100%{opacity:1}50%{opacity:.4} }
        @keyframes hpSpin  { to{ transform:rotate(360deg) } }
        @keyframes dtPulse { 0%,100%{opacity:1}50%{opacity:.5} }
      `}</style>

      <div style={{ padding: '28px 24px', maxWidth: 900 }}>
        {/* ─ ZONA 1: Header ─ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: 'var(--color-brand)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <HeartPulse size={18} color="#fff" />
              </div>
              <div>
                <h1
                  style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}
                >
                  Health Monitor
                </h1>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
                  Monitoramento de saúde do sistema em tempo real.
                </p>
              </div>
            </div>
            {/* Stats inline */}
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Checks', value: String(checkCount) },
                {
                  label: 'Última falha',
                  value: lastFailureAt !== null ? formatTime(lastFailureAt) : 'N/A',
                },
                { label: 'Intervalo', value: '15s' },
              ].map(stat => (
                <div key={stat.label} style={{ display: 'flex', gap: 5, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>{stat.label}:</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: 'DM Mono, monospace',
                      color: 'var(--color-text)',
                    }}
                  >
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheck}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 7,
              background: 'var(--color-surface)',
              color: isLoading ? 'var(--color-subtle)' : 'var(--color-text)',
              fontSize: 13,
              fontWeight: 500,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
              alignSelf: 'flex-start',
            }}
          >
            <RefreshCw
              size={13}
              style={{
                animation: isLoading ? 'hpSpin 700ms linear infinite' : 'none',
              }}
            />
            Verificar agora
          </button>
        </div>

        {/* ─ ZONA 2: Status cards (2×2 grid) ─ */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 12,
            marginBottom: 16,
          }}
        >
          {isLoading && checkCount === 0 ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 90,
                  borderRadius: 9,
                  background: 'var(--color-surface-2)',
                  animation: 'dtPulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 100}ms`,
                  border: '1px solid var(--color-border)',
                }}
              />
            ))
          ) : (
            <>
              <ServiceCard name="API" badge={apiBadge} />
              <ServiceCard name="Banco" badge={dbBadge} note="inferido da resposta de /health" />
              <ServiceCard name="WebSocket" badge={wsBadge} note="F7.3 — não conectado ainda" />
              <ServiceCard
                name="Node.js"
                badge={nodeBadge}
                note="N/A — não disponível no frontend"
              />
            </>
          )}
        </div>

        {/* Extra: versão + uptime */}
        <div
          style={{
            display: 'flex',
            gap: 20,
            flexWrap: 'wrap',
            padding: '12px 16px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 9,
            marginBottom: 24,
          }}
        >
          {[
            { label: 'Versão', value: data?.version ?? '—' },
            {
              label: 'Uptime',
              value:
                data?.uptime !== null && data?.uptime !== undefined
                  ? formatUptime(data.uptime)
                  : '—',
            },
          ].map(item => (
            <div key={item.label}>
              <span style={{ fontSize: 11, color: 'var(--color-subtle)' }}>{item.label}: </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'DM Mono, monospace',
                  color: 'var(--color-text)',
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* ─ ZONA 3: Histórico de checks ─ */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              borderBottom: '1px solid var(--color-border)',
              background: 'var(--color-surface-2)',
            }}
          >
            <Activity size={14} style={{ color: 'var(--color-muted)' }} />
            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>
              Histórico da sessão atual
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-subtle)', marginLeft: 'auto' }}>
              últimas 20 verificações · reinicia ao navegar
            </span>
          </div>

          {history.length === 0 ? (
            <div
              style={{
                padding: '40px 16px',
                textAlign: 'center',
                fontSize: 13,
                color: 'var(--color-muted)',
              }}
            >
              Aguardando primeira verificação...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    {['#', 'Horário', 'Status', 'Uptime'].map(h => (
                      <th
                        key={h}
                        style={{
                          padding: '8px 14px',
                          textAlign: 'left',
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--color-subtle)',
                          textTransform: 'uppercase',
                          letterSpacing: '.06em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, i) => {
                    const badge = statusBadge(entry.apiStatus);
                    return (
                      <tr
                        key={entry.checkedAt.getTime()}
                        style={{
                          borderBottom:
                            i < history.length - 1 ? '1px solid var(--color-border)' : 'none',
                          opacity: i === 0 ? 1 : 0.85 - i * 0.025,
                        }}
                      >
                        <td
                          style={{
                            padding: '9px 14px',
                            fontSize: 11,
                            color: 'var(--color-subtle)',
                            fontFamily: 'DM Mono, monospace',
                            width: 32,
                          }}
                        >
                          {i + 1}
                        </td>
                        <td
                          style={{
                            padding: '9px 14px',
                            fontSize: 12,
                            color: 'var(--color-muted)',
                            fontFamily: 'DM Mono, monospace',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatTime(entry.checkedAt)}
                        </td>
                        <td style={{ padding: '9px 14px' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: 4,
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: 'DM Mono, monospace',
                              background: badge.bg,
                              color: badge.color,
                            }}
                          >
                            {badge.label}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '9px 14px',
                            fontSize: 12,
                            color: 'var(--color-muted)',
                            fontFamily: 'DM Mono, monospace',
                          }}
                        >
                          {entry.uptime !== null ? formatUptime(entry.uptime) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
