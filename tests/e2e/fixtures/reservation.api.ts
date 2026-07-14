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

export class ReservationApi {
  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
  ) {}

  async create(data: ReservationData): Promise<{ id: string }> {
    const res = await fetch(`${this.apiUrl}/reservations`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`[ReservationApi] create failed: ${res.status}`);
    return res.json() as Promise<{ id: string }>;
  }

  async cancel(id: string): Promise<void> {
    await fetch(`${this.apiUrl}/reservations/${id}/status`, {
      method: 'PATCH',
      headers: this.headers(),
      body: JSON.stringify({ status: 'CANCELLED' }),
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

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
    };
  }
}
