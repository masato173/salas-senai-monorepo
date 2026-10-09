import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ReservationStatus, NotificationType } from '@prisma/client';
import { ReservationsService, sortedLockKeys } from '../reservations.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockTx = {
  $executeRaw: vi.fn().mockResolvedValue(undefined), // advisory lock
  room: { findUnique: vi.fn() },
  reservation: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
};

const mockPrisma = {
  room: { findUnique: vi.fn() },
  reservation: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi
    .fn()
    .mockImplementation((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
};

const mockConflictService = { hasConflict: vi.fn() };
const mockOwnershipService = { assertCanModify: vi.fn(), assertOwnerOrPrivileged: vi.fn() };
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

    // ── COORDENADOR também pode modificar reserva de terceiro (Issue 3, C4) ──
    // baseReservation.userId === 'prof-1' !== coordUser.userId — não é o dono.
    it('COORDENADOR consegue atualizar reserva de outro usuário (não dono)', async () => {
      const result = await makeService().update('res-1', { fim: '11:00' }, coordUser);
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

    // ── COORDENADOR também pode modificar reserva de terceiro (Issue 3, C4) ──
    // baseReservation.userId === 'prof-1' !== coordUser.userId — não é o dono.
    it('COORDENADOR consegue cancelar reserva de outro usuário (não dono)', async () => {
      const result = await makeService().cancel('res-1', coordUser);
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

    // ── Ownership no atalho de idempotência (Issue 3, C2) ───────────────
    it('lança ForbiddenException ao cancelar reserva JÁ CANCELADA de outro usuário', async () => {
      const cancelledDeOutroUser = {
        ...baseReservation,
        userId: 'prof-2',
        status: ReservationStatus.CANCELLED,
      };
      // quickLookup (findUnique direto) roda ANTES de assertCanModify no cancel()
      mockPrisma.reservation.findUnique.mockResolvedValue(cancelledDeOutroUser);
      mockOwnershipService.assertOwnerOrPrivileged.mockImplementation(() => {
        throw new ForbiddenException('Você não tem permissão para modificar esta reserva.');
      });

      await expect(makeService().cancel('res-1', profUser)).rejects.toThrow(ForbiddenException);
      // Nenhum efeito colateral — não abre transação, não vaza o objeto
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
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

  // ── Edição em lote (updateGroup / updateSelected) — #22 ───────────────────
  // Lote inteiro numa $transaction: locks (sala, data) de TODAS as chaves em
  // ordem crescente → releitura → validação por item → gravação → verificação
  // de conflito dos itens que bloqueiam (PENDING/APPROVED) já na posição nova,
  // excluindo a própria reserva → AuditLog por item. Tudo-ou-nada.
  describe('sortedLockKeys()', () => {
    it('ordena por sala e depois por data, sem duplicata', () => {
      expect(
        sortedLockKeys([
          { roomId: 'room-3', date: '2026-07-17' },
          { roomId: 'room-1', date: '2026-07-17' },
          { roomId: 'room-3', date: '2026-07-10' },
          { roomId: 'room-1', date: '2026-07-17' },
          { roomId: 'room-1', date: '2026-07-10' },
        ]),
      ).toEqual([
        { roomId: 'room-1', date: '2026-07-10' },
        { roomId: 'room-1', date: '2026-07-17' },
        { roomId: 'room-3', date: '2026-07-10' },
        { roomId: 'room-3', date: '2026-07-17' },
      ]);
    });

    it('lista vazia → vazia', () => {
      expect(sortedLockKeys([])).toEqual([]);
    });
  });

  describe('edição em lote (#22)', () => {
    const D1 = '2026-07-10';
    const D2 = '2026-07-17';
    const itemA = {
      ...baseReservation,
      id: 'res-a',
      userId: 'prof-1',
      groupId: 'grp-1',
      roomId: 'room-2',
      date: D2,
      status: ReservationStatus.APPROVED,
      turma: null as string | null,
    };
    const itemB = {
      ...baseReservation,
      id: 'res-b',
      userId: 'prof-2',
      groupId: 'grp-1',
      roomId: 'room-1',
      date: D1,
      status: ReservationStatus.APPROVED,
      turma: null as string | null,
    };

    type Item = typeof itemA;

    // findMany do lote: 1ª = pré-leitura, 2ª = releitura após os locks,
    // 3ª = estado gravado (depois do updateMany).
    function mockLot(items: Item[], fields: Partial<Item>, reread: Item[] = items): Item[] {
      const after = reread.map(r => ({ ...r, ...fields }));
      mockTx.reservation.findMany
        .mockResolvedValueOnce(items)
        .mockResolvedValueOnce(reread)
        .mockResolvedValueOnce(after);
      return after;
    }

    function lockCalls(): [string, string][] {
      return (mockTx.$executeRaw.mock.calls as unknown[][]).map(
        c => [c[1], c[2]] as [string, string],
      );
    }

    function firstOrder(fn: { mock: { invocationCallOrder: number[] } }): number {
      return Math.min(...fn.mock.invocationCallOrder);
    }

    beforeEach(() => {
      mockTx.reservation.findMany.mockReset();
      mockTx.reservation.updateMany.mockReset().mockResolvedValue({ count: 2 });
      mockOwnershipService.assertOwnerOrPrivileged.mockReset();
      mockConflictService.hasConflict.mockReset().mockResolvedValue(false);
    });

    describe('updateGroup()', () => {
      it('roda numa $transaction com timeout de lote (20 s) e maxWait (5 s)', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });
        await makeService().updateGroup({ groupId: 'grp-1', fim: '11:00' }, coordUser);
        expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
          maxWait: 5_000,
          timeout: 20_000,
        });
      });

      it('locks de TODAS as chaves (salas antigas e novas), em ordem crescente, sem duplicata, antes de qualquer checagem', async () => {
        mockLot([itemA, itemB], { roomId: 'room-3', fim: '11:00' });

        await makeService().updateGroup(
          { groupId: 'grp-1', roomId: 'room-3', fim: '11:00' },
          coordUser,
        );

        expect(lockCalls()).toEqual([
          ['room-1', D1],
          ['room-2', D2],
          ['room-3', D1],
          ['room-3', D2],
        ]);
        const lastLock = Math.max(...mockTx.$executeRaw.mock.invocationCallOrder);
        expect(lastLock).toBeLessThan(firstOrder(mockConflictService.hasConflict));
        expect(lastLock).toBeLessThan(firstOrder(mockTx.reservation.updateMany));
      });

      it('verifica conflito DEPOIS de gravar, no client da transação, excluindo a própria reserva', async () => {
        const after = mockLot([itemA, itemB], { fim: '11:00' });

        await makeService().updateGroup({ groupId: 'grp-1', fim: '11:00' }, coordUser);

        expect(firstOrder(mockTx.reservation.updateMany)).toBeLessThan(
          firstOrder(mockConflictService.hasConflict),
        );
        for (const r of after) {
          expect(mockConflictService.hasConflict).toHaveBeenCalledWith(
            { roomId: r.roomId, date: r.date, inicio: r.inicio, fim: r.fim, excludeId: r.id },
            mockTx,
          );
        }
      });

      it('grava o lote numa única updateMany com os campos informados (spread condicional)', async () => {
        mockLot([itemA, itemB], { roomId: 'room-3', fim: '11:00' });

        await makeService().updateGroup(
          { groupId: 'grp-1', roomId: 'room-3', fim: '11:00' },
          coordUser,
        );

        expect(mockTx.reservation.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['res-a', 'res-b'] } },
          data: { roomId: 'room-3', fim: '11:00' },
        });
      });

      it('conflito com reserva fora do lote → 409 com as datas do lote, sem audit nem retorno parcial', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });
        mockConflictService.hasConflict.mockImplementation((p: { excludeId: string }) =>
          Promise.resolve(p.excludeId === 'res-b'),
        );

        const err = await makeService()
          .updateGroup({ groupId: 'grp-1', fim: '11:00' }, coordUser)
          .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(ConflictException);
        const msg = (err as ConflictException).message;
        expect(msg).toContain('10/07/2026');
        expect(msg).not.toContain('17/07/2026');
        expect(msg).toContain('Nenhuma alteração foi salva');
        expect(mockAuditService.log).not.toHaveBeenCalled();
      });

      it('409 não expõe dados da reserva conflitante (id, dono, sala, e-mail)', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });
        mockConflictService.hasConflict.mockResolvedValue(true);

        const err = (await makeService()
          .updateGroup({ groupId: 'grp-1', fim: '11:00' }, coordUser)
          .catch((e: unknown) => e)) as ConflictException;

        expect(err.message).not.toMatch(/res-|prof-|room-|@/);
      });

      it('dois itens do próprio lote que passam a se sobrepor → 409', async () => {
        // Mesma data; o lote move os dois para a mesma sala/horário. Dentro
        // da tx os dois já estão na posição nova: cada um enxerga o outro.
        const a = { ...itemA, date: D1 };
        mockLot([a, itemB], { roomId: 'room-3', inicio: '08:00', fim: '10:00' });
        mockConflictService.hasConflict.mockResolvedValue(true);

        await expect(
          makeService().updateGroup(
            { groupId: 'grp-1', roomId: 'room-3', inicio: '08:00', fim: '10:00' },
            coordUser,
          ),
        ).rejects.toThrow(ConflictException);
      });

      it('item REJECTED (não bloqueia) movido para horário ocupado → sem 409 falso, não é verificado', async () => {
        const rejeitada = { ...itemB, status: ReservationStatus.REJECTED };
        mockLot([itemA, rejeitada], { roomId: 'room-3' });
        mockConflictService.hasConflict.mockImplementation((p: { excludeId: string }) =>
          Promise.resolve(p.excludeId === 'res-b'),
        );

        const result = await makeService().updateGroup(
          { groupId: 'grp-1', roomId: 'room-3' },
          coordUser,
        );

        expect(result.count).toBe(2);
        expect(mockConflictService.hasConflict).toHaveBeenCalledTimes(1);
        expect(mockConflictService.hasConflict).toHaveBeenCalledWith(
          expect.objectContaining({ excludeId: 'res-a' }),
          mockTx,
        );
      });

      it('edição só de turma não gera falso conflito consigo mesma (excludeId próprio)', async () => {
        mockLot([itemA, itemB], { turma: 'T2' });
        // Sem excludeId a reserva colidiria consigo mesma.
        mockConflictService.hasConflict.mockImplementation((p: { excludeId?: string }) =>
          Promise.resolve(p.excludeId === undefined),
        );

        const result = await makeService().updateGroup(
          { groupId: 'grp-1', turma: 'T2' },
          coordUser,
        );

        expect(result.count).toBe(2);
      });

      it('audita cada item dentro da transação: UPDATE_RESERVATION, ator, antes e depois', async () => {
        const [afterA, afterB] = mockLot([itemA, itemB], { fim: '11:00' });

        await makeService().updateGroup({ groupId: 'grp-1', fim: '11:00' }, coordUser);

        expect(mockAuditService.log).toHaveBeenCalledTimes(2);
        expect(mockAuditService.log).toHaveBeenCalledWith(mockTx, {
          action: 'UPDATE_RESERVATION',
          entityId: 'res-a',
          userId: coordUser.userId,
          before: itemA,
          after: afterA,
        });
        expect(mockAuditService.log).toHaveBeenCalledWith(mockTx, {
          action: 'UPDATE_RESERVATION',
          entityId: 'res-b',
          userId: coordUser.userId,
          before: itemB,
          after: afterB,
        });
      });

      // Issue 3 (C3), invertido no #22: antes o 1º item era gravado e o 2º
      // falhava (sem transação, sem rollback). Agora a posse é checada em
      // todos os itens antes de qualquer gravação.
      it('grupo com donos diferentes — sem permissão no 2º item → 403 e NADA gravado', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });
        mockOwnershipService.assertOwnerOrPrivileged
          .mockImplementationOnce(() => undefined) // itemA — profUser é o dono
          .mockImplementationOnce(() => {
            throw new ForbiddenException('Você não tem permissão para modificar esta reserva.');
          }); // itemB — não é o dono

        await expect(
          makeService().updateGroup({ groupId: 'grp-1', fim: '11:00' }, profUser),
        ).rejects.toThrow(ForbiddenException);

        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
        expect(mockPrisma.reservation.update).not.toHaveBeenCalled();
        expect(mockAuditService.log).not.toHaveBeenCalled();
      });

      it('COORDENADOR consegue atualizar grupo com reservas de donos diferentes', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });

        const result = await makeService().updateGroup(
          { groupId: 'grp-1', fim: '11:00' },
          coordUser,
        );

        expect(result.count).toBe(2);
        expect(mockTx.reservation.updateMany).toHaveBeenCalledTimes(1);
      });

      it('item mudou de sala/data entre a pré-leitura e o lock → 409, nada gravado', async () => {
        mockLot([itemA, itemB], { fim: '11:00' }, [itemA, { ...itemB, date: D2 }]);

        await expect(
          makeService().updateGroup({ groupId: 'grp-1', fim: '11:00' }, coordUser),
        ).rejects.toThrow(ConflictException);
        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
      });

      it('grupo vazio → 404 (comportamento mantido)', async () => {
        mockTx.reservation.findMany.mockResolvedValue([]);

        await expect(
          makeService().updateGroup({ groupId: 'grp-x', fim: '11:00' }, coordUser),
        ).rejects.toThrow(NotFoundException);
        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
      });

      it('horário inválido → 400 antes de gravar', async () => {
        mockLot([itemA, itemB], { fim: '07:00' });

        await expect(
          makeService().updateGroup({ groupId: 'grp-1', fim: '07:00' }, coordUser),
        ).rejects.toThrow(BadRequestException);
        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
      });
    });

    describe('updateSelected()', () => {
      it('grava o lote inteiro, com locks antes e verificação depois', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });

        const result = await makeService().updateSelected(
          { ids: ['res-a', 'res-b'], fim: '11:00' },
          coordUser,
        );

        expect(result.count).toBe(2);
        expect(lockCalls()).toEqual([
          ['room-1', D1],
          ['room-2', D2],
        ]);
        expect(Math.max(...mockTx.$executeRaw.mock.invocationCallOrder)).toBeLessThan(
          firstOrder(mockConflictService.hasConflict),
        );
        expect(mockAuditService.log).toHaveBeenCalledTimes(2);
      });

      it('id inexistente → 404 com a MESMA mensagem do assertCanModify, nada gravado', async () => {
        mockLot([itemA], { fim: '11:00' });

        const err = await makeService()
          .updateSelected({ ids: ['res-a', 'res-x'], fim: '11:00' }, coordUser)
          .catch((e: unknown) => e);

        expect(err).toBeInstanceOf(NotFoundException);
        expect((err as NotFoundException).message).toBe('Reserva "res-x" não encontrada.');
        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
      });

      it('id soft-deleted → 404 com a mesma mensagem, nada gravado', async () => {
        mockLot([itemA, { ...itemB, deletedAt: new Date() } as unknown as Item], { fim: '11:00' });

        const err = await makeService()
          .updateSelected({ ids: ['res-a', 'res-b'], fim: '11:00' }, coordUser)
          .catch((e: unknown) => e);

        expect((err as NotFoundException).message).toBe('Reserva "res-b" não encontrada.');
        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
      });

      it('posse checada por item, na ordem da requisição — o 1º sem permissão define o 403', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });
        mockOwnershipService.assertOwnerOrPrivileged.mockImplementation((r: Item) => {
          if (r.userId !== profUser.userId) {
            throw new ForbiddenException('Você não tem permissão para modificar esta reserva.');
          }
        });

        await expect(
          makeService().updateSelected({ ids: ['res-b', 'res-a'], fim: '11:00' }, profUser),
        ).rejects.toThrow('Você não tem permissão para modificar esta reserva.');
        expect(mockOwnershipService.assertOwnerOrPrivileged.mock.calls[0][0]).toMatchObject({
          id: 'res-b',
        });
        expect(mockTx.reservation.updateMany).not.toHaveBeenCalled();
      });

      it('404 vem antes do 403 para o mesmo lote (mesma ordem do assertCanModify)', async () => {
        mockLot([itemA], { fim: '11:00' });
        mockOwnershipService.assertOwnerOrPrivileged.mockImplementation(() => {
          throw new ForbiddenException('Você não tem permissão para modificar esta reserva.');
        });

        await expect(
          makeService().updateSelected({ ids: ['res-x', 'res-a'], fim: '11:00' }, profUser),
        ).rejects.toThrow(NotFoundException);
      });

      it('conflito → 409 sem gravação parcial', async () => {
        mockLot([itemA, itemB], { fim: '11:00' });
        mockConflictService.hasConflict.mockResolvedValue(true);

        await expect(
          makeService().updateSelected({ ids: ['res-a', 'res-b'], fim: '11:00' }, coordUser),
        ).rejects.toThrow(ConflictException);
        expect(mockAuditService.log).not.toHaveBeenCalled();
      });

      it('ids repetidos contam uma vez', async () => {
        mockLot([itemA], { fim: '11:00' });

        const result = await makeService().updateSelected(
          { ids: ['res-a', 'res-a'], fim: '11:00' },
          coordUser,
        );

        expect(result.count).toBe(1);
        expect(mockTx.reservation.updateMany).toHaveBeenCalledWith({
          where: { id: { in: ['res-a'] } },
          data: { fim: '11:00' },
        });
      });
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

  // ── findByDay (painel de reservas do dia) ───────────────────────────────────
  describe('findByDay()', () => {
    const dayRow = {
      id: 'res-1',
      inicio: '08:00',
      fim: '10:00',
      status: ReservationStatus.APPROVED,
      turma: 'APB.ADM.148',
      createdByUserId: 'prof-1',
      room: { name: '603 Sala' },
      user: { name: 'Prof. Silva' },
    };

    beforeEach(() => {
      mockPrisma.reservation.findMany.mockResolvedValue([dayRow]);
    });

    // Issue 5 (fase 2): qualquer usuário autenticado vê o nome do professor
    // responsável (Dashboard); createdByUserId continua só pra COORD/ADMIN.
    it('PROFESSOR recebe o nome do professor, mas não createdByUserId', async () => {
      const result = await makeService().findByDay('2026-08-10', profUser);
      expect(result).toEqual([
        {
          id: 'res-1',
          sala: '603 Sala',
          inicio: '08:00',
          fim: '10:00',
          status: ReservationStatus.APPROVED,
          turma: 'APB.ADM.148',
          professor: 'Prof. Silva',
        },
      ]);
    });

    it('reserva por proxy: o nome é do DONO (user), nunca de quem criou', async () => {
      // Dono fictício 'Prof. Dono Ficticio'; criada por um coordenador (id diferente).
      mockPrisma.reservation.findMany.mockResolvedValue([
        { ...dayRow, createdByUserId: 'coord-9', user: { name: 'Prof. Dono Ficticio' } },
      ]);
      for (const user of [profUser, coordUser, adminUser]) {
        const [item] = await makeService().findByDay('2026-08-10', user);
        expect(item.professor).toBe('Prof. Dono Ficticio');
      }
    });

    it('nenhum role recebe e-mail ou notes', async () => {
      for (const user of [profUser, coordUser, adminUser]) {
        const [item] = await makeService().findByDay('2026-08-10', user);
        expect(item).not.toHaveProperty('email');
        expect(item).not.toHaveProperty('notes');
      }
    });

    it('COORDENADOR recebe shape completo — com professor e createdByUserId', async () => {
      const result = await makeService().findByDay('2026-08-10', coordUser);
      expect(result).toEqual([
        {
          id: 'res-1',
          sala: '603 Sala',
          inicio: '08:00',
          fim: '10:00',
          status: ReservationStatus.APPROVED,
          turma: 'APB.ADM.148',
          professor: 'Prof. Silva',
          createdByUserId: 'prof-1',
        },
      ]);
    });

    it('ADMIN também recebe shape completo', async () => {
      const result = await makeService().findByDay('2026-08-10', adminUser);
      expect(result[0]).toHaveProperty('professor', 'Prof. Silva');
      expect(result[0]).toHaveProperty('createdByUserId', 'prof-1');
    });

    it('createdByUserId null vira campo omitido (exactOptionalPropertyTypes), não null', async () => {
      mockPrisma.reservation.findMany.mockResolvedValue([{ ...dayRow, createdByUserId: null }]);
      const result = await makeService().findByDay('2026-08-10', coordUser);
      expect(result[0]).not.toHaveProperty('createdByUserId');
    });

    it('query filtra status PENDING/APPROVED, date exata e deletedAt: null', async () => {
      await makeService().findByDay('2026-08-10', profUser);
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        where: { date?: string; deletedAt?: null; status?: { in: string[] } };
      };
      expect(calledWith.where.date).toBe('2026-08-10');
      expect(calledWith.where.deletedAt).toBeNull();
      expect(calledWith.where.status?.in).toEqual([
        ReservationStatus.PENDING,
        ReservationStatus.APPROVED,
      ]);
    });

    it('query usa select explícito sem notes e sem user.email', async () => {
      await makeService().findByDay('2026-08-10', coordUser);
      const calledWith = mockPrisma.reservation.findMany.mock.calls[0][0] as {
        select: Record<string, unknown>;
      };
      expect(calledWith.select).not.toHaveProperty('notes');
      expect(calledWith.select.user).toEqual({ select: { name: true } });
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
      await expect(makeService().findOne('nao-existe', adminUser)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException quando reserva está soft-deleted', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue({
        ...baseReservation,
        deletedAt: new Date(),
      });
      await expect(makeService().findOne('res-1', adminUser)).rejects.toThrow(NotFoundException);
    });

    // ── Ownership (Issue 3, C1) ────────────────────────────────────────
    it('PROFESSOR lê a própria reserva com sucesso', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation); // userId: 'prof-1'
      const result = await makeService().findOne('res-1', profUser);
      expect(result.id).toBe('res-1');
    });

    it('PROFESSOR tentando ler reserva de outro usuário recebe NotFoundException', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation); // userId: 'prof-1'
      const outroProf = { userId: 'prof-2', email: 'prof2@senai.edu', role: 'PROFESSOR' };
      await expect(makeService().findOne('res-1', outroProf)).rejects.toThrow(NotFoundException);
    });

    it('COORDENADOR consegue ler reserva de qualquer usuário', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation); // userId: 'prof-1'
      const result = await makeService().findOne('res-1', coordUser);
      expect(result.id).toBe('res-1');
    });

    it('ADMIN consegue ler reserva de qualquer usuário', async () => {
      mockPrisma.reservation.findUnique.mockResolvedValue(baseReservation); // userId: 'prof-1'
      const result = await makeService().findOne('res-1', adminUser);
      expect(result.id).toBe('res-1');
    });
  });
});
