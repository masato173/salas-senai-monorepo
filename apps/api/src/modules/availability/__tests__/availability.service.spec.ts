import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ReservationStatus } from '@prisma/client';
import { AvailabilityService } from '../availability.service';

const mockRoomDelegate = { findMany: vi.fn() };
const mockReservationDelegate = { findMany: vi.fn() };
const mockScheduleDelegate = { findMany: vi.fn().mockResolvedValue([]) };
const mockPrisma = {
  room: mockRoomDelegate,
  reservation: mockReservationDelegate,
  schedule: mockScheduleDelegate,
};

function makeService(): AvailabilityService {
  return new AvailabilityService(mockPrisma as never);
}

const ROOMS = [
  { id: 'r1', name: '01 Sala', available: true },
  { id: 'r2', name: '02 Lab. Elétrica', available: true },
];

function makeReservation(overrides: {
  roomId?: string;
  inicio?: string;
  fim?: string;
  status?: ReservationStatus;
  turma?: string | null;
}) {
  return {
    id: 'res-1',
    roomId: overrides.roomId ?? 'r1',
    date: '2026-07-10',
    inicio: overrides.inicio ?? '08:00',
    fim: overrides.fim ?? '10:00',
    // Default APPROVED — só reserva aprovada conta como "ativa" na
    // disponibilidade (fix do bug de PENDING aparecer como ocupada).
    status: overrides.status ?? ReservationStatus.APPROVED,
    turma: overrides.turma ?? null,
    deletedAt: null,
    user: { name: 'Prof. Teste' },
  };
}

function makeSchedule(overrides: { sala?: string; inicio?: string; fim?: string }) {
  return {
    id: 'sch-1',
    date: '2026-07-10',
    sala: overrides.sala ?? '01 Sala',
    turma: 'APB.ADM.148',
    mes: 'Julho',
    turno: null,
    inicio: overrides.inicio ?? '07:00',
    fim: overrides.fim ?? '09:00',
  };
}

