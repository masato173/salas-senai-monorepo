import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AdminLayout } from '../layouts/AdminLayout';
import { RouteLoader } from './RouteLoader';
import { ProtectedRoute } from './ProtectedRoute';
const LoginPage = lazy(() => import('../pages/Login'));

// ─────────────────────────────────────────────────────────────
// Lazy loading — cada página carrega só quando visitada
// O Dashboard carrega imediatamente (não é lazy) porque é a
// primeira página que o usuário vê
// ─────────────────────────────────────────────────────────────
import { DashboardPage } from '../pages/Dashboard';

const AgendamentosPage = lazy(() => import('../pages/Agendamentos'));
const ReservasPage = lazy(() => import('../pages/Reservas'));
const AprovacoesPage = lazy(() => import('../pages/Aprovacoes'));
const PerfilPage = lazy(() => import('../pages/Perfil'));
const NotFoundPage = lazy(() => import('../pages/NotFound'));

const AdminDashboardPage = lazy(() => import('../pages/Admin/Dashboard'));
const AdminUsuariosPage = lazy(() => import('../pages/Admin/Usuarios'));
const AdminPermissoesPage = lazy(() => import('../pages/Admin/Permissoes'));
const AdminAuditoriaPage = lazy(() => import('../pages/Admin/Auditoria'));
const AdminSyncPage = lazy(() => import('../pages/Admin/Sync'));
const AdminSistemaPage = lazy(() => import('../pages/Admin/Sistema'));
const AdminConfiguracoesPage = lazy(() => import('../pages/Admin/Configuracoes'));
const AdminLogsPage = lazy(() => import('../pages/Admin/Logs'));
const AdminApiPage = lazy(() => import('../pages/Admin/Api'));
const AdminHealthPage = lazy(() => import('../pages/Admin/Health'));

export const router = createBrowserRouter(
  [
    {
      // Login fora do AppLayout — sem sidebar, sem topbar
      path: '/login',
      element: (
        <Suspense fallback={<RouteLoader />}>
          <LoginPage />
        </Suspense>
      ),
    },
    {
      path: '/',
      element: <AppLayout />,
      children: [
        {
          index: true,
          element: <DashboardPage />,
        },
        {
          path: 'agendamentos',
          element: (
            <Suspense fallback={<RouteLoader />}>
              <AgendamentosPage />
            </Suspense>
          ),
        },
        {
          path: 'reservas',
          element: (
            <ProtectedRoute>
              <Suspense fallback={<RouteLoader />}>
                <ReservasPage />
              </Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: 'aprovacoes',
          element: (
            <ProtectedRoute requiredRole="COORDENADOR">
              <Suspense fallback={<RouteLoader />}>
                <AprovacoesPage />
              </Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: 'admin',
          element: (
            <ProtectedRoute requiredRole="ADMIN">
              <AdminLayout />
            </ProtectedRoute>
          ),
          children: [
            {
              index: true,
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminDashboardPage />
                </Suspense>
              ),
            },
            {
              path: 'usuarios',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminUsuariosPage />
                </Suspense>
              ),
            },
            {
              path: 'permissoes',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminPermissoesPage />
                </Suspense>
              ),
            },
            {
              path: 'auditoria',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminAuditoriaPage />
                </Suspense>
              ),
            },
            {
              path: 'sync',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminSyncPage />
                </Suspense>
              ),
            },
            {
              path: 'sistema',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminSistemaPage />
                </Suspense>
              ),
            },
            {
              path: 'configuracoes',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminConfiguracoesPage />
                </Suspense>
              ),
            },
            {
              path: 'logs',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminLogsPage />
                </Suspense>
              ),
            },
            {
              path: 'api',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminApiPage />
                </Suspense>
              ),
            },
            {
              path: 'health',
              element: (
                <Suspense fallback={<RouteLoader />}>
                  <AdminHealthPage />
                </Suspense>
              ),
            },
          ],
        },
        {
          path: 'perfil',
          element: (
            <ProtectedRoute>
              <Suspense fallback={<RouteLoader />}>
                <PerfilPage />
              </Suspense>
            </ProtectedRoute>
          ),
        },
        {
          path: '*',
          element: (
            <Suspense fallback={<RouteLoader />}>
              <NotFoundPage />
            </Suspense>
          ),
        },
      ],
    },
  ],
  {
    // GitHub Pages serve o app num subcaminho (/salas-senai-monorepo/).
    // BASE_URL vem do `vite build --base=...` no CD; em dev e nos testes é '/',
    // então o comportamento local não muda.
    basename: import.meta.env.BASE_URL,
  },
);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
