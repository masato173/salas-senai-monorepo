# CLAUDE.md — Controle de Salas SENAI

## O que é

Sistema institucional de gestão e agendamento de salas do SENAI (Manaus).
**Está EM PRODUÇÃO e EM USO REAL.** Não recriar do zero.

Plataforma SaaS de gestão de salas, reservas, calendário, disponibilidade,
auditoria, aprovação e administração — evoluída incrementalmente a partir
de um sistema legado em Google Sheets, **sem nunca quebrar o legado durante
a transição**.

---

## Estado atual

| Camada        | Tecnologia                                                                        | Estado                                                 |
| ------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Frontend      | React 18 + TypeScript + Vite + Zustand + React Query (hook manual) + FullCalendar | Em produção — 100% migrado, sem cliente Apps Script    |
| Backend       | NestJS 10 + Prisma 5 + PostgreSQL (Supabase)                                      | Em produção — fonte única de verdade                   |
| Realtime      | Socket.IO (namespace `/rooms`, JWT no handshake)                                  | Em produção                                            |
| Auth          | JWT + Refresh Token + RBAC (PROFESSOR / COORDENADOR / ADMIN)                      | Em produção                                            |
| Sync de aulas | Google Apps Script → `POST /sync/schedules` → tabela `Schedule`                   | Em produção — única função remanescente do Apps Script |
| CI/CD         | GitHub Actions (validate + e2e) → Railway (backend) + GitHub Pages (frontend)     | Em produção                                            |

O legado HTML/CSS/JS + Apps Script + Google Sheets como _backend de reservas_
foi desativado no cutover oficial (ADR-003, F5.8). O Apps Script segue vivo
hoje só como fonte de dados de aulas/turmas da planilha institucional
(professores editam lá) — ver seção "Arquitetura atual".

---

## Arquitetura atual

```
React (Vite, GitHub Pages)
   │  JWT Bearer + refresh automático (apiClient.ts)
   ▼
NestJS (Railway)
   │  Prisma
   ▼
PostgreSQL (Supabase)
```

Módulos reais do backend (`apps/api/src/app.module.ts`): `ConfigModule`,
`PrismaModule`, `AuthModule`, `UsersModule`, `HealthModule`, `RoomsModule`,
`ReservationsModule`, `AvailabilityModule`, `AuditModule`, `RealtimeModule`,
`SyncModule`, `SchedulesModule`, `DashboardModule`, mais `ScheduleModule`
(`@nestjs/schedule`, cron), `LoggerModule` (`nestjs-pino`) e `ThrottlerModule`
(`@nestjs/throttler`) como infraestrutura transversal.

**Exceção legítima e isolada:** `SyncModule` chama o Apps Script
(`APPS_SCRIPT_URL`/`APPS_SCRIPT_TOKEN`) só para importar `Schedule` (aulas
da planilha institucional) via `POST /sync/schedules` (ADMIN). Isso não é
legado morto — é a fonte real de dados de aula, que continua sendo mantida
na planilha pelos professores. Reservas, salas, usuários e auditoria **nunca**
passam pelo Apps Script.

---

## Roadmap

**✅ Concluído**

