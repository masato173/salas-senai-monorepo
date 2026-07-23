import { useMemo, useCallback, useState } from 'react';
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Database, Zap } from 'lucide-react';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { useTriggerSync } from '../../../hooks/useTriggerSync';
import { useSyncHistory } from '../../../hooks/useSyncHistory';
import { useSchedule } from '../../../hooks/useSchedule';
import {
  applyScheduleFilters,
  type ScheduleFilterState,
} from '../../../components/dashboard/applyScheduleFilters';
import { OccupancyDashboard } from '../../../components/dashboard/OccupancyDashboard';
import { todayYmd } from '../../../components/dashboard/scheduleDateUtils';
import type { AuditLog, RegistroLegado } from '../../../types';
import type { SyncResult } from '@salas-senai/shared';

// Estado inicial dos filtros da tabela histórica de Schedule — migrado de
// Dashboard/index.tsx na unificação Schedule+Reservation (F-unify).
const ESTADO_INICIAL_FILTROS_SCHEDULE: ScheduleFilterState = {
  turma: '',
  data: '',
  sala: '',
  mes: '',
  turno: 'TODOS',
};

// ─────────────────────────────────────────────────────────────
// AdminSyncPage — F6.5
//
// Gerencia a sincronização Apps Script → banco de dados.
// Fluxo: botão → confirmação inline → loading → resultado.
// Histórico: últimas 10 sincronizações via GET /audit.
// ─────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Manaus',
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

// ─── Resultado de um sync (extrai do AuditLog.after) ─────────
interface SyncAfter {
  synced?: number;
  fromAppsScript?: number;
  duration?: number;
  startedAt?: string;
  finishedAt?: string;
}

function extractAfter(log: AuditLog): SyncAfter {
  if (log.after !== null && typeof log.after === 'object' && !Array.isArray(log.after)) {
    return log.after as SyncAfter;
  }
  return {};
}

