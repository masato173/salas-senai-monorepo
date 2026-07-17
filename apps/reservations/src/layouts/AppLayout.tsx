import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
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
import { useAuthStore, selectAccessToken, selectUser } from '../store/authStore';
import { getSocket, disconnectSocket } from '../services/socketClient';

const ICON_MAP = {
  LayoutDashboard,
  Calendar,
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
            .concat(userRole === 'ADMIN' ? ['admin'] : [])
            .map(section => (
              <div key={section}>
                <div className="sidebar-section-label">
                  {SECTION_LABELS[section as keyof typeof SECTION_LABELS]}
                </div>
                {ROUTE_SECTIONS[section as keyof typeof ROUTE_SECTIONS].map(route => {
                  const Icon = ICON_MAP[route.icon as IconName];
                  return (
                    <NavLink
                      key={route.path}
                      to={route.path}
                      end={route.path === '/'}
                      data-label={route.label}
                      className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                    >
                      <span className="sidebar-icon" aria-hidden="true">
                        {Icon && <Icon size={16} strokeWidth={1.75} />}
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
