import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Users, Search, RefreshCw, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { createNestjsApiService } from '../../../services/nestjsApiService';
import { useListUsers } from '../../../hooks/useListUsers';
import { useUpdateUser } from '../../../hooks/useUpdateUser';
import { Select } from '../../../components/ui/Select';
import type { AdminUser, UserListParams } from '../../../types';

const ROLE_FILTER_OPTIONS = [
  { value: '', label: 'Todos os papéis' },
  { value: 'PROFESSOR', label: 'Professor' },
  { value: 'COORDENADOR', label: 'Coordenador' },
  { value: 'ADMIN', label: 'Admin' },
];

const ACTIVE_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'active', label: 'Ativos' },
  { value: 'inactive', label: 'Inativos' },
];

// ─────────────────────────────────────────────────────────────
// AdminUsuariosPage — F6.7
//
// Listagem paginada de usuários com filtros de busca, role e status.
// Edição inline: role via select, status via toggle — optimistic update.
// ─────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  AdminUser['role'],
  { label: string; bg: string; color: string; border: string }
> = {
  PROFESSOR: {
    label: 'Professor',
    bg: 'var(--color-blue-l)',
    color: 'var(--color-blue)',
    border: 'rgba(37,99,235,.3)',
  },
  COORDENADOR: {
    label: 'Coordenador',
    bg: 'var(--color-accent-l)',
    color: 'var(--color-accent)',
    border: 'rgba(224,124,43,.3)',
  },
  ADMIN: {
    label: 'Admin',
    bg: 'var(--color-red-l)',
    color: 'var(--color-red)',
    border: 'rgba(220,38,38,.3)',
  },
};

const LIMIT = 20;

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Manaus',
    });
  } catch {
    return '—';
  }
}

// ─── UserAvatar ───────────────────────────────────────────────
function UserAvatar({ name }: { name: string }): JSX.Element {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0] ?? '')
    .join('')
    .toUpperCase();

  const palette = ['#1e3a5f', '#2563eb', '#16a34a', '#b45309', '#7c3aed', '#0891b2'];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  const bg = palette[hash % palette.length] ?? '#1e3a5f';

  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        fontFamily: 'DM Sans, system-ui, sans-serif',
        fontVariantNumeric: 'tabular-nums',
        userSelect: 'none',
      }}
    >
      {initials}
    </div>
  );
}

// ─── ToggleSwitch ─────────────────────────────────────────────
function ToggleSwitch({
  active,
  disabled,
  onToggle,
}: {
  active: boolean;
  disabled: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={active ? 'Desativar usuário' : 'Ativar usuário'}
      style={{
        position: 'relative',
        width: 36,
        height: 20,
        borderRadius: 10,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        background: active ? 'var(--color-green)' : 'var(--color-border-2)',
        transition: 'background 180ms var(--ease)',
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: active ? 19 : 3,
          width: 14,
          height: 14,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.25)',
          transition: 'left 180ms var(--ease)',
        }}
      />
    </button>
  );
}

// ─── UserRow ──────────────────────────────────────────────────
function UserRow({
  user,
  mutating,
  onToggleActive,
  onRoleChange,
}: {
  user: AdminUser;
  mutating: boolean;
  onToggleActive: (user: AdminUser) => void;
  onRoleChange: (user: AdminUser, role: AdminUser['role']) => void;
}): JSX.Element {
  return (
    <tr
      style={{
        borderBottom: '1px solid var(--color-border)',
        opacity: mutating ? 0.7 : 1,
        transition: 'opacity 200ms',
      }}
    >
      {/* Usuário */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UserAvatar name={user.name} />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 200,
              }}
            >
              {user.name}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-muted)',
                marginTop: 1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 200,
              }}
            >
              {user.email}
            </div>
          </div>
        </div>
      </td>
      {/* Role */}
      <td style={{ padding: '12px 16px' }}>
        <select
          value={user.role}
          disabled={mutating}
          onChange={e => onRoleChange(user, e.target.value as AdminUser['role'])}
          style={{
            appearance: 'none',
            padding: '3px 24px 3px 10px',
            borderRadius: 20,
            border: `1px solid ${ROLE_CONFIG[user.role].border}`,
            background: ROLE_CONFIG[user.role].bg,
            color: ROLE_CONFIG[user.role].color,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '.04em',
            textTransform: 'uppercase',
            cursor: mutating ? 'not-allowed' : 'pointer',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%236b7280'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '8px',
            outline: 'none',
          }}
        >
          <option value="PROFESSOR">Professor</option>
          <option value="COORDENADOR">Coordenador</option>
          <option value="ADMIN">Admin</option>
        </select>
      </td>
      {/* Status */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ToggleSwitch
            active={user.active}
            disabled={mutating}
            onToggle={() => onToggleActive(user)}
          />
          <span
            style={{
              fontSize: 12,
              color: user.active ? 'var(--color-green)' : 'var(--color-muted)',
              fontWeight: 500,
            }}
          >
            {user.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
      </td>
      {/* Criado em */}
      <td style={{ padding: '12px 16px' }}>
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-muted)',
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatDate(user.createdAt)}
        </span>
      </td>
    </tr>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────
