# MEMORY.md — Controle de Salas SENAI

# Cérebro persistente do projeto — leia ANTES de qualquer tarefa

# Atualizado: 2026-07-22 | Fase atual: F9.9 completo — pré-deploy produção

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

⏳ PENDENTE PRÉ-DEPLOY REAL:

- Criar conta/projeto Railway + configurar env vars
- Adicionar RAILWAY_TOKEN e VITE_API_URL_PROD nos secrets GitHub
- Trocar senhas das contas de produção (role@senai2026 são de teste)
- Testar railway up manualmente antes de confiar no CD automático
- Autenticação institucional (SSO/LDAP) — pendência desde ADR-003, não iniciada

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

✅ Sempre usar todayYmd() de scheduleDateUtils.ts para data de hoje
✅ Sempre usar pg_advisory_xact_lock em create/update de Reservation
✅ Sempre usar $transaction individual por data em createRange (pgbouncer)
✅ Sempre validar conflito via ConflictService.hasConflict dentro da transaction
✅ Sempre usar spread condicional com exactOptionalPropertyTypes:
...(value !== undefined ? { prop: value } : {})
(atenção: se o valor real for `T | null` em vez de `T | undefined`,
o guard correto é `!== null`, não `!== undefined` — já causou bug real)

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
POST /reservations PROFESSOR | COORDENADOR | ADMIN (valida data passada + conflito + lock)
POST /reservations/range PROFESSOR | COORDENADOR | ADMIN (lock+conflito por data, skip em conflito, max 60 dias)
PATCH /reservations/:id JWT (qualquer role autenticada)
PATCH /reservations/:id/status COORDENADOR|ADMIN (APPROVED|REJECTED)
PATCH /reservations/group/:id JWT (qualquer role autenticada)
PATCH /reservations/selected JWT (qualquer role autenticada)
DELETE /reservations/:id JWT (soft delete via deletedAt, idempotente)
GET /availability @Public (date obrigatório, turno opcional)
GET /schedules @Public → { registros, turnoMap }
GET /dashboard @Public → DashboardResult (contadores SQL)
POST /sync/schedules ADMIN → guard vazio + DELETE + INSERT batch 500
GET /audit ADMIN (filtros: entityType, entityId, userId, action, from, to, page, limit)
GET /users ADMIN (filtros role, search, isActive, page, limit)
PATCH /users/:id/role ADMIN (audita UPDATE_ROLE, entityType 'User')
PATCH /users/:id/active ADMIN (audita SET_ACTIVE, entityType 'User')
WebSocket /rooms JWT handshake
eventos: reservation.created/updated/approved/rejected/cancelled

---

## SCHEMA PRISMA (produção — apps/api/prisma/schema.prisma)

User id, name, email, passwordHash, role, active, deletedAt
Room id, name, type, capacity, floor, available
↳ auditado em create/update/softDelete via AuditService
Reservation id, userId, roomId, groupId, date(string), inicio, fim,
status, turma, notes, clientRequestId, deletedAt
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

enum Role: PROFESSOR | COORDENADOR | ADMIN
enum RoomType: SALA_COMUM | LAB_GERAL | LAB_INFORMATICA |
LAB_CLP | LAB_ELETRICA | LAB_SMT | LAB_ELETRONICA
enum ReservationStatus: PENDING | APPROVED | REJECTED | CANCELLED

---

## MÓDULOS DO BACKEND (app.module.ts)

ConfigModule, PrismaModule, AuthModule, UsersModule, HealthModule,
RoomsModule, ReservationsModule, AvailabilityModule, AuditModule,
RealtimeModule, SyncModule, SchedulesModule, DashboardModule,
ScheduleModule (@nestjs/schedule — cron), LoggerModule (nestjs-pino),
ThrottlerModule (@nestjs/throttler)

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

pages/
Dashboard/index.tsx ← unificado via GET /availability + navegação de
data (ScheduleHeader) + busca (turma/sala/turno)
Agendamentos/index.tsx ← dados reais + mapToEntries + filtros
Reservas/index.tsx
Aprovacoes/index.tsx
Admin/Sync/index.tsx ← tabela histórica de Schedule (useSchedule +
applyScheduleFilters + OccupancyDashboard) + botão de sync
Admin/[outras]/ ← páginas admin funcionais

components/
dashboard/
OccupancyUnified.tsx ← tabela unificada Schedule+Reservation do dia
(chips de evento; sortSalas/getViewState exportados e testados)
OccupancyDashboard.tsx ← tabela histórica antiga, migrou de consumidor
(Dashboard → Admin/Sync), NÃO deletada
applyScheduleFilters.ts ← função pura, usada só por Admin/Sync agora
DashboardStats.tsx ← cards de resumo (fonte: disponibilidade + dashboardStats,
não usa mais RegistroLegado/filtered desde a unificação)
scheduleDateUtils.ts ← todayYmd(), ymdToUtcDate(), formatDataBR()
calendar/
ScheduleHeader.tsx ← navegação de data reutilizável (Dashboard + Agendamentos),
prop title? opcional (default 'Agendamentos')
ScheduleFilters.tsx ← filtros turma/tipo/turno (usado em Agendamentos)
ScheduleSidebar.tsx ← lista de salas com eventos
DayView.tsx ← grade de horas com blocos posicionados
AvailabilityCards.tsx ← cards livres/ocupadas/pendentes

