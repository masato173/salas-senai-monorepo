interface ReservationData {
  roomId: string;
  date: string;
  inicio: string;
  fim: string;
  notes?: string;
}

interface ReservationListItem {
  id: string;
  notes?: string;
}

interface RoomListItem {
  id: string;
  name: string;
}

export class ReservationApi {
  // Cache nome→UUID compartilhado entre instâncias — os specs criam uma
  // ReservationApi nova por teste; sem cache estático seria 1 GET /rooms por teste.
  private static roomIdCache = new Map<string, string>();

  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
  ) {}

  async create(data: ReservationData): Promise<{ id: string }> {
    // F9.1 — o NestJS espera Room.id (UUID) em roomId; os specs passam o nome
    // legível da sala (ex.: '603 Sala'). Resolve antes do POST.
    const roomId = await this.resolveRoomId(data.roomId);
    const res = await fetch(`${this.apiUrl}/reservations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ ...data, roomId }),
    });
    if (!res.ok) throw new Error(`[ReservationApi] create failed: ${res.status}`);
    return res.json() as Promise<{ id: string }>;
  }

  async cancel(id: string): Promise<void> {
    // F9.1 — cancelamento real é DELETE /reservations/:id (soft delete → CANCELLED).
    // PATCH :id/status só aceita APPROVED|REJECTED (UpdateStatusDto) — o PATCH
    // anterior falhava com 400 silencioso e nunca cancelava nada.
    await fetch(`${this.apiUrl}/reservations/${id}`, {
      method: 'DELETE',
      headers: this.headers(),
    });
  }

  async listMine(): Promise<ReservationListItem[]> {
    const res = await fetch(`${this.apiUrl}/reservations?mine=true`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: ReservationListItem[] } | ReservationListItem[];
    // Backend pode retornar { data: [...] } ou array direto — trata os dois casos
    return Array.isArray(json) ? json : (json.data ?? []);
  }

  async sweepE2E(): Promise<void> {
    const all = await this.listMine();
    const e2e = all.filter(r => r.notes?.startsWith('e2e-'));
    await Promise.allSettled(e2e.map(r => this.cancel(r.id)));
  }

  // Resolve nome de sala → UUID via GET /rooms (RoomsController.findAll retorna
  // array cru de Room). Aceita também um UUID já resolvido (passthrough).
  private async resolveRoomId(nameOrId: string): Promise<string> {
    const cached = ReservationApi.roomIdCache.get(nameOrId);
    if (cached !== undefined) return cached;

    const res = await fetch(`${this.apiUrl}/rooms`, { headers: this.headers() });
    if (!res.ok) throw new Error(`[ReservationApi] GET /rooms failed: ${res.status}`);
    const rooms = (await res.json()) as RoomListItem[];

    const room = rooms.find(r => r.name === nameOrId) ?? rooms.find(r => r.id === nameOrId);
    if (room === undefined) {
      throw new Error(
        `[ReservationApi] sala não encontrada em GET /rooms: "${nameOrId}" ` +
          `(${rooms.length} salas retornadas)`,
      );
    }

    ReservationApi.roomIdCache.set(nameOrId, room.id);
    return room.id;
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }
}