// ─── Card de resultado de trigger ────────────────────────────
function ResultCard({ result }: { result: SyncResult }): JSX.Element {
  return (
    <div
      style={{
        background: 'var(--color-green-l)',
        border: '1px solid var(--color-green)',
        borderRadius: 10,
        padding: '20px 24px',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <CheckCircle2 size={18} style={{ color: 'var(--color-green)' }} />
        <span style={{ fontWeight: 600, color: 'var(--color-green)', fontSize: 14 }}>
          Sincronização concluída
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 12,
        }}
      >
        {[
          { label: 'Registros sincronizados', value: result.synced.toLocaleString('pt-BR') },
          { label: 'Fonte (Apps Script)', value: result.fromAppsScript.toLocaleString('pt-BR') },
          { label: 'Duração', value: formatDuration(result.duration) },
          { label: 'Concluído em', value: formatTimestamp(result.finishedAt) },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{ background: 'var(--color-surface)', borderRadius: 6, padding: '10px 14px' }}
          >
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Linha de histórico ───────────────────────────────────────
function HistoryRow({ log, isLast }: { log: AuditLog; isLast: boolean }): JSX.Element {
  const after = extractAfter(log);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        gap: 16,
        padding: '10px 16px',
        alignItems: 'center',
        borderBottom: isLast ? 'none' : '1px solid var(--color-border)',
        fontSize: 13,
      }}
    >
      <div>
        <div style={{ color: 'var(--color-text)', fontWeight: 500 }}>
          {formatTimestamp(log.timestamp)}
        </div>
        <div style={{ color: 'var(--color-muted)', fontSize: 11 }}>
          {timeAgo(log.timestamp)} — por {log.user.name}
        </div>
      </div>
      <div style={{ textAlign: 'right', color: 'var(--color-text)' }}>
        {after.synced !== undefined ? after.synced.toLocaleString('pt-BR') : '—'}
        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>registros</div>
      </div>
      <div style={{ textAlign: 'right', color: 'var(--color-text)' }}>
        {after.duration !== undefined ? formatDuration(after.duration) : '—'}
        <div style={{ fontSize: 11, color: 'var(--color-muted)' }}>duração</div>
      </div>
      <span
        style={{
          display: 'inline-block',
          padding: '2px 8px',
          borderRadius: 20,
          fontSize: 11,
          fontWeight: 600,
          background: 'var(--color-green-l)',
          color: 'var(--color-green)',
        }}
      >
        OK
      </span>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────
export default function AdminSyncPage(): JSX.Element {
  const service = useMemo(() => createNestjsApiService(), []);

  const {
    execute,
    status: triggerStatus,
    data: triggerResult,
    error: triggerError,
  } = useTriggerSync(service);
  const { data: history, status: historyStatus, refetch: refetchHistory } = useSyncHistory(service);

  const [confirmVisible, setConfirmVisible] = useState(false);

  // ─── Registros históricos de Schedule (Apps Script) — migrado da
  // Dashboard na unificação Schedule+Reservation. Esta seção mostra os
  // dados BRUTOS importados da planilha (não a visão operacional do dia,
  // que agora vive em GET /availability na Dashboard).
  const schedule = useSchedule(service);
  const [filtrosSchedule, setFiltrosSchedule] = useState<ScheduleFilterState>(
    ESTADO_INICIAL_FILTROS_SCHEDULE,
  );
  const [scheduleTablePage, setScheduleTablePage] = useState<number>(1);

  function updateFiltroSchedule<K extends keyof ScheduleFilterState>(
    key: K,
    value: ScheduleFilterState[K],
  ): void {
    setFiltrosSchedule(prev => ({ ...prev, [key]: value }));
    setScheduleTablePage(1);
  }

  function resetFiltrosSchedule(): void {
    setFiltrosSchedule(ESTADO_INICIAL_FILTROS_SCHEDULE);
    setScheduleTablePage(1);
  }

  const registrosSchedule = useMemo<RegistroLegado[]>(
    () => schedule.data?.registros ?? [],
    [schedule.data],
  );
  const filteredSchedule = useMemo<RegistroLegado[]>(
    () => applyScheduleFilters(registrosSchedule, filtrosSchedule),
    [registrosSchedule, filtrosSchedule],
  );
  const salasUnicasSchedule = useMemo<string[]>(
    () => [...new Set(registrosSchedule.map(r => r.sala))].sort((a, b) => a.localeCompare(b)),
    [registrosSchedule],
  );
  const mesesUnicosSchedule = useMemo<string[]>(
    () => [...new Set(registrosSchedule.map(r => r.mes))],
    [registrosSchedule],
  );
  const hojeSchedule = todayYmd();

  const handleTrigger = useCallback(async () => {
    setConfirmVisible(false);
    const res = await execute();
    if (res.ok) {
      // Atualiza histórico após sync bem-sucedido
      void refetchHistory();
    }
  }, [execute, refetchHistory]);

  const isLoading = triggerStatus === 'loading';
  const historyRows = history?.data ?? [];
  const lastSync = historyRows[0];

  return (
    <div style={{ padding: '28px 24px', maxWidth: 900 }}>
      {/* Cabeçalho */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 28,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <RefreshCw size={20} style={{ color: 'var(--color-brand)' }} />
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
              Sincronização de Aulas
            </h1>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
            Importa registros do Google Apps Script para o banco de dados PostgreSQL. Operação
            idempotente — DELETE + INSERT em batches de 500.
          </p>
        </div>
      </div>

      {/* Cards de status rápido */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Database size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>
              Último sync
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {lastSync ? timeAgo(lastSync.timestamp) : '—'}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Zap size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>
              Registros (último)
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {lastSync
                ? ((extractAfter(lastSync).synced ?? '—').toLocaleString?.('pt-BR') ?? '—')
                : '—'}
            </div>
          </div>
        </div>

        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Clock size={20} style={{ color: 'var(--color-brand)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-muted)', marginBottom: 2 }}>
              Duração (último)
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
              {lastSync ? formatDuration(extractAfter(lastSync).duration ?? 0) : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Resultado do trigger */}
      {triggerStatus === 'success' && triggerResult && <ResultCard result={triggerResult} />}

      {/* Erro do trigger */}
      {triggerStatus === 'error' && triggerError && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            background: 'var(--color-red-l)',
            border: '1px solid var(--color-red)',
            borderRadius: 8,
            marginBottom: 24,
            color: 'var(--color-red)',
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} />
          <span>
            {triggerError.code === 'CONFLICT'
              ? 'Já existe uma sincronização em andamento. Aguarde e tente novamente.'
              : `Erro ao sincronizar: ${triggerError.message}`}
          </span>
        </div>
      )}

      {/* Botão de trigger */}
      <div
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 10,
          padding: '24px',
          marginBottom: 28,
        }}
      >
        <h2
          style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}
        >
          Sincronizar agora
        </h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-muted)' }}>
          Apaga todos os registros de aula do banco e reimporta do Apps Script. Pode levar até 60
          segundos. Reservas não são afetadas.
        </p>

        {!confirmVisible ? (
          <button
            onClick={() => setConfirmVisible(true)}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 20px',
              background: 'var(--color-brand)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.7 : 1,
            }}
          >
            <RefreshCw
              size={15}
              style={isLoading ? { animation: 'syncSpin 0.8s linear infinite' } : undefined}
            />
            {isLoading ? 'Sincronizando…' : 'Iniciar Sincronização'}
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text)', fontWeight: 500 }}>
              Confirmar sincronização? Isso apaga e reimporta todos os registros de aula.
            </span>
            <button
              onClick={() => void handleTrigger()}
              style={{
                padding: '8px 18px',
                background: 'var(--color-brand)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmVisible(false)}
              style={{
                padding: '8px 18px',
                background: 'var(--color-surface-2)',
                color: 'var(--color-text)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* Histórico */}
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
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-2)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
            Histórico de sincronizações
            {history && (
              <span
                style={{
                  fontWeight: 400,
                  color: 'var(--color-muted)',
                  marginLeft: 8,
                  fontSize: 12,
                }}
              >
                (últimas {history.data.length})
              </span>
            )}
          </h2>
          <button
            onClick={() => void refetchHistory()}
            disabled={historyStatus === 'loading'}
            style={{
              background: 'none',
              border: 'none',
              cursor: historyStatus === 'loading' ? 'not-allowed' : 'pointer',
              color: 'var(--color-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              padding: '4px 8px',
            }}
          >
            <RefreshCw size={12} />
            Atualizar
          </button>
        </div>

        {historyStatus === 'loading' && (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--color-muted)',
              fontSize: 13,
            }}
          >
            Carregando histórico…
          </div>
        )}

        {historyStatus === 'success' && historyRows.length === 0 && (
          <div
            style={{
              padding: '32px 20px',
              textAlign: 'center',
              color: 'var(--color-subtle)',
              fontSize: 13,
            }}
          >
            Nenhuma sincronização registrada ainda.
          </div>
        )}

        {historyRows.map((log, i) => (
          <HistoryRow key={log.id} log={log} isLast={i === historyRows.length - 1} />
        ))}
      </div>

      {/* ── Registros importados da planilha (Schedule/Apps Script) ──── */}
      <div style={{ marginTop: 28 }}>
        <div style={{ marginBottom: 12 }}>
          <h2
            style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}
          >
            Registros importados da planilha
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-muted)' }}>
            Dados brutos de Schedule (aulas) trazidos do Google Apps Script pelo último sync. Ficam
            estáticos depois que a planilha institucional deixar de ser mantida — a visão
            operacional do dia (aulas + reservas combinadas) vive na Dashboard.
          </p>
        </div>
        <OccupancyDashboard
          filtered={filteredSchedule}
          filtros={filtrosSchedule}
          onFiltroChange={updateFiltroSchedule}
          page={scheduleTablePage}
          onPageChange={setScheduleTablePage}
          salasUnicas={salasUnicasSchedule}
          mesesUnicos={mesesUnicosSchedule}
          status={schedule.status}
          error={schedule.error}
          onRefetch={() => {
            void schedule.refetch();
          }}
          onReset={resetFiltrosSchedule}
          hoje={hojeSchedule}
        />
      </div>

      <style>{`
        @keyframes syncSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
