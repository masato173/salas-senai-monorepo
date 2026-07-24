interface ReservationData {
  roomId: string;
  date: string;
  inicio: string;
  fim: string;
  notes?: string;
  ownerUserId?: string;
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

  // GET /reservations/:id — ReservationsService.findOne retorna o registro
  // cru do Prisma (status/userId no nível raiz), sem envelope.
  async getById(id: string): Promise<{ id: string; status: string; userId: string }> {
    const res = await fetch(`${this.apiUrl}/reservations/${id}`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`[ReservationApi] getById failed: ${res.status}`);
    return res.json() as Promise<{ id: string; status: string; userId: string }>;
  }

  // GET /users/professors — COORDENADOR|ADMIN. UsersService.listProfessors
  // retorna UserPublicDto[] ({ id, name, email, role, active, createdAt });
  // tipagem aqui é um subconjunto proposital, só os campos usados nos specs.
  async listProfessors(): Promise<{ id: string; name: string; email: string }[]> {
    const res = await fetch(`${this.apiUrl}/users/professors`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`[ReservationApi] listProfessors failed: ${res.status}`);
    return res.json() as Promise<{ id: string; name: string; email: string }[]>;
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
