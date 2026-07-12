import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Server,
  Database,
  Wifi,
  GitBranch,
  Activity,
  ScrollText,
  Users,
} from 'lucide-react';
import { createAppsScriptService } from '../../../services/appsScript';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { useAdminDashboard } from '../../../hooks/useAdminDashboard';
import { APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN } from '../../../config';
import type { AdminDashboardData } from '../../../hooks/useAdminDashboard';

// ─── Utilitários ──────────────────────────────────────────────

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return `${d}d ${h}h`;
}

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'há 1 dia' : `há ${days} dias`;
}

function formatTimestamp(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// ─── Skeleton ─────────────────────────────────────────────────

function SkeletonCard({ height = 96 }: { height?: number }) {
  return (
    <div
      className="admin-skeleton-card"
      style={{
        height,
        borderRadius: 'var(--radius)',
        background: 'var(--color-surface-2)',
        border: '1px solid var(--color-border)',
      }}
    />
  );
}

// ─── Metric Card (linha 1 — operacional) ──────────────────────

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accentColor?: string;
  badge?: React.ReactNode;
  highlight?: boolean;
}

function MetricCard({ label, value, icon, accentColor, badge, highlight }: MetricCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${accentColor ?? 'var(--color-brand)'}`,
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-s)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Icon + label row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: accentColor ?? 'var(--color-brand)', opacity: 0.7, display: 'flex' }}>
          {icon}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-muted)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: highlight ? (accentColor ?? 'var(--color-amber)') : 'var(--color-text)',
          lineHeight: 1.1,
          letterSpacing: '-.02em',
        }}
      >
        {value}
      </div>

      {/* Badge (opcional) */}
      {badge && <div style={{ marginTop: 2 }}>{badge}</div>}
    </div>
  );
}

// ─── Infra Card (linha 2 — infraestrutura) ────────────────────

interface InfraCardProps {
  label: string;
  icon: React.ReactNode;
  value: string;
  statusBadge?: { label: string; color: string; bg: string };
  subValue?: string;
}

function InfraCard({ label, icon, value, statusBadge, subValue }: InfraCardProps) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        boxShadow: 'var(--shadow-s)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Icon block */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: 'var(--color-surface-2)',
          border: '1px solid var(--color-border)',
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          color: 'var(--color-brand)',
        }}
      >
        {icon}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-muted)',
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          {label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {statusBadge ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 999,
                background: statusBadge.bg,
                color: statusBadge.color,
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {statusBadge.label}
            </span>
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {value}
            </span>
          )}
          {subValue && (
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>{subValue}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Dashboard renderizado ────────────────────────────────────

interface DashboardContentProps {
  data: AdminDashboardData;
  onRefetch: () => void;
  isRefetching: boolean;
}

function DashboardContent({
  data,
  onRefetch: _onRefetch,
  isRefetching: _isRefetching,
}: DashboardContentProps) {
  const navigate = useNavigate();

  const statusBadgeOk = {
    label: 'Online',
    color: 'var(--color-green)',
    bg: 'var(--color-green-l)',
  };
  const statusBadgeDown = { label: 'Offline', color: 'var(--color-red)', bg: 'var(--color-red-l)' };
  const statusBadgeUnknown = {
    label: 'Disponível',
    color: 'var(--color-blue)',
    bg: 'var(--color-blue-l)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ── Linha 1: Métricas operacionais ── */}
      <section>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            marginBottom: 12,
          }}
        >
          Operacional
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          <MetricCard
            label="Reservas hoje"
            value={data.reservasHoje !== null ? String(data.reservasHoje) : '—'}
            icon={<Activity size={14} strokeWidth={1.75} />}
            accentColor="var(--color-brand)"
            badge={
              data.reservasHoje === null ? (
                <span style={{ fontSize: 10, color: 'var(--color-subtle)' }}>
                  Disponível em F6.3b
                </span>
              ) : undefined
            }
          />
          <MetricCard
            label="Pendentes"
            value={data.pendentes !== null ? String(data.pendentes) : '—'}
            icon={<Clock size={14} strokeWidth={1.75} />}
            accentColor={
              data.pendentes !== null && data.pendentes > 0
                ? 'var(--color-amber)'
                : 'var(--color-brand)'
            }
            highlight={data.pendentes !== null && data.pendentes > 0}
          />
          <MetricCard
            label="Salas ocupadas"
            value={data.salasOcupadas !== null ? `${data.salasOcupadas} / 34` : '—'}
            icon={<LayoutDashboard size={14} strokeWidth={1.75} />}
            accentColor="var(--color-brand)"
          />
          <MetricCard
            label="Usuários ativos"
            value="—"
            icon={<Users size={14} strokeWidth={1.75} />}
            accentColor="var(--color-subtle)"
            badge={
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--color-subtle)',
                  background: 'var(--color-surface-2)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                F6.7
              </span>
            }
          />
        </div>
      </section>

      {/* ── Linha 2: Infraestrutura ── */}
      <section>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            marginBottom: 12,
          }}
        >
          Infraestrutura
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 12,
          }}
        >
          <InfraCard
            label="API"
            icon={<Server size={16} strokeWidth={1.75} />}
            value="ok"
            statusBadge={data.apiStatus === 'ok' ? statusBadgeOk : statusBadgeDown}
          />
          <InfraCard
            label="Banco"
            icon={<Database size={16} strokeWidth={1.75} />}
            value="ok"
            statusBadge={data.dbStatus === 'ok' ? statusBadgeOk : statusBadgeDown}
            subValue="TODO F6.6"
          />
          <InfraCard
            label="WebSocket"
            icon={<Wifi size={16} strokeWidth={1.75} />}
            value="ok"
            statusBadge={
              data.webSocketStatus === 'ok'
                ? statusBadgeUnknown
                : {
                    label: 'Desconhecido',
                    color: 'var(--color-muted)',
                    bg: 'var(--color-surface-2)',
                  }
            }
            subValue="TODO F7.3"
          />
          <InfraCard
            label="Última Sync"
            icon={<RefreshCw size={16} strokeWidth={1.75} />}
            value={data.ultimaSync ? timeAgo(data.ultimaSync) : '—'}
            {...(data.ultimaSync !== null
              ? { subValue: new Date(data.ultimaSync).toLocaleDateString('pt-BR') }
              : {})}
          />
          <InfraCard
            label="Versão"
            icon={<GitBranch size={16} strokeWidth={1.75} />}
            value={data.versao ?? '—'}
          />
          <InfraCard
            label="Uptime"
            icon={<Activity size={16} strokeWidth={1.75} />}
            value={data.uptime !== null ? formatUptime(data.uptime) : '—'}
          />
        </div>
      </section>

      {/* ── Quick Actions ── */}
      <section>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.08em',
            textTransform: 'uppercase',
            color: 'var(--color-muted)',
            marginBottom: 12,
          }}
        >
          Ações rápidas
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/admin/auditoria')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              height: 36,
              padding: '0 16px',
              borderRadius: 'var(--radius-s)',
              background: 'var(--color-brand)',
              border: '1px solid var(--color-brand)',
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <ScrollText size={14} strokeWidth={2} />
            Ver Auditoria
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/sync')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              height: 36,
              padding: '0 16px',
              borderRadius: 'var(--radius-s)',
              background: 'transparent',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} strokeWidth={2} />
            Sincronizar Aulas
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────

export default function AdminDashboardPage(): JSX.Element {
  const service = useMemo(() => {
    const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
    return createNestjsApiService(appsScript);
  }, []);

  const { data, status, error, refetch } = useAdminDashboard(service);

  const handleRefetch = useCallback(() => {
    void refetch();
  }, [refetch]);

  const isLoading = status === 'idle' || status === 'loading';
  const isRefetching = status === 'loading' && data !== null;

  return (
    <>
      {/* @keyframes pulse — inline para não poluir global.css */}
      <style>{`
        @keyframes admin-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .45; }
        }
        .admin-skeleton-card {
          animation: admin-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 28,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: 'var(--color-brand)',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <LayoutDashboard size={18} strokeWidth={1.75} color="#fff" />
            </div>
            <div>
              <h1
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  lineHeight: 1.2,
                }}
              >
                Dashboard Admin
              </h1>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
                Visão geral do sistema.
              </p>
            </div>
          </div>

          {/* Meta + Atualizar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {data?.lastUpdatedAt && (
              <span style={{ fontSize: 11.5, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
                Atualizado às {formatTimestamp(data.lastUpdatedAt)}
              </span>
            )}
            <button
              type="button"
              onClick={handleRefetch}
              disabled={isLoading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 12px',
                borderRadius: 'var(--radius-s)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              <RefreshCw
                size={13}
                strokeWidth={2}
                style={isRefetching ? { animation: 'spin 0.8s linear infinite' } : undefined}
              />
              Atualizar
            </button>
          </div>
        </div>

        {/* ── Estado: erro ── */}
        {status === 'error' && error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 16px',
              background: 'var(--color-red-l)',
              border: '1px solid var(--color-red)',
              borderRadius: 'var(--radius)',
              marginBottom: 20,
              color: 'var(--color-red)',
            }}
          >
            <AlertCircle size={16} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, flex: 1 }}>
              Erro ao carregar dados. {error.message}
            </span>
            <button
              type="button"
              onClick={handleRefetch}
              style={{
                background: 'transparent',
                border: '1px solid var(--color-red)',
                color: 'var(--color-red)',
                borderRadius: 'var(--radius-s)',
                padding: '4px 10px',
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* ── Estado: loading (sem dados ainda) ── */}
        {isLoading && data === null && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Skeleton linha 1 */}
            <div>
              <div
                style={{
                  height: 14,
                  width: 100,
                  borderRadius: 4,
                  background: 'var(--color-surface-2)',
                  marginBottom: 12,
                }}
                className="admin-skeleton-card"
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 12,
                }}
              >
                {[0, 1, 2, 3].map(i => (
                  <SkeletonCard key={i} height={96} />
                ))}
              </div>
            </div>
            {/* Skeleton linha 2 */}
            <div>
              <div
                style={{
                  height: 14,
                  width: 100,
                  borderRadius: 4,
                  background: 'var(--color-surface-2)',
                  marginBottom: 12,
                }}
                className="admin-skeleton-card"
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: 12,
                }}
              >
                {[0, 1, 2, 3, 4, 5].map(i => (
                  <SkeletonCard key={i} height={70} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Estado: dados disponíveis ── */}
        {data !== null && (
          <DashboardContent data={data} onRefetch={handleRefetch} isRefetching={isRefetching} />
        )}

        {/* ── Status bar ── */}
        {data !== null && (
          <div
            style={{
              marginTop: 24,
              padding: '10px 14px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              color: 'var(--color-muted)',
            }}
          >
            <CheckCircle2
              size={13}
              strokeWidth={2}
              style={{ color: 'var(--color-green)', flexShrink: 0 }}
            />
            Dados carregados com sucesso
            {data.lastUpdatedAt && (
              <span style={{ marginLeft: 4 }}>· {formatTimestamp(data.lastUpdatedAt)}</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}
