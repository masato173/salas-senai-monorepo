import React, { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { ScrollText, RefreshCw, AlertCircle } from 'lucide-react';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { useAuditLogs } from '../../../hooks/useAuditLogs';
import { DataTable } from '../../../components/DataTable';
import type { Column } from '../../../components/DataTable';
import { JsonTree } from '../../../components/JsonTree';
import { Pagination } from '../../../components/Pagination';
import { DatePicker } from '../../../components/ui/DatePicker';
import type { AuditLog, AuditQuery } from '../../../types';

// ─────────────────────────────────────────────────────────────
// AdminAuditoriaPage — F6.4
//
// Trilha completa de auditoria: GET /audit com filtros server-side
// e paginação. Linhas expansíveis mostram before/after JSON.
// ─────────────────────────────────────────────────────────────

interface FilterState {
  action: string;
  entityType: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterState = { action: '', entityType: '', from: '', to: '' };

const ACTION_OPTIONS = [
  '',
  'CREATE_RESERVATION',
  'CANCEL_RESERVATION',
  'UPDATE_RESERVATION',
  'APPROVE_RESERVATION',
  'REJECT_RESERVATION',
  'SYNC_SCHEDULES',
  'LOGIN',
  'LOGOUT',
];

const ENTITY_OPTIONS = ['', 'Reservation', 'User', 'Room', 'Schedule'];

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

function truncate(s: string, max = 12): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ─── Colunas da tabela ────────────────────────────────────────

const COLUMNS: Column<AuditLog>[] = [
  {
    key: 'user',
    header: 'Usuário',
    width: '200px',
    render(row) {
      return (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text)' }}>
            {row.user.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted)', marginTop: 1 }}>
            {row.user.email}
          </div>
        </div>
      );
    },
  },
  {
    key: 'action',
    header: 'Ação',
    width: '200px',
    render(row) {
      const isDestructive =
        row.action.includes('CANCEL') ||
        row.action.includes('REJECT') ||
        row.action.includes('LOGOUT');
      const isPositive =
        row.action.includes('CREATE') ||
        row.action.includes('APPROVE') ||
        row.action.includes('LOGIN');
      const bg = isDestructive
        ? 'var(--color-danger-l, #fff1f0)'
        : isPositive
          ? 'var(--color-green-l, #f0faf4)'
          : 'var(--color-surface-2)';
      const color = isDestructive
        ? 'var(--color-danger, #cf1322)'
        : isPositive
          ? 'var(--color-green, #389e0d)'
          : 'var(--color-muted)';
      return (
        <span
          style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 600,
            background: bg,
            color,
            whiteSpace: 'nowrap',
          }}
        >
          {row.action.replace(/_/g, ' ')}
        </span>
      );
    },
  },
  {
    key: 'entity',
    header: 'Entidade',
    width: '180px',
    render(row) {
      return (
        <div>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--color-text)' }}>
            {row.entityType}
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--color-muted)',
              marginTop: 1,
              fontFamily: 'monospace',
            }}
          >
            {truncate(row.entityId)}
          </div>
        </div>
      );
    },
  },
  {
    key: 'ip',
    header: 'IP',
    width: '120px',
    render(row) {
      return (
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 12,
            color: row.ip ? 'var(--color-text)' : 'var(--color-subtle)',
          }}
        >
          {row.ip ?? '—'}
        </span>
      );
    },
  },
  {
    key: 'timestamp',
    header: 'Data / Hora',
    width: '160px',
    render(row) {
      return (
        <span style={{ fontSize: 12, color: 'var(--color-muted)', whiteSpace: 'nowrap' }}>
          {formatTimestamp(row.timestamp)}
        </span>
      );
    },
  },
];

// ─── Conteúdo expandido (before/after) ───────────────────────

function ExpandedRow({ row }: { row: AuditLog }): JSX.Element {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-muted)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Antes
        </div>
        <JsonTree value={row.before} />
      </div>
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-muted)',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Depois
        </div>
        <JsonTree value={row.after} />
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────

