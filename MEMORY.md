# MEMORY.md — Controle de Salas SENAI

# Cérebro persistente do projeto — leia ANTES de qualquer tarefa

# Atualizado: 2026-07-29 | Fase atual: F9.9 + pós-F9 + leva de pré-produção

# (Fase A: fix conflito falso; Fase B: RBAC coordenador no admin; Fase C1: schema

# createdByUserId+Notification; Fase C2: notificações persistentes; Fase C3: cron

# de lembrete + fix CORS) — Railway configurado e primeiro deploy disparado.

# Redesign da tela de Login em andamento (NÃO COMMITADO — ver seção LOGIN abaixo).

---

## IDENTIDADE DO PROJETO

**Nome:** Controle de Salas SENAI
**Instituição:** SENAI Manaus (Amazonas)
**Propósito:** Sistema institucional de reserva e gestão de salas
**Repositório:** github.com/masato173/salas-senai-monorepo
**Monorepo:** C:\dev\monorepo (pnpm workspace)
**Branch principal:** master (não main)
**Comunicação:** PT-BR informal

---

## STACK EM PRODUÇÃO

### Frontend — apps/reservations

React 18 + TypeScript + Vite
Zustand (estado global — authStore, reservationStore)
React Query — hook manual (não TanStack Query)
CSS custom properties puro (sem Tailwind, sem MUI, sem Chakra)
Lucide React (ícones)
FullCalendar v6 (calendário de reservas)
React Router DOM (basename via BASE_URL pra GitHub Pages)
Socket.IO client (namespace /rooms, JWT no handshake)

### Backend — apps/api