- **F0** — Legado (HTML/CSS/JS + Apps Script + Sheets): leitura de ocupação, funcional em produção.
- **F1-F3** — Frontend React (Vite/TS/Zustand), estrutura de rotas, Dashboard.
- **F4** — Backend NestJS completo: Auth, Users, Rooms, Reservations, Availability, Audit, Sync, Schedules, Realtime, Health, guards RBAC.
- **F5** — Cutover oficial (ADR-003): frontend migrado 100% para NestJS; Apps Script deixa de ser backend de reservas.
- **F6** — Portal de aprovações (COORDENADOR+) e shell administrativo (`/admin/*`).
- **F7** — Remoção de `CURRENT_USER` hardcoded, cron de sync, cliente Socket.IO no frontend, testes E2E Playwright.
- **F8** — Extração de tipos (`apiTypes.ts`), índice de performance em `Schedule`, dashboard via SQL.
- **F9** — Produção e qualidade: Helmet + rate limiting, seed bloqueado em produção, CI/CD (Railway + GitHub Pages), logs estruturados (`nestjs-pino`), backup documentado, fix crítico de conflito em `createRange`, cliente Apps Script removido do frontend (F9.7), ESLint reativado com `root:true` (F9.8).
- **F9.9** — `AuditService` (`apps/api/src/modules/reservations/audit/audit.service.ts`) generalizado: `entityType` agora é opcional (default `'Reservation'`, preserva as 5 chamadas existentes em `reservations.service.ts` sem alteração) e `action` aceita `ReservationAuditAction | RoomAuditAction`. Exportado do `ReservationsModule` e importado pelo `RoomsModule`. `RoomsService.create/update/softDelete` passaram a rodar dentro de `$transaction` e auditar `CREATE_ROOM`/`UPDATE_ROOM`/`DEACTIVATE_ROOM` com `entityType: 'Room'`.

**⏭️ Próximos passos (em aberto)**

- `apps/reservations/backend/codigo.gs*` (fontes históricas do Apps Script) — decidido: mantido em `apps/reservations/backend/`, documentado inline (ver comentário no topo do arquivo) explicando por que vive ali apesar de alimentar o `SyncModule`.
- Autenticação institucional (SSO/LDAP) — pendência registrada desde a ADR-003, ainda não iniciada.

---

## REGRA ABSOLUTA

**NUNCA:**

- recriar o projeto do zero
- remover funcionalidades existentes
- quebrar o sync com o Apps Script (`SyncModule`/`POST /sync/schedules`) sem decisão explícita — ele é a fonte real de dados de aula
- alterar contratos de API do NestJS silenciosamente (nome/tipo de campo, formato de resposta, status HTTP)
- remover compatibilidade
- ignorar regressões, testes ou concorrência

**SEMPRE:**

1. analisar o contexto atual antes de mexer
2. reutilizar o que já existe
3. implementar incrementalmente
4. preservar compatibilidade
5. pensar em segurança, concorrência, UX, escalabilidade, rollback e observabilidade

Se houver dúvida: **PARE, explique os trade-offs, não assuma silenciosamente.**

---

## O que conta como REGRESSÃO

- `GET /reservations`, `GET /availability`, `GET /schedules` ou `GET /dashboard` param de responder ou mudam o formato de resposta sem versionamento
- Conflito de horário deixa de ser detectado em `create`, `update`, `createRange`, `updateGroup` ou `updateSelected` (overlap parcial/total/containment)
- Idempotência do cancelamento (`DELETE /reservations/:id`) para de ser state-based (reserva já `CANCELLED` deve retornar sucesso, não erro)
- Um teste que passava passa a falhar (frontend: Vitest; backend: Vitest unit)
- `POST /sync/schedules` para de sincronizar `Schedule` corretamente
- Rate limiting (`@Throttle`) ou Helmet somem de `main.ts`/`auth.controller.ts` sem decisão explícita
- Tempo de resposta degrada de forma relevante

---

## Protocolo obrigatório antes de qualquer alteração

1. Ler este `CLAUDE.md`.
2. Ler os arquivos que serão tocados **e os que dependem deles**.
3. Rodar os testes ANTES (baseline).
4. Fazer a análise de impacto: o que toca, quem depende, quebra contrato de API/schema, afeta concorrência (locks, race conditions), afeta performance, qual o plano de rollback.
5. Confirmar em qual camada a mudança entra.
6. Só então alterar — **mudança mínima necessária**.
7. Rodar os testes DEPOIS e comparar com o baseline.
8. Validar manualmente o caminho afetado quando aplicável.

Em caso de dúvida sobre escopo: **PARE e pergunte.**

---

## Regra mais importante — conflito de horário

```ts
const hasConflict = newStart < existingEnd && newEnd > existingStart;
```

