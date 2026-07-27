import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  Building2,
  Users,
  BarChart3,
  Settings,
  ClipboardCheck,
  ChevronsLeft,
  Menu,
  X,
  Sun,
  Moon,
  UserCog,
  ShieldCheck,
  ScrollText,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Braces,
  HeartPulse,
} from 'lucide-react';
import { PageTransition } from '../router/PageTransition';
import { ROUTES, getBreadcrumbs, ROUTE_SECTIONS } from '../router/config';
import { hasRole } from '../router/ProtectedRoute';
import { useAuthStore, selectAccessToken, selectUser } from '../store/authStore';
import { getSocket, disconnectSocket } from '../services/socketClient';
import { useRealtimeSocket } from '../hooks/useRealtimeSocket';

const ICON_MAP = {
  LayoutDashboard,
  CalendarCheck,
  FileText,
  Building2,
  Users,
  BarChart3,
  Settings,
  ClipboardCheck,
  UserCog,
  ShieldCheck,
  ScrollText,
  RefreshCw,
  Server,
  SlidersHorizontal,
  Braces,
  HeartPulse,
} as const;

type IconName = keyof typeof ICON_MAP;

const SECTION_LABELS = {
  principal: 'Principal',
  gestao: 'Gestão',
  sistema: 'Sistema',
  admin: 'Admin',
} as const;

