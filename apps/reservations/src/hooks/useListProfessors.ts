import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../services/apiClient';

export interface ProfessorOption {
  id: string;
  name: string;
  email: string;
}

interface UseListProfessorsResult {
  data: ProfessorOption[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// GET /users/professors — COORDENADOR/ADMIN. Lista simples (sem paginação)
// de professores ativos, pra selecionar ao criar reserva em nome de alguém.
// enabled=false (ex: PROFESSOR logado) não dispara fetch.
//
// fetchIdRef evita race condition: descarta resposta de fetch obsoleto —
// mesmo padrão de useAvailabilityBackend.ts/useDashboardStats.ts.
export function useListProfessors(enabled: boolean = true): UseListProfessorsResult {
  const [data, setData] = useState<ProfessorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const doFetch = useCallback((): void => {
    if (!enabled) return;
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    apiFetch<ProfessorOption[]>('/users/professors')
      .then(result => {
        if (id === fetchIdRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (id === fetchIdRef.current) {
          setError(e instanceof Error ? e.message : 'Erro ao buscar professores.');
          setLoading(false);
        }
      });
  }, [enabled]);

  useEffect(() => {
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doFetch encapsula enabled; refetch() é o mecanismo explícito
  }, [enabled]);

  return { data, loading, error, refetch: doFetch };
}
