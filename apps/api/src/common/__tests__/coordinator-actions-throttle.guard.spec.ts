import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'reflect-metadata';
import { HttpStatus, Module, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { ThrottlerException, ThrottlerModule, ThrottlerStorageService } from '@nestjs/throttler';
import {
  CoordinatorActionsThrottleGuard,
  COORDINATOR_ACTIONS_LIMIT,
  COORDINATOR_ACTIONS_MESSAGE,
  COORDINATOR_ACTIONS_TTL_MS,
  resolveCoordinatorActionsTracker,
} from '../guards/coordinator-actions-throttle.guard';
import { ReservationsController } from '../../modules/reservations/reservations.controller';

// Issue 6 — limite de requisições do COORDENADOR nas ações sobre reservas
// (editar, cancelar, aprovar, rejeitar, lote por grupo e por seleção).
// Storage real em memória do @nestjs/throttler + ExecutionContext falso.

interface FakeReq {
  ip: string;
  user?: { userId: string; email: string; role: string };
}

function makeContext(req: FakeReq, handler: () => void = function update() {}) {
  const res = { header: vi.fn() };
  const context = {
    switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    getHandler: () => handler,
    getClass: () => ReservationsController,
  } as unknown as ExecutionContext;
  return { context, res };
}

function user(role: string, userId = `${role.toLowerCase()}-1`) {
  return { userId, email: `${userId}@senai.edu`, role };
}

let storage: ThrottlerStorageService;

function makeGuard(skip = false): CoordinatorActionsThrottleGuard {
  return new CoordinatorActionsThrottleGuard(
    { throttlers: [{ ttl: 60_000, limit: 100 }], skipIf: () => skip },
    storage,
  );
}

async function hit(guard: CoordinatorActionsThrottleGuard, req: FakeReq, handler?: () => void) {
  return guard.canActivate(makeContext(req, handler).context);
}

describe('CoordinatorActionsThrottleGuard (issue 6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    storage = new ThrottlerStorageService();
  });
  afterEach(() => {
    storage.onApplicationShutdown();
    vi.useRealTimers();
  });

  it('limite e janela documentados: 30 ações por 60 s', () => {
    expect(COORDINATOR_ACTIONS_LIMIT).toBe(30);
    expect(COORDINATOR_ACTIONS_TTL_MS).toBe(60_000);
  });

  it('COORDENADOR: 30 passam, a 31ª → 429 com mensagem em PT-BR e Retry-After em segundos', async () => {
    const guard = makeGuard();
    const req = { ip: '10.0.0.1', user: user('COORDENADOR') };
    for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT; i++) {
      await expect(hit(guard, req)).resolves.toBe(true);
    }

    const { context, res } = makeContext(req);
    const err = await guard.canActivate(context).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ThrottlerException);
    expect((err as ThrottlerException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    expect((err as ThrottlerException).message).toBe(COORDINATOR_ACTIONS_MESSAGE);
    expect(res.header).toHaveBeenCalledWith('Retry-After', 60);
  });

  it('depois do bloqueio, passado o ttl, volta a passar', async () => {
    const guard = makeGuard();
    const req = { ip: '10.0.0.1', user: user('COORDENADOR') };
    for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT; i++) await hit(guard, req);
    await expect(hit(guard, req)).rejects.toThrow(ThrottlerException);

    vi.advanceTimersByTime(COORDINATOR_ACTIONS_TTL_MS + 1_000);

    await expect(hit(guard, req)).resolves.toBe(true);
  });

  it.each(['ADMIN', 'PROFESSOR'])(
    '%s nunca é limitado por este guard (segue no global)',
    async role => {
      const guard = makeGuard();
      const req = { ip: '10.0.0.1', user: user(role) };
      for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT * 2; i++) {
        await expect(hit(guard, req)).resolves.toBe(true);
      }
    },
  );

  it('balde único: handlers diferentes somam no mesmo contador', async () => {
    const guard = makeGuard();
    const req = { ip: '10.0.0.1', user: user('COORDENADOR') };
    const handlers = [
      function update() {},
      function cancel() {},
      function updateStatus() {},
      function updateGroup() {},
      function updateSelected() {},
    ];
    for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT; i++) {
      await hit(guard, req, handlers[i % handlers.length]);
    }
    await expect(hit(guard, req, handlers[0])).rejects.toThrow(ThrottlerException);
  });

  it('por usuário, não por IP: coordenadores distintos no mesmo IP têm baldes separados', async () => {
    const guard = makeGuard();
    const a = { ip: '10.0.0.1', user: user('COORDENADOR', 'coord-a') };
    const b = { ip: '10.0.0.1', user: user('COORDENADOR', 'coord-b') };
    for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT; i++) await hit(guard, a);
    await expect(hit(guard, a)).rejects.toThrow(ThrottlerException);

    await expect(hit(guard, b)).resolves.toBe(true);
  });

  it('mesmo coordenador trocando de IP continua no mesmo balde', async () => {
    const guard = makeGuard();
    for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT; i++) {
      await hit(guard, { ip: `10.0.0.${i}`, user: user('COORDENADOR') });
    }
    await expect(hit(guard, { ip: '10.9.9.9', user: user('COORDENADOR') })).rejects.toThrow(
      ThrottlerException,
    );
  });

  it('lote conta 1: uma requisição = um incremento, independente do corpo', async () => {
    const guard = makeGuard();
    const spy = vi.spyOn(storage, 'increment');
    await hit(guard, { ip: '10.0.0.1', user: user('COORDENADOR') }, function updateSelected() {});
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skipIf do módulo (THROTTLE_SKIP, issue 7) ligado → nunca limita nem conta', async () => {
    const guard = makeGuard(true);
    const spy = vi.spyOn(storage, 'increment');
    const req = { ip: '10.0.0.1', user: user('COORDENADOR') };
    for (let i = 0; i < COORDINATOR_ACTIONS_LIMIT * 2; i++) {
      await expect(hit(guard, req)).resolves.toBe(true);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('tracker: userId quando autenticado, IP quando não', () => {
    expect(resolveCoordinatorActionsTracker({ ip: '10.0.0.1', user: user('COORDENADOR') })).toBe(
      'user:coordenador-1',
    );
    expect(resolveCoordinatorActionsTracker({ ip: '10.0.0.1' })).toBe('ip:10.0.0.1');
  });
});

// DI: o guard é instanciado pelo Nest via @UseGuards, num módulo que não
// importa o ThrottlerModule diretamente — depende de ele ser @Global e
// exportar os tokens de opções/storage (mesma forma forRootAsync do app.module).
describe('CoordinatorActionsThrottleGuard — injeção de dependência', () => {
  it('resolve opções e storage do ThrottlerModule global num módulo que não o importa', async () => {
    @Module({ providers: [CoordinatorActionsThrottleGuard] })
    class FeatureModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRootAsync({
          useFactory: () => ({ throttlers: [{ ttl: 60_000, limit: 100 }], skipIf: () => false }),
        }),
        FeatureModule,
      ],
    }).compile();

    expect(moduleRef.get(CoordinatorActionsThrottleGuard)).toBeInstanceOf(
      CoordinatorActionsThrottleGuard,
    );
    await moduleRef.close();
  });
});