store/
authStore.ts ← Zustand — selectUser, selectAccessToken, clearAuth
tokenStorage.ts ← localStorage swappable

router/
config.ts ← ROUTES[] — seções: principal/gestao/admin (sistema ficou
vazia após remover /salas /turmas /relatorios /configuracoes)
index.tsx ← createBrowserRouter com basename BASE_URL
PageTransition.tsx
RouteLoader.tsx

styles/
global.css ← design system completo (tokens + liquid glass)
NOTA: DM Mono REMOVIDA — usar DM Sans + fontVariantNumeric:tabular-nums

---

## DESIGN SYSTEM

### Tokens principais (valores reais em global.css — conferir antes de

### assumir, esta seção já passou por 3 rounds de ajuste "liquid glass"

### nesta fase e valores antigos ficam obsoletos rápido)

```css
--color-brand: #1e3a5f /* navy SENAI — nunca mudou */ --color-accent: #e07c2b
  /* laranja SENAI — nunca mudou */ --color-bg: #f4f5f7 /* base sólida; o gradiente mesh
                                                       é uma CAMADA no body, não troca
                                                       o valor deste token */ --color-surface: rgba(
    255,
    255,
    255,
    0.7
  )
  --color-surface-2: rgba(255, 255, 255, 0.48) --color-border: rgba(17, 24, 39, 0.08)
  /* tint = hex de --color-text */ --color-border-2: rgba(17, 24, 39, 0.16) --color-text: #111827
  --color-muted: #6b7280 --color-subtle: #9ca3af --color-green: #16a34a / --color-green-l: #dcfce7
  --color-amber: #b45309 / --color-amber-l: #fef3c7 --color-red: #dc2626 / --color-red-l: #fee2e2
  --color-blue: #2563eb / --color-blue-l: #dbeafe
  --sidebar-bg: linear-gradient(135deg, rgba(10, 26, 48, 0.85), rgba(20, 46, 74, 0.79))
  --radius: 12px --radius-s: 8px --glass-blur-s: 22px
  /* usado via backdrop-filter: blur(var(--glass-blur-s)) */ --glass-blur-l: 38px
  /* sidebar — o mais pronunciado */ --glass-sheen: inset 0 1px 0 rgba(255, 255, 255, 0.5)
  /* dark: rgba(255,255,255,.08) */
  --glass-strong: linear-gradient(135deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.65))
  --glass-soft-bg: linear-gradient(135deg, rgba(255, 255, 255, 0.55), rgba(255, 255, 255, 0.35));
```

### Liquid glass (aplicado em global.css — 3 rounds nesta fase)

- body: gradiente mesh radial em 2 camadas (navy dominante + accent
  discreto, opacidade do accent reduzida à metade no round mais recente
  — só navy+accent, NUNCA cores semânticas no mesh)
- .sidebar: `background: var(--sidebar-bg)` (gradiente diagonal navy
  2 camadas, não rgba chapada) + `backdrop-filter: blur(var(--glass-blur-l)) saturate(165%)`
  - `box-shadow: var(--glass-sheen)` — o glass mais pronunciado do sistema
- .topbar, .avail-card, .calendar-placeholder: `background: var(--glass-strong)`
  - backdrop-filter blur(var(--glass-blur-s)) saturate(140-150%) + glass-sheen
- .slot-item: `background: var(--glass-soft-bg)` (elemento secundário/aninhado)
- Dark mode: mesmos tokens com rgba escuros; --sidebar-bg NÃO é sobrescrito
  no dark (sidebar é intencionalmente theme-invariant)

---

## SITEMAP ATUAL

PRINCIPAL (todos)
/ Dashboard (unificado — Schedule+Reservation via /availability + filtros)
/agendamentos Agendamentos (dados reais + DayView)
/reservas PROFESSOR+

GESTÃO (COORDENADOR+)
/aprovacoes COORDENADOR+

ADMIN (ADMIN only)
/admin Dashboard admin
/admin/usuarios Usuários
/admin/permissoes Permissões
/admin/auditoria Auditoria
/admin/sync Sincronização + tabela histórica de Schedule
/admin/sistema Sistema
/admin/configuracoes Configurações
/admin/logs Logs
/admin/api API
/admin/health Health

REMOVIDOS DA NAVEGAÇÃO (arquivos mantidos, rotas removidas):
/salas, /turmas, /relatorios, /configuracoes (stubs fase 4/5)

---

## CONTAGEM DE TESTES (última verificação conhecida — não re-rodado

## nesta sessão, checar antes de confiar cegamente)

Frontend (apps/reservations): 296 testes (30 suites)
Backend (apps/api): 57 testes (5 suites)
E2E (Playwright): 23 passando, 9 skip (legado)
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
Job deploy-backend: Railway via RAILWAY_TOKEN ← AINDA NÃO CRIADO
Job deploy-frontend: gh-pages via VITE_API_URL_PROD ← AINDA NÃO CRIADO

---

## PADRÕES OBRIGATÓRIOS

### Anti-invenção (regra #1)

SEMPRE ler arquivos-fonte antes de propor código.
NUNCA inventar estrutura, interfaces, tipos ou imports.
Esta sessão já pegou valores assumidos errados em pelo menos 3 missões
(sidebar rgba, índice do Reservation, entityType do AuditLog) — sempre
que uma instrução descrever um valor "atual" sem eu ter acabado de ler
o arquivo, ler antes de aplicar, não confiar na descrição.

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
