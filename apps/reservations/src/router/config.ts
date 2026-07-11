// ─────────────────────────────────────────────────────────────
// Configuração central de rotas
// Fonte única de verdade: labels, ícones, títulos, permissões
// ─────────────────────────────────────────────────────────────

export interface RouteConfig {
  path: string;
  label: string;
  pageTitle: string;
  icon: string; // nome do ícone Lucide
  section: 'principal' | 'gestao' | 'sistema';
  requiresAuth: boolean;
  requiredRole?: 'PROFESSOR' | 'COORDENADOR' | 'ADMIN';
  featureFlag?: string; // para feature flags futuras
}

export interface Breadcrumb {
  label: string;
  path: string;
}

export const ROUTES: RouteConfig[] = [
  // ── Principal ───────────────────────────────────────────
  {
    path: '/',
    label: 'Dashboard',
    pageTitle: 'Dashboard · SENAI Salas',
    icon: 'LayoutDashboard',
    section: 'principal',
    requiresAuth: false,
  },
  {
    path: '/agendamentos',
    label: 'Agendamentos',
    pageTitle: 'Agendamentos · SENAI Salas',
    icon: 'Calendar',
    section: 'principal',
    requiresAuth: false,
  },
  {
    path: '/reservas',
    label: 'Reservas',
    pageTitle: 'Reservas · SENAI Salas',
    icon: 'FileText',
    section: 'principal',
    requiresAuth: true,
    requiredRole: 'PROFESSOR',
  },
  // ── Gestão ──────────────────────────────────────────────
  {
    path: '/aprovacoes',
    label: 'Aprovações',
    pageTitle: 'Aprovações · SENAI Salas',
    icon: 'ClipboardCheck',
    section: 'gestao',
    requiresAuth: true,
    requiredRole: 'COORDENADOR',
  },
  {
    path: '/salas',
    label: 'Salas',
    pageTitle: 'Salas · SENAI Salas',
    icon: 'Building2',
    section: 'gestao',
    requiresAuth: true,
    requiredRole: 'COORDENADOR',
  },
  {
    path: '/turmas',
    label: 'Turmas',
    pageTitle: 'Turmas · SENAI Salas',
    icon: 'Users',
    section: 'gestao',
    requiresAuth: true,
    requiredRole: 'COORDENADOR',
  },
  // ── Sistema ─────────────────────────────────────────────
  {
    path: '/relatorios',
    label: 'Relatórios',
    pageTitle: 'Relatórios · SENAI Salas',
    icon: 'BarChart3',
    section: 'sistema',
    requiresAuth: true,
    requiredRole: 'COORDENADOR',
  },
  {
    path: '/configuracoes',
    label: 'Configurações',
    pageTitle: 'Configurações · SENAI Salas',
    icon: 'Settings',
    section: 'sistema',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
];

// ── Helpers ──────────────────────────────────────────────────

export function getRouteByPath(path: string): RouteConfig | null {
  return ROUTES.find(r => r.path === path) ?? null;
}

export function getBreadcrumbs(path: string): Breadcrumb[] {
  if (path === '/') {
    return [{ label: 'Dashboard', path: '/' }];
  }
  const route = getRouteByPath(path);
  return [
    { label: 'Dashboard', path: '/' },
    ...(route ? [{ label: route.label, path: route.path }] : []),
  ];
}

/**
 * Verifica acesso a uma rota.
 * Fase atual: só verifica autenticação.
 * Fase 4: vai verificar role via JWT claims.
 */
export function hasAccess(path: string, isAuthenticated: boolean): boolean {
  const route = getRouteByPath(path);
  if (!route) return false;
  if (!route.requiresAuth) return true;
  return isAuthenticated;
}

export const ROUTE_SECTIONS = {
  principal: ROUTES.filter(r => r.section === 'principal'),
  gestao: ROUTES.filter(r => r.section === 'gestao'),
  sistema: ROUTES.filter(r => r.section === 'sistema'),
};
