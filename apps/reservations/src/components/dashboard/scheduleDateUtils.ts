// Sprint A3.5 — helpers de data extraídos do OccupancyDashboard pra serem
// compartilhados entre o pai (Dashboard/index.tsx) e os filhos (Stats + tabela).
// Sem duplicação.
//
// ★ TIMEZONE: toda parse via UTC-noon (Date.UTC(y, m-1, d, 12)) + getUTC*.
// ZERO new Date(string) cru. Manaus é UTC-4 — bug histórico do projeto.

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Date em UTC-noon a partir de YYYY-MM-DD.
export function ymdToUtcDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

// "hoje" em YYYY-MM-DD usando partes LOCAIS (espelha o legado — pill "Hoje"
// é apenas informativa, baseada no calendário do navegador do usuário).
export function todayYmd(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

export function formatDataBR(iso: string): string {
  const dt = ymdToUtcDate(iso);
  return `${pad2(dt.getUTCDate())}/${pad2(dt.getUTCMonth() + 1)}/${dt.getUTCFullYear()}`;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function weekdayShort(iso: string): string {
  return WEEKDAYS[ymdToUtcDate(iso).getUTCDay()];
}
