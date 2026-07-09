import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated } from '../store/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'PROFESSOR' | 'COORDENADOR' | 'ADMIN';
}

// Guard de rota — F5.1: autenticação real via useAuthStore (JWT).
// Redirect preserva a rota destino para restaurar após login.
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps): JSX.Element {
  const location = useLocation();
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const userRole = useAuthStore(s => s.user?.role ?? '');

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(userRole, requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Hierarquia de roles: ADMIN > COORDENADOR > PROFESSOR
const ROLE_HIERARCHY: Record<string, number> = {
  PROFESSOR: 1,
  COORDENADOR: 2,
  ADMIN: 3,
};

function hasRole(userRole: string, required: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
}
