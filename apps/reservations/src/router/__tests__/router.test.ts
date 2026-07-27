import { describe, it, expect } from 'vitest';
import { ROUTES, ROUTE_SECTIONS, getRouteByPath, getBreadcrumbs, hasAccess } from '../config';

describe('ROUTES config', () => {
  it('contém todas as rotas essenciais', () => {
    const paths = ROUTES.map(r => r.path);
    for (const p of [
      '/',
      '/reservas',
      '/aprovacoes',
      '/admin',
      '/admin/usuarios',
      '/admin/auditoria',
    ]) {
      expect(paths, `rota ${p} ausente em ROUTES`).toContain(p);
    }
  });

  it('cada rota tem label, icon, pageTitle e section', () => {
    for (const r of ROUTES) {
      expect(r.label, `${r.path}: falta label`).toBeTruthy();
      expect(r.icon, `${r.path}: falta icon`).toBeTruthy();
      expect(r.pageTitle, `${r.path}: falta pageTitle`).toBeTruthy();
      expect(r.section, `${r.path}: falta section`).toBeTruthy();
    }
  });

  it('pageTitle de cada rota contém "SENAI Salas"', () => {
    for (const r of ROUTES) {
      expect(r.pageTitle).toContain('SENAI Salas');
    }
  });

  it('dashboard não requer auth', () => {
    expect(ROUTES.find(r => r.path === '/')?.requiresAuth).toBeFalsy();
  });

  it('reservas requer auth com role PROFESSOR', () => {
    const r = ROUTES.find(r => r.path === '/reservas');
    expect(r?.requiresAuth).toBe(true);
    expect(r?.requiredRole).toBe('PROFESSOR');
  });

  it('aprovacoes requer role COORDENADOR', () => {
    const r = ROUTES.find(r => r.path === '/aprovacoes');
    expect(r?.requiresAuth).toBe(true);
    expect(r?.requiredRole).toBe('COORDENADOR');
  });

  // Fase B — 4 das 10 rotas admin abrem pra COORDENADOR (hierárquico:
  // COORDENADOR e ADMIN passam), as outras 6 continuam ADMIN-only.
  it('4 rotas admin abrem para COORDENADOR (Dashboard Admin, Usuários, Permissões, Auditoria)', () => {
    const abertas = ['/admin', '/admin/usuarios', '/admin/permissoes', '/admin/auditoria'];
    for (const p of abertas) {
      const r = ROUTES.find(r => r.path === p);
      expect(r?.requiredRole, `${p} deveria requerer COORDENADOR`).toBe('COORDENADOR');
    }
  });

  it('6 rotas admin permanecem ADMIN-only (sync, sistema, configuracoes, logs, api, health)', () => {
    const restritas = [
      '/admin/sync',
      '/admin/sistema',
      '/admin/configuracoes',
      '/admin/logs',
      '/admin/api',
      '/admin/health',
    ];
    for (const p of restritas) {
      const r = ROUTES.find(r => r.path === p);
      expect(r?.requiredRole, `${p} deveria continuar ADMIN-only`).toBe('ADMIN');
    }
  });

  it('seção admin tem exatamente 10 rotas — 4 abertas pra COORDENADOR, 6 ADMIN-only', () => {
    const adminRoutes = ROUTES.filter(r => r.section === 'admin');
    expect(adminRoutes.length).toBe(10);
    expect(adminRoutes.filter(r => r.requiredRole === 'COORDENADOR')).toHaveLength(4);
    expect(adminRoutes.filter(r => r.requiredRole === 'ADMIN')).toHaveLength(6);
  });
});

describe('ROUTE_SECTIONS', () => {
  it('seção principal tem Dashboard e Reservas', () => {
    const paths = ROUTE_SECTIONS.principal.map(r => r.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/reservas');
  });

  it('seção gestao tem Aprovações', () => {
    const paths = ROUTE_SECTIONS.gestao.map(r => r.path);
    expect(paths).toContain('/aprovacoes');
  });

  // Salas, Turmas, Relatórios e Configurações (stub) removidas da navegação —
  // seção sistema fica vazia até uma página real ocupá-la.
  it('seção sistema fica vazia (abas stub removidas da navegação)', () => {
    expect(ROUTE_SECTIONS.sistema).toEqual([]);
  });

  it('todas as rotas estão em alguma seção', () => {
    const inSections = [
      ...ROUTE_SECTIONS.principal,
      ...ROUTE_SECTIONS.gestao,
      ...ROUTE_SECTIONS.sistema,
      ...ROUTE_SECTIONS.admin,
    ].map(r => r.path);
    for (const r of ROUTES) {
      expect(inSections).toContain(r.path);
    }
  });
});

describe('getRouteByPath()', () => {
  it('retorna rota para path existente', () => {
    expect(getRouteByPath('/reservas')?.label).toBe('Reservas');
  });

  it('retorna rota raiz para /', () => {
    expect(getRouteByPath('/')?.label).toBe('Dashboard');
  });

  it('retorna null para path inexistente', () => {
    expect(getRouteByPath('/pagina-que-nao-existe')).toBeNull();
  });
});

describe('getBreadcrumbs()', () => {
  it('/ retorna só [Dashboard]', () => {
    const crumbs = getBreadcrumbs('/');
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0]).toEqual({ label: 'Dashboard', path: '/' });
  });

  it('/reservas retorna [Dashboard, Reservas]', () => {
    const crumbs = getBreadcrumbs('/reservas');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].label).toBe('Dashboard');
    expect(crumbs[1].label).toBe('Reservas');
    expect(crumbs[1].path).toBe('/reservas');
  });

  it('path desconhecido retorna só [Dashboard]', () => {
    expect(getBreadcrumbs('/rota-inexistente')).toHaveLength(1);
  });
});

describe('hasAccess()', () => {
  it('rota pública — acessa sem auth', () => {
    expect(hasAccess('/', false)).toBe(true);
  });

  it('rota protegida — bloqueada sem auth', () => {
    expect(hasAccess('/reservas', false)).toBe(false);
    expect(hasAccess('/aprovacoes', false)).toBe(false);
  });

  it('rota protegida — liberada com auth', () => {
    expect(hasAccess('/reservas', true)).toBe(true);
    expect(hasAccess('/aprovacoes', true)).toBe(true);
  });

  it('path inexistente retorna false', () => {
    expect(hasAccess('/nao-existe', true)).toBe(false);
  });
});