Implementada em `ConflictService.hasConflict` (`apps/api/src/modules/reservations/conflict.service.ts`),
via query Prisma equivalente (`inicio: { lt: fim }`, `fim: { gt: inicio }`),
considerando só reservas `PENDING`/`APPROVED` e não soft-deletadas.

**Todos os métodos de escrita de `ReservationsService` que criam/movem uma
reserva rodam dentro de `$transaction` com `pg_advisory_xact_lock(hashtext(roomId), hashtext(date))`
seguido de `ConflictService.hasConflict`, antes do INSERT/UPDATE:**
`create()`, `update()`, e — desde a correção do F9.6 — `createRange()`
(uma `$transaction` **por data**, não uma única para o range inteiro, porque
pgbouncer em transaction mode não suporta transactions longas; datas em
conflito são puladas, não abortam o range todo). `updateGroup()` e
`updateSelected()` também chamam `hasConflict()` por ocorrência, pulando
as que conflitam.

O frontend pode mostrar conflito como UX (otimista), mas **nunca é a única
proteção** — a validação autoritativa é sempre no backend, dentro do lock.

---

## Backend NestJS (`apps/api`)

### Módulos e guards globais

Guards registrados como `APP_GUARD` em `app.module.ts`, nesta ordem:
`ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`. Rotas `@Public()` pulam
o `JwtAuthGuard`; rotas sem `@Roles(...)` passam livres no `RolesGuard`
contanto que autenticadas; `ADMIN` sempre passa em qualquer `@Roles(...)`.

`RolesGuard` usa `getAllAndOverride([handler, classe])`: o `@Roles` do
handler **substitui** o da classe. Por isso nenhum controller com handlers
próprios deve ter `@Roles` de classe (ADR-006). O papel em `req.user.role`
vem do **banco** (`JwtStrategy.validate`), não do token — rebaixar um
usuário vale na próxima requisição HTTP.

Regra do COORDENADOR (ADR-006): edita, cancela, aprova e rejeita **qualquer**
reserva (bypass intencional no `OwnershipService`), com limite de **30
ações/60 s por usuário** nessas rotas (`CoordinatorActionsThrottleGuard`,
guard de rota — roda depois dos globais). Não pode promover a ADMIN nem
alterar ADMIN ou outro COORDENADOR (gates de `UsersService`).

### Schema Prisma (modelos reais — `apps/api/prisma/schema.prisma`)

```
User          id, name, email, passwordHash, role, active, deletedAt
Room          id, name, type, capacity, floor, available
Reservation   id, userId, roomId, groupId, date(string YYYY-MM-DD),
              inicio, fim, status, turma, notes, clientRequestId, deletedAt
              índices: [roomId,date] [userId] [status] [groupId] [date,status]
AuditLog      id, action, entityType, entityId, userId, before, after, ip
RefreshToken  id, userId, tokenHash, expiresAt, revokedAt
Schedule      id, date, sala, turma, mes, turno, inicio, fim (sem FK p/ Room)

enum Role               PROFESSOR | COORDENADOR | ADMIN
enum RoomType            SALA_COMUM | LAB_GERAL | LAB_INFORMATICA | LAB_CLP
                          | LAB_ELETRICA | LAB_SMT | LAB_ELETRONICA
enum ReservationStatus  PENDING | APPROVED | REJECTED | CANCELLED
```

`Reservation.date`/`inicio`/`fim` são `String`, não `DateTime` — paridade
com o legado Google Sheets, decisão travada desde F4.0.

### Endpoints reais (confirmados nos controllers)

