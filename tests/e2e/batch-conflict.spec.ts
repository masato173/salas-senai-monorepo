import { test, expect } from './fixtures/test.fixture';
import { ReservationApi } from './fixtures/reservation.api';
import { daysFromNow } from './helpers/dates';
import { loginViaApi } from './fixtures/auth.fixture';
import { requireEnv } from './helpers/env';

// #22 — concorrência real contra Postgres (job e2e do CI, banco descartável).
// Duas edições em lote disparadas ao mesmo tempo que, cada uma sozinha, são
// válidas, mas juntas sobreporiam a mesma sala/horário. Com o lock por
// (sala, data) dentro da transação do lote, exatamente UMA passa (200) e a
// outra recebe 409 sem gravar nada — qualquer que seja o entrelaçamento.
const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? '';
const ADMIN_PASSWORD = requireEnv('E2E_ADMIN_PASSWORD');

// Salas reais do seed, não usadas pelos outros specs (que usam '603 Sala').
const ROOM_A = '607 Sala';
const ROOM_B = '608 Sala';
const TARGET_ROOM = '609 Sala';

test.describe('Edição em lote concorrente (#22)', () => {
  let adminApi: ReservationApi;
  const created: string[] = [];

  test.beforeAll(async () => {
    const auth = await loginViaApi(API_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminApi = new ReservationApi(API_URL, auth.accessToken);
    await adminApi.sweepE2E();
  });

  test.afterEach(async () => {
    await Promise.allSettled(created.map(id => adminApi.cancel(id)));
    created.length = 0;
  });

  test.afterAll(async () => {
    await adminApi.sweepE2E();
  });

  test('dois lotes que juntos sobreporiam a mesma sala → exatamente um 200 e um 409', async () => {
    const date = daysFromNow(45);
    const slot = { date, inicio: '21:00', fim: '21:30' };
    const r1 = await adminApi.create({ roomId: ROOM_A, ...slot, notes: 'e2e-batch-conflict-1' });
    created.push(r1.id);
    const r2 = await adminApi.create({ roomId: ROOM_B, ...slot, notes: 'e2e-batch-conflict-2' });
    created.push(r2.id);

    const [a, b] = await Promise.all([
      adminApi.updateSelected({ ids: [r1.id], roomId: TARGET_ROOM }),
      adminApi.updateSelected({ ids: [r2.id], roomId: TARGET_ROOM }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);

    // Só uma reserva ficou na sala alvo; a do 409 continua onde estava.
    const targetId = await adminApi.roomIdOf(TARGET_ROOM);
    const [room1, room2] = await Promise.all([
      adminApi.getRoomOf(r1.id),
      adminApi.getRoomOf(r2.id),
    ]);
    expect([room1, room2].filter(r => r === targetId)).toHaveLength(1);
    const loserRoom = a.status === 409 ? room1 : room2;
    const loserOriginal = await adminApi.roomIdOf(a.status === 409 ? ROOM_A : ROOM_B);
    expect(loserRoom).toBe(loserOriginal);
  });
});
