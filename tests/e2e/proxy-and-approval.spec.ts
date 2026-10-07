import { test, expect } from './fixtures/test.fixture';
import { ReservationApi } from './fixtures/reservation.api';
import { tomorrow } from './helpers/dates';
import { loginViaApi } from './fixtures/auth.fixture';
import type { LoginResponse } from './fixtures/auth.fixture';
import { requireEnv } from './helpers/env';

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? '';
const ADMIN_PASSWORD = requireEnv('E2E_ADMIN_PASSWORD');
const COORD_EMAIL = process.env['E2E_COORDENADOR_EMAIL'] ?? '';
const COORD_PASSWORD = requireEnv('E2E_COORDENADOR_PASSWORD');
const PROF_EMAIL = process.env['E2E_PROFESSOR_EMAIL'] ?? '';
const PROF_PASSWORD = requireEnv('E2E_PROFESSOR_PASSWORD');

// Sala real do sistema — mesma usada em reservations.spec.ts
const TEST_ROOM_NAME = '603 Sala';

// loginViaApi lança (throw) em falha de login — não retorna null/undefined.
// setupCoordenadorSession/setupProfessorSession (helpers/auth.ts) tratam isso,
// mas dependem de um Page (injectAuth); os testes aqui são de API pura, sem
// fixture de página, então usamos este helper local com a mesma semântica de
// try/catch → null, para permitir test.skip() quando a conta de teste não existir.
async function tryLogin(email: string, password: string): Promise<LoginResponse | null> {
  try {
    return await loginViaApi(API_URL, email, password);
  } catch {
    return null;
  }
}

test.describe('Auto-aprovação e proxy de reserva', () => {
  let adminApi: ReservationApi;
  const created: string[] = [];

  test.beforeAll(async () => {
    const auth = await loginViaApi(API_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    adminApi = new ReservationApi(API_URL, auth.accessToken);
    // Sweep de segurança: limpa reservas E2E órfãs de runs anteriores
    await adminApi.sweepE2E();
  });

  test.afterEach(async () => {
    // Cleanup determinístico por ID — ADMIN pode cancelar qualquer reserva
    // (OwnershipService.assertCanModify libera ADMIN/COORDENADOR sempre),
    // independente de quem criou (COORDENADOR ou PROFESSOR).
    await Promise.allSettled(created.map(id => adminApi.cancel(id)));
    created.length = 0;
  });

  test.afterAll(async () => {
    // Sweep de segurança final
    await adminApi.sweepE2E();
  });

  test('COORDENADOR cria reserva — status inicial já é APPROVED (auto-aprovação)', async () => {
    const auth = await tryLogin(COORD_EMAIL, COORD_PASSWORD);
    if (auth === null) {
      test.skip();
      return;
    }
    const coordApi = new ReservationApi(API_URL, auth.accessToken);

    const reservation = await coordApi.create({
      roomId: TEST_ROOM_NAME,
      date: tomorrow(),
      inicio: '07:00',
      fim: '07:15',
      notes: 'e2e-auto-approve-coord',
    });
    created.push(reservation.id);

    const fetched = await adminApi.getById(reservation.id);
    expect(fetched.status).toBe('APPROVED');
  });

  test('PROFESSOR cria reserva — status inicial é PENDING (sem auto-aprovação)', async () => {
    const auth = await tryLogin(PROF_EMAIL, PROF_PASSWORD);
    if (auth === null) {
      test.skip();
      return;
    }
    const profApi = new ReservationApi(API_URL, auth.accessToken);

    const reservation = await profApi.create({
      roomId: TEST_ROOM_NAME,
      date: tomorrow(),
      inicio: '07:15',
      fim: '07:30',
      notes: 'e2e-pending-prof',
    });
    created.push(reservation.id);

    const fetched = await adminApi.getById(reservation.id);
    expect(fetched.status).toBe('PENDING');
  });

  test('COORDENADOR cria reserva em nome de um professor via ownerUserId (proxy)', async () => {
    const auth = await tryLogin(COORD_EMAIL, COORD_PASSWORD);
    if (auth === null) {
      test.skip();
      return;
    }
    const coordApi = new ReservationApi(API_URL, auth.accessToken);

    const professors = await coordApi.listProfessors();
    if (professors.length === 0) {
      // Sem PROFESSOR cadastrado no banco — não há para quem fazer proxy.
      test.skip();
      return;
    }
    const targetProfessor = professors[0]!;

    const reservation = await coordApi.create({
      roomId: TEST_ROOM_NAME,
      date: tomorrow(),
      inicio: '07:30',
      fim: '07:45',
      notes: 'e2e-proxy-test',
      ownerUserId: targetProfessor.id,
    });
    created.push(reservation.id);

    const fetched = await adminApi.getById(reservation.id);
    // Dono da reserva é o professor (proxy), não o coordenador que criou.
    expect(fetched.userId).toBe(targetProfessor.id);
    // Status segue a role de quem CRIOU (COORDENADOR) — auto-aprovação,
    // não a role do dono (ReservationsService.initialStatus(currentUser.role)).
    expect(fetched.status).toBe('APPROVED');
  });

  test('reserva PENDING não aparece como ocupação em GET /availability (bug fix)', async () => {
    const auth = await tryLogin(PROF_EMAIL, PROF_PASSWORD);
    if (auth === null) {
      test.skip();
      return;
    }
    const profApi = new ReservationApi(API_URL, auth.accessToken);

    const date = tomorrow();
    const reservation = await profApi.create({
      roomId: TEST_ROOM_NAME,
      date,
      inicio: '07:45',
      fim: '08:00',
      notes: 'e2e-availability-pending',
    });
    created.push(reservation.id);

    // GET /availability é @Public — sem Authorization
    const res = await fetch(`${API_URL}/availability?date=${date}`);
    expect(res.ok).toBe(true);
    const json = (await res.json()) as { salas: { sala: string; status: string }[] };

    const sala = json.salas.find(s => s.sala === TEST_ROOM_NAME);
    // Verificação "soft": não afirma 'livre' (pode haver aula real nesse dia),
    // só garante que a reserva PENDING não foi contabilizada como ocupação
    // (regressão do bug: AvailabilityService incluía PENDING além de APPROVED).
    expect(sala?.status).not.toBe('reserva');
  });
});