```
POST   /auth/login                @Public, @Throttle 5/60s
POST   /auth/refresh              @Public, @Throttle 5/60s
POST   /auth/logout               JWT

GET    /health                    @Public

GET    /rooms                     @Public
GET    /rooms/admin/all           ADMIN
GET    /rooms/:id                 @Public
POST   /rooms                     ADMIN
PATCH  /rooms/:id                 ADMIN
DELETE /rooms/:id                 ADMIN (soft delete)

GET    /reservations              JWT — filtros roomId, date, status, mine;
                                    paginação opcional/aditiva page, pageSize
                                    (1-200) — sem eles, retorna array completo
GET    /reservations/:id          JWT
POST   /reservations              PROFESSOR | COORDENADOR | ADMIN
POST   /reservations/range        PROFESSOR | COORDENADOR | ADMIN
PATCH  /reservations/:id/status   COORDENADOR | ADMIN (APPROVED|REJECTED) ¹
PATCH  /reservations/group/:id    JWT — dono, COORDENADOR ou ADMIN ¹
PATCH  /reservations/selected     JWT — dono, COORDENADOR ou ADMIN ¹
PATCH  /reservations/:id          JWT — dono, COORDENADOR ou ADMIN ¹
DELETE /reservations/:id          JWT — dono, COORDENADOR ou ADMIN; cancelamento
                                    (soft delete, idempotente) ¹
  ¹ COORDENADOR limitado a 30 ações/60 s por usuário, balde único (ADR-006)

GET    /availability              @Public — date obrigatório, turno opcional
GET    /schedules                 @Public
GET    /dashboard                 @Public — date obrigatório

POST   /sync/schedules            ADMIN — DELETE + INSERT batch 500, sem $transaction

GET    /audit                     COORDENADOR | ADMIN — filtros entityType, entityId, userId,
                                    action, from, to, page, limit

GET    /users                     COORDENADOR | ADMIN — filtros role, search, isActive, page, limit
GET    /users/professors          COORDENADOR | ADMIN
PATCH  /users/:id/role            COORDENADOR | ADMIN (COORDENADOR: nunca → ADMIN,
                                    nunca alvo ADMIN/COORDENADOR)
PATCH  /users/:id/active          COORDENADOR | ADMIN (COORDENADOR: nunca alvo
                                    ADMIN/COORDENADOR)

WS     /rooms                     JWT no handshake (auth.token)
       eventos: reservation.created/updated/approved/rejected/cancelled
```

---

## Frontend React (`apps/reservations/src`)

```
main.tsx, config.ts, config/api.ts
components/    dashboard/, calendar/, reservations/, ui/, DataTable.tsx,
               Pagination.tsx, JsonTree.tsx
hooks/         um hook por operação (useCreateReservation, useListReservations,
               useCancelReservation, useCreateReservationRange, useApproveReservation,
               useRejectReservation, usePendingReservations, useAuditLogs,
               useListUsers, useUpdateUser, useSchedule, useAvailability,
               useAvailabilityBackend, useDashboardStats, useSyncHistory,
               useTriggerSync, useSystemHealth, useRealtimeSocket, useConflict, ...)
layouts/       AppLayout.tsx, AdminLayout.tsx
pages/         Dashboard, Reservas, Aprovacoes, Login, Salas, Turmas,
               Agendamentos, Relatorios, Configuracoes, Perfil, NotFound,
               Admin/{Dashboard,Usuarios,Permissoes,Auditoria,Sync,Sistema,
               Configuracoes,Logs,Api,Health}
router/        index.tsx, config.ts, ProtectedRoute.tsx, RouteLoader.tsx
services/      apiClient.ts (JWT + refresh automático), apiTypes.ts
               (fonte única de contratos), nestjsApiService.ts, availability.ts,
               socketClient.ts, tokenStorage.ts
store/         authStore.ts, reservationStore.ts (Zustand)
validators/    conflict.ts, reservation.ts
utils/         dateRange.ts, sanitize.ts
```

`apiTypes.ts` é a fonte única de verdade dos contratos (extraído do antigo
`appsScript.ts` no F8.9; `appsScript.ts` foi deletado no F9.7 — não existe
mais nenhum cliente Apps Script no frontend).

### Padrão de hook

```typescript
export function useXxx(service: XxxService, options = {}): UseXxxResult {
  const [status, setStatus] = useState<QueryStatus | MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const serviceRef = useRef(service); // evita stale closure
  // query: useEffect mount-only + refetch explícito
  // mutation: execute via useCallback
}
```

