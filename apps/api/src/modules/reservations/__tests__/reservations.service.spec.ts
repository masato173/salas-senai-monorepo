import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReservationStatus, NotificationType } from '@prisma/client';
import { ReservationsService } from '../reservations.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTx = {
  $executeRaw: vi.fn().mockResolvedValue(undefined), // advisory lock
  room: { findUnique: vi.fn() },
  reservation: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
};

const mockPrisma = {
  room: { findUnique: vi.fn() },
  reservation: { findMany: vi.fn(), findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi
    .fn()
    .mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockConflictService = { hasConflict: vi.fn() };
const mockOwnershipService = { assertCanModify: vi.fn() };
const mockAuditService = { log: vi.fn() };
const mockRealtimeService = {
  reservationCreated: vi.fn(),
  reservationUpdated: vi.fn(),
  reservationCancelled: vi.fn(),
  reservationApproved: vi.fn(),
  reservationRejected: vi.fn(),
};
const mockNotificationsService = { notify: vi.fn(), notifyMany: vi.fn() };

function makeService(): ReservationsService {
  return new ReservationsService(
    mockPrisma as never,
    mockConflictService as never,
    mockOwnershipService as never,
    mockAuditService as never,
    mockRealtimeService as never,
    mockNotificationsService as never,
  );
}

const adminUser = { userId: 'admin-1', email: 'admin@senai.edu', role: 'ADMIN' };
const profUser = { userId: 'prof-1', email: 'prof@senai.edu', role: 'PROFESSOR' };
const coordUser = { userId: 'coord-1', email: 'coord@senai.edu', role: 'COORDENADOR' };

const baseReservation = {
  id: 'res-1',
  userId: 'prof-1',
  roomId: 'room-1',
  date: '2026-07-10',
  inicio: '08:00',
  fim: '10:00',
  status: ReservationStatus.PENDING,
  notes: null,
  deletedAt: null,
  groupId: null,
  clientRequestId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReservationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuditService.log.mockResolvedValue(undefined);
    mockNotificationsService.notify.mockResolvedValue(undefined);
    mockNotificationsService.notifyMany.mockResolvedValue(undefined);
    // Default: nenhum aprovador ativo — notifyPendingApprovers faz early
    // return sem tocar room/user.findUnique. Testes que verificam a
    // notificação de fato sobrescrevem isso.
    mockPrisma.user.findMany.mockResolvedValue([]);
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create()', () => {
    const dto = { roomId: 'room-1', date: '2026-07-10', inicio: '08:00', fim: '10:00' };

    beforeEach(() => {
      mockTx.room.findUnique.mockResolvedValue({ id: 'room-1', name: '01 Sala', available: true });
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockTx.reservation.create.mockResolvedValue(baseReservation);
    });

    it('cria reserva com sucesso e retorna a reserva criada', async () => {
      const result = await makeService().create(dto, profUser);
      expect(result).toEqual(baseReservation);
      expect(mockTx.$executeRaw).toHaveBeenCalled(); // advisory lock executado
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'CREATE_RESERVATION', userId: profUser.userId }),
      );
    });

    it('lança ConflictException quando há conflito de horário', async () => {
      mockConflictService.hasConflict.mockResolvedValue(true);
      await expect(makeService().create(dto, profUser)).rejects.toThrow(ConflictException);
    });

    it('lança NotFoundException quando sala não existe', async () => {
      mockTx.room.findUnique.mockResolvedValue(null);
      await expect(makeService().create(dto, profUser)).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando sala está desativada', async () => {
      mockTx.room.findUnique.mockResolvedValue({ id: 'room-1', name: '01 Sala', available: false });
      await expect(makeService().create(dto, profUser)).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando inicio >= fim', async () => {
      await expect(
        makeService().create({ ...dto, inicio: '10:00', fim: '08:00' }, profUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando inicio antes de 06:00', async () => {
      await expect(makeService().create({ ...dto, inicio: '05:00' }, profUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lança BadRequestException quando fim após 23:00', async () => {
      await expect(makeService().create({ ...dto, fim: '23:30' }, profUser)).rejects.toThrow(
        BadRequestException,
      );
    });

    // ── Auto-aprovação ─────────────────────────────────────────────────
    it('PROFESSOR cria reserva com status PENDING', async () => {
      await makeService().create(dto, profUser);
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReservationStatus.PENDING }),
        }),
      );
    });

    it('COORDENADOR cria reserva já com status APPROVED (auto-aprovação)', async () => {
      await makeService().create(dto, coordUser);
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReservationStatus.APPROVED }),
        }),
      );
    });

    it('ADMIN cria reserva já com status APPROVED (auto-aprovação)', async () => {
      await makeService().create(dto, adminUser);
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReservationStatus.APPROVED }),
        }),
      );
    });

    // ── Proxy ownerUserId ──────────────────────────────────────────────
    it('PROFESSOR ignora ownerUserId — reserva sempre gravada no próprio userId', async () => {
      await makeService().create({ ...dto, ownerUserId: 'outro-user' }, profUser);
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: profUser.userId }) }),
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('COORDENADOR sem ownerUserId cria a reserva pra si mesmo', async () => {
      await makeService().create(dto, coordUser);
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: coordUser.userId }) }),
      );
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('COORDENADOR com ownerUserId válido cria a reserva em nome do professor informado', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-2', active: true });

      await makeService().create({ ...dto, ownerUserId: 'prof-2' }, coordUser);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'prof-2' } });
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: 'prof-2' }) }),
      );
    });

    it('lança NotFoundException quando ownerUserId não existe', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        makeService().create({ ...dto, ownerUserId: 'fantasma' }, coordUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando ownerUserId existe mas está inativo', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-3', active: false });
      await expect(
        makeService().create({ ...dto, ownerUserId: 'prof-3' }, coordUser),
      ).rejects.toThrow(NotFoundException);
    });

    // ── createdByUserId (Fase C1) ──────────────────────────────────────
    it('grava createdByUserId com o userId de quem criou', async () => {
      await makeService().create(dto, profUser);
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdByUserId: profUser.userId }),
        }),
      );
    });

    it('proxy: COORDENADOR cria em nome de professor — userId é do professor, createdByUserId é do coordenador (diferentes)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-2', active: true });

      await makeService().create({ ...dto, ownerUserId: 'prof-2' }, coordUser);

      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'prof-2',
            createdByUserId: coordUser.userId,
          }),
        }),
      );
    });

    // ── Notificação — evento 1 (Fase C2) ────────────────────────────────
    it('PROFESSOR cria reserva PENDING — notifica todos os COORDENADOR/ADMIN ativos', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'coord-1' }, { id: 'admin-1' }]);
      mockPrisma.room.findUnique.mockResolvedValue({ id: 'room-1', name: '01 Sala' });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-1', name: 'Prof. Silva' });

      await makeService().create(dto, profUser);

      expect(mockNotificationsService.notifyMany).toHaveBeenCalledWith(
        ['coord-1', 'admin-1'],
        expect.objectContaining({ type: NotificationType.RESERVATION_PENDING }),
      );
    });

    it('COORDENADOR cria reserva já APPROVED — não dispara notificação de pendência', async () => {
      await makeService().create(dto, coordUser);
      expect(mockNotificationsService.notifyMany).not.toHaveBeenCalled();
    });

    it('nenhum aprovador ativo — não chama notifyMany (early return)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      await makeService().create(dto, profUser);
      expect(mockNotificationsService.notifyMany).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────
  describe('update()', () => {
    beforeEach(() => {
      mockOwnershipService.assertCanModify.mockResolvedValue(baseReservation);
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockTx.reservation.update.mockResolvedValue({ ...baseReservation, fim: '11:00' });
    });

    it('atualiza reserva com sucesso e registra audit log', async () => {
      const result = await makeService().update('res-1', { fim: '11:00' }, adminUser);
      expect(result.fim).toBe('11:00');
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'UPDATE_RESERVATION' }),
      );
    });

    it('lança ConflictException quando novo horário conflita', async () => {
      mockConflictService.hasConflict.mockResolvedValue(true);
      await expect(makeService().update('res-1', { inicio: '09:00' }, adminUser)).rejects.toThrow(
        ConflictException,
      );
    });

    it('lança ForbiddenException para usuário sem permissão', async () => {
      mockOwnershipService.assertCanModify.mockRejectedValue(
        new ForbiddenException('Sem permissão.'),
      );
      await expect(makeService().update('res-1', { fim: '11:00' }, profUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    // ── Notificação — evento 5 (Fase C2) ────────────────────────────────
    // baseReservation.userId === 'prof-1' === profUser.userId
    it('notifica quando OUTRA pessoa reprograma a reserva (currentUser !== dono)', async () => {
      await makeService().update('res-1', { fim: '11:00' }, adminUser);
      expect(mockNotificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'prof-1',
          type: NotificationType.RESERVATION_RESCHEDULED,
        }),
      );
    });

    it('NÃO notifica quando o próprio dono edita a própria reserva', async () => {
      await makeService().update('res-1', { fim: '11:00' }, profUser);
      expect(mockNotificationsService.notify).not.toHaveBeenCalled();
    });

    it('NÃO notifica quando só notes/turma mudam (não é reprogramação de data/horário/sala)', async () => {
      await makeService().update('res-1', { notes: 'nova nota' }, adminUser);
      expect(mockNotificationsService.notify).not.toHaveBeenCalled();
    });
  });

  // ── cancel ────────────────────────────────────────────────────────────────
  describe('cancel()', () => {
    beforeEach(() => {
      mockOwnershipService.assertCanModify.mockResolvedValue(baseReservation);
      // reset: quickLookup retorna PENDING por padrão — idempotência sobreescreve para CANCELLED
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation);
      mockTx.reservation.update.mockResolvedValue({
        ...baseReservation,
        status: ReservationStatus.CANCELLED,
        deletedAt: new Date(),
      });
    });

    it('cancela reserva com sucesso', async () => {
      const result = await makeService().cancel('res-1', adminUser);
      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'DELETE_RESERVATION' }),
      );
    });

    it('retorna reserva já cancelada sem erro (idempotência)', async () => {
      const cancelled = { ...baseReservation, status: ReservationStatus.CANCELLED };
      mockOwnershipService.assertCanModify.mockResolvedValue(cancelled);
      // quickLookup (findUnique direto) roda ANTES de assertCanModify no cancel()
      mockPrisma.reservation.findUnique.mockResolvedValue(cancelled);
      const result = await makeService().cancel('res-1', adminUser);
      expect(result.status).toBe(ReservationStatus.CANCELLED);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled(); // não abre tx desnecessária
    });

    it('lança ForbiddenException para usuário sem permissão', async () => {
      mockOwnershipService.assertCanModify.mockRejectedValue(
        new ForbiddenException('Sem permissão.'),
      );
      await expect(makeService().cancel('res-1', profUser)).rejects.toThrow(ForbiddenException);
    });

    // ── Notificação — evento 4 (Fase C2) ────────────────────────────────
    // baseReservation.userId === 'prof-1' === profUser.userId
    it('notifica quando OUTRA pessoa cancela (ex: COORDENADOR/ADMIN cancelando em nome do professor)', async () => {
      await makeService().cancel('res-1', adminUser);
      expect(mockNotificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'prof-1', type: NotificationType.RESERVATION_CANCELLED }),
      );
    });

    it('NÃO notifica quando o próprio dono cancela a própria reserva', async () => {
      await makeService().cancel('res-1', profUser);
      expect(mockNotificationsService.notify).not.toHaveBeenCalled();
    });
  });

  // ── updateStatus — notificação, eventos 2 e 3 (Fase C2) ────────────────────
  // Não havia describe() pra updateStatus() antes desta missão — cobre só o
  // disparo de notificação (escopo desta tarefa), não a suite completa do
  // método.
  describe('updateStatus() — notificação de confirmação/rejeição (Fase C2)', () => {
    beforeEach(() => {
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation); // userId: 'prof-1'
      mockTx.reservation.update.mockResolvedValue(baseReservation);
    });

    it('APPROVED — notifica o dono da reserva com RESERVATION_CONFIRMED', async () => {
      mockTx.reservation.update.mockResolvedValue({
        ...baseReservation,
        status: ReservationStatus.APPROVED,
      });

      await makeService().updateStatus('res-1', ReservationStatus.APPROVED, adminUser);

      expect(mockNotificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'prof-1',
          type: NotificationType.RESERVATION_CONFIRMED,
        }),
      );
    });

    it('REJECTED — notifica o dono da reserva com RESERVATION_REJECTED', async () => {
      mockTx.reservation.update.mockResolvedValue({
        ...baseReservation,
        status: ReservationStatus.REJECTED,
      });

      await makeService().updateStatus('res-1', ReservationStatus.REJECTED, adminUser);

      expect(mockNotificationsService.notify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'prof-1',
          type: NotificationType.RESERVATION_REJECTED,
        }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────
  describe('findAll()', () => {
    beforeEach(() => {
      mockPrisma.reservation.findMany.mockResolvedValue([baseReservation]);
    });

    it('PROFESSOR vê apenas suas próprias reservas', async () => {
      await makeService().findAll({ currentUser: profUser });
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { userId?: string };
      };
      expect(calledWith.where.userId).toBe(profUser.userId);
    });

    it('ADMIN vê todas as reservas sem filtro de userId', async () => {
      await makeService().findAll({ currentUser: adminUser });
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { userId?: string };
      };
      expect(calledWith.where.userId).toBeUndefined();
    });

    it('mine=true filtra por userId mesmo para ADMIN', async () => {
      await makeService().findAll({ currentUser: adminUser, mine: true });
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { userId?: string };
      };
      expect(calledWith.where.userId).toBe(adminUser.userId);
    });
  });

  // ── createRange ───────────────────────────────────────────────────────────
  describe('createRange()', () => {
    const rangeDto = {
      roomId: 'room-1',
      dateInicio: '2026-08-03',
      dateFim: '2026-08-05',
      diasSemana: [0, 1, 2, 3, 4, 5, 6], // todos os dias — não depende do dia da semana real
      inicio: '08:00',
      fim: '10:00',
    };

    beforeEach(() => {
      mockPrisma.room.findUnique.mockResolvedValue({
        id: rangeDto.roomId,
        name: 'Sala Teste',
        available: true,
      });
      mockTx.reservation.create.mockImplementation(
        (args: { data: { date: string; [key: string]: unknown } }) =>
          Promise.resolve({ ...baseReservation, ...args.data, id: `res-${args.data.date}` }),
      );
    });

    it('pula data com conflito e cria as demais', async () => {
      mockConflictService.hasConflict.mockImplementation((params: { date: string }) =>
        Promise.resolve(params.date === '2026-08-04'),
      );

      const result = await makeService().createRange(rangeDto, profUser);

      expect(result.count).toBe(2);
      expect(result.reservations.map(r => r.date)).toEqual(['2026-08-03', '2026-08-05']);
      expect(mockTx.reservation.create).toHaveBeenCalledTimes(2);
      expect(mockRealtimeService.reservationCreated).toHaveBeenCalledTimes(2);
      // lock é tentado nas 3 datas, mesmo na que acaba pulada por conflito
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(3);
    });

    it('todas as datas com conflito: retorna count=0 e reservations=[]', async () => {
      mockConflictService.hasConflict.mockResolvedValue(true);

      const result = await makeService().createRange(rangeDto, profUser);

      expect(result).toEqual({ count: 0, reservations: [] });
      expect(mockTx.reservation.create).not.toHaveBeenCalled();
      expect(mockRealtimeService.reservationCreated).not.toHaveBeenCalled();
    });

    it('nenhuma data com conflito: cria todas as datas do range', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);

      const result = await makeService().createRange(rangeDto, profUser);

      expect(result.count).toBe(3);
      expect(result.reservations.map(r => r.date)).toEqual([
        '2026-08-03',
        '2026-08-04',
        '2026-08-05',
      ]);
      expect(mockTx.$executeRaw).toHaveBeenCalledTimes(3);
      expect(mockAuditService.log).toHaveBeenCalledTimes(3);
      expect(mockAuditService.log).toHaveBeenCalledWith(
        mockTx,
        expect.objectContaining({ action: 'CREATE_RESERVATION' }),
      );
    });

    it('PROFESSOR: todas as ocorrências do range saem com status PENDING', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);

      await makeService().createRange(rangeDto, profUser);

      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: ReservationStatus.PENDING }),
        }),
      );
    });

    it('COORDENADOR com ownerUserId: range inteiro sai APPROVED e gravado no professor informado', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-2', active: true });

      await makeService().createRange({ ...rangeDto, ownerUserId: 'prof-2' }, coordUser);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 'prof-2' } });
      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'prof-2',
            status: ReservationStatus.APPROVED,
          }),
        }),
      );
      // valida ownerUserId 1x antes do loop, não 1x por data
      expect(mockPrisma.user.findUnique).toHaveBeenCalledTimes(1);
    });

    // ── Notificação — evento 1 agregado (Fase C2) ───────────────────────
    it('PROFESSOR: range inteiro PENDING dispara UMA notificação agregada (não uma por data)', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'coord-1' }]);
      // NÃO sobrescrever mockPrisma.room.findUnique aqui — o beforeEach de
      // createRange() já mockou { available: true }, necessário pra
      // validação inicial da sala não lançar BadRequestException antes de
      // chegar no código de notificação (mesmo mock serve as duas chamadas).
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-1', name: 'Prof. Silva' });

      await makeService().createRange(rangeDto, profUser);

      expect(mockNotificationsService.notifyMany).toHaveBeenCalledTimes(1);
      expect(mockNotificationsService.notifyMany).toHaveBeenCalledWith(
        ['coord-1'],
        expect.objectContaining({ type: NotificationType.RESERVATION_PENDING }),
      );
    });

    it('COORDENADOR com ownerUserId: range sai APPROVED — não dispara notificação de pendência', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-2', active: true });

      await makeService().createRange({ ...rangeDto, ownerUserId: 'prof-2' }, coordUser);

      expect(mockNotificationsService.notifyMany).not.toHaveBeenCalled();
    });

    // ── createdByUserId (Fase C1) ──────────────────────────────────────
    it('grava createdByUserId em todas as ocorrências do range', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);

      await makeService().createRange(rangeDto, profUser);

      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdByUserId: profUser.userId }),
        }),
      );
    });

    it('proxy no range: userId é do professor, createdByUserId é do coordenador (diferentes)', async () => {
      mockConflictService.hasConflict.mockResolvedValue(false);
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'prof-2', active: true });

      await makeService().createRange({ ...rangeDto, ownerUserId: 'prof-2' }, coordUser);

      expect(mockTx.reservation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'prof-2',
            createdByUserId: coordUser.userId,
          }),
        }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────
  describe('findOne()', () => {
    it('lança NotFoundException quando reserva não existe', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(null);
      await expect(makeService().findOne('nao-existe')).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando reserva está soft-deleted', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...baseReservation,
        deletedAt: new Date(),
      });
      await expect(makeService().findOne('res-1')).rejects.toThrow(NotFoundException);
    });
  });
});
