import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ReservationStatus, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

// Fase C3 — RESERVATION_REMINDER (enum existe desde a Fase C1, sem uso até
// agora). Lógica de domínio de reserva ("quais reservas estão prestes a
// começar") — mora em reservations/, não em NotificationsService, que
// continua só criar/listar/marcar notificação.

// Manaus é UTC-4 fixo o ano inteiro — Brasil aboliu horário de verão em
// 2019, não há DST a considerar aqui.
const MANAUS_OFFSET_MS = 4 * 60 * 60 * 1000;

// Reserva "lembrada" quando falta menos de 60min pra começar, mas ainda
// não começou.
const REMINDER_WINDOW_MINUTES = 60;

// HH:MM → minutos do dia. Mesmo parsing de toMinutes() em
// availability.service.ts — não compartilhado entre módulos hoje (nenhum
// dos dois services importa o outro; cada um mantém sua própria cópia
// trivial, mesmo padrão já existente no projeto).
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// "Agora" deslocado -4h: ler os getters UTC dessa Date resultante dá o
// horário de PAREDE de Manaus. Mesmo princípio geral (deslocar antes de ler
// getters UTC) do "UTC noon trick" já usado no projeto (ex:
// is-not-past-date.validator.ts, expandirDatas em reservations.service.ts)
// — mas nenhum trecho existente fazia essa conta especificamente pro
// "agora" em minutos (aqueles tratam só de datas, não hora do dia), então
// essa aplicação exata é nova nesta missão, seguindo o mesmo princípio.
function manausNow(): Date {
  return new Date(Date.now() - MANAUS_OFFSET_MS);
}

function manausTodayYmd(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function manausMinutesOfDay(now: Date): number {
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

// Pura e exportada — testável sem mockar cron/Prisma. "Na janela de
// lembrete": ainda não começou (inicio > agora) e começa dentro da janela
// (inicio <= agora + windowMinutes).
export function isWithinReminderWindow(
  inicioMinutes: number,
  nowMinutes: number,
  windowMinutes: number = REMINDER_WINDOW_MINUTES,
): boolean {
  return inicioMinutes > nowMinutes && inicioMinutes <= nowMinutes + windowMinutes;
}

@Injectable()
export class ReservationReminderService {
  private readonly logger = new Logger(ReservationReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // A cada 15 minutos — não existe CronExpression.EVERY_15_MINUTES na
  // versão instalada de @nestjs/schedule (confirmado lendo o enum: só 5/10/
  // 30min e depois horas), então uso a expressão cron equivalente direto,
  // mesmo formato de 6 campos do EVERY_5_MINUTES da própria lib
  // ("0 */5 * * * *").
  @Cron('0 */15 * * * *')
  async sendUpcomingReminders(): Promise<void> {
    const now = manausNow();
    const today = manausTodayYmd(now);
    const nowMinutes = manausMinutesOfDay(now);

    const candidates = await this.prisma.reservation.findMany({
      where: {
        date: today,
        status: ReservationStatus.APPROVED,
        deletedAt: null,
      },
      include: { room: { select: { name: true } } },
    });

    const dueForReminder = candidates.filter(r =>
      isWithinReminderWindow(toMinutes(r.inicio), nowMinutes),
    );

    let created = 0;
    for (const reservation of dueForReminder) {
      try {
        // Idempotência SEM campo novo no schema — a própria existência de
        // uma Notification (reservationId + type=REMINDER) é a marca de
        // "já lembrado". Consulta direta ao Prisma aqui, não em
        // NotificationsService, pra manter a lógica de reminder isolada
        // (ver comentário do módulo acima).
        const already = await this.prisma.notification.findFirst({
          where: {
            reservationId: reservation.id,
            type: NotificationType.RESERVATION_REMINDER,
          },
          select: { id: true },
        });
        if (already) continue;

        // NotificationsService.notify() isola falha do EMIT (WebSocket)
        // internamente, mas não do próprio INSERT no banco — por isso o
        // try/catch por item aqui: uma reserva com erro não pode impedir
        // as outras no mesmo ciclo do cron.
        await this.notificationsService.notify({
          userId: reservation.userId,
          type: NotificationType.RESERVATION_REMINDER,
          title: 'Sua reserva está prestes a começar',
          body: `${reservation.room.name} às ${reservation.inicio}, hoje.`,
          reservationId: reservation.id,
        });
        created++;
      } catch (e) {
        this.logger.warn(`Falha ao processar lembrete da reserva ${reservation.id}: ${String(e)}`);
      }
    }

    this.logger.log(
      `Lembretes: ${candidates.length} reserva(s) aprovada(s) hoje, ` +
        `${dueForReminder.length} na janela de ${REMINDER_WINDOW_MINUTES}min, ` +
        `${created} lembrete(s) novo(s) criado(s).`,
    );
  }
}