Retry: só em falha de rede ou `error.code === 'INTERNAL'`, `maxRetries` default 2,
mesmo `clientRequestId` em todas as tentativas de uma mutation.

---

## Segurança

- **Helmet** (`app.use(helmet())` em `main.ts`) — headers de segurança HTTP padrão.
- **Rate limiting** (`@nestjs/throttler`): 100 req/min por IP como default global
  (`ThrottlerModule.forRoot`); `POST /auth/login` e `POST /auth/refresh` com limite
  mais restrito de **5 req/min** via `@Throttle`. `THROTTLE_SKIP=true` desliga o
  throttling — usado **só** no job E2E do CI (o helper de polling faria o login
  estourar o limite); nunca usar em produção.
- **Validação de data passada**: `IsNotPastDateConstraint` (UTC noon trick) aplicado
  em `dateInicio` de `CreateReservationDto` e `CreateReservationRangeDto`.
- **Seed bloqueado em produção**: `prisma/seed.ts` lança erro se `NODE_ENV=production`
  — as senhas vêm de `SEED_*_PASSWORD` (sem default, ver ADR-005) e o seed nunca roda contra um banco real.
- **CORS configurável** via `CORS_ORIGIN` (lista separada por vírgula); fallback
  para `localhost:5173`/`4173` em dev.
- **`ValidationPipe` global**: `whitelist`, `forbidNonWhitelisted`, `transform`.
- Token do sync com Apps Script (`APPS_SCRIPT_TOKEN`) e segredos JWT nunca
  commitados — só em `.env` local / secrets do Railway e GitHub Actions.
- `trust proxy` vem de `TRUST_PROXY` (env validado; inteiro ≥ 0 ou `false`,
  **obrigatório em produção** — Railway e `infra/docker` usam `1`) para que o
  rate limiting por IP use o cliente real (`X-Forwarded-For`). No
  `infra/docker` o nginx é a borda única: sobrescreve `X-Forwarded-For` e a
  api não publica porta (ADR-009).

---

## CI/CD

**CI** (`.github/workflows/ci.yml`) — dispara em push/PR para `master`:

- Job `validate`: instala deps, typecheck frontend, `prisma generate`,
  typecheck backend (`build`), **lint frontend e backend** (reativado no
  F9.8), testes unitários do frontend (Vitest), build do frontend.
- Job `e2e` (depende de `validate`): build do backend, `prisma migrate deploy`,
  sobe o backend com `THROTTLE_SKIP=true`, roda Playwright, upload do relatório
  em caso de falha.

**CD** (`.github/workflows/cd.yml`) — dispara via `workflow_run` do CI,
só quando `conclusion == success`, na branch `master`:

- Job `preflight`: checa se os secrets `RAILWAY_TOKEN`/`VITE_API_URL_PROD`
  existem; se não, **pula** os deploys sem falhar o workflow.
- Job `deploy-backend`: checkout do SHA validado pelo CI, `prisma migrate deploy`,
  `railway up --service salas-senai-api --ci` (build definido por `railway.json`
  na raiz — Nixpacks, `node apps/api/dist/main.js`, healthcheck `/health`).
- Job `deploy-frontend`: build com `--base=/salas-senai-monorepo/` e
  `VITE_API_URL` de produção, fallback SPA (`404.html`), publica na branch
  `gh-pages` via `peaceiris/actions-gh-pages`.

Deploy nunca acontece em cima de CI vermelho, e sempre no SHA exato validado.
Detalhes de setup manual (Railway, secrets) em `docs/deploy.md`.

---

## Observabilidade

- **Logs estruturados via `nestjs-pino`** (`LoggerModule.forRoot` em
  `app.module.ts`, `app.useLogger(app.get(Logger))` em `main.ts`): JSON puro
  em produção, `pino-pretty` legível em dev; cada requisição ganha um
  `req.id` (UUID) presente em todos os logs dela; header `Authorization`
  redigido.
