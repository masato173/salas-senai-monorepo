import { useState, useEffect, useRef, useCallback } from 'react';
import { apiFetch } from '../services/apiClient';
import {
  subscribeToNotificationEvents,
  type NotificationEventPayload,
  type NotificationTypeValue,
} from '../services/socketClient';

// Fase C2 — notificação persistente. Mesmo shape do NotificationEventPayload
// do backend (realtime.service.ts) + userId/reservationId, que o GET
// /notifications retorna mas o evento de WS não precisa carregar de novo.
// Nome AppNotification (não "Notification") — colide com a Web
// Notifications API global do browser, mesma classe de bug do histórico do
// projeto (window.clear() vs método nativo).
export interface AppNotification {
  id: string;
  userId: string;
  reservationId: string | null;
  type: NotificationTypeValue;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

interface UseNotificationsResult {
  data: AppNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

// GET /notifications — JWT (qualquer role autenticada). Mesmo padrão de
// useMyReservations.ts: fetchIdRef evita race condition, {data, loading,
// error, refetch}. markRead/markAllRead atualizam o estado local na hora
// (sensação de resposta imediata), sem esperar o refetch — se o PATCH
// falhar, só loga (não reverte otimisticamente; próximo refetch corrige).
// Subscreve notification.created via WS pra lista/contador atualizarem sem
// reload (mesmo padrão de useRealtimeSocket).
export function useNotifications(): UseNotificationsResult {
  const [data, setData] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const doFetch = useCallback((): void => {
    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);
    apiFetch<AppNotification[]>('/notifications')
      .then(result => {
        if (id === fetchIdRef.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        if (id === fetchIdRef.current) {
          setError(e instanceof Error ? e.message : 'Erro ao buscar notificações.');
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    doFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- doFetch é estável (sem deps externas); refetch() é o mecanismo explícito
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationEvents((payload: NotificationEventPayload) => {
      setData(prev => [
        {
          id: payload.id,
          userId: '', // não incluído no payload de WS — próximo refetch preenche
          reservationId: null,
          type: payload.type,
          title: payload.title,
          body: payload.body,
          read: payload.read,
          createdAt: payload.createdAt,
        },
        ...prev,
      ]);
    });
    return unsubscribe;
  }, []);

  const markRead = useCallback((id: string): void => {
    setData(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }).catch((e: unknown) => {
      console.error('[useNotifications] markRead falhou:', e);
    });
  }, []);

  const markAllRead = useCallback((): void => {
    setData(prev => prev.map(n => ({ ...n, read: true })));
    apiFetch('/notifications/read-all', { method: 'PATCH' }).catch((e: unknown) => {
      console.error('[useNotifications] markAllRead falhou:', e);
    });
  }, []);

  const unreadCount = data.filter(n => !n.read).length;

  return { data, unreadCount, loading, error, refetch: doFetch, markRead, markAllRead };
}