export default function AdminAuditoriaPage(): JSX.Element {
  const service = useMemo(() => createNestjsApiService(), []);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, status, error, refetch, currentQuery } = useAuditLogs(service, {
    page: 1,
    limit: 20,
  });

  const applyFilters = useCallback(
    (overrides?: Partial<AuditQuery>) => {
      const q: AuditQuery = {
        page: 1,
        limit: 20,
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.entityType ? { entityType: filters.entityType } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...overrides,
      };
      void refetch(q);
    },
    [filters, refetch],
  );

  const handleFilterChange = useCallback(
    (field: keyof FilterState, value: string) => {
      setFilters(prev => ({ ...prev, [field]: value }));

      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const updated = { ...filters, [field]: value };
        const q: AuditQuery = {
          page: 1,
          limit: 20,
          ...(updated.action ? { action: updated.action } : {}),
          ...(updated.entityType ? { entityType: updated.entityType } : {}),
          ...(updated.from ? { from: updated.from } : {}),
          ...(updated.to ? { to: updated.to } : {}),
        };
        void refetch(q);
      }, 400);
    },
    [filters, refetch],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleClearFilters = useCallback(() => {
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    setFilters(EMPTY_FILTERS);
    void refetch({ page: 1, limit: 20 });
  }, [refetch]);

  const handlePageChange = useCallback(
    (page: number) => {
      applyFilters({ page, limit: currentQuery.limit });
    },
    [applyFilters, currentQuery.limit],
  );

  const isLoading = status === 'loading';
  const hasFilters =
    filters.action !== '' || filters.entityType !== '' || filters.from !== '' || filters.to !== '';
  const rows = data?.data ?? [];
  const totalPages = data ? Math.ceil(data.total / data.limit) : 0;

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px',
    border: '1px solid var(--color-border)',
    borderRadius: 6,
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: 13,
    outline: 'none',
    minWidth: 0,
  };

  return (
    <div style={{ padding: '28px 24px', maxWidth: 1200 }}>
      {/* Cabeçalho */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScrollText size={20} style={{ color: 'var(--color-brand)' }} />
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
            Auditoria
          </h1>
          {data && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-muted)',
                background: 'var(--color-surface-2)',
                padding: '2px 8px',
                borderRadius: 12,
              }}
            >
              {data.total} registros
            </span>
          )}
        </div>
        <button
          onClick={() => applyFilters()}
          disabled={isLoading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            fontSize: 13,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          <RefreshCw
            size={13}
            style={isLoading ? { animation: 'spin 0.8s linear infinite' } : undefined}
          />
          Atualizar
        </button>
      </div>

      {/* Barra de filtros */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto',
          gap: 8,
          marginBottom: 16,
          alignItems: 'end',
        }}
      >
        <select
          value={filters.action}
          onChange={e => handleFilterChange('action', e.target.value)}
          style={inputStyle}
          aria-label="Filtrar por ação"
        >
          <option value="">Todas as ações</option>
          {ACTION_OPTIONS.filter(o => o !== '').map(o => (
            <option key={o} value={o}>
              {o.replace(/_/g, ' ')}
            </option>
          ))}
        </select>

        <select
          value={filters.entityType}
          onChange={e => handleFilterChange('entityType', e.target.value)}
          style={inputStyle}
          aria-label="Filtrar por entidade"
        >
          <option value="">Todas as entidades</option>
          {ENTITY_OPTIONS.filter(o => o !== '').map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>

        <DatePicker
          value={filters.from}
          onChange={v => handleFilterChange('from', v)}
          aria-label="Data de início"
          placeholder="Data de início"
        />

        <DatePicker
          value={filters.to}
          onChange={v => handleFilterChange('to', v)}
          aria-label="Data de fim"
          placeholder="Data de fim"
        />

        {hasFilters && (
          <button
            onClick={handleClearFilters}
            style={{
              padding: '6px 14px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              background: 'var(--color-surface)',
              color: 'var(--color-muted)',
              fontSize: 13,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Limpar
          </button>
        )}
      </div>

      {/* Erro */}
      {status === 'error' && error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            background: 'var(--color-danger-l, #fff1f0)',
            border: '1px solid var(--color-danger, #ff4d4f)',
            borderRadius: 8,
            marginBottom: 16,
            color: 'var(--color-danger, #cf1322)',
            fontSize: 13,
          }}
        >
          <AlertCircle size={16} />
          <span>
            Erro ao carregar auditoria: {error.message}{' '}
            <button
              onClick={() => applyFilters()}
              style={{
                background: 'none',
                border: 'none',
                textDecoration: 'underline',
                cursor: 'pointer',
                color: 'inherit',
                padding: 0,
                fontSize: 'inherit',
              }}
            >
              Tentar novamente
            </button>
          </span>
        </div>
      )}

      {/* Tabela */}
      <DataTable<AuditLog>
        columns={COLUMNS}
        rows={rows}
        rowKey={row => row.id}
        emptyMessage="Nenhum registro de auditoria encontrado para os filtros aplicados."
        loading={isLoading}
        expandedContent={row => <ExpandedRow row={row} />}
      />

      {/* Paginação */}
      {data && totalPages > 1 && (
        <Pagination
          page={currentQuery.page}
          totalPages={totalPages}
          total={data.total}
          limit={data.limit}
          onPageChange={handlePageChange}
          disabled={isLoading}
        />
      )}

      {/* CSS inline: spin para o ícone de loading */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