// Contrato de rota: o guard está EXATAMENTE nas 5 ações de modificação.
// Handler novo em ReservationsController precisa entrar num dos dois grupos.
const LIMITED = ['updateStatus', 'updateGroup', 'updateSelected', 'update', 'cancel'];
const NOT_LIMITED = ['findAll', 'findByDay', 'findOne', 'create', 'createRange'];

describe('ReservationsController — rotas cobertas pelo limite do coordenador (issue 6)', () => {
  function guardsOf(name: string): unknown[] {
    const handler = (ReservationsController.prototype as unknown as Record<string, object>)[name];
    return (handler ? (Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[]) : []) ?? [];
  }

  it('todo handler está classificado neste teste', () => {
    const names = Object.getOwnPropertyNames(ReservationsController.prototype).filter(
      n => n !== 'constructor',
    );
    expect(names.sort()).toEqual([...LIMITED, ...NOT_LIMITED].sort());
  });

  it.each(LIMITED)('%s tem o CoordinatorActionsThrottleGuard', name => {
    expect(guardsOf(name)).toContain(CoordinatorActionsThrottleGuard);
  });

  it.each(NOT_LIMITED)('%s NÃO tem o CoordinatorActionsThrottleGuard', name => {
    expect(guardsOf(name)).not.toContain(CoordinatorActionsThrottleGuard);
  });
});
