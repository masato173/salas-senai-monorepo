// Espelha 1:1 o expandDateRange do backend (apps/reservations/backend/codigo.gs.new).
//
// Convenção de dias da semana: 0=domingo, 1=segunda, ..., 6=sábado (padrão JS).
// Construção em meio-dia UTC para que getUTCDay() bata com o dia local em Manaus
// (UTC-4: meio-dia UTC = 08:00 Manaus, mesmo dia, sem drift de DST).
//
// Limite: `> 60` (idêntico ao backend) — pode devolver até 61 datas como sinal
// de estouro; o caller (validação do form) deve rejeitar quando length > 60.
export function expandDateRange(
  dataInicio: string,   // YYYY-MM-DD
  dataFim:    string,   // YYYY-MM-DD
  diasSemana: number[], // valores em 0..6
): string[] {
  const datas: string[] = [];
  const seen = new Set<string>();

  const [y1, m1, d1] = dataInicio.split('-').map(Number);
  const [y2, m2, d2] = dataFim.split('-').map(Number);
  const start = Date.UTC(y1, m1 - 1, d1, 12);
  const end   = Date.UTC(y2, m2 - 1, d2, 12);

  for (let ms = start; ms <= end; ms += 86400000) {
    const d = new Date(ms);
    if (!diasSemana.includes(d.getUTCDay())) continue;
    const iso = formatUTCDate(d);
    if (!seen.has(iso)) {
      seen.add(iso);
      datas.push(iso);
    }
    if (datas.length > 60) break;
  }
  return datas;
}

function formatUTCDate(d: Date): string {
  const y  = d.getUTCFullYear();
  const m  = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
