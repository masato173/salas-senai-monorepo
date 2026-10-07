# MEMORY.md — Controle de Salas SENAI

# Cérebro persistente do projeto — leia ANTES de qualquer tarefa

# Atualizado: 2026-09-22 | Fase atual: pós-F9.9 completo + leva de

# pré-produção (Fase A/B/C1/C2/C3) + deploy Railway configurado + registro

# público de professores COMMITADO (`2a4b9cb`, `POST /auth/register`

# restrito a `@am.senai.br`). Redesign dark-first + DatePicker/TimePicker

# COMMITADO (`7c336c8`), painel de reservas do dia (`4994fff`), componente

# Select.tsx substituindo `<select>` nativo em 6 lugares

# (`f0fda1e`+`baf7e3d`), infra Docker pra servidor local do SENAI commitada

# mas NÃO testada (`425aaaa`+`1d796b2`), DESIGN.md sincronizado com o

# global.css dark-first (`e3b6f15`). Ver ENDPOINTS DO BACKEND, seções

# FRONTEND — LEVA DARK-FIRST, INFRAESTRUTURA — Docker local e DESIGN

# SYSTEM abaixo. NOVO (set/2026): LEVA DE SEGURANÇA — 5 commits saídos da

# auditoria interna (`0ad2666`, `7fdd585`, `c482a2e`, `3360fde`,

# `fb2a446`), fechando token hardcoded, IDOR em reservas e RLS faltando

# na Notification. Todos commitados E PUSHADOS — mas o \*\*CI está vermelho

# desde 18/09\*\* (secret de banco do GitHub Actions), então o CD foi pulado

# nas 3 vezes e NADA disso está em produção: o backend em produção ainda

# roda o código de `2a4b9cb` (15/08). A rotação do token do Apps Script

# também continua PENDENTE (sem ela o achado não fecha).

# Ver LEVA DE SEGURANÇA e ⏳ PENDENTE abaixo.

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

✅ REDESIGN DA TELA DE LOGIN — **COMMITADO** (`844e138`, 2026-07-31,
fora desta sessão de memory-sync). Layout split ≥768px (painel visual
54% com foto de laboratório + overlay navy, formulário 46% card de
vidro), mobile volta a single-column. Ver seção DESIGN SYSTEM → LOGIN
abaixo pra detalhe completo — a versão anterior deste arquivo dizia
"NÃO COMMITADO", estava desatualizada.

