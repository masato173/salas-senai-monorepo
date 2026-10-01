import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchedulesService, SCHEDULE_MAX_ROWS } from '../schedules.service';

const mockScheduleDelegate = { findMany: vi.fn() };
const mockPrisma = { schedule: mockScheduleDelegate };

function makeService(): SchedulesService {
  return new SchedulesService(mockPrisma as never);
}

const ROW = {
  id: 'sch-1',
  date: '2026-07-10',
  sala: '01 Sala',
  turma: 'APB.ADM.148',
  mes: 'Julho',
  turno: 'M',
  inicio: '07:00',
  fim: '12:30',
};

function findManyArgs(): { skip?: number; take?: number } {
  return mockScheduleDelegate.findMany.mock.calls[0][0] as { skip?: number; take?: number };
}

describe('SchedulesService.getAll — paginação (Issue 5, A3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScheduleDelegate.findMany.mockResolvedValue([ROW]);
  });

  it('pagina com skip/take quando page e pageSize são válidos', async () => {
    await makeService().getAll({ page: 2, pageSize: 10 });
    expect(findManyArgs()).toMatchObject({ skip: 10, take: 10 });
  });

  it('sem parâmetros aplica o teto fixo (nunca devolve a tabela sem limite)', async () => {
    await makeService().getAll();
    const args = findManyArgs();
    expect(args.take).toBe(SCHEDULE_MAX_ROWS);
    expect(args.skip).toBeUndefined();
  });

  it('pageSize acima de 200 é inválido e cai no teto (mesma regra de GET /reservations)', async () => {
    await makeService().getAll({ page: 1, pageSize: 500 });
    expect(findManyArgs().take).toBe(SCHEDULE_MAX_ROWS);
  });

  it('page sem pageSize cai no teto', async () => {
    await makeService().getAll({ page: 3 });
    expect(findManyArgs().take).toBe(SCHEDULE_MAX_ROWS);
  });

  it('mantém o shape { registros, turnoMap }', async () => {
    const result = await makeService().getAll({ page: 1, pageSize: 10 });
    expect(result.registros).toEqual([
      {
        data: '2026-07-10',
        sala: '01 Sala',
        turma: 'APB.ADM.148',
        mes: 'Julho',
        turno: 'M',
        inicio: '07:00',
        fim: '12:30',
      },
    ]);
    expect(result.turnoMap).toEqual({ 'APB.ADM.148': 'M' });
  });
});
