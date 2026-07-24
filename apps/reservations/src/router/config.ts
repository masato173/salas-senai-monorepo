// ─────────────────────────────────────────────────────────────
// Configuração central de rotas
// Fonte única de verdade: labels, ícones, títulos, permissões
// ─────────────────────────────────────────────────────────────

export interface RouteConfig {
  path: string;
  label: string;
  pageTitle: string;
  icon: string; // nome do ícone Lucide
  section: 'principal' | 'gestao' | 'sistema' | 'admin';
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
  {
    path: '/minha-agenda',
    label: 'Minha Agenda',
    pageTitle: 'Minha Agenda · SENAI Salas',
    icon: 'CalendarCheck',
    section: 'principal',
    requiresAuth: true,
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
  // ── Admin ──────────────────────────────────────────────
  {
    path: '/admin',
    label: 'Dashboard Admin',
    pageTitle: 'Dashboard Admin · SENAI Salas',
    icon: 'LayoutDashboard',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/usuarios',
    label: 'Usuários',
    pageTitle: 'Usuários · SENAI Salas',
    icon: 'UserCog',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/permissoes',
    label: 'Permissões',
    pageTitle: 'Permissões · SENAI Salas',
    icon: 'ShieldCheck',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/auditoria',
    label: 'Auditoria',
    pageTitle: 'Auditoria · SENAI Salas',
    icon: 'ScrollText',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/sync',
    label: 'Sincronização',
    pageTitle: 'Sincronização · SENAI Salas',
    icon: 'RefreshCw',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/sistema',
    label: 'Sistema',
    pageTitle: 'Sistema · SENAI Salas',
    icon: 'Server',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/configuracoes',
    label: 'Configurações Admin',
    pageTitle: 'Configurações Admin · SENAI Salas',
    icon: 'SlidersHorizontal',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/logs',
    label: 'Logs',
    pageTitle: 'Logs · SENAI Salas',
    icon: 'ScrollText',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/api',
    label: 'API',
    pageTitle: 'API · SENAI Salas',
    icon: 'Braces',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
  {
    path: '/admin/health',
    label: 'Health',
    pageTitle: 'Health · SENAI Salas',
    icon: 'HeartPulse',
    section: 'admin',
    requiresAuth: true,
    requiredRole: 'ADMIN',
  },
];

// ── Helpers ──────────────────────────────────────────────────

export function getRouteByPath(path: string): RouteConfig | null {
  return ROUTES.find(r => r.path === path) ?? null;
}

// TODO: /admin/* hoje gera breadcrumb "Dashboard > <rota>" igual às demais
// seções. Quando o portal admin ganhar hierarquia própria (F6.3+), avaliar
// um nível intermediário "Admin" entre Dashboard e a rota.
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
  admin: ROUTES.filter(r => r.section === 'admin'),
};