NestJS 10 + Prisma 5.22
PostgreSQL via Supabase (São Paulo — aws-1-sa-east-1)
pgbouncer transaction mode (RESTRIÇÃO CRÍTICA — ver Bug #2)
JWT + Refresh Token (httpOnly, rotação automática)
Socket.IO (WebSocket namespace /rooms)
RBAC (PROFESSOR | COORDENADOR | ADMIN)
Helmet (headers de segurança)
@nestjs/throttler (100/min global, 5/min em login+refresh)
nestjs-pino (logs estruturados JSON em produção)
@nestjs/schedule (cron de sync às 03h UTC)

### Infraestrutura

Supabase free tier (pausa após ~5-10min — Bug Histórico #1)
Railway (backend — deploy via GitHub Actions CD)
GitHub Pages (frontend — deploy via gh-pages branch)
Google Apps Script (APENAS fonte de sync de aulas — POST /sync/schedules)
CI: GitHub Actions (validate + e2e jobs, Node 22, pnpm 8)
CD: .github/workflows/cd.yml (workflow_run pós-CI)

---

## ESTADO POR FASE

✅ F0 Legado (HTML + Apps Script + Google Sheets)
✅ F1 Modularização frontend legado
✅ F2 Backend proxy (absorvido pelo NestJS)
✅ F3 React + Vite + hooks + componentes
✅ F4 Backend NestJS completo (Auth, Users, Rooms, Reservations,
Availability, Audit, Sync, Schedules, Realtime, Health, RBAC)
✅ F5 Cutover definitivo (ADR-003) — NestJS = backend oficial
✅ F6 Portal Aprovações + Shell Admin completo
✅ F7 Cron sync + Socket.IO client + testes E2E
✅ F8 Migração Google Sheets → PostgreSQL como fonte única
(Schedule indexado, AvailabilityService usa banco, reservas 100% PG)
✅ F9 Produção e qualidade — SPRINT COMPLETA:
✅ F9.1 E2E Playwright: 23 testes passando, CI verde
✅ F9.2 CI GitHub Actions (validate + e2e jobs)
✅ F9.3 CD Railway + GitHub Pages
✅ F9.4 Logs estruturados nestjs-pino
✅ F9.5 Backup Supabase nativo + docs/backup-restore.md
✅ F9.6 Índice Reservation(date, status) + paginação aditiva GET /reservations
✅ F9.7 Cliente Apps Script removido do frontend (appsScript.ts deletado)
✅ F9.8 ESLint reativado (causa raiz: root:true + devDep na raiz)
✅ F9.9 AuditService generalizado (entityType opcional, default
'Reservation'; action aberto pra ReservationAuditAction |
RoomAuditAction). Exportado do ReservationsModule, importado
pelo RoomsModule. RoomsService.create/update/softDelete rodam
dentro de $transaction e auditam CREATE_ROOM/UPDATE_ROOM/
DEACTIVATE_ROOM com entityType: 'Room'.

✅ PÓS-F9.9 (sem número de fase formal — trabalho incremental):

- Fix: AvailabilityService incluía reservas PENDING como ocupação em
  GET /availability (deveria ser só APPROVED) — corrigido, com teste
  novo pro where-clause.
- Auto-aprovação por role: ReservationsService.initialStatus(role) —
  PENDING pra PROFESSOR, APPROVED pra COORDENADOR/ADMIN.
- Reserva por proxy: CreateReservationDto/CreateReservationRangeDto
  ganharam ownerUserId? opcional. resolveOwnerUserId() valida (User
  ativo) e grava a reserva com userId = ownerUserId quando quem chama
  é COORDENADOR/ADMIN; PROFESSOR sempre ignora o campo.
- Novo endpoint GET /users/professors (COORDENADOR|ADMIN) via
  UsersRepository.findAllProfessors().
- Frontend: seletor de professor em ReservationForm (proxy), nova
  página/rota /minha-agenda (useMyReservations, GET /reservations?mine=true),
  Dashboard ganhou toggle Tabela/Linha do tempo (reaproveita DayView,
  mapToEntries extraído pra components/dashboard/mapToEntries.ts,
  compartilhado com Agendamentos), notificação efêmera na sidebar
  (AppLayout.tsx: dot pulsante em Minha Agenda pro dono da reserva
  criada, ou em Reservas quando nasce PENDING pra COORDENADOR/ADMIN —
  via useRealtimeSocket, some ao visitar a rota).
- FullCalendar (/reservas): dayMaxEvents ligado (popover "+N mais"
  nativo) + popover restilizado com os tokens glass do projeto.
- /agendamentos: rota removida de vez (não só do menu — tirada de
  router/index.tsx e router/config.ts, seguindo o mesmo padrão de
  /salas /turmas /relatorios /configuracoes). Arquivo da página
  mantido, só não é mais roteável.
- ConflictAlert.tsx reescrito: usava classes Tailwind, mas o projeto
  nunca teve Tailwind instalado (renderizava sem estilo em produção,
  dentro do fluxo real de criação de reserva) — ver Bug #12.
  StatusBadge.tsx/LoadingSkeleton.tsx (mesmo padrão Tailwind, sem
  nenhum import em uso) deletados.
- Foco de teclado visível (`:focus-visible`, global.css) adicionado —
  não existia nenhuma regra de foco antes.
- DESIGN.md + PRODUCT.md + .impeccable/ criados em apps/reservations/
  via skill Impeccable — ver seção DESIGN SYSTEM abaixo (agora aponta
  pra lá como fonte primária de tokens, não duplica tudo aqui).
- Hooks do Claude Code adicionados (.claude/hooks/): bloqueio de
  edição de .env\* (exceto .env.example) + eslint --fix automático
  pós-edit em .ts/.tsx. Ver seção AUTOMAÇÃO CLAUDE CODE.

✅ LEVA DE PRÉ-PRODUÇÃO (Fases A/B/C1/C2/C3 — 2026-07-27/28, commits reais
abaixo, todos já no histórico de `master`):

- **Fase A** (`5650f79`) — `AvailabilityService` marcava status `'conflito'`
  sempre que existia aula E reserva na mesma sala/dia, sem checar
  sobreposição real de horário; fix usa `overlaps()` (já existia no
  arquivo) no cálculo de status. Precedência: conflito-real > aula >
  reserva > livre. Turma também passou a aparecer no chip de reserva
  (`turma: String?` já existia no schema, só faltava no evento). Ver Bug
  histórico #17.
- **Fase B** (`efbabf9`) — COORDENADOR ganhou acesso a 4 das 10 rotas
  `/admin/*` (`/admin`, `/admin/usuarios`, `/admin/permissoes`,
  `/admin/auditoria`); as outras 6 continuam ADMIN-only.
  `ProtectedRoute.tsx` exporta `ROLE_HIERARCHY`/`hasRole()` (reusado por
  `AppLayout.tsx` pra filtrar a sidebar). `AuditController` abriu pra
  COORDENADOR (read-only). `UsersService` ganhou gates de segurança
  obrigatórios (`ForbiddenException` antes de tocar o banco): COORDENADOR
  nunca pode promover a ADMIN, nem alterar um alvo ADMIN ou outro
  COORDENADOR. 9 testes novos em `users.service.spec.ts`.
- **Fix colateral do dia seguinte** (`5abf8a6`) — o `ProtectedRoute` do
  layout PAI `/admin` em `router/index.tsx` continuava com
  `requiredRole='ADMIN'` hardcoded, bloqueando COORDENADOR antes mesmo de
  chegar nas rotas filhas — tornava a Fase B inteira ineficaz na prática.
  Ver Bug histórico #16.
- **Fase C1** (`9ec47be` schema + `80a1ba4` migration) —
  `Reservation.createdByUserId String?` + relação nomeada `createdBy`
  (só difere de `userId` em reserva por proxy) e `model Notification` +
  `enum NotificationType` (6 valores) adicionados ao schema. Migration
  **aplicada em produção** (Supabase sa-east-1) em 2026-07-27. Frontend:
  badge "via {nome}" em Minha Agenda quando a reserva é proxy, botão "Ver
  Minha Agenda" em Perfil.
- **Fase C2** (`a4d9dfb`) — sistema de notificação persistente completo:
  `NotificationsModule` (`notify`/`notifyMany`/`findForUser`/`markRead`/
  `markAllRead`), `GET /notifications`, `PATCH /notifications/:id/read`,
  `PATCH /notifications/read-all`. `RealtimeGateway` ganhou
  `client.join(userId)` no handshake pra permitir emit direcionado por
  usuário (`RealtimeService.notificationCreated`). 5 pontos de disparo em
  `ReservationsService` (PENDING, CONFIRMED, REJECTED, CANCELLED,
  RESCHEDULED — todos com `notifySafe` try/catch pra nunca derrubar a
  operação principal). Frontend: `NotificationBell.tsx` (sino na topbar,
  dropdown glass) + `useNotifications.ts`. A notificação efêmera de
  sidebar (pós-F9.9) foi **mantida**, as duas coexistem.
- **Fase C3** (`700c72e`) — primeiro `@Cron` do projeto:
  `ReservationReminderService` (`reservations/reservation-reminder.service.ts`),
  `@Cron('0 */15 * * * *')` (a cada 15min — `CronExpression.EVERY_15_MINUTES`
  não existe no `@nestjs/schedule@6.1.3` instalado). Lembra reservas
  `APPROVED` do dia com início entre agora e +60min (Manaus UTC-4, mesma
  técnica de deslocamento -4h + `getUTC*`). Idempotência sem migration
  nova (checa `Notification` existente por `reservationId`+`type`) +
  isolamento de falha por reserva. CORS do WebSocket também deixou de ser
  hardcoded (`cors-origins.util.ts`, compartilhado com `main.ts`).

✅ DEPLOY RAILWAY — configurado e primeiro deploy real disparado
(2026-07-29, commits `f7799a5`/`667797e`/`08bf89e`/`0000368`). Três bugs
reais de infra corrigidos nesse processo — ver Bugs históricos #13/#14/#15.

🔶 REDESIGN DA TELA DE LOGIN — em andamento, **NÃO COMMITADO** (working
tree, `apps/reservations/src/pages/Login/index.tsx` modificado +
`apps/reservations/src/assets/` novo, não rastreado). Ver seção LOGIN
(REDESIGN, NÃO COMMITADO) mais abaixo pra detalhe completo.

⏳ PENDENTE PRÉ-DEPLOY REAL:

- Confirmar que o primeiro deploy real (`f7799a5` em diante) completou
  com sucesso no Railway — não validado nesta sessão, checar dashboard
- Trocar senhas das contas de produção (role@senai2026 são de teste)
- Autenticação institucional (SSO/LDAP) — pendência desde ADR-003, não iniciada
- Commitar (ou descartar deliberadamente) o redesign do Login antes que
  vire trabalho perdido — ver seção LOGIN abaixo

---

## REGRAS ABSOLUTAS (nunca violar)

❌ Nunca usar $transaction com pgbouncer para operações longas
❌ Nunca validar conflito de horário só no frontend
❌ Nunca fazer deleteMany({}) sem guard de retorno vazio (Bug histórico do sync)
❌ Nunca usar new Date().toISOString().slice(0,10) para "hoje" (usa todayYmd())
❌ Nunca instalar libs UI (sem Tailwind, sem MUI, sem Chakra)
❌ Nunca colocar regra de negócio no Controller
❌ Nunca commitar sem typecheck + vitest + build verdes
❌ Nunca inventar estrutura sem ler o arquivo fonte primeiro
❌ Nunca usar fontWeight: 700 em DM Sans para números (700 não está carregado)
❌ Nunca mudar requiredRole de rotas filhas em router/config.ts sem checar
o ProtectedRoute do layout PAI da mesma árvore (Bug #16 — o guard do pai
roda primeiro e bloqueia antes das rotas filhas serem avaliadas)

✅ Sempre usar todayYmd() de scheduleDateUtils.ts para data de hoje
✅ Sempre usar pg_advisory_xact_lock em create/update de Reservation
✅ Sempre usar $transaction individual por data em createRange (pgbouncer)
✅ Sempre validar conflito via ConflictService.hasConflict dentro da transaction
✅ Sempre usar spread condicional com exactOptionalPropertyTypes:
...(value !== undefined ? { prop: value } : {})
(atenção: se o valor real for `T | null` em vez de `T | undefined`,
o guard correto é `!== null`, não `!== undefined` — já causou bug real)
✅ Sempre checar watchPatterns do railway.json ao mudar arquivo na raiz do
monorepo que precise disparar rebuild do backend (Bug #14)

---

## BUGS HISTÓRICOS (NUNCA REPETIR)

#1 Supabase free tier pausa após ~5-10min de inatividade
→ Fix: DIRECT_URL (porta 5432) para migrations; retry no smoke test

#2 pgbouncer transaction mode NÃO suporta $transaction interativo longo
→ Fix: operações longas em sequencial sem $transaction (sync em batches 500)
→ createRange usa $transaction individual por data (não uma única pra tudo)

#3 PowerShell Invoke-RestMethod trunca arrays JSON grandes silenciosamente
→ Fix: Invoke-WebRequest + .Content para ver raw JSON

#4 RLS na tabela Schedule bloqueia SELECT mesmo com dados inseridos
→ Fix: CREATE POLICY "schedule_select_all" + GRANT SELECT TO anon, authenticated

#5 window.clear() colide com método nativo do browser
→ Fix: renomear funções customizadas

#6 exactOptionalPropertyTypes: true no tsconfig
→ groupId: undefined é inválido — usar spread condicional

#7 instanceof ApiError falha em módulos mockados pelo Vitest
→ Fix: duck-typing com isApiLike(e)

#8 new Date().toISOString().slice(0,10) calcula UTC — em Manaus (UTC-4)
a partir de ~20h mostra o dia seguinte
→ Fix: sempre usar todayYmd() de scheduleDateUtils.ts
→ Corrigido em: AgendamentosPage, DayView, ScheduleHeader

#9 SyncService.syncSchedules fazia deleteMany({}) incondicional
→ Se Apps Script retornasse vazio, zerava Schedule inteiro
→ Fix: guard dados.length === 0 → aborta antes do delete + Logger.warn

#10 fontWeight: 700 em DM Mono causa bold sintético (borrado)
DM Mono só carregada em 400/500 no Google Fonts
→ Fix: DM Mono removida do projeto inteiro → DM Sans + tabular-nums
→ Cuidado ao reintroduzir peso alto em DM Sans pra números monoespaçados:
DM Sans variable também tem faixa de peso limitada carregada via
Google Fonts (wght@300;400;500;600;700) — 700 EXISTE pra DM Sans,
mas em contexto de números tabulares o padrão do projeto é 500-600
(ver eventTimeStyle em OccupancyUnified.tsx)

#11 ESLint "not found" no CI e pre-commit
Causa raiz: eslint não declarado como devDependency + falta root:true
nos .eslintrc.cjs de apps/api e apps/reservations
→ Fix: eslint como devDep na raiz + root:true nos dois configs

#12 components/ui/_.tsx usando classes Tailwind — projeto nunca teve
Tailwind instalado (renderizava sem nenhum estilo em produção)
→ ConflictAlert.tsx (em uso real em ReservationForm.tsx) reescrito com
tokens do design system (var(--color-_)); StatusBadge.tsx e
LoadingSkeleton.tsx (mesmo padrão, sem nenhum import em uso) deletados
→ Fix geral: sempre grep por className Tailwind quando for tocar
components/ui/ — não existe garantia de que o arquivo já foi migrado

#13 husky prepare quebra pnpm install em produção
`"prepare": "husky"` no package.json raiz falha em produção
(NODE_ENV=production pula devDependencies → binário husky não existe),
derrubando o install inteiro antes mesmo do Prisma generate rodar
→ Fix oficial husky v9 pro cenário: `"prepare": "husky || true"` —
local (husky instalado) continua instalando os git hooks normalmente;
produção absorve a falha sem quebrar o resto do install

#14 Railway watchPatterns auto-detectado ignora mudanças na raiz do monorepo
Sem `watchPatterns` explícito no railway.json, o Railway restringia
rebuild a um path auto-detectado (provavelmente só `apps/api/**`) — um
fix no `package.json` da raiz (Bug #13) foi silenciosamente ignorado:
"no changes detected in watch paths, build will skip"
→ Fix: `watchPatterns` explícito no `build` do railway.json cobrindo
`apps/api/**`, `package.json`, `pnpm-lock.yaml` e o próprio `railway.json`

#15 Nome de serviço Railway com @/ quebra a CLI
Railway nomeou o serviço automaticamente como `@salas-senai/api`
(herdado do escopo npm do package.json) — os caracteres `@` e `/`
quebram `railway up --service <nome>` ("Service not found")
→ Fix: usar o ID do serviço (estável, não muda se o nome mudar) em vez
do nome, em `.github/workflows/cd.yml`

#16 ProtectedRoute do layout pai /admin com requiredRole hardcoded
Fase B (RBAC) mudou `requiredRole` de 4 rotas admin em `router/config.ts`
pra COORDENADOR, mas o `ProtectedRoute` do layout PAI `/admin` em
`router/index.tsx` continuava com `requiredRole='ADMIN'` hardcoded —
bloqueava COORDENADOR antes mesmo de chegar nas rotas filhas, tornando a
mudança de config.ts inteiramente ineficaz na prática
→ Fix: `requiredRole` do pai também muda pra COORDENADOR (hierárquico —
ADMIN continua passando); as 6 rotas ADMIN-only ganham `ProtectedRoute`
individual (`requiredRole='ADMIN'`) direto nos filhos
→ Lição: ao mudar RBAC de rotas aninhadas, checar o guard do layout PAI
também, não só das rotas folha

#17 Status 'conflito' calculado sem checar sobreposição real de horário
`AvailabilityService` marcava uma sala/dia como `'conflito'` sempre que
existia aula E reserva no mesmo dia, mesmo sem sobreposição de horário
nenhuma (ex: aula de manhã + reserva à noite virava "conflito" indevido)
→ Fix: usa `overlaps()` (já existia no arquivo, não usada nesse cálculo)
pra só marcar conflito quando os intervalos realmente se sobrepõem —
precedência final: conflito-real > aula > reserva > livre

---

## CONVENÇÕES CRÍTICAS DE CÓDIGO

### Data/hora (CRÍTICO — Manaus é UTC-4)

```typescript
// ✅ CORRETO — usa componentes locais
import { todayYmd } from '../../components/dashboard/scheduleDateUtils';
const hoje = todayYmd();

// ❌ ERRADO — retorna UTC, não local
const hoje = new Date().toISOString().slice(0, 10);
```

### Datas no banco (Schedule/Reservation)

- date é String YYYY-MM-DD (não DateTime)
- Sync usa T12:00:00Z (UTC noon) pra evitar ambiguidade de fuso
- expandirDatas usa getUTCDate/getUTCDay (não getDate/getDay)

### Conflito de horário (REGRA #1 DO PROJETO)

```typescript
// create() E createRange() obrigatoriamente:
await tx.$executeRaw`
  SELECT pg_advisory_xact_lock(hashtext(${roomId}), hashtext(${date}))
`;
const conflict = await this.conflictService.hasConflict({ roomId, date, inicio, fim }, tx);
if (conflict) throw new NestConflictException('Sala já reservada neste horário.');
```

### createRange — padrão obrigatório (pgbouncer)

- Uma $transaction por data (não uma única pra todo o range)
- Lock + hasConflict DENTRO de cada transaction
- Conflict → skip (Logger.warn), não abort
- room.findUnique fora do loop, antes de começar (valida sala uma vez)

### Propriedades opcionais (exactOptionalPropertyTypes)

```typescript
// ✅ CORRETO — quando o valor é T | undefined
{...(value !== undefined ? { prop: value } : {})}

// ✅ CORRETO — quando o valor é T | null (ex: hooks com data: T | null)
{...(disp.data !== null ? { disponibilidade: disp.data } : {})}

// ❌ ERRADO — atribuir undefined explicitamente à prop
disponibilidade={disp.data ?? undefined}
```

### Tipografia / fonte

- Corpo: DM Sans (carregada em 300/400/500/600/700 via Google Fonts)
- Números tabulares: DM Sans + fontVariantNumeric: 'tabular-nums'
- DM Mono REMOVIDA do projeto inteiro (jul/2026) — causava bold sintético
  borrado em pesos não carregados; index.html não carrega mais DM+Mono

---

## ENDPOINTS DO BACKEND

POST /auth/login @Public (throttle 5/min)
POST /auth/refresh @Public (throttle 5/min)
POST /auth/logout JWT
GET /health @Public
GET /rooms @Public (salas ativas)
GET /rooms/:id @Public
GET /rooms/admin/all ADMIN
POST /rooms ADMIN (com auditoria CREATE_ROOM)
PATCH /rooms/:id ADMIN (com auditoria UPDATE_ROOM)
DELETE /rooms/:id ADMIN (soft delete, auditoria DEACTIVATE_ROOM)
GET /reservations JWT (filtros: roomId, date, status, mine, page, pageSize)
GET /reservations/:id JWT
POST /reservations PROFESSOR | COORDENADOR | ADMIN (valida data passada + conflito + lock;
aceita ownerUserId? opcional — proxy, só COORDENADOR/ADMIN; status inicial PENDING pra
PROFESSOR, APPROVED pra COORDENADOR/ADMIN — ReservationsService.initialStatus(role))
POST /reservations/range PROFESSOR | COORDENADOR | ADMIN (lock+conflito por data, skip em
conflito, max 60 dias, mesmo suporte a ownerUserId? do create())
PATCH /reservations/:id JWT (qualquer role autenticada)
PATCH /reservations/:id/status COORDENADOR|ADMIN (APPROVED|REJECTED)
PATCH /reservations/group/:id JWT (qualquer role autenticada)
PATCH /reservations/selected JWT (qualquer role autenticada)
DELETE /reservations/:id JWT (soft delete via deletedAt, idempotente)
GET /availability @Public (date obrigatório, turno opcional; considera só
reservas APPROVED — PENDING não conta como ocupação, fix pós-F9.9)
GET /schedules @Public → { registros, turnoMap }
GET /dashboard @Public → DashboardResult (contadores SQL)
POST /sync/schedules ADMIN → guard vazio + DELETE + INSERT batch 500
GET /audit COORDENADOR|ADMIN (pós-Fase B, era ADMIN-only; filtros:
entityType, entityId, userId, action, from, to, page, limit)
GET /users COORDENADOR|ADMIN (pós-Fase B, era ADMIN-only; filtros role,
search, isActive, page, limit)
GET /users/professors COORDENADOR|ADMIN (UsersRepository.findAllProfessors() —
usado pelo seletor de proxy no ReservationForm)
PATCH /users/:id/role COORDENADOR|ADMIN (pós-Fase B — gates em
UsersService: COORDENADOR nunca promove a ADMIN, nunca altera alvo ADMIN
ou outro COORDENADOR, ForbiddenException antes de tocar o banco; audita
UPDATE_ROLE, entityType 'User')
PATCH /users/:id/active COORDENADOR|ADMIN (mesmos gates de segurança
acima quando requester é COORDENADOR; audita SET_ACTIVE, entityType 'User')
GET /notifications JWT (Fase C2 — filtro unreadOnly?, sempre req.user.userId)
PATCH /notifications/:id/read JWT (Fase C2 — ForbiddenException se não for o dono)
PATCH /notifications/read-all JWT (Fase C2)
WebSocket /rooms JWT handshake
eventos: reservation.created/updated/approved/rejected/cancelled,
notification.created (Fase C2 — emit direcionado via client.join(userId)
no handshake, server.to(userId).emit(...))

---

## SCHEMA PRISMA (produção — apps/api/prisma/schema.prisma)

User id, name, email, passwordHash, role, active, deletedAt
Room id, name, type, capacity, floor, available
↳ auditado em create/update/softDelete via AuditService
Reservation id, userId, roomId, groupId, date(string), inicio, fim,
status, turma, notes, clientRequestId, deletedAt,
createdByUserId (Fase C1 — String? opcional; só difere de userId em
reserva por proxy; relação nomeada "ReservationCreatedBy" pra User)
@@index([roomId, date])
@@index([userId])
@@index([status])
@@index([groupId])
@@index([date, status]) ← F9.6
AuditLog id, action, entityType, entityId, userId, before, after,
ip, timestamp
@@index([entityType, entityId])
@@index([userId])
entityType usado hoje: 'Reservation' | 'Room' | 'Schedule' | 'User'
(UsersService audita direto via prisma.auditLog, não via
AuditService — não passa pelo generalizado do F9.9)
RefreshToken id, userId, tokenHash, expiresAt, revokedAt
Schedule id, date, sala, turma, mes, turno, inicio, fim (sem FK para Room)
Notification id, userId, reservationId?, type, title, body, read,
createdAt (Fase C1 schema + Fase C2 lógica) — relações pra User e
Reservation (opcional); @@index([userId, read]), @@index([userId, createdAt])
Migration aplicada em produção (Supabase sa-east-1) em 2026-07-27.

enum Role: PROFESSOR | COORDENADOR | ADMIN
enum RoomType: SALA_COMUM | LAB_GERAL | LAB_INFORMATICA |
LAB_CLP | LAB_ELETRICA | LAB_SMT | LAB_ELETRONICA
enum ReservationStatus: PENDING | APPROVED | REJECTED | CANCELLED
enum NotificationType: RESERVATION_PENDING | RESERVATION_CONFIRMED |
RESERVATION_REJECTED | RESERVATION_CANCELLED | RESERVATION_RESCHEDULED |
RESERVATION_REMINDER (Fase C1 schema — RESERVATION_REMINDER só ganhou
uso real na Fase C3, via cron)

---

## MÓDULOS DO BACKEND (app.module.ts)

ConfigModule, PrismaModule, AuthModule, UsersModule, HealthModule,
RoomsModule, ReservationsModule, AvailabilityModule, AuditModule,
RealtimeModule, SyncModule, SchedulesModule, DashboardModule,
NotificationsModule (Fase C2 — notify/notifyMany/findForUser/markRead/
markAllRead, importado por ReservationsModule),
ScheduleModule (@nestjs/schedule — cron), LoggerModule (nestjs-pino),
ThrottlerModule (@nestjs/throttler)

ReservationReminderService (Fase C3) NÃO é módulo — é provider dentro de
ReservationsModule (reservations/reservation-reminder.service.ts),
auto-registrado via @Cron por ser provider do módulo.

Ordem de import em app.module.ts importa de verdade: ConfigModule é o
PRIMEIRO import (antes de RealtimeModule) — é isso que garante
CORS_ORIGIN já populado quando o decorator @WebSocketGateway avalia
(ver cors-origins.util.ts, Fase C3). Fragilidade documentada, não bug
ativo hoje.

Guards (ordem obrigatória): ThrottlerGuard → JwtAuthGuard → RolesGuard

---

## AUDITSERVICE (generalizado — F9.9)

```typescript
// entityType é opcional — default 'Reservation' preserva os 5 call sites
// de reservations.service.ts sem nenhuma mudança
this.auditService.log(tx, {
  action: 'CREATE_ROOM', // ou UPDATE_ROOM, DEACTIVATE_ROOM
  entityType: 'Room', // omitir = 'Reservation'
  entityId: room.id,
  userId: currentUserId,
  after: room,
});
```

Nota: SyncService ('Schedule') e UsersService ('User') auditam direto
via `this.prisma.auditLog.create(...)`, sem passar pelo AuditService
generalizado acima — três caminhos de escrita de auditoria coexistem hoje.

---

## FRONTEND — ARQUIVOS-CHAVE

apps/reservations/src/
services/
apiTypes.ts ← tipos da API (fonte única pós-F9.7)
nestjsApiService.ts ← cliente NestJS (sem fallback Apps Script)
apiClient.ts ← apiFetch<T> + refreshLock + ApiError
socketClient.ts ← getSocket/disconnectSocket

hooks/
useAvailabilityBackend.ts ← GET /availability (fonte de dados principal)
useDashboardStats.ts ← GET /dashboard (contadores SQL)
useListReservations.ts
useCreateReservation.ts
useCreateReservationRange.ts
useCancelReservation.ts
useApproveReservation.ts
useRejectReservation.ts
useSchedule.ts ← GET /schedules (usado apenas em /admin/sync)
useAvailability.ts ← Forma B, local/derivado (Schedule+reservas) — ainda
usado em Reservas/index.tsx, não removido na unificação da Dashboard
useRealtimeSocket.ts
useMyReservations.ts ← GET /reservations?mine=true (Minha Agenda);
MyReservation ganhou createdByUserId?/createdBy? (Fase C1)
useListProfessors.ts ← GET /users/professors (seletor de proxy)
useNotifications.ts ← Fase C2 — GET /notifications + markRead/markAllRead
otimistas + subscrição WS (notification.created) via socketClient

pages/
Dashboard/index.tsx ← unificado via GET /availability + navegação de
data (ScheduleHeader) + busca (turma/sala/turno) + toggle Tabela/Linha
do tempo (OccupancyUnified ↔ DayView, via mapToEntries)
Agendamentos/index.tsx ← arquivo mantido, mas SEM ROTA — /agendamentos
saiu de router/index.tsx e router/config.ts (pós-F9.9)
Reservas/index.tsx ← ReservationForm com seletor de professor (proxy,
só renderiza pra COORDENADOR/ADMIN)
MinhaAgenda/index.tsx ← rota /minha-agenda, useMyReservations; badge
"via {nome}" (proxyBadgeLabel(), função pura exportada) quando a reserva
veio de proxy (createdByUserId !== userId), Fase C1
Perfil/index.tsx ← ganhou botão "Ver Minha Agenda" (Fase C1)
Login/index.tsx ← ver seção LOGIN (REDESIGN, NÃO COMMITADO) abaixo
Aprovacoes/index.tsx
Admin/Sync/index.tsx ← tabela histórica de Schedule (useSchedule +
applyScheduleFilters + OccupancyDashboard) + botão de sync
Admin/[outras]/ ← páginas admin funcionais

components/
dashboard/
OccupancyUnified.tsx ← tabela unificada Schedule+Reservation do dia
(chips de evento; sortSalas/getViewState exportados e testados; chip de
reserva agora mostra turma quando presente, Fase A)
OccupancyDashboard.tsx ← tabela histórica antiga, migrou de consumidor
(Dashboard → Admin/Sync), NÃO deletada
applyScheduleFilters.ts ← função pura, usada só por Admin/Sync agora
DashboardStats.tsx ← cards de resumo (fonte: disponibilidade + dashboardStats,
não usa mais RegistroLegado/filtered desde a unificação)
scheduleDateUtils.ts ← todayYmd(), ymdToUtcDate(), formatDataBR()
mapToEntries.ts ← extraído de Agendamentos/index.tsx, compartilhado com
Dashboard (toggle Linha do tempo) — DisponibilidadeSala[] → SidebarEntry[]
calendar/
ScheduleHeader.tsx ← navegação de data reutilizável (Dashboard + Agendamentos),
prop title? opcional (default 'Agendamentos')
ScheduleFilters.tsx ← filtros turma/tipo/turno (usado em Agendamentos)
ScheduleSidebar.tsx ← lista de salas com eventos
DayView.tsx ← grade de horas com blocos posicionados; agora também usado
pelo Dashboard (não só Agendamentos)
AvailabilityCards.tsx ← cards livres/ocupadas/pendentes
ui/
ConflictAlert.tsx ← reescrito pós-F9.9 (era Tailwind sem efeito, ver Bug #12);
usado em ReservationForm.tsx
NotificationBell.tsx ← Fase C2 — sino na topbar (badge --color-accent,
dropdown glass, receita de 3 partes igual ao popover FullCalendar);
exporta formatRelativeTime() (usa getUTCDate/getUTCMonth — Bug #8)
reservations/
ReservationCalendar.tsx ← wrapper do FullCalendar; dayMaxEvents ligado +
popover "+N mais" restilizado com tokens glass (global.css)

layouts/
AppLayout.tsx ← shell (sidebar+topbar); dono da notificação efêmera de
sidebar pós-F9.9 (useRealtimeSocket + notifyPath, dot pulsante — ver
PÓS-F9.9 acima). Não persiste entre sessões (sem campo no schema hoje
pra diferenciar quem criou de quem é o dono). Desde a Fase C2 também
renderiza <NotificationBell/> na topbar (as duas notificações coexistem)
e desde a Fase B filtra a sidebar por role via hasRole() (ProtectedRoute).

store/
authStore.ts ← Zustand — selectUser, selectAccessToken, clearAuth
tokenStorage.ts ← localStorage swappable

services/
socketClient.ts ← Fase C2 ganhou um mini-emitter paralelo pra
notification.created (subscribeToNotificationEvents), sem alterar o
emitter de eventos de reserva já existente

router/
config.ts ← ROUTES[] — seções: principal/gestao/admin (sistema ficou
vazia após remover /salas /turmas /relatorios /configuracoes; /agendamentos
saiu também pós-F9.9, mesmo padrão). Fase B: requiredRole de
/admin, /admin/usuarios, /admin/permissoes, /admin/auditoria mudou de
ADMIN pra COORDENADOR; as outras 6 rotas admin continuam ADMIN-only.
index.tsx ← createBrowserRouter com basename BASE_URL. O ProtectedRoute
do layout PAI /admin também precisou virar requiredRole='COORDENADOR'
(Bug #16) — as 6 rotas ADMIN-only ganharam ProtectedRoute individual
direto nos filhos (/admin/sync, /sistema, /configuracoes, /logs, /api,
/health); as 4 abertas pro COORDENADOR ficam sem guard próprio.
ProtectedRoute.tsx ← exporta ROLE_HIERARCHY e hasRole() desde a Fase B
(reusado por AppLayout.tsx pra filtrar a sidebar)
PageTransition.tsx
RouteLoader.tsx

styles/
global.css ← design system completo (tokens + liquid glass)
NOTA: DM Mono REMOVIDA — usar DM Sans + fontVariantNumeric:tabular-nums

---

## DESIGN SYSTEM

### Fonte primária agora é apps/reservations/DESIGN.md (+ .impeccable/design.json)

Gerado via skill Impeccable (`/impeccable document`) direto do global.css real.
North Star: "The Liquid Glass Deck". O bloco abaixo é um resumo — em caso de
dúvida ou divergência, DESIGN.md manda, não este resumo (mesma regra anti-
invenção do resto do projeto). Named Rules documentadas lá: The Rare Ember
Rule (laranja nunca preenche área grande), The Status-Only Color Rule,
The Tabular Numbers Rule, The One Voice Rule, The Sheen-Always Rule,
The Two-Blur Rule.

### CORREÇÃO — a versão anterior desta seção estava errada

`--glass-strong` e `--glass-soft-bg` (gradientes) **não existem** em
global.css — nunca existiram. `--sidebar-bg` é um rgba chapado
(`rgba(15, 36, 64, 0.82)`), não um gradiente diagonal. Isso ficou errado
aqui por pelo menos um round de atualização sem ser pego. Valores reais
abaixo, confirmados lendo o arquivo (não copiados de versão anterior
deste MEMORY.md):

```css
--color-brand:
  #1e3a5f /* navy SENAI ("SENAI Ink" no DESIGN.md) */ --color-brand-2: #2a4f80
    /* stop mais claro, só no gradiente da sidebar */ --color-accent: #e07c2b
    /* laranja ("SENAI Ember") — uso raro, nunca fundo grande */ --color-accent-l: #fef0e4
    /* claro; dark: rgba(224,124,43,.15) */ --color-bg: #f4f5f7
    /* base sólida atrás do mesh gradient do body; dark: #0d1117 */
    --color-surface: rgba(255, 255, 255, 0.7) /* dark: rgba(22,27,34,.62) */
    --color-surface-2: rgba(255, 255, 255, 0.48) /* dark: rgba(28,33,40,.5) */
    --color-border: rgba(17, 24, 39, 0.08) /* dark: rgba(255,255,255,.08) */
    --color-border-2: rgba(17, 24, 39, 0.16) /* dark: rgba(255,255,255,.14) */ --color-text: #111827
    --color-muted: #6b7280 --color-subtle: #9ca3af /* dark: #e6edf3/#8b949e/#6e7681 */
    --color-green: #16a34a / -l: #dcfce7 --color-amber: #b45309 / -l: #fef3c7 --color-red: #dc2626 /
    -l: #fee2e2 --color-blue: #2563eb / -l: #dbeafe --sidebar-bg: rgba(15, 36, 64, 0.82)
    /* rgba chapado, NÃO gradiente */ --radius: 12px --radius-s: 8px
    /* + 20px "pill" pra badges, não tokenizado */ --shadow-s: 0 1px 2px rgba(17, 24, 39, 0.04),
  0 2px 10px rgba(17, 24, 39, 0.05) --shadow-m: 0 4px 18px rgba(17, 24, 39, 0.08),
  0 14px 36px rgba(17, 24, 39, 0.06) /* overlays flutuantes */ --glass-blur-s: 22px
    /* cards/popovers */ --glass-blur-l: 38px /* só sidebar — só esses 2 valores existem */
    --glass-sheen: inset 0 1px 0 rgba(255, 255, 255, 0.5) /* dark: rgba(255,255,255,.08) */
    --ease: cubic-bezier(0.4, 0, 0.2, 1) --dur: 180ms;
```

### Liquid glass — receita real (3 partes, sempre junto)

```css
background: var(--color-surface); /* ou -2, elemento aninhado */
backdrop-filter: blur(var(--glass-blur-s)) saturate(140-150%);
box-shadow: var(--shadow-s), var(--glass-sheen); /* --shadow-m em overlay flutuante */
```

- Aplicada em: .topbar, .avail-card, .calendar-placeholder, .fc-popover
  (FullCalendar, pós-F9.9), cards genéricos — todos com essa receita idêntica,
  não um token único de "glass forte"
- .sidebar: `background: var(--sidebar-bg)` (rgba chapado) + blur 38px
  (o mais pronunciado) + saturate(165%) + `box-shadow: var(--glass-sheen)`
- .slot-item: `background: var(--color-surface-2)` + `backdrop-filter: blur(8px)`
  (elemento secundário/aninhado — blur menor, fora do padrão de 2 valores)
- body: gradiente mesh radial em 2 camadas (navy + accent, opacidade do
  accent reduzida à metade) — só navy+accent, nunca cor semântica no mesh
- Dark mode: mesmos tokens com rgba escuros; --sidebar-bg NÃO é sobrescrito
  no dark (sidebar é intencionalmente theme-invariant)
- `:focus-visible` global (pós-F9.9): outline 2px var(--color-blue) !important
  (precisa !important pra vencer outline:'none' inline nos inputStyle/buttonStyle)

### LOGIN (redesign, NÃO COMMITADO — working tree)

`apps/reservations/src/pages/Login/index.tsx` está modificado no working
tree (não em nenhum commit) e `apps/reservations/src/assets/` é diretório
novo, não rastreado pelo git. Ninguém commitou isso ainda — próxima sessão
precisa decidir: commitar ou descartar deliberadamente (não é lixo, é
trabalho reto de duas iterações desta sessão).

Duas iterações no mesmo arquivo, nesta ordem:

1. **Liquid glass single-column** — trocou fundo chapado (`var(--color-bg)`)
   por herdar o mesh gradient do body, card ganhou a receita de vidro de
   3 partes, título saiu de Georgia/serif pra DM Sans, erro saiu de hex
   hardcoded (`#fecaca`/`#dc2626`) pra tokens (`--color-red`/`--color-red-l`).
   Barra de 3px em `--color-accent` no topo do card (uso permitido pela
   Rare Ember Rule).
2. **Layout split** (substituiu a versão single-column) — painel visual
   à esquerda (`flex: 0 0 54%`, foto de laboratório de informática +
   overlay navy + `backdrop-filter: blur(--glass-blur-s)`) com "SENAI"
   grande (64px/700, fora da rampa tipográfica documentada — papel novo
   "hero display" desta tela) + "Controle de Salas", formulário à
   direita (`flex: 1 1 46%`, card de vidro, sem duplicar a marca em
   desktop). Abaixo de 768px o painel visual some por completo, form
   volta a ocupar a tela inteira (mesmo padrão de antes). `<h1>`/ícone do
   card continuam sempre no DOM (nunca `display:none`) — só visualmente
   ocultos em desktop via clip 1×1px, reaparecem em mobile (heading real
   acessível por leitor de tela nas duas larguras).
   - Depois enlarged a pedido explícito ("formulário muito pequeno"):
     card 460px→540px, padding 40/32/32→48/44/44, input 34px/12px→48px/15px,
     botão 40px/14px→50px/16px — exceção pontual só deste card; os tokens
     documentados de `input-search`/`button-secondary` (34px/12px) no
     DESIGN.md **não mudaram** pro resto do sistema.

**Imagem nova**: `apps/reservations/src/assets/images/login-lab.jpg` —
primeira imagem estática do projeto (não existia `src/assets/` nem
imagem nenhuma em `public/` antes disso; convenção nova, criada nesta
sessão). Foto de laboratório de informática, Pexels License (uso
comercial livre, sem atribuição obrigatória) — baixada de
`pexels.com/photo/18471488/` (foto de Delot), nunca hotlink, redimensionada
localmente com Pillow pra 1600×1200 JPEG progressivo (~158KB, era 3.1MB
no original). Importada via ES module (`import loginBg from
'../../assets/images/login-lab.jpg'`), não via `public/`.

---

## SITEMAP ATUAL

PRINCIPAL (todos)
/ Dashboard (unificado — Schedule+Reservation via /availability + filtros +
toggle Tabela/Linha do tempo, pós-F9.9)
/reservas PROFESSOR+ (seletor de proxy pra COORDENADOR/ADMIN, pós-F9.9)

AUTENTICADO (qualquer role)
/minha-agenda Minha Agenda (pós-F9.9 — GET /reservations?mine=true)

GESTÃO (COORDENADOR+)
/aprovacoes COORDENADOR+

ADMIN — 4 rotas abertas pro COORDENADOR desde a Fase B, 6 continuam ADMIN only
/admin Dashboard admin (COORDENADOR+, Fase B)
/admin/usuarios Usuários (COORDENADOR+, Fase B)
/admin/permissoes Permissões (COORDENADOR+, Fase B)
/admin/auditoria Auditoria (COORDENADOR+, Fase B)
/admin/sync Sincronização + tabela histórica de Schedule (ADMIN only)
/admin/sistema Sistema (ADMIN only)
/admin/configuracoes Configurações (ADMIN only)
/admin/logs Logs (ADMIN only)
/admin/api API (ADMIN only)
/admin/health Health (ADMIN only)

REMOVIDOS DA NAVEGAÇÃO (arquivos mantidos, rotas removidas):
/salas, /turmas, /relatorios, /configuracoes (stubs fase 4/5)
/agendamentos (pós-F9.9 — dessa vez rota removida de verdade, não só
escondida do menu; arquivo Agendamentos/index.tsx continua existindo)

---

## CONTAGEM DE TESTES (última verificação conhecida — não re-rodado

## nesta sessão, checar antes de confiar cegamente)

Frontend (apps/reservations): 296 testes (30 suites) — contagem anterior a
pós-F9.9; ganhou testes novos (availability where-clause, users repository/
service) mas não foi re-somado, não inventar total novo aqui
Backend (apps/api): 57 testes (5 suites) — idem, mais testes de
reservations.service.spec.ts (auto-aprovação/proxy) desde então
E2E (Playwright): 23 passando, 9 skip (legado) — mais recente que isso:
tests/e2e/proxy-and-approval.spec.ts (4 testes novos, cobrindo auto-
aprovação por role, proxy de professor, bug fix de PENDING em
/availability) + 1 teste novo em navigation.spec.ts (/minha-agenda pra
PROFESSOR). setupCoordenadorSession adicionado em helpers/auth.ts.

Leva de pré-produção (Fases A-C3, commits `5650f79`..`700c72e`) adicionou
mais arquivos de teste, nenhum re-somado ainda — não inventar total:

- `apps/api/src/modules/availability/__tests__/availability.service.spec.ts` (novo)
- `apps/api/src/modules/notifications/__tests__/notifications.service.spec.ts` (novo)
- `apps/api/src/common/__tests__/cors-origins.util.spec.ts` (novo)
- `apps/api/src/modules/reservations/__tests__/reservation-reminder.service.spec.ts` (novo)
- `apps/reservations/src/pages/MinhaAgenda/__tests__/index.test.ts` (novo)
- `apps/reservations/src/components/ui/__tests__/NotificationBell.test.ts` (novo)
- `reservations.service.spec.ts`, `users.service.spec.ts`, `router.test.ts`
  expandidos (não novos, ganharam casos)
  Total exato não confirmado nesta sessão — rodar antes de confiar.
  NOTA: o projeto NÃO usa @testing-library/react em lugar nenhum — todos
  os testes de componente React cobrem funções puras extraídas
  (sortSalas, getViewState, filterSalas, applyScheduleFilters), nunca
  renderizam JSX. Ao pedir testes novos pra um componente, extrair a
  lógica pura em vez de tentar montar/renderizar.

---

## CI/CD

### CI (.github/workflows/ci.yml)

Job validate: typecheck frontend → prisma generate → build backend →
lint frontend+backend → unit tests → build frontend
Job e2e: prisma migrate deploy → start backend → wait-on /health →
playwright (THROTTLE_SKIP=true pra evitar 429 no polling)
Node 22, branch master, secrets: DATABASE_URL, DIRECT_URL,
JWT_SECRET, JWT_REFRESH_SECRET, APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN

### CD (.github/workflows/cd.yml)

Trigger: workflow_run do CI com conclusion=success
Job deploy-backend: Railway via RAILWAY_TOKEN — **configurado**, secrets
criados, primeiro deploy real disparado em 2026-07-29 (`f7799a5`). Não
validado nesta sessão se o deploy completou com sucesso — checar
dashboard do Railway antes de assumir.
`railway up --service <ID>` (não o nome — ver Bug #15), watchPatterns
explícito no railway.json cobrindo apps/api/\*\* + package.json +
pnpm-lock.yaml + o próprio railway.json (ver Bug #14)
Job deploy-frontend: gh-pages via VITE_API_URL_PROD — secret criado,
não validado nesta sessão se o deploy do frontend já rodou de fato
package.json raiz: `"prepare": "husky || true"` (ver Bug #13) — sem
isso o `pnpm install` em produção quebrava antes do Prisma generate rodar

---

## AUTOMAÇÃO CLAUDE CODE (.claude/, pós-F9.9)

hooks/block-env-edit.mjs ← PreToolUse (Edit|Write), exit code 2: bloqueia
edição de .env/.env.\* (exceto .env.example). Testado — recusa mesmo
pedido inofensivo de adicionar uma linha.
hooks/lint-after-edit.mjs ← PostToolUse (Edit|Write), sempre exit 0: roda
`eslint --fix` em todo .ts/.tsx tocado, loga em .claude/hooks/lint-log.txt
(fora do versionamento), só imprime stdout se achar problema.
settings.json ← registra os dois hooks acima.
skills/controle-salas-senai/ ← skill do projeto (regras deste MEMORY.md +
anti-invenção + bugs históricos, carregada no início de qualquer trabalho).
Recomendado pelo plugin claude-code-setup (Anthropic) após análise do
projeto — não confundir com config pessoal do usuário (MCP servers como
Supabase/context7/obsidian são do ambiente Claude Code, não do projeto,
não documentados aqui).

---

## PADRÕES OBRIGATÓRIOS

### Anti-invenção (regra #1)

SEMPRE ler arquivos-fonte antes de propor código.
NUNCA inventar estrutura, interfaces, tipos ou imports.
Múltiplas sessões já pegaram valores assumidos errados (sidebar rgba,
índice do Reservation, entityType do AuditLog, e — pós-F9.9 — a própria
seção DESIGN SYSTEM deste MEMORY.md, que documentava `--glass-strong`/
`--glass-soft-bg` como se existissem e `--sidebar-bg` como gradiente,
quando o global.css real nunca teve isso) — sempre que uma instrução
(ou este próprio arquivo) descrever um valor "atual" sem eu ter acabado
de ler o arquivo fonte, ler antes de aplicar, não confiar na descrição —
nem na deste MEMORY.md.

### Instanciação do service (F9.7 — sem fallback Apps Script)

```typescript
// ✅ CORRETO desde F9.7
const service = useMemo(() => createNestjsApiService(), []);

// ❌ ERRADO — createAppsScriptService removido do frontend
const service = useMemo(() => {
  const appsScript = createAppsScriptService(...);
  return createNestjsApiService(appsScript);
}, []);
```

### Validação após cada sprint

```powershell
pnpm --filter @salas-senai/reservations typecheck
pnpm --filter @salas-senai/reservations exec vitest run --reporter=dot --no-coverage
pnpm --filter @salas-senai/reservations lint
pnpm --filter @salas-senai/reservations build
pnpm --filter @salas-senai/api build
pnpm --filter @salas-senai/api lint
pnpm --filter @salas-senai/api test:unit
```

### Commits (Conventional Commits, branch master)

feat(scope): descrição em minúsculo
fix(scope): descrição
refactor(scope): descrição
docs(scope): descrição
chore(scope): descrição
style(scope): descrição

---

## COMANDOS DE EMERGÊNCIA

```powershell
# Acordar Supabase (Bug #1)
cd C:\dev\monorepo\apps\api
pnpm exec prisma migrate deploy   # usa DIRECT_URL no .env

# Sync manual de aulas
$auth = Invoke-RestMethod "http://localhost:3000/auth/login" `
  -Method Post -ContentType "application/json" `
  -Body '{"email":"admin@senai.edu","password":"admin@senai2026"}'
Invoke-RestMethod "http://localhost:3000/sync/schedules" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $($auth.accessToken)" } `
  -TimeoutSec 60

# Restaurar arquivo corrompido
git checkout apps/reservations/src/caminho/arquivo.ts

# Ver disponibilidade de hoje
$hoje = (Get-Date).ToString("yyyy-MM-dd")
$result = Invoke-RestMethod "http://localhost:3000/availability?date=$hoje"
$result.salas | Where-Object { $_.eventos.Count -gt 0 }
```