describe('AvailabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRoomDelegate.findMany.mockResolvedValue(ROOMS);
    mockReservationDelegate.findMany.mockResolvedValue([]);
    // clearAllMocks() não reseta a implementação (só calls/results) — sem
    // isso, um teste que seta schedule vazaria pro próximo via o mesmo
    // mock. Reset explícito aqui, igual ao padrão já usado pra reservation.
    mockScheduleDelegate.findMany.mockResolvedValue([]);
  });

  describe('getAvailability()', () => {
    it('retorna todas as salas como "livre" quando não há reservas', async () => {
      const result = await makeService().getAvailability({ date: '2026-07-10' });

      expect(result.data).toBe('2026-07-10');
      expect(result.turno).toBeUndefined();
      expect(result.salas).toHaveLength(2);
      expect(result.salas.every(s => s.status === 'livre')).toBe(true);
      expect(result.salas.every(s => s.eventos.length === 0)).toBe(true);
      expect(result.geradoEm).toBeTruthy();
    });

    it('marca sala como "reserva" quando tem reserva ativa', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([makeReservation({ roomId: 'r1' })]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });

      const sala1 = result.salas.find(s => s.sala === '01 Sala')!;
      const sala2 = result.salas.find(s => s.sala === '02 Lab. Elétrica')!;

      expect(sala1.status).toBe('reserva');
      expect(sala1.eventos).toHaveLength(1);
      expect(sala1.eventos[0].tipo).toBe('reserva');
      expect(sala2.status).toBe('livre');
    });

    it('consulta reservas só com status APPROVED — PENDING não deve aparecer na disponibilidade', async () => {
      await makeService().getAvailability({ date: '2026-07-10' });

      expect(mockReservationDelegate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: ReservationStatus.APPROVED }),
        }),
      );
    });

    it('filtro turno=M: reserva 09:00-10:00 aparece (dentro de 07:30-12:00)', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([
        makeReservation({ roomId: 'r1', inicio: '09:00', fim: '10:00' }),
      ]);

      const result = await makeService().getAvailability({
        date: '2026-07-10',
        turno: 'M',
      });

      const sala = result.salas.find(s => s.sala === '01 Sala')!;
      expect(sala.status).toBe('reserva');
      expect(result.turno).toBe('M');
    });

    it('filtro turno=V: reserva 09:00-10:00 NÃO aparece (fora de 13:00-17:30)', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([
        makeReservation({ roomId: 'r1', inicio: '09:00', fim: '10:00' }),
      ]);

      const result = await makeService().getAvailability({
        date: '2026-07-10',
        turno: 'V',
      });

      const sala = result.salas.find(s => s.sala === '01 Sala')!;
      expect(sala.status).toBe('livre');
    });

    it('inclui id no evento de reserva, mas NUNCA o nome do professor (endpoint público)', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([makeReservation({ roomId: 'r1' })]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });
      const evento = result.salas.find(s => s.sala === '01 Sala')!.eventos[0];

      expect(evento.id).toBe('res-1');
      expect(evento).not.toHaveProperty('professor');
      expect(JSON.stringify(result)).not.toContain('Prof. Teste');
    });

    // Issue 5 (fase 2): a resposta de /availability é pública — nenhuma chave
    // de pessoa em nenhum nível do JSON, mesmo com o nome restaurado no
    // Dashboard (que vem de /reservations/day, autenticado).
    it('varredura recursiva: nenhuma chave professor/name/email/user em nenhum nível', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([makeReservation({ roomId: 'r1' })]);
      mockScheduleDelegate.findMany.mockResolvedValue([makeSchedule({})]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });

      const proibidas = new Set(['professor', 'name', 'email', 'user', 'userId', 'notes']);
      const encontradas: string[] = [];
      const visitar = (valor: unknown, caminho: string): void => {
        if (Array.isArray(valor)) {
          valor.forEach((item, i) => visitar(item, `${caminho}[${i}]`));
        } else if (valor !== null && typeof valor === 'object') {
          for (const [chave, filho] of Object.entries(valor)) {
            if (proibidas.has(chave)) encontradas.push(`${caminho}.${chave}`);
            visitar(filho, `${caminho}.${chave}`);
          }
        }
      };
      visitar(result, 'resposta');

      expect(encontradas).toEqual([]);
    });

    it('não busca o usuário da reserva no banco (sem include de user)', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([]);

      await makeService().getAvailability({ date: '2026-07-10' });

      const args = mockReservationDelegate.findMany.mock.calls[0][0] as { include?: unknown };
      expect(args.include).toBeUndefined();
    });

    it('reserva de outra sala não afeta status de sala diferente', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([makeReservation({ roomId: 'r2' })]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });

      expect(result.salas.find(s => s.sala === '01 Sala')!.status).toBe('livre');
      expect(result.salas.find(s => s.sala === '02 Lab. Elétrica')!.status).toBe('reserva');
    });

    it('aula de manhã + reserva de tarde, mesma sala, sem sobreposição → status "aula" (não "conflito")', async () => {
      mockScheduleDelegate.findMany.mockResolvedValue([
        makeSchedule({ sala: '01 Sala', inicio: '07:00', fim: '09:00' }),
      ]);
      mockReservationDelegate.findMany.mockResolvedValue([
        makeReservation({ roomId: 'r1', inicio: '14:00', fim: '16:00' }),
      ]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });

      const sala1 = result.salas.find(s => s.sala === '01 Sala')!;
      expect(sala1.status).toBe('aula');
      expect(sala1.eventos).toHaveLength(2);
    });

    it('aula e reserva com sobreposição real de horário, mesma sala → status "conflito"', async () => {
      mockScheduleDelegate.findMany.mockResolvedValue([
        makeSchedule({ sala: '01 Sala', inicio: '08:00', fim: '10:00' }),
      ]);
      mockReservationDelegate.findMany.mockResolvedValue([
        makeReservation({ roomId: 'r1', inicio: '09:00', fim: '11:00' }),
      ]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });

      const sala1 = result.salas.find(s => s.sala === '01 Sala')!;
      expect(sala1.status).toBe('conflito');
    });

    it('evento de reserva com turma preenchida inclui o campo turma', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([
        makeReservation({ roomId: 'r1', turma: 'DEV-2026' }),
      ]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });
      const evento = result.salas.find(s => s.sala === '01 Sala')!.eventos[0];

      expect(evento.turma).toBe('DEV-2026');
    });

    it('evento de reserva sem turma (null) não inclui o campo turma no objeto', async () => {
      mockReservationDelegate.findMany.mockResolvedValue([
        makeReservation({ roomId: 'r1', turma: null }),
      ]);

      const result = await makeService().getAvailability({ date: '2026-07-10' });
      const evento = result.salas.find(s => s.sala === '01 Sala')!.eventos[0];

      expect(evento.turma).toBeUndefined();
      expect('turma' in evento).toBe(false);
    });
  });

  describe('validateParams()', () => {
    it('lança BadRequestException se date ausente', () => {
      expect(() => AvailabilityService.validateParams(undefined, undefined)).toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException se date em formato inválido', () => {
      expect(() => AvailabilityService.validateParams('10/07/2026', undefined)).toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException se turno inválido', () => {
      expect(() => AvailabilityService.validateParams('2026-07-10', 'X')).toThrow(
        BadRequestException,
      );
    });

    it('aceita date válido sem turno', () => {
      const result = AvailabilityService.validateParams('2026-07-10', undefined);
      expect(result.date).toBe('2026-07-10');
      expect(result.turno).toBeUndefined();
    });

    it('aceita date + turno válidos', () => {
      const result = AvailabilityService.validateParams('2026-07-10', 'M');
      expect(result.turno).toBe('M');
    });
  });
});
