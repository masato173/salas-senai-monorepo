import { describe, it, expect } from 'vitest';
import { ROUTES, ROUTE_SECTIONS, getRouteByPath, getBreadcrumbs, hasAccess } from '../config';

describe('ROUTES config', () => {
  it('contém todas as rotas essenciais', () => {
    const paths = ROUTES.map(r => r.path);
    for (const p of [
      '/',
      '/agendamentos',
      '/reservas',
      '/aprovacoes',
      '/salas',
      '/turmas',
      '/relatorios',
      '/configuracoes',
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

  it('agendamentos não requer auth', () => {
    expect(ROUTES.find(r => r.path === '/agendamentos')?.requiresAuth).toBeFalsy();
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

  it('configuracoes requer role ADMIN', () => {
    expect(ROUTES.find(r => r.path === '/configuracoes')?.requiredRole).toBe('ADMIN');
  });
});

describe('ROUTE_SECTIONS', () => {
  it('seção principal tem Dashboard, Agendamentos e Reservas', () => {
    const paths = ROUTE_SECTIONS.principal.map(r => r.path);
    expect(paths).toContain('/');
    expect(paths).toContain('/agendamentos');
    expect(paths).toContain('/reservas');
  });

  it('seção gestao tem Aprovações, Salas e Turmas', () => {
    const paths = ROUTE_SECTIONS.gestao.map(r => r.path);
    expect(paths).toContain('/aprovacoes');
    expect(paths).toContain('/salas');
    expect(paths).toContain('/turmas');
  });

  it('seção sistema tem Relatorios e Configuracoes', () => {
    const paths = ROUTE_SECTIONS.sistema.map(r => r.path);
    expect(paths).toContain('/relatorios');
    expect(paths).toContain('/configuracoes');
  });

  it('todas as rotas estão em alguma seção', () => {
    const inSections = [
      ...ROUTE_SECTIONS.principal,
      ...ROUTE_SECTIONS.gestao,
      ...ROUTE_SECTIONS.sistema,
    ].map(r => r.path);
    for (const r of ROUTES) {
      expect(inSections).toContain(r.path);
    }
  });
});

describe('getRouteByPath()', () => {
  it('retorna rota para path existente', () => {
    expect(getRouteByPath('/agendamentos')?.label).toBe('Agendamentos');
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

  it('/agendamentos retorna [Dashboard, Agendamentos]', () => {
    const crumbs = getBreadcrumbs('/agendamentos');
    expect(crumbs).toHaveLength(2);
    expect(crumbs[0].label).toBe('Dashboard');
    expect(crumbs[1].label).toBe('Agendamentos');
    expect(crumbs[1].path).toBe('/agendamentos');
  });

  it('path desconhecido retorna só [Dashboard]', () => {
    expect(getBreadcrumbs('/rota-inexistente')).toHaveLength(1);
  });
});

describe('hasAccess()', () => {
  it('rota pública — acessa sem auth', () => {
    expect(hasAccess('/', false)).toBe(true);
    expect(hasAccess('/agendamentos', false)).toBe(true);
  });

  it('rota protegida — bloqueada sem auth', () => {
    expect(hasAccess('/reservas', false)).toBe(false);
    expect(hasAccess('/salas', false)).toBe(false);
    expect(hasAccess('/configuracoes', false)).toBe(false);
  });

  it('rota protegida — liberada com auth', () => {
    expect(hasAccess('/reservas', true)).toBe(true);
    expect(hasAccess('/configuracoes', true)).toBe(true);
  });

  it('path inexistente retorna false', () => {
    expect(hasAccess('/nao-existe', true)).toBe(false);
  });
});