✅ LEVA DARK-FIRST + DATEPICKER/TIMEPICKER — **COMMITADA** (`7c336c8`,
2026-08-02, junto com 2 bugs corrigidos — professor sem reservas, ver
Bugs históricos #20): polimento visual do Dashboard + dot de pendentes
na sidebar, redesign dark-first Fase 1, Calendário/Reservas integrado
ao design system, componentes `DatePicker`/`TimePicker` novos. Ver
seção **FRONTEND — LEVA DARK-FIRST (commit `7c336c8`)** abaixo pra
detalhe completo de cada uma.

✅ PAINEL DE RESERVAS DO DIA — **COMMITADO** (`4994fff`, 2026-08-03):
endpoint novo `GET /reservations/day` + `DayReservationsPanel.tsx`
(drawer lateral ao clicar numa data do calendário em `/reservas`). Ver
ENDPOINTS DO BACKEND e FRONTEND — ARQUIVOS-CHAVE abaixo.

✅ COMPONENTE `Select.tsx` — **COMMITADO** (`f0fda1e`+`baf7e3d`,
2026-08-11/12): substitui `<select>` nativo em 6 lugares (port do
`TimePicker` generalizado pra `{value,label}[]`, reaproveita as classes
`.ui-picker-*` já existentes). Bug de `onChange` disparando sem mudança
real de valor corrigido no dia seguinte, achado pelo ultrareview (ver
Bugs históricos #21).

✅ INFRA DOCKER PRA SERVIDOR LOCAL — **COMMITADA, NÃO TESTADA**
(`425aaaa`+`1d796b2`, 2026-08-09): `infra/docker/` completo (Dockerfile
api+frontend, compose, entrypoint com migrate+seed condicional),
aditiva à nuvem (Railway/Supabase/GitHub Pages intactos). Ver seção
**INFRAESTRUTURA — Docker local** abaixo.

✅ DESIGN.md SINCRONIZADO COM O DARK-FIRST — **COMMITADO** (`e3b6f15`,
2026-08-13): tokens/valores do `DESIGN.md` (frontmatter + seção Colors

- Shadow Vocabulary) atualizados pro `:root` dark real do `global.css`,
  resolvendo a divergência que essa seção sinalizava antes.

✅ REGISTRO PÚBLICO DE PROFESSORES — **COMMITADO** (`2a4b9cb`,
2026-08-15): `POST /auth/register` no `AuthController` (não em
`UsersController` — este tem `@Roles(ADMIN)` de classe que herdaria via
`RolesGuard.getAllAndOverride` e daria 403 mesmo com `@Public()` no
método; achado real durante a análise, não suposição). `@Public()` +
`@Throttle` 5/hora/IP. `RegisterDto` sem campo `role` (dupla proteção:
`forbidNonWhitelisted` barra no body + `UsersService.create()` nem
aceita `role`, cai no `@default(PROFESSOR)` do schema) +
`@Matches(/@am\.senai\.br$/i)` restringindo ao domínio institucional
(âncora no fim bloqueia disfarce de subdomínio tipo
`@am.senai.br.attacker.com`; mensagem de erro discreta, não revela o
domínio exigido — nem a UI expõe). Sem auto-login de propósito: sucesso
só confirma, front redireciona pro `/login`. Primeira suíte de teste do
módulo `auth` (`auth.service.spec.ts`). Ver ENDPOINTS DO BACKEND,
FRONTEND — ARQUIVOS-CHAVE e Bug histórico #22 (contraste do link
corrigido no mesmo commit).

✅ LEVA DE SEGURANÇA — **COMMITADA E PUSHADA, MAS NÃO DEPLOYADA** (5
commits, 2026-09-03/21), saída de uma auditoria interna do projeto
(artefatos em `docs/security-audit/`, ainda untracked no working tree).
Zero mudança de contrato de API além do que está listado; zero mudança de
UI.

⚠️ **Nada disso está em produção.** As 3 execuções de CI desses commits
falharam (18/09 ×2, 21/09 ×1) no step `prisma migrate deploy` do job
`e2e` com `FATAL: (ENOTFOUND) tenant/user postgres.czvqugzwscgmdfyppbke
not found`; como o CD é `workflow_run` com `conclusion == success`, foi
pulado nas 3. Último deploy real bem-sucedido: `2a4b9cb` (15/08). Não é a
migration de RLS (o erro já acontecia em 18/09, antes dela) e não é banco
morto (o projeto `czvqugzwscgmdfyppbke` está `ACTIVE_HEALTHY` em
sa-east-1) — é a connection string do secret do CI. Ver ⏳ PENDENTE.

- **Token do Apps Script fora do código** (`0ad2666` + `7fdd585`) — o
  valor estava hardcoded em 10 arquivos rastreados e, o agravante, era
  **servido ao browser de qualquer visitante** via `apps/legacy/index.html`
  publicado no GitHub Pages (ver Bug histórico #23). `apps/legacy/` e
  `apps/web/` foram **deletados por inteiro** (cluster órfão: `apps/web`
  não era buildado por nenhum job de CI nem deployado pelo CD, e o
  `README.md`/`.husky/pre-push` já os documentavam como legado
  descontinuado); junto foram `scripts/validate-legacy.sh` e as
  referências em `.prettierignore`/`README.md`/`.husky/pre-push`.
  `codigo.gs` passou a ler `SECRET_TOKEN`/`SPREADSHEET_ID` de **Script
  Properties** (Apps Script Editor → Configurações do projeto), os 6
  scripts `.ps1` leem `$env:APPS_SCRIPT_URL`/`$env:APPS_SCRIPT_TOKEN`, e
  o valor foi redigido de `.claude/skills/controle-salas-senai/SKILL.md`
  e `references/backend.md` (achado extra — esses docs entram no contexto
  de toda sessão do Claude Code). `git grep` do valor não retorna mais
  nenhum arquivo rastreado.
- **Token do sync no corpo do POST** (`c482a2e`) — `sync.service.ts`
  mandava `?token=...` na query string (vaza em log de servidor/proxy e
  no header `Referer`). Agora manda `{action:'listSchedules', token}` no
  corpo. Exigiu trocar `fetch` por `https.request` nativo por causa do
  redirect 302 do Apps Script (ver Bug histórico #24) e uma branch nova
  `listSchedules` no `doPost` do `codigo.gs` (aditiva — `doGet` intocado,
  continua aceitando `?token=` por compatibilidade; vira código morto só
  depois que o Apps Script novo estiver deployado).
- **IDOR em reservas** (`3360fde`) — 4 achados, ver Bug histórico #26.
  `GET /reservations/:id` não checava posse nenhuma; o atalho de
  idempotência do cancelamento devolvia a reserva inteira antes do gate;
  `updateGroup` checava posse só em `reservations[0]`; e o comentário do
  `OwnershipService` divergia do código. `OwnershipService` ganhou
  `assertOwnerOrPrivileged(reservation, currentUser): void` — checagem de
  permissão **pura** (sem I/O, sem checar existência/soft-delete),
  extraída de dentro do `assertCanModify` (que passou a chamá-la; zero
  mudança de comportamento observável nele).
- **RLS na Notification** (`fb2a446`) — era a única das 7 tabelas fora do
  padrão da ADR-001 (ver Bug histórico #27). Migration aditiva
  `20260918000000_enable_rls_notification` + rollback
  `prisma/rollback/20260918000000_enable_rls_notification_rollback.sql`.
  **Criada mas NÃO aplicada** — roda sozinha no `migrate deploy` do CI/CD
  quando isso for pushado.

⏳ PENDENTE:

- **Rotacionar o token do Apps Script** — a leva tirou o valor do código,
  mas NÃO invalidou o que já vazou: ele continua válido, está em 11
  commits do histórico do git e esteve público no GitHub Pages enquanto
  `apps/legacy/index.html` existiu. **Sem a rotação o achado não fecha.**
  Ordem: (1) configurar as Script Properties `SECRET_TOKEN`/
  `SPREADSHEET_ID` no Apps Script Editor com os valores ATUAIS, (2)
  redeployar o `codigo.gs` como nova versão da MESMA implantação, (3)
  confirmar via POST que responde `{ok:true}`, (4) só então pushar/
  mergear o backend (o CD é automático no merge) — se inverter a ordem o
  sync quebra. Depois da rotação de fato: atualizar `APPS_SCRIPT_TOKEN`
  no Railway e nos GitHub Actions secrets.
- Verificar a RLS da `Notification` em produção depois do deploy:
  `SELECT relname, relrowsecurity FROM pg_class c JOIN pg_namespace n ON
n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';`
  (esperado `relrowsecurity = true` nas 7 tabelas) + zero linhas em
  `role_table_grants` pra anon/authenticated na Notification
- **Destravar o CI** — `DATABASE_URL`/`DIRECT_URL` dos secrets do GitHub
  Actions não resolvem o tenant no pooler `aws-1-sa-east-1` (projeto
  `czvqugzwscgmdfyppbke` vivo e `ACTIVE_HEALTHY`, então é a string que
  está errada/desatualizada). Enquanto isso não for corrigido, nenhum
  commit novo deploya — inclusive os 5 da leva de segurança, já pushados
- Conferir se o `DATABASE_URL` do Railway (produção) tem o mesmo problema
  do secret do CI — não dá pra verificar sem o dashboard do Railway
- Confirmar que o primeiro deploy real (`f7799a5` em diante) completou
  com sucesso no Railway — ainda não validado em nenhuma sessão, checar
  dashboard
- Rotacionar as senhas das contas de produção (admin, coordenador, professor) antes de a API voltar ao ar — Issue 2, pendente no VPS
- Autenticação institucional (SSO/LDAP) — pendência desde ADR-003, não iniciada
- Reset de senha (professor esqueceu a senha) — próxima leva planejada
  depois do registro público (`2a4b9cb`): nível 1 ADMIN reseta
  manualmente, nível 2 self-service. Botão "Esqueceu sua senha?" no
  Login continua `disabled` até isso existir
- Testar a infra Docker (`infra/docker/`) de fato — commitada em duas
  missões mas nunca rodada (nenhuma das sessões que a escreveram tinha
  Docker no ambiente de dev); build, entrypoint e migrate+seed
  condicional tudo por confirmar
- Testes automatizados (Vitest) pras funções puras de `DatePicker`/
  `TimePicker`/`Select` (`buildMonthGrid`/`buildTimeSlots`) — só
  validado interativamente via Playwright, sem suíte própria ainda
- `CHANGELOG.md` tem uma regeneração via `pnpm changelog`/`changelog:all`
  não commitada no working tree (blocos datados 14/08 e 12/08 parecem
  duplicados) — decidir se commita ou descarta

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
❌ Nunca criar tabela nova sem o bloco RLS da ADR-001 (ENABLE ROW LEVEL
SECURITY + REVOKE de anon/authenticated) na MESMA migration que a cria
(Bug #27 — a Notification ficou 2 meses exposta por causa disso)
❌ Nunca mandar segredo em query string (vaza em log de servidor/proxy e
no header Referer) — corpo do POST, sempre (Bug #23)
❌ Nunca usar `fetch` nativo pra POST no Apps Script — o 302 dele come o
body (Bug #24). `https.request` com redirect manual
❌ Nunca checar posse só no primeiro item de um lote — a checagem vai
DENTRO do loop, por item (Bug #26)

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
⚠️ OBSOLETO desde a ADR-001 / migration `20260709000000_add_schedule_table`:
esse fix é da era do legado, quando o frontend falava direto com o
Supabase. Hoje a política da Schedule (e de todas as outras) é deny-all +
REVOKE de anon/authenticated, e nada quebra porque o backend conecta como
role `postgres` (`rolbypassrls = true`). NÃO reaplicar esse GRANT.

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

#18 Item aninhado dentro de painel glass usando --color-bg (opaco)
`RoomAvailabilityPanel.tsx` usava `var(--color-bg)` (fundo opaco da
página inteira) nos itens internos — quando o painel em volta virou
glass (translúcido), o item parecia um buraco em vez de superfície
elevada
→ Fix: `--color-surface-2`, o token documentado pra item aninhado
dentro de outro glass (mesmo padrão de `.slot-item` dentro de
`.avail-card`) — não `--color-bg`, que é a cor de fundo da PÁGINA, não
de um elemento aninhado

#19 Dropdown customizado perto da borda direita da tela vaza do viewport
Painel flutuante (`DatePicker`) ancorado só com `left: 0` — quando o
gatilho fica perto da borda direita (ex: `ScheduleHeader` na topbar do
Dashboard), o painel (mais largo que o gatilho) ultrapassa o viewport
→ Fix: prop `align?: 'left'|'right'` — `right: 0` nesses casos, mesmo
padrão que `NotificationBell.tsx` já usa pro mesmo problema
→ Lição: qualquer dropdown/painel flutuante posicionado perto da borda
direita da tela precisa considerar ancoragem pela direita — não assumir
`left: 0` sempre funciona

#20 Professor sem reservas via lista vazia mesmo tendo reservas (2 bugs
relacionados na mesma tela, corrigidos juntos em `7c336c8`)
`ReservationList.tsx` filtrava só `status === 'APPROVED'` — professor
com reservas só `PENDING` via a lista sempre vazia. Ao mesmo tempo, os
cards de estatística (Total/Pendentes/Aprovadas/Rejeitadas) de
`Reservas/index.tsx` liam `useReservationStore` (Zustand nunca populado
nessa tela, sempre zero) em vez da resposta real já buscada
→ Fix: filtro vira `PENDING|APPROVED` (`groupReservations()` extraída
como função pura testável, `ReservationList.test.ts` novo); cards
passam a ler `list.data?.reservations`

#21 `Select.tsx` (componente customizado) disparava `onChange` mesmo
sem mudança real de valor
Diferente do `<select>` nativo, que só dispara `change` quando o valor
muda — reclicar a opção já selecionada disparava `onChange`
incondicionalmente. Cascateava efeito colateral em 2 callers:
`Reservas/index.tsx` apagava a turma digitada (`setTurma('')` no
`onChange` da sala), `Admin/Usuarios` resetava a paginação
(`setPage(1)` no `onChange` dos filtros)
→ Fix (`baf7e3d`): `if (o.value !== value) onChange(o.value)` — achado
pelo ultrareview em `f0fda1e`

#22 `--color-brand` usado como cor de TEXTO tem contraste ruim no dark
Link "Criar conta"/"Entrar" novo (`Login`/`Register`) usava `color:
var(--color-brand)` — token pensado pra fundo/borda de superfície sólida
(botão, ícone), não pra texto pequeno sobre um card translúcido também
navy no tema dark (contraste ~1.5:1, WCAG AA exige 4.5:1). Achado pelo
ultrareview, corrigido no mesmo commit (`2a4b9cb`)
→ Fix: `var(--color-blue)` — token semântico de link do projeto (já
usado no `:focus-visible` global), contraste OK nos dois temas
→ Lição: `--color-brand`/`--color-accent` são cores de SUPERFÍCIE
(fundo sólido, borda), não usar como `color` de texto pequeno sem
checar contraste primeiro

#23 Token do Apps Script hardcoded em 10 arquivos rastreados — e servido
ao browser de qualquer visitante
`apps/legacy/index.html` (publicado no GitHub Pages) trazia `API_URL` +
`API_TOKEN` no código-fonte da página: bastava abrir o view-source pra
ter acesso total ao endpoint. O mesmo valor era o `SECRET_TOKEN` do
`codigo.gs` e o `APPS_SCRIPT_TOKEN` do `SyncModule` em produção. Também
estava em 6 scripts `.ps1` e em 2 docs de skill (`SKILL.md`,
`references/backend.md`) que entram no contexto de toda sessão do Claude
Code
→ Fix (`0ad2666`+`7fdd585`): `apps/legacy/`+`apps/web/` deletados, Script
Properties no Apps Script, env var nos `.ps1`, valor redigido dos docs
→ Lição: trocar o arquivo NÃO conserta sozinho — o valor continua válido
e recuperável do histórico do git até ser **rotacionado** (pendência
aberta, ver ⏳ PENDENTE)

#24 `fetch` nativo do Node rebaixa POST→GET e DESCARTA o body ao seguir
o redirect do Apps Script
Web App do Apps Script sempre responde `/exec` com 302 pra
`script.googleusercontent.com` (é no segundo salto que o script de fato
roda). Pela spec do WHATWG Fetch, um POST que recebe 301/302 e segue o
redirect automaticamente vira GET **sem corpo** — ou seja, o token
mandado no body nunca chegava, e o `doGet` respondia "Acesso negado".
`redirect: 'manual'` não resolve: o undici devolve uma resposta opaca
(status 0, headers ilegíveis), então nem dá pra ler o `Location`
→ Fix (`c482a2e`): `https.request` nativo, seguindo o redirect na mão e
reenviando o mesmo POST pro `Location` (limite de 5 saltos)
→ Lição: teste com `fetch` mockado NÃO pega isso (o mock não simula
redirect). O teste que trava a regressão simula os DOIS saltos e confere
que a 2ª chamada continua POST com o body — validado por mutation
(quebrar a correção de propósito e ver o teste falhar)

#25 Script Property vazia faz o gate de token passar (fail-OPEN)
`PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN')`
devolve `''` (string vazia, não `null`) se a property existe mas está
salva sem valor — cenário real de quem apaga o valor no editor em vez de
deletar a linha. Como o token recebido também cai em `''` por default,
`token !== SECRET_TOKEN` virava `'' !== ''` = false: **qualquer request
sem token era autenticado**
→ Fix (`3360fde`): `if (!SECRET_TOKEN || token !== SECRET_TOKEN)` nos
dois pontos de entrada (`doGet` e `doPost/listSchedules`) — `!x` cobre
`null`, `undefined` e `''` de uma vez
→ Lição: ao trocar constante hardcoded por config externa, o caso "existe
mas está vazio" é novo e não existia antes — cobrir explicitamente

#26 IDOR em reservas — 3 caminhos sem checagem de posse (`3360fde`)
(a) `GET /reservations/:id` fazia `findUnique` puro: qualquer usuário
autenticado lia qualquer reserva, incluindo `user.email` de terceiro.
(b) O atalho de idempotência do `cancel()` devolvia a reserva INTEIRA
antes de chamar o `assertCanModify` — dava pra ler reserva alheia já
cancelada. (c) `updateGroup` chamava `assertCanModify` só em
`reservations[0]` e depois atualizava o grupo todo no loop
→ Fix: (a) `findOne(id, currentUser)` com a mesma regra do `restrictToOwn`
do `findAll`, lançando **NotFoundException** (não Forbidden — não
confirma a um estranho que o ID existe); (b) gate movido pra dentro do
atalho via `assertOwnerOrPrivileged`; (c) checagem por item dentro do loop
→ Detalhe que custou análise: `assertCanModify` NÃO servia pro caso (b),
porque ele trata soft-deleted como "não encontrada" e toda reserva
CANCELLED tem `deletedAt` preenchido — daí a extração do
`assertOwnerOrPrivileged` (permissão pura, sem I/O, sem checar existência)

#27 Tabela nova criada sem o bloco RLS da ADR-001
A migration `20260727192910_add_reservation_created_by_and_notification`
criou a `Notification` sem `ENABLE ROW LEVEL SECURITY` e sem `REVOKE` de
anon/authenticated — era a única das 7 tabelas do schema fora do padrão,
alcançável pela chave anon do Supabase se ela vazasse (título, corpo e
`userId` de cada destinatário)
→ Fix (`fb2a446`): migration aditiva
`20260918000000_enable_rls_notification`, mesmo bloco `DO $$ ... END $$`
do `20260709000000_add_schedule_table`, + rollback no padrão da ADR-001
→ Lição: o padrão da ADR-001 não é automático — toda migration que cria
tabela precisa carregar o bloco (virou regra absoluta, ver acima)

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
POST /auth/register @Public (throttle 5/hora/IP; `RegisterDto`: name,
email restrito a @am.senai.br via @Matches — âncora no fim, mensagem de
erro discreta que não revela o domínio; password @MinLength(6); SEM
campo role — sempre cria PROFESSOR via UsersService.create(); sem
auto-login, retorna 201 sem corpo; `2a4b9cb`)
POST /auth/logout JWT
GET /health @Public
GET /rooms @Public (salas ativas)
GET /rooms/:id @Public
GET /rooms/admin/all ADMIN
POST /rooms ADMIN (com auditoria CREATE_ROOM)
PATCH /rooms/:id ADMIN (com auditoria UPDATE_ROOM)
DELETE /rooms/:id ADMIN (soft delete, auditoria DEACTIVATE_ROOM)
GET /reservations JWT (filtros: roomId, date, status, mine, page, pageSize)
GET /reservations/:id JWT (desde `3360fde` recebe o usuário autenticado
via @Request e checa posse: PROFESSOR só vê a própria; COORDENADOR/ADMIN
veem qualquer uma. Não-dono recebe **NotFoundException** com a mesma
mensagem do "não existe" — de propósito, pra não confirmar que o ID é
válido. Ver Bug histórico #26)
GET /reservations/day JWT (query date=YYYY-MM-DD obrigatório, valida
formato ou 400; rota declarada ANTES de :id no controller pra não ser
capturada pelo param dinâmico, mesmo padrão de POST /reservations/range;
sem restrictToOwn — qualquer role autenticada vê todas as reservas do
dia; filtra só PENDING/APPROVED; shape reduzido pra PROFESSOR sem nome
do professor (privacidade), shape completo +professor/createdByUserId
pra COORDENADOR/ADMIN; notes e user.email nunca retornam; `4994fff`)
POST /reservations PROFESSOR | COORDENADOR | ADMIN (valida data passada + conflito + lock;
aceita ownerUserId? opcional — proxy, só COORDENADOR/ADMIN; status inicial PENDING pra
PROFESSOR, APPROVED pra COORDENADOR/ADMIN — ReservationsService.initialStatus(role))
POST /reservations/range PROFESSOR | COORDENADOR | ADMIN (lock+conflito por data, skip em
conflito, max 60 dias, mesmo suporte a ownerUserId? do create())
PATCH /reservations/:id JWT (qualquer role autenticada)
PATCH /reservations/:id/status COORDENADOR|ADMIN (APPROVED|REJECTED)
PATCH /reservations/group/:id JWT (qualquer role autenticada; desde
`3360fde` a posse é checada por item DENTRO do loop — antes era só em
`reservations[0]`. Best-effort sequencial idêntico ao updateSelected:
aborta no primeiro item sem permissão, sem transação agrupando o lote,
sem rollback dos itens já aplicados. Ver Bug histórico #26)
PATCH /reservations/selected JWT (qualquer role autenticada)
DELETE /reservations/:id JWT (soft delete via deletedAt, idempotente —
cancelar reserva já CANCELLED continua retornando sucesso; desde
`3360fde` a posse é checada ANTES do atalho de idempotência, via
`assertOwnerOrPrivileged`, senão vazava a reserva alheia já cancelada.
Ver Bug histórico #26)
GET /availability @Public (date obrigatório, turno opcional; considera só
reservas APPROVED — PENDING não conta como ocupação, fix pós-F9.9)
GET /schedules @Public → { registros, turnoMap }
GET /dashboard @Public → DashboardResult (contadores SQL)
POST /sync/schedules ADMIN → guard vazio + DELETE + INSERT batch 500
(desde `c482a2e` o token vai no CORPO do POST pro Apps Script — `{action:
'listSchedules', token}` via `https.request` nativo com redirect manual,
não mais `?token=` na URL nem `fetch`. Ver Bug histórico #24)
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

RLS (ADR-001): as 7 tabelas + `_prisma_migrations` têm RLS deny-all
(nenhuma policy) + REVOKE de anon/authenticated. A Notification só
entrou nesse padrão em `fb2a446` (migration
`20260918000000_enable_rls_notification`) — **já pushada, mas ainda NÃO
aplicada**: o CI está vermelho desde 18/09 e o CD nunca rodou, então o
`migrate deploy` não chegou a executar em lugar nenhum. Nada no código muda por
causa de RLS: o backend conecta como role `postgres`, que tem
`rolbypassrls = true`. Ver Bug histórico #27 e o rollback em
`prisma/rollback/`.

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

## OWNERSHIPSERVICE (dois métodos desde `3360fde`)

```typescript
// Existência + permissão. Lança NotFoundException se não existe OU está
// soft-deleted; ForbiddenException se não tem permissão. Retorna a reserva.
await this.ownershipService.assertCanModify(reservationId, currentUser);

// Só permissão, sem I/O e sem checar existência — pra quando o objeto já
// está em mãos (veio de um findMany) ou quando ele é legitimamente
// soft-deleted (reserva CANCELLED no atalho de idempotência do cancel()).
this.ownershipService.assertOwnerOrPrivileged(reservation, currentUser);
```

ADMIN e COORDENADOR passam em qualquer reserva (mesmo nível que já têm
pra aprovar/rejeitar via `PATCH /reservations/:id/status`; a ação fica no
AuditLog). O dono passa na própria. Qualquer outro: ForbiddenException.

`assertCanModify` chama `assertOwnerOrPrivileged` internamente — a regra
de permissão existe em UM lugar só. Quando o chamador já tem o objeto,
usar a versão pura evita um `findUnique` redundante (é o que o
`updateGroup` faz); o `updateSelected` continua usando `assertCanModify`
porque só tem os `ids`, precisa da query pra buscar o objeto.

---

## FRONTEND — ARQUIVOS-CHAVE

apps/reservations/src/
services/
apiTypes.ts ← tipos da API (fonte única pós-F9.7); DayReservationItem/
DayReservationsResponse desde `4994fff`
nestjsApiService.ts ← cliente NestJS (sem fallback Apps Script);
getDayReservations(date) desde `4994fff`
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
Login/index.tsx ← ver seção DESIGN SYSTEM → LOGIN abaixo (redesign
COMMITADO em `844e138`); link "Não tem conta? Criar conta" → /registro
desde `2a4b9cb` (cor var(--color-blue), ver Bug histórico #22)
Register/index.tsx ← NOVO (`2a4b9cb`) — rota pública /registro, mesmo
shell visual do Login (fora do AppLayout, fetch direto pro backend, sem
nestjsApiService). Sem auto-login: sucesso mostra confirmação e
redireciona pro /login. Erro 409 → "email já cadastrado"; 400 →
mensagem institucional discreta (não expõe @am.senai.br); link "Já tem
conta? Entrar" → /login
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
DatePicker.tsx / TimePicker.tsx ← dropdown customizado substituindo
input nativo type=date/time em 6 arquivos; exportam
buildMonthGrid()/buildTimeSlots() puras (ainda sem teste automatizado
próprio, só validação interativa via Playwright). Commitados em
`7c336c8`. Ver seção FRONTEND — LEVA DARK-FIRST (item 4) pra detalhe completo
Select.tsx ← NOVO (`f0fda1e`+`baf7e3d`) — port do TimePicker
generalizado pra {value,label}[], reaproveita classes .ui-picker-\* de
global.css. Substitui <select> nativo em 6 lugares (EditSelectedView,
Admin/Usuarios, Admin/Auditoria, OccupancyDashboard, Reservas,
ReservationForm). Bug histórico #21: onChange só dispara quando o valor
muda de fato (paridade com <select> nativo)
reservations/
ReservationCalendar.tsx ← wrapper do FullCalendar; dayMaxEvents ligado +
popover "+N mais" restilizado com tokens glass (global.css); prop
onDateClick (dateClick do interactionPlugin) desde `4994fff`
DayReservationsPanel.tsx ← NOVO (`4994fff`) — drawer lateral direito
(400px, glass dark) com as reservas do dia clicado no calendário de
/reservas; sala/horário/status badge/turma; professor só visível pra
COORD/ADMIN; fecha por X/Esc/clique-fora; clicar numa reserva abre o
ReservationDetailsModal existente. Consome getDayReservations(date) de
nestjsApiService.ts (GET /reservations/day)

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
/health); as 4 abertas pro COORDENADOR ficam sem guard próprio. Rota
pública /registro (lazy, fora do AppLayout, mesmo padrão de /login)
desde `2a4b9cb`.
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
(`rgba(15, 36, 64, 0.82)`, mesmo valor nos dois temas — sidebar é
intencionalmente theme-invariant), não um gradiente diagonal. Isso ficou
errado aqui por pelo menos um round de atualização sem ser pego.

Desde a Fase 1 do redesign dark-first (`7c336c8`, ver FRONTEND — LEVA
DARK-FIRST item 2), `:root` é a base **dark** e `[data-theme='light']`
é o override — inverteu o que valia antes (`:root` light,
`[data-theme='dark']` como override). Não duplicar a lista inteira de
valores aqui de novo — é exatamente esse tipo de duplicação que já
ficou stale mais de uma vez. Valores exatos:
`apps/reservations/src/styles/global.css` linhas 16-84 (`:root` dark +
`[data-theme='light']` override), ou `apps/reservations/DESIGN.md`
(sincronizado com o global.css real em `e3b6f15`). O que vale lembrar
sem ir ler o arquivo:

- `--color-bg` dark: `#07111f` (não `#0d1117` — mudou na própria Fase 1)
- `--shadow-s`/`--shadow-m` dark são bem mais fortes que o light (o
  `[data-theme='dark']` antigo nunca tinha sombra própria, usava a
  sombra clara quase invisível no escuro)
- `--sidebar-bg`, `--color-brand*`, `--color-accent`, `--glass-blur-*`,
  `--radius*`, `--ease`/`--dur` não mudam por tema (declarados uma
  única vez, sem bloco duplicado)

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
- body: gradiente mesh radial em 2 camadas — no dark (padrão hoje), só
  glows frios de navy, sem laranja cobrindo área grande; no light
  (`[data-theme='light']`, override), preserva o mesh original
  navy+laranja intocado — nunca cor semântica no mesh, nos dois temas
- `[data-theme='light']` restaura os valores claros originais como
  override; `--sidebar-bg` NÃO é sobrescrito por nenhum tema (sidebar é
  intencionalmente theme-invariant)
- `:focus-visible` global (pós-F9.9): outline 2px var(--color-blue) !important
  (precisa !important pra vencer outline:'none' inline nos inputStyle/buttonStyle)

### LOGIN (redesign — COMMITADO em `844e138`, 2026-07-31)

`apps/reservations/src/pages/Login/index.tsx` e
`apps/reservations/src/assets/images/login-lab.jpg` — commitados, não é
mais working tree pendente (correção: versão anterior deste arquivo
dizia "NÃO COMMITADO").

Duas iterações no mesmo arquivo, nesta ordem (ambas já no commit final):

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

## FRONTEND — LEVA DARK-FIRST (commit `7c336c8`, 2026-08-02)

Tudo abaixo foi commitado em `7c336c8` — 100% frontend/CSS/componente
React, zero mudança em backend/schema/API. Ordem cronológica da sessão
original em que foi escrito. O mesmo commit também corrigiu 2 bugs reais
não listados nos 4 itens abaixo (professor sem reservas — ver Bugs
históricos #20).

### 1. Polimento visual do Dashboard + dot de pendentes na sidebar

- `DashboardStats.tsx`: cards de estatística ganharam a receita de vidro
  de 3 partes (`backdrop-filter: blur(--glass-blur-s) saturate(140%)` +
  `--glass-sheen`), raio `--radius-s`→`--radius`, padding 14→16px.
  `Dashboard/index.tsx`: painéis de busca (turma/sala) e barra de turno
  ganharam o mesmo tratamento — consistência entre os blocos da página.
- `AppLayout.tsx`: dot **persistente** (não confundir com o efêmero
  `notifyPath` já existente) no ícone "Aprovações" da sidebar, visível
  enquanto existir ≥1 reserva `PENDING` no sistema. Reusa
  `usePendingReservations` (mesmo wiring de `Aprovacoes/index.tsx`,
  `createNestjsApiService()` + `{status:'PENDING'}`), `autoFetch:
canApprove` (só busca pra COORDENADOR/ADMIN — PROFESSOR nem vê a rota
  na sidebar). Refetch via um segundo `useRealtimeSocket` (não filtrado
  por tipo de evento, mesmo padrão do `disp.refetch()` do Dashboard).
  CSS **reaproveitado**, zero novo: `.sidebar-notify-dot` +
  `@keyframes notifyPulse` já existiam (usados pelo dot efêmero).
- Achado do detector `impeccable`: `TurnoCard`'s `borderLeft: 3px solid`
  em `DashboardStats.tsx:159` foi flagado como antipattern `side-tab`
  (padrão comum de UI genérica) — **usuário confirmou intencional**
  (cor semântica real de turno, não decorativa) e a exceção foi
  persistida em `.impeccable/config.json` (`detector.ignoreValues`,
  escopada a esse arquivo+regra, com `reason`).

### 2. Redesign dark-first — Fase 1 (fundação)

Decisão de produto: dark vira o tema padrão ao abrir o app (sem preferência
salva); light sobrevive como opção via o botão sol/lua já existente. Sem
neumorphism (rejeitado). **Nota**: quando essa missão começou, o MEMORY.md
não tinha essa decisão registrada apesar de o brief afirmar que tinha —
divergência real, sinalizada na hora, não inventada aqui.

- `global.css`: **inversão mecânica de `:root`/`[data-theme]`** — `:root`
  agora é a base DARK (era light); `[data-theme='light']` é o novo
  override (contém os valores que antes eram o `:root`). Não existe mais
  bloco `[data-theme='dark']` (dark já é o padrão). Os tokens `-l`
  (`--color-green-l` etc.) **não foram duplicados** — o valor dark
  translúcido que já existia no antigo `[data-theme='dark']` foi
  realocado pro `:root` novo; o pastel sólido original foi realocado pro
  `[data-theme='light']` novo. `--color-bg: #07111f` (novo, era
  `#0d1117`). `--shadow-s`/`-m` ganharam valores dark reais pela primeira
  vez (achado: o `[data-theme='dark']` antigo nunca tinha sombra própria,
  usava a sombra clara quase invisível no escuro). `--glass-sheen` dark
  já estava certo (`rgba(255,255,255,.08)`), só realocado.
- `body`: gradiente mesh dark perdeu as 2 elipses laranja (viraram navy)
  — zero laranja no fundo, mesmas 4 posições/opacidades só recoloridas.
  Light preserva o mesh original (navy+laranja) sem nenhuma mudança.
- `.topbar` virou **pill flutuante**: `position: fixed` (não mais sticky
  em fluxo), `border-radius: 28px` (= metade de `--header-h`, cápsula de
  verdade), margem lateral 24px + topo 16px, `.main-wrap.collapsed
.topbar` ajusta o `left` (acompanha o collapse da sidebar).
  `.page-content` ganhou `padding-top: calc(var(--header-h) + 36px)` pra
  compensar a pill ter saído do fluxo. Mobile (`@media max-width:768px`):
  volta a `position: sticky` full-width com `border-bottom`, `!important`
  em `left`/`margin` (mesmo padrão defensivo já usado por `.main-wrap`)
  pra um `collapsed` persistido do desktop não vazar pro mobile.
- `AppLayout.tsx`: default de tema mudou de `matchMedia('prefers-color-
scheme: dark')` pra `'dark'` fixo quando não há escolha salva em
  localStorage. Persistência da escolha do usuário intocada.
- `index.html` — **fora da lista de leitura obrigatória da missão, mas
  necessário** (senão dava flash light→dark no F5): `<html
data-theme="light">` hardcoded virou `"dark"`; o script inline parava
  de consultar `matchMedia` (só respeita `localStorage.theme` agora);
  cores do loader pré-React (spinner/texto) recalibradas pro fundo
  escuro, com override `[data-theme="light"]` restaurando o original.

### 3. Calendário/Reservas integrado ao design system

- Glass (receita de 3 partes) aplicado em: os 4 cards de estatística de
  `Reservas/index.tsx` (Total/Pendentes/Aprovadas/Rejeitadas), o painel
  do formulário "Nova reserva", o painel "Todas as reservas",
  `RoomAvailabilityPanel.tsx`, e o wrapper de `ReservationCalendar.tsx`.
- **Bug real corrigido**: `RoomAvailabilityPanel.tsx` usava
  `var(--color-bg)` (fundo opaco da página inteira) nos itens internos
  — dentro de um painel que virou glass, isso parecia um buraco em vez
  de superfície elevada. Trocado pro token certo pra item aninhado
  dentro de glass: `--color-surface-2` (mesmo padrão de `.slot-item`
  dentro de `.avail-card`, já documentado no DESIGN.md). Ver Bug
  histórico #18.
- **FullCalendar ganhou tema pela primeira vez** — antes só existia
  override pro popover "+N mais" (pós-F9.9); toolbar/grade/eventos
  usavam CSS padrão do FullCalendar (visual genérico, sem relação com o
  design system). Agora em `global.css`: toolbar (botões glass/brand-
  ativo), cabeçalho de coluna (label style), número do dia (tabular-
  nums), hoje destacado (`--color-accent-l`, único ember na grade),
  eventos = pills verdes (`--color-green`/`-l` — nesta tela todo evento
  já é uma reserva `APPROVED`, cor semântica real, não decoração).
- **Bug real corrigido**: `text-transform: capitalize` no título do
  toolbar quebrava "agosto de 2026" (locale pt-br, tudo minúsculo) em
  "Agosto **De** 2026" (capitalizava a preposição também). Fix:
  `::first-letter` em vez de `text-transform`, capitaliza só o "A"
  inicial.
- Achado do detector: mesmo antipattern `side-tab` em
  `RoomAvailabilityPanel.tsx`'s `EventoItem` (`borderLeft: 3px solid`,
  cor por tipo aula/reserva) — **sinalizado ao usuário, ainda NÃO
  confirmado/suprimido** (diferente do achado #1 acima, que já foi
  confirmado). Perguntar antes de mexer ou suprimir.

### 4. `DatePicker`/`TimePicker` — componentes novos

Dois componentes novos em `apps/reservations/src/components/ui/`
(`DatePicker.tsx`, `TimePicker.tsx`) — dropdown customizado glass,
substituindo `<input type="date">`/`<input type="time">` nativo em
**6 arquivos, 12 inputs**: `Reservas/index.tsx` (1 data), `ScheduleHeader.tsx`
(1 data), `ReservationForm.tsx` (3 data + 2 hora), `EditSelectedView.tsx`
(2 hora), `OccupancyDashboard.tsx` (1 data), `Admin/Auditoria/index.tsx`
(2 data).

- `value`/`onChange` mantêm o **mesmo contrato** dos inputs nativos que
  substituíram (`YYYY-MM-DD` / `HH:MM`, sempre string) — zero mudança em
  lógica de formulário, validação ou conflito.
- Matemática de grade do `DatePicker` usa `Date.UTC(...,12)`+`getUTC*`
  (UTC noon trick) — **reaproveita** `ymdToUtcDate`/`todayYmd`/
  `formatDataBR`/`weekdayShort` de `scheduleDateUtils.ts`, não duplica.
  `buildMonthGrid()` e `buildTimeSlots()` são funções puras exportadas
  (testáveis sem montar o componente — ainda sem teste automatizado
  escrito, ver pendência).
- `TimePicker` default `min='06:00' max='23:00' step={30}` — não é regra
  de negócio nova, é o horário de reserva já documentado no projeto; o
  backend continua sendo a validação autoritativa, isso só afeta o que
  o dropdown lista.
- Prop nova `align?: 'left'|'right'` nos dois componentes — **bug real
  encontrado e corrigido**: o `DatePicker` do `ScheduleHeader` (perto da
  borda direita da topbar do Dashboard) vazava pra fora do viewport.
  Corrigido seguindo o mesmo padrão que `NotificationBell.tsx` já usa
  pra esse exato problema (`right: 0` em vez de `left: 0`). Ver Bug
  histórico #19.
- **Bug histórico #8 corrigido de passagem**: `ReservationForm.tsx`
  tinha 3 ocorrências de `new Date().toISOString().slice(0,10)` pra
  calcular "hoje" (exatamente o padrão do Bug #8) — como essas linhas já
  estavam sendo reescritas pra virar `min` do `DatePicker`, trocadas pra
  `todayYmd()`.
- Campos que tinham `onBlur` pra marcar "touched" (validação) tiveram
  essa marcação movida pro `onChange` — dropdown não tem blur natural
  equivalente ao de um input de texto.
- Validado interativamente via Playwright (abrir, navegar mês,
  selecionar, fechar, valor correto no campo) em dark/light/mobile —
  sem testes automatizados (Vitest) escritos ainda pras funções puras
  `buildMonthGrid`/`buildTimeSlots`. **Pendência real.**

---

## SITEMAP ATUAL

PÚBLICAS (sem autenticação, fora do AppLayout)
/login Login
/registro Registro público de professor — sempre cria PROFESSOR,
restrito a e-mail @am.senai.br (novo, `2a4b9cb`)

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

## CONTAGEM DE TESTES (rodado de verdade em 2026-09-22 — reconfirmar se

## muito tempo passar desde essa data)

Frontend (apps/reservations): **311 testes, 33 suites**, todos verdes —
`pnpm --filter @salas-senai/reservations exec vitest run --reporter=dot
--no-coverage` (sem mudança desde 08-14 — a leva de segurança não tocou
frontend; `Register/index.tsx` continua sem suíte própria, mesma exceção
de DatePicker/TimePicker/Select)
Backend (apps/api): **152 testes, 12 suites**, todos verdes —
`pnpm --filter @salas-senai/api test:unit` (+11 testes desde 08-15, sem
suíte nova: toda a leva de segurança caiu em specs já existentes —
`sync.service.spec.ts` e `reservations.service.spec.ts`, ver lista abaixo)
E2E (Playwright): 23 passando, 9 skip (legado) — NÃO re-rodado nesta
sessão (precisa backend+frontend de pé, mais custoso); mais recente que
essa contagem: tests/e2e/proxy-and-approval.spec.ts (4 testes novos,
cobrindo auto-aprovação por role, proxy de professor, bug fix de
PENDING em /availability) + 1 teste novo em navigation.spec.ts
(/minha-agenda pra PROFESSOR). setupCoordenadorSession adicionado em
helpers/auth.ts. Total exato de E2E não confirmado — rodar antes de
confiar cegamente.

Arquivos de teste relevantes adicionados desde a última contagem
confiável (Fases A-C3 + leva de 2026-08, todos já refletidos nos totais
verdes acima):

- `apps/api/src/modules/availability/__tests__/availability.service.spec.ts` (novo)
- `apps/api/src/modules/notifications/__tests__/notifications.service.spec.ts` (novo)
- `apps/api/src/common/__tests__/cors-origins.util.spec.ts` (novo)
- `apps/api/src/modules/reservations/__tests__/reservation-reminder.service.spec.ts` (novo)
- `apps/reservations/src/pages/MinhaAgenda/__tests__/index.test.ts` (novo)
- `apps/reservations/src/components/ui/__tests__/NotificationBell.test.ts` (novo)
- `apps/reservations/src/components/reservations/__tests__/ReservationList.test.ts`
  (novo, `7c336c8` — cobre `groupReservations()`, ver Bug histórico #20)
- 7 casos novos em `reservations.service.spec.ts` cobrindo `findByDay`
  (`4994fff`, shape por role/filtros/select sem dados sensíveis)
- `apps/api/src/modules/auth/__tests__/auth.service.spec.ts` (novo,
  `2a4b9cb` — primeira suíte do módulo auth: delegação sem role,
  propagação do 409 de e-mail duplicado, ausência de tokens; a
  validação do `@Matches`/400 do DTO em si é efeito do `ValidationPipe`
  e não é coberta aqui — validada manualmente via PowerShell, ver
  mensagem do commit)
- `reservations.service.spec.ts`, `users.service.spec.ts`, `router.test.ts`
  expandidos (não novos, ganharam casos)
- Leva de segurança (+11 no backend, nenhuma suíte nova):
  `sync.service.spec.ts` +2 (token no corpo e nunca na URL; **redirect de
  dois saltos** — mock de `node:https` que devolve 302+Location na 1ª
  chamada e 200 na 2ª, conferindo que a 2ª continua POST com o mesmo
  body; esse é o teste que pega o Bug #24, e foi validado por mutation).
  `reservations.service.spec.ts` +9 (4 de posse no `findOne`, 1 no atalho
  de cancelamento de reserva alheia já cancelada, 2 no `updateGroup` com
  donos diferentes — incluindo a asserção de que o item já aplicado
  antes da falha permanece aplicado —, 2 de COORDENADOR modificando
  reserva de terceiro em `update`/`cancel`, cobertura que só existia com
  ADMIN antes). O mock de `node:https` e o `mockPrisma.reservation.update`
  foram adicionados ao spec nessa leva
  NOTA: o projeto NÃO usa @testing-library/react em lugar nenhum — todos
  os testes de componente React cobrem funções puras extraídas
  (sortSalas, getViewState, filterSalas, applyScheduleFilters,
  groupReservations), nunca renderizam JSX. Ao pedir testes novos pra um
  componente, extrair a lógica pura em vez de tentar montar/renderizar.
  `DatePicker`/`TimePicker`/`Select` são a exceção pendente — ainda sem
  suíte própria pras funções puras que exportam (ver PENDENTE acima).

---

## INFRAESTRUTURA — Docker local (SENAI on-prem)

Caminho de deploy ADITIVO pro servidor Windows local do SENAI,
alternativo ao Railway/Supabase/GitHub Pages (nuvem intacta —
`railway.json`/`cd.yml`/`ci.yml` não foram tocados). Commitado em duas
missões (`425aaaa`+`1d796b2`, 2026-08-09) — **nunca rodado de fato**
(sem Docker no ambiente de dev usado nas duas sessões que escreveram
isso). Ver PENDENTE acima.

`infra/docker/`:

- `Dockerfile.api` — multi-stage. Builder: `node:22-alpine` + `apk
python3 make g++` (bcrypt tem binding nativo), copia o monorepo inteiro
  (pacotes workspace precisam estar presentes em build-time, mesmo
  raciocínio do `buildCommand` do `railway.json` real), `pnpm install
--frozen-lockfile` + `prisma generate` + build; `prisma/seed.ts`
  compilado à parte via `tsc` isolado com flags explícitas (não passa
  pelo `tsconfig.build.json`, que exclui `prisma/` de propósito) pra
  rodar sem `ts-node`/devDependencies em produção. Runner: copia
  `node_modules` (raiz + `apps/api`, preserva os symlinks do pnpm),
  `dist/`, `prisma/`; `ENTRYPOINT ["sh", "/app/entrypoint.sh"]`.
- `Dockerfile.frontend` — multi-stage (vite build + `nginx:alpine`).
  `VITE_API_URL` via build ARG (build-time, gravado no bundle). Sem
  `--base` (usa `/` — a nuvem usa `/salas-senai-monorepo/` por causa do
  subpath do GitHub Pages).
- `entrypoint.sh` (`sh`/ash, não bash — Alpine não tem bash por padrão)
  — roda em todo boot do container do backend, antes do NestJS subir:
  `set -e` (aborta se migration falhar), `node_modules/.bin/prisma
migrate deploy --schema apps/api/prisma/schema.prisma` (idempotente,
  seguro rodar em todo boot), seed condicional (só com
  `SEED_FORCE=true` — o container roda `NODE_ENV=production` sempre e
  `seed.ts` bloqueia produção; o comando do seed prefixa
  `NODE_ENV=development` só nele mesmo, sem `export`, preservando o
  guard pro resto do processo), `exec node apps/api/dist/main.js` (node
  vira PID 1 e recebe SIGTERM direto do Docker — sem `exec` o sinal
  morre no shell e o Docker mata na força no timeout).
- `docker-compose.yml` — `postgres:16-alpine` (volume `pgdata`, sem
  `ports:` expostas — só rede interna, healthcheck `pg_isready`), `api`
  (depends_on postgres `service_healthy`, porta 3000, `DATABASE_URL` ==
  `DIRECT_URL` apontando pro mesmo `postgres:5432` do compose — sem
  pgbouncer local, diferente da Supabase em nuvem), `frontend` (nginx,
  porta 80, depends_on api). Rede bridge própria (`salas-senai`).
- `.env.local.example` — template com placeholders; `.env.local` real
  gitignored.
- `nginx.conf` — SPA fallback (`try_files`) pras rotas do React Router.
- `README.md` — guia de setup pra TI do SENAI; documenta o fluxo
  `SEED_FORCE=true` no primeiro boot, depois volta pra `false`.

---

## CI/CD

### CI (.github/workflows/ci.yml)

Job validate: typecheck frontend → prisma generate → build backend →
lint frontend+backend → unit tests → build frontend
Job e2e: prisma migrate deploy → start backend → wait-on /health →
playwright (THROTTLE_SKIP=true pra evitar 429 no polling)
Node 22, branch master, secrets: DATABASE_URL, DIRECT_URL,
JWT_SECRET, JWT_REFRESH_SECRET, APPS_SCRIPT_URL, APPS_SCRIPT_TOKEN
⚠️ `prisma migrate deploy` roda em DOIS lugares: no job `e2e` do CI
(contra `secrets.DATABASE_URL`) e no CD. Se o DATABASE_URL do CI apontar
pro mesmo banco de produção, toda migration é aplicada já no CI do PR,
antes do CD — conferir pra onde esse secret aponta antes de assumir que
o CD é o único caminho de aplicação.

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
  -Body '{"email":"admin@senai.edu","password":"admin@senai****"}'
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
