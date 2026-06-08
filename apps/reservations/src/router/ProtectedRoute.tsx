import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children:     React.ReactNode;
  requiredRole?: 'PROFESSOR' | 'COORDENADOR' | 'ADMIN';
}

/**
 * Guard de rota — protege páginas que precisam de auth.
 *
 * Fase atual: isAuthenticated é sempre true (sem auth ainda).
 * Fase 2+: ler do useAuthStore (Zustand) ou contexto JWT.
 *
 * Quando auth for implementado, só mudar o valor de
 * `isAuthenticated` aqui — o resto do sistema não muda.
 */
export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const location = useLocation();

  // TODO Fase 2: substituir por useAuthStore()
  const isAuthenticated = true;
  const userRole = 'ADMIN'; // TODO: vir do JWT

  if (!isAuthenticated) {
    // Preserva a rota destino para redirect após login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !hasRole(userRole, requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

// Hierarquia de roles: ADMIN > COORDENADOR > PROFESSOR
const ROLE_HIERARCHY: Record<string, number> = {
  PROFESSOR:   1,
  COORDENADOR: 2,
  ADMIN:       3,
};

function hasRole(userRole: string, required: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
}