- Eventos de autenticação (`AuthService`) logados de forma estruturada —
  sucesso/falha de login, refresh, logout — **nunca** senha nem token completo.
- `ReservationsService.createRange` loga (`Logger.warn`) as datas puladas por
  conflito — não fazem parte do contrato de resposta, só ficam rastreáveis no log.
- `AuditLog` (tabela) registra quem/quando/o quê nas ações de `Reservation`
  (create/update/delete/approve/reject), em `POST /sync/schedules`
  (`SYNC_SCHEDULES`) e, desde F9.9, nas ações administrativas de `Room`
  (`CREATE_ROOM`/`UPDATE_ROOM`/`DEACTIVATE_ROOM`).
- Erros de resposta HTTP não seguem um envelope único do lado NestJS (usam
  as exceptions padrão do Nest — `NotFoundException`, `ConflictException`,
  etc.); o **frontend** normaliza para `BackendError { code, message }` em
  `nestjsApiService.ts`.

---

## Regra anti-invenção — a IA NÃO inventa código

A IA (Claude Code ou assistente) **NUNCA inventa**:

- nomes de funções, métodos, variáveis, campos ou tipos que não existem no código
- contratos de API, formatos de request/response ou nomes de campo
- helpers, módulos, bibliotecas ou imports não verificados
- IDs, URLs, tokens, caminhos de arquivo, nomes de módulo ou de tabela
- estrutura de arquivos ou comportamento de função sem ter **lido o código real**

**Antes de referenciar qualquer coisa, VERIFICAR que ela existe:**

- ler o arquivo real (não assumir pelo nome)
- confirmar a assinatura da função / o nome exato do campo
- usar os contratos já validados: `apps/reservations/src/services/apiTypes.ts`
  (frontend) e os DTOs/controllers/`schema.prisma` reais (backend)

Se a informação não estiver disponível: **perguntar, ou marcar `// TODO`
explícito** — nunca preencher a lacuna com suposição. Código inventado que
"parece certo" é pior que um TODO honesto, porque esconde o bug até a
integração.

---

## Critérios de aceite (definição de "pronto")

Uma tarefa só está concluída quando **TODOS** forem verdadeiros:

- [ ] `pnpm --filter @salas-senai/api build` (typecheck) sem erros
- [ ] `pnpm --filter @salas-senai/reservations typecheck` sem erros
- [ ] `pnpm --filter @salas-senai/api lint` e `pnpm --filter @salas-senai/reservations lint` (0 erros/warnings — `--max-warnings 0` no frontend)
- [ ] `pnpm --filter @salas-senai/api test:unit` e `pnpm --filter @salas-senai/reservations test` verdes, **sem reduzir** cobertura existente
- [ ] **zero regressão** (ver seção "O que conta como REGRESSÃO")
- [ ] tipagem válida (sem `any` desnecessário fora dos overrides de teste do ESLint)
- [ ] validado manualmente no caminho real quando aplicável (browser / `Invoke-RestMethod`)
- [ ] backend: validação **dentro do lock** (`$transaction` + `pg_advisory_xact_lock`), idempotência mantida, contrato preservado
- [ ] mudança de contrato de API sempre **versionada/documentada**, nunca silenciosa
- [ ] decisão técnica relevante registrada na tabela de Decisões (ou num ADR em `docs/adr/` se for arquitetural)

---

## Prioridades quando requisitos conflitam (regra de desempate)

Quando dois objetivos colidem, **vence o de cima**:

1. Não quebrar produção / estabilidade
2. Compatibilidade de contrato
3. Segurança e integridade de dados (conflito de horário, concorrência)
4. Correção funcional
5. Experiência do usuário
6. Testabilidade / manutenibilidade
7. Performance
8. Velocidade de entrega

Exemplos: segurança vence conveniência · não quebrar produção vence nova
feature · correção vence performance · simplicidade vence "esperteza".

---

## Política de commits e entregas