// ─────────────────────────────────────────────────────────────
// AppLayout — shell completo: sidebar + topbar + outlet
// ─────────────────────────────────────────────────────────────
export function AppLayout() {
  const location = useLocation();
  const userRole = useAuthStore(s => s.user?.role ?? '');
  const accessToken = useAuthStore(selectAccessToken);
  const currentUser = useAuthStore(selectUser);

  // F7.3 — Socket.IO: abre/fecha conexão conforme o token.
  // AppLayout gerencia apenas ciclo de vida.
  // Páginas subscrevem eventos via useRealtimeSocket({ onReservationEvent }).
  useEffect(() => {
    if (accessToken !== null) {
      getSocket(accessToken);
    } else {
      disconnectSocket();
    }
  }, [accessToken]);

  // Notificação efêmera na sidebar (não sobrevive a reload — não há campo
  // no schema hoje pra diferenciar quem criou de quem é o dono da reserva
  // de forma persistente). Mora aqui porque AppLayout já tem role + rota
  // atual; evita duplicar esse estado em cada página.
  //   PROFESSOR: indicador em "Minha Agenda" quando uma reserva EM SEU NOME
  //     é criada (payload.userId é sempre o dono — inclusive em reservas
  //     por proxy do coordenador, ver ReservationsService.resolveOwnerUserId).
  //   COORDENADOR|ADMIN: indicador em "Reservas" quando uma reserva nova
  //     nasce PENDING (sinal de que precisa de aprovação).
  // Some sozinho ao visitar a rota notificada (useEffect abaixo).
  const [notifyPath, setNotifyPath] = useState<string | null>(null);

  useRealtimeSocket({
    onReservationEvent: (event, payload) => {
      if (event !== 'reservation.created') return;
      if (userRole === 'PROFESSOR') {
        if (payload.userId === currentUser?.id) setNotifyPath('/minha-agenda');
      } else if (userRole === 'COORDENADOR' || userRole === 'ADMIN') {
        if (payload.status === 'PENDING') setNotifyPath('/reservas');
      }
    },
  });

  useEffect(() => {
    if (notifyPath !== null && location.pathname === notifyPath) {
      setNotifyPath(null);
    }
  }, [location.pathname, notifyPath]);

  // Sidebar state
  const [collapsed, setCollapsed] = useState(() => ls('sidebar-collapsed') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = ls('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    lsSave('theme', theme);
  }, [theme]);

  useEffect(() => {
    lsSave('sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  // Fecha sidebar mobile em mudança de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  // Atualiza page title
  const currentRoute = ROUTES.find(r => r.path === location.pathname);
  useEffect(() => {
    document.title = currentRoute?.pageTitle ?? 'SENAI Salas';
  }, [currentRoute]);

  const breadcrumbs = getBreadcrumbs(location.pathname);
  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), []);

  return (
    <div className="app-shell">
      {/* ── Overlay mobile ──────────────────────────────── */}
      {mobileOpen && (
        <div
          className="sidebar-overlay visible"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside
        className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
      >
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">SS</div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">SENAI Salas</span>
            <span className="sidebar-logo-sub">v2.0 · Production</span>
          </div>
        </div>

        {/* Nav sections */}
        <nav className="sidebar-nav" aria-label="Navegação principal">
          {(['principal', 'gestao', 'sistema'] as const as string[])
            // Fase B — seção 'admin' abre pra COORDENADOR também (4 das 10
            // rotas admin liberam COORDENADOR; as outras 6 continuam ADMIN
            // via requiredRole em router/config.ts). O filtro por rota logo
            // abaixo (hasRole) é quem decide quais das 10 aparecem — esta
            // condição só decide se a SEÇÃO existe.
            .concat(userRole === 'ADMIN' || userRole === 'COORDENADOR' ? ['admin'] : [])
            // Seções sem rotas (ex: 'sistema' após remover as abas stub) não
            // renderizam cabeçalho órfão. Reutiliza hasRole (mesma hierarquia
            // de ProtectedRoute.tsx, não duplicada) pra já contar só as
            // rotas que o usuário realmente pode ver.
            .filter(
              section =>
                ROUTE_SECTIONS[section as keyof typeof ROUTE_SECTIONS].filter(
                  route => !route.requiredRole || hasRole(userRole, route.requiredRole),
                ).length > 0,
            )
            .map(section => (
              <div key={section}>
                <div className="sidebar-section-label">
                  {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
                </div>
                {ROUTE_SECTIONS[section as keyof typeof ROUTE_SECTIONS]
                  .filter(route => !route.requiredRole || hasRole(userRole, route.requiredRole))
                  .map(route => {
                    const Icon = ICON_MAP[route.icon as IconName];
                    return (
                      <NavLink
                        key={route.path}
                        to={route.path}
                        end={route.path === '/'}
                        data-label={route.label}
                        className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                        aria-label={
                          route.path === notifyPath
                            ? `${route.label} (nova notificação)`
                            : undefined
                        }
                      >
                        <span className="sidebar-icon" aria-hidden="true">
                          {Icon && <Icon size={16} strokeWidth={1.75} />}
                          {route.path === notifyPath && (
                            <span className="sidebar-notify-dot" aria-hidden="true" />
                          )}
                        </span>
                        <span className="sidebar-label">{route.label}</span>
                      </NavLink>
                    );
                  })}
              </div>
            ))}
        </nav>

        {/* Collapse toggle */}
        <div className="sidebar-toggle">
          <button
            className="sidebar-toggle-btn"
            onClick={() => setCollapsed(c => !c)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <span className="toggle-icon sidebar-icon">
              <ChevronsLeft size={16} strokeWidth={1.75} />
            </span>
            <span className="sidebar-label toggle-label">Recolher</span>
          </button>
        </div>
      </aside>

      {/* ── Main wrap ───────────────────────────────────── */}
      <div className={`main-wrap ${collapsed ? 'collapsed' : ''}`}>
        {/* Topbar */}
        <header className="topbar">
          <button
            className="topbar-mobile-toggle"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Abrir menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Breadcrumbs */}
          <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && (
                  <span className="topbar-breadcrumb-sep" aria-hidden="true">
                    ›
                  </span>
                )}
                {i < breadcrumbs.length - 1 ? (
                  <NavLink to={crumb.path} className="topbar-breadcrumb-root">
                    {crumb.label}
                  </NavLink>
                ) : (
                  <span className="topbar-breadcrumb-current">{crumb.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>

          {/* Actions */}
          <div className="topbar-actions">
            <button
              className="topbar-btn icon-only"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
            >
              {theme === 'dark' ? (
                <Sun size={15} strokeWidth={1.75} />
              ) : (
                <Moon size={15} strokeWidth={1.75} />
              )}
            </button>
            <a
              href="/perfil"
              className="topbar-avatar"
              title="Meu perfil"
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              {(currentUser?.name ?? 'U').charAt(0).toUpperCase()}
            </a>
          </div>
        </header>

        {/* Page content */}
        <main className="page-content">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

// Helpers localStorage seguros
function ls(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function lsSave(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}
