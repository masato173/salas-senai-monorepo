import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReservationDayApi } from '../services/nestjsApiService';
import { buildProfessorNameMap, shouldFetchNames } from '../components/dashboard/professorNames';

// Issue 5 (fase 2) — nomes dos professores das reservas do dia, só pra
// usuário autenticado, via GET /reservations/day (JWT). Visitante anônimo:
// nenhuma chamada, mapa vazio. Falha do endpoint: mapa vazio, sem erro na
// tela — o Dashboard segue mostrando a ocupação, só sem nome.
// Os nomes vivem só neste estado React: nada de URL, storage ou log.

export interface UseProfessorNamesResult {
  map: ReadonlyMap<string, string>;
  loading: boolean;
  refetch: () => void;
}

const EMPTY: ReadonlyMap<string, string> = new Map();

export function useProfessorNames(
  service: ReservationDayApi,
  date: string,
  accessToken: string | null,
): UseProfessorNamesResult {
  const serviceRef = useRef(service); // evita stale closure
  serviceRef.current = service;
  const [map, setMap] = useState<ReadonlyMap<string, string>>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);
  const enabled = shouldFetchNames(accessToken);

  useEffect(() => {
    // Logout (ou anônimo): descarta os nomes já carregados na hora.
    if (!enabled) {
      setMap(EMPTY);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void serviceRef.current.getDayReservations(date).then(res => {
      if (cancelled) return;
      setMap(res.ok && res.data !== null ? buildProfessorNameMap(res.data) : EMPTY);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date, enabled, version]);

  const refetch = useCallback(() => setVersion(v => v + 1), []);

  return { map, loading, refetch };
}
