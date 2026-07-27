import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../services/apiClient';

export type MyReservationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// Mesmo shape de NestReservation (nestjsApiService.ts) — não exportado de lá
// (interface interna do adapter), redefinido aqui pra não acoplar a esse
// módulo. GET /reservations retorna o registro cru do Prisma via
// reservations.controller.ts findAll(), incluindo room/user via `include`.
export interface MyReservation {
  id: string;
  userId: string;
  roomId: string;
  groupId: string | null;
  date: string;
  inicio: string;
  fim: string;
  status: MyReservationStatus;
  turma: string | null;
  notes: string | null;
  clientRequestId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  room?: { id: string; name: string };
  user?: { id: string; name: string; email: string };
  // Quem de fato criou a reserva — só difere de userId em reserva por
  // proxy (COORDENADOR/ADMIN criando em nome de um professor). Pós-F9.9.
  createdByUserId?: string | null;
  createdBy?: { id: string; name: string } | null;
}

interface UseMyReservationsResult {
  data: MyReservation[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// GET /reservations?mine=true — JWT (qualquer role autenticada). Lista as
// reservas do usuário logado — inclusive as criadas por proxy por um
// COORDENADOR/ADMIN em seu nome (userId gravado é sempre o do professor,
// não de quem criou — ver ReservationsService.resolveOwnerUserId no backend).
//
// fetchIdRef evita race condition: mesmo padrão de useAvailabilityBackend.ts.
export function useMyReservations(): UseMyReservationsResult {
  const [data, setData] = useState<MyReservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const doFetch = useCallback((): void => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    apiFetch<MyReservation[]>('/reservations?mine=true')
      .then(result => {
        if (id === fetchIdRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (id === fetchIdRef.current) {
          setError(e instanceof Error ? e.message : 'Erro ao buscar suas reservas.');
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doFetch é estável (sem deps externas); refetch() é o mecanismo explícito
  }, []);

  return { data, loading, error, refetch: doFetch };
}
