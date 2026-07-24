import type { SidebarEntry } from '../calendar/ScheduleSidebar';
import type { DisponibilidadeSala } from '../../types';

// Mapeamento de disponibilidade → entradas do sidebar/calendário (DayView).
// Extraído de Agendamentos/index.tsx — compartilhado com Dashboard (toggle
// Tabela/Linha do tempo), já que os dois consomem a mesma GET /availability.
// Função pura, testável em isolamento sem React.
export function mapToEntries(salas: DisponibilidadeSala[]): SidebarEntry[] {
  const entries: SidebarEntry[] = [];

  for (const sala of salas) {
    if (sala.status === 'livre' || sala.eventos.length === 0) {
      entries.push({
        id: sala.sala,
        sala: sala.sala,
        turma: '',
        turno: null,
        start: '07:00',
        end: '22:00',
        status: 'free',
      });
      continue;
    }

    for (const evento of sala.eventos) {
      const status: SidebarEntry['status'] =
        evento.tipo === 'aula' ? 'busy' : sala.status === 'conflito' ? 'busy' : 'pending';

      entries.push({
        id: `${sala.sala}-${evento.inicio}`,
        sala: sala.sala,
        turma: evento.turma ?? '',
        turno: evento.turno ?? null,
        start: evento.inicio,
        end: evento.fim,
        status,
      });
    }
  }

  return entries.sort((a, b) => a.sala.localeCompare(b.sala));
}