function SkeletonRows(): JSX.Element {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
          {[200, 120, 80, 80].map((w, j) => (
            <td key={j} style={{ padding: '12px 16px' }}>
              <div
                style={{
                  height: j === 0 ? 34 : 14,
                  borderRadius: j === 0 ? 17 : 4,
                  background: 'var(--color-surface-2)',
                  width: w,
                  animation: 'dtPulse 1.4s ease-in-out infinite',
                  animationDelay: `${i * 80}ms`,
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function AdminUsuariosPage(): JSX.Element {
  const service = useMemo(() => createNestjsApiService(), []);

  const { data, status, error, fetch } = useListUsers(service);
  const {
    updateRole,
    setActive,
    status: mutStatus,
    error: mutError,
    reset,
  } = useUpdateUser(service);

  // Local filter state
  const [searchInput, setSearchInput] = useState('');
  const [committedSearch, setCommittedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<AdminUser['role'] | ''>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [page, setPage] = useState(1);

  // Optimistic overlay — substitui a lista enquanto mutation está em voo
  const [localUsers, setLocalUsers] = useState<AdminUser[] | null>(null);
  const [mutatingId, setMutatingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchRef = useRef(fetch);
  fetchRef.current = fetch;

  const buildParams = useCallback(
    (
      search: string,
      role: AdminUser['role'] | '',
      active: 'all' | 'active' | 'inactive',
      p: number,
    ): UserListParams => ({
      page: p,
      limit: LIMIT,
      ...(search.trim() !== '' ? { search: search.trim() } : {}),
      ...(role !== '' ? { role } : {}),
      ...(active === 'active' ? { isActive: true } : {}),
      ...(active === 'inactive' ? { isActive: false } : {}),
    }),
    [],
  );

  // Fetch on committed filter/page change
  useEffect(() => {
    void fetchRef.current(buildParams(committedSearch, roleFilter, activeFilter, page));
    setLocalUsers(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedSearch, roleFilter, activeFilter, page]);

  // Sync localUsers when remote data arrives
  useEffect(() => {
    if (data !== null) setLocalUsers(data.data);
  }, [data]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setCommittedSearch(value);
      setPage(1);
    }, 400);
  };

  const handleRoleFilter = (value: AdminUser['role'] | '') => {
    setRoleFilter(value);
    setPage(1);
  };

  const handleActiveFilter = (value: 'all' | 'active' | 'inactive') => {
    setActiveFilter(value);
    setPage(1);
  };

  const handleRefresh = () => {
    reset();
    void fetchRef.current(buildParams(committedSearch, roleFilter, activeFilter, page));
  };

  // ─── Optimistic: toggle active ────────────────────────────
  const handleToggleActive = useCallback(
    async (user: AdminUser) => {
      if (mutatingId !== null) return;
      const newActive = !user.active;
      setMutatingId(user.id);
      // Optimistic update
      setLocalUsers(
        prev => prev?.map(u => (u.id === user.id ? { ...u, active: newActive } : u)) ?? null,
      );
      const updated = await setActive(user.id, newActive);
      if (updated !== null) {
        // Confirm with server response
        setLocalUsers(prev => prev?.map(u => (u.id === user.id ? updated : u)) ?? null);
      } else {
        // Rollback
        setLocalUsers(prev => prev?.map(u => (u.id === user.id ? user : u)) ?? null);
      }
      setMutatingId(null);
    },
    [mutatingId, setActive],
  );

  // ─── Optimistic: change role ──────────────────────────────
  const handleRoleChange = useCallback(
    async (user: AdminUser, newRole: AdminUser['role']) => {
      if (mutatingId !== null || newRole === user.role) return;
      setMutatingId(user.id);
      // Optimistic update
      setLocalUsers(
        prev => prev?.map(u => (u.id === user.id ? { ...u, role: newRole } : u)) ?? null,
      );
      const updated = await updateRole(user.id, newRole);
      if (updated !== null) {
        setLocalUsers(prev => prev?.map(u => (u.id === user.id ? updated : u)) ?? null);
      } else {
        // Rollback
        setLocalUsers(prev => prev?.map(u => (u.id === user.id ? user : u)) ?? null);
      }
      setMutatingId(null);
    },
    [mutatingId, updateRole],
  );

  const isLoading = status === 'loading';
  const rows = localUsers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      <style>{`@keyframes dtPulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      <div style={{ padding: '28px 24px', maxWidth: 1100 }}>
        {/* ─ Header ─ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
              <Users size={18} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
                Usuários
              </h1>
              {total > 0 && (
                <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
                  {total} {total === 1 ? 'usuário' : 'usuários'} cadastrados
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            title="Atualizar"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              background: 'var(--color-surface)',
              color: 'var(--color-muted)',
              fontSize: 13,
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.6 : 1,
            }}
          >
            <RefreshCw
              size={13}
              style={{ animation: isLoading ? 'dtSpin 800ms linear infinite' : 'none' }}
            />
            Atualizar
          </button>
        </div>

        {/* ─ Filters ─ */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 16,
          }}
        >
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 0 }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-subtle)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              placeholder="Buscar por nome ou email…"
              value={searchInput}
              onChange={e => handleSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>
          {/* Role filter */}
          <div style={{ width: '170px', flexShrink: 0 }}>
            <Select
              value={roleFilter}
              onChange={v => handleRoleFilter(v as AdminUser['role'] | '')}
              options={ROLE_FILTER_OPTIONS}
              aria-label="Filtrar por papel"
            />
          </div>
          {/* Active filter */}
          <div style={{ width: '150px', flexShrink: 0 }}>
            <Select
              value={activeFilter}
              onChange={v => handleActiveFilter(v as 'all' | 'active' | 'inactive')}
              options={ACTIVE_FILTER_OPTIONS}
              aria-label="Filtrar por status"
            />
          </div>
        </div>

        {/* ─ Error banners ─ */}
        {(status === 'error' || mutStatus === 'error') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'var(--color-red-l)',
              border: '1px solid rgba(220,38,38,.3)',
              borderRadius: 8,
              marginBottom: 16,
              fontSize: 13,
              color: 'var(--color-red)',
            }}
          >
            <AlertCircle size={14} />
            {mutStatus === 'error' && mutError !== null
              ? mutError.message
              : (error?.message ?? 'Erro ao carregar usuários.')}
            {status === 'error' && (
              <button
                type="button"
                onClick={handleRefresh}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 10px',
                  border: '1px solid var(--color-red)',
                  borderRadius: 4,
                  background: 'transparent',
                  color: 'var(--color-red)',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                Tentar novamente
              </button>
            )}
          </div>
        )}

        {/* ─ Table ─ */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    background: 'var(--color-surface-2)',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  {['Usuário', 'Papel', 'Status', 'Cadastrado em'].map(h => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--color-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '.05em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && rows.length === 0 ? (
                  <SkeletonRows />
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: '48px 16px',
                        textAlign: 'center',
                        color: 'var(--color-muted)',
                        fontSize: 14,
                      }}
                    >
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  rows.map(user => (
                    <UserRow
                      key={user.id}
                      user={user}
                      mutating={mutatingId === user.id}
                      onToggleActive={handleToggleActive}
                      onRoleChange={handleRoleChange}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ─ Pagination ─ */}
          {totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderTop: '1px solid var(--color-border)',
                background: 'var(--color-surface-2)',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                Página {page} de {totalPages}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: 12,
                    cursor: page <= 1 || isLoading ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 || isLoading ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft size={13} /> Anterior
                </button>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 10px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 6,
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    fontSize: 12,
                    cursor: page >= totalPages || isLoading ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages || isLoading ? 0.5 : 1,
                  }}
                >
                  Próxima <ChevronRight size={13} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