- Commits **pequenos e atômicos**: uma mudança lógica por commit.
- **Nunca** commitar código que não compila ou com teste vermelho.
- Mensagem no imperativo, com tipo e escopo. Ex.:
  - `fix(reservations): corrige createRange sem validação de conflito`
  - `feat(f9): seguranca (helmet, rate limit, seed guard)`
  - `chore(eslint): adiciona root:true para impedir subida ate a raiz`
- Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`.
- Uma feature por branch quando possível; a branch principal **nunca** com
  produção quebrada.
- Rodar os testes antes de cada entrega.
- Registrar decisões técnicas relevantes na tabela abaixo (ou em ADR).

---

## Como responder (mudanças significativas)

Para tarefas relevantes, cobrir:
objetivo · impacto · riscos · estratégia · testes · implementação ·
segurança · performance · rollback · próximos passos.

Sempre entregar artefatos completos (código, imports, configs, testes,
comandos) — nunca só teoria. Para micro-tarefas, ser direto e conciso.

Mentalidade: pensar como Staff Engineer / Software Architect / Security
Engineer / especialista em SaaS institucional.

---

## Comandos úteis

```powershell
# Backend — typecheck, lint, testes
pnpm --filter @salas-senai/api build
pnpm --filter @salas-senai/api lint
pnpm --filter @salas-senai/api test:unit

# Backend — subir localmente
pnpm --filter @salas-senai/api start:dev

# Frontend — typecheck, lint, testes
pnpm --filter @salas-senai/reservations typecheck
pnpm --filter @salas-senai/reservations lint
pnpm --filter @salas-senai/reservations exec vitest run --reporter=dot --no-coverage

# Frontend — subir localmente
pnpm --filter @salas-senai/reservations dev

# E2E (Playwright, requer backend + frontend de pé)
pnpm test:e2e

# Prisma
pnpm --filter @salas-senai/api exec prisma generate
pnpm --filter @salas-senai/api exec prisma migrate deploy   # produção/CI
```

<!-- TODO: confirmar se o workaround histórico "vite preview + copy legacy-index.html"
     (bloqueio de proxy/VPN no dev server) ainda é necessário no ambiente atual —
     não há evidência no código de que o problema foi resolvido nem de que persiste;
     se o dev server (`pnpm --filter @salas-senai/reservations dev`) não abrir,
     tentar `npx vite build && npx vite preview` como alternativa. -->

---

## Decisões técnicas registradas

| Data    | Decisão                                                                                                                                                                                                                                                                      | Motivo                                                                                                                                                                                             |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05 | Cache removido do Apps Script                                                                                                                                                                                                                                                | Limite de 100KB do CacheService estourava com milhares de registros                                                                                                                                |
| 2026-05 | XSS protegido via `esc()`                                                                                                                                                                                                                                                    | Dados da planilha renderizados via innerHTML sem escape                                                                                                                                            |
| 2026-06 | Colunas C/D/E forçadas como texto (`setNumberFormat('@')`) no Apps Script                                                                                                                                                                                                    | Sheets convertia "08:00"/datas em Date de 1899, quebrando detecção de conflito                                                                                                                     |
| 2026-06 | Reserva em período: tudo-ou-nada, dias da semana escolhidos, limite 60 datas                                                                                                                                                                                                 | Atomicidade dentro do lock; proteção contra timeout/abuso                                                                                                                                          |
| 2026-06 | Migração Sheets → Postgres: Postgres como fonte única de reservas, sem sync bidirecional                                                                                                                                                                                     | Sync bidirecional geraria dupla escrita e conflitos                                                                                                                                                |
| 2026-06 | Cancelar reserva = soft delete (`status='CANCELLED'`), idempotência state-based                                                                                                                                                                                              | Mantém auditoria; retry de cancel numa reserva já cancelada não é erro                                                                                                                             |
| 2026-07 | Cutover oficial F5.8: NestJS é o backend de reservas                                                                                                                                                                                                                         | Apps Script passa a servir só como fonte de sync de `Schedule` (ADR-003)                                                                                                                           |
| 2026-07 | `Reservation.date/inicio/fim` como `String`, não `DateTime`                                                                                                                                                                                                                  | Paridade com o legado Google Sheets (decisão F4.0)                                                                                                                                                 |
| 2026-07 | Apps Script removido do **frontend** (F9.7); tipos migrados de `appsScript.ts` para `apiTypes.ts`                                                                                                                                                                            | Reservas já eram 100% NestJS desde F5.8; `appsScript.ts` sobrevivia só como fonte de tipos e fallback morto                                                                                        |
| 2026-07 | CORS configurável via `CORS_ORIGIN`                                                                                                                                                                                                                                          | Produção (GitHub Pages) tem origem diferente de `localhost`                                                                                                                                        |
| 2026-07 | Validação de data passada (`IsNotPastDateConstraint`, UTC noon) em `dateInicio`                                                                                                                                                                                              | Backend aceitava reservas retroativas — falha de integridade confirmada por E2E                                                                                                                    |
| 2026-07 | Helmet + `@nestjs/throttler` (100/min global, 5/min em login/refresh)                                                                                                                                                                                                        | Auditoria de segurança F9.1: headers de segurança ausentes, sem proteção contra brute force                                                                                                        |
| 2026-07 | Seed bloqueado em produção via checagem de `NODE_ENV` (senhas de teste mantidas)                                                                                                                                                                                             | Senhas conhecidas (`<role>@senai****`, removidas do código no ADR-005) seriam risco grave se o seed rodasse contra produção                                                                        |
| 2026-07 | Deploy: Railway (backend) + GitHub Pages (frontend); CD via `workflow_run` pós-CI                                                                                                                                                                                            | Deploy nunca roda em cima de CI vermelho; deploya exatamente o SHA validado                                                                                                                        |
| 2026-07 | Backup via recurso nativo do Supabase, sem script de export customizado                                                                                                                                                                                                      | Já incluso no plano; evita manter infraestrutura de backup própria                                                                                                                                 |
| 2026-07 | Logs estruturados via `nestjs-pino` (JSON em produção, pino-pretty em dev)                                                                                                                                                                                                   | Observabilidade em produção real; request-id por requisição                                                                                                                                        |
| 2026-07 | Índice `Reservation(date, status)` adicionado                                                                                                                                                                                                                                | `AvailabilityService`/`DashboardService` filtram por `date` sem `roomId` — índice `(roomId,date)` existente não cobria                                                                             |
| 2026-07 | Fix crítico: `createRange` passou a usar `$transaction` individual por data + `pg_advisory_xact_lock` + `ConflictService`, com datas conflitantes puladas (não abortando o range)                                                                                            | Implementação original inserção direta, sem lock nem validação de conflito — violação da Regra mais importante do projeto                                                                          |
| 2026-07 | `root: true` nos `.eslintrc.cjs` de `apps/api` e `apps/reservations`; `eslint` como devDependency explícita na raiz                                                                                                                                                          | ESLint subia até a raiz do monorepo e caía no `ignorePatterns` que bloqueia `apps/`, causando "No files matching the pattern src" ao lintar um pacote isoladamente                                 |
| 2026-07 | `AuditService` generalizado (`entityType` opcional, default `'Reservation'`; `action` aberto para `ReservationAuditAction \| RoomAuditAction`), exportado do `ReservationsModule`, importado pelo `RoomsModule`; `RoomsService` agora audita `Room` dentro de `$transaction` | Fechava o gap de auditoria em ações administrativas de `Room`; opção de generalizar o service (em vez de duplicar) preservando as 5 chamadas existentes em `reservations.service.ts` sem alteração |
| 2026-10 | Issue 6 (ADR-006): papel efetivo do banco (não do token); `@Roles` de classe morto removido de `UsersController`; COORDENADOR modifica qualquer reserva, com limite de 30 ações/60 s por usuário                                                                             | Revogar privilégio passa a ser imediato; contrato de autorização travado em teste; bypass do COORDENADOR com freio contra abuso                                                                    |
