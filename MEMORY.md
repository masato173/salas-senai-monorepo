# MEMORY.md — Controle de Salas SENAI

# Cérebro persistente do projeto — leia ANTES de qualquer tarefa

# Atualizado: 2026-07-11 | Fase atual: F6.1 concluída

---

## IDENTIDADE DO PROJETO

**Nome:** Controle de Salas SENAI
**Instituição:** SENAI Manaus (Amazonas)
**Propósito:** Sistema institucional de reserva e gestão de salas
**Repositório:** github.com/masato173/salas-senai-monorepo
**Monorepo:** C:\dev\monorepo (pnpm workspace)
**Comunicação:** PT-BR informal

---

## STACK EM PRODUÇÃO

### Frontend — apps/reservations

React 18 + TypeScript + Vite
Zustand (estado global)
React Query (fetch — hook manual, não TanStack Query)
Tailwind — NÃO USADO (projeto usa CSS vars próprias)
Lucide React (ícones)
FullCalendar (calendário)
React Router DOM

### Backend — apps/api

NestJS 10
PostgreSQL via Supabase (São Paulo — aws-1-sa-east-1)
Prisma 5.22 (ORM)
pgbouncer (transaction mode — RESTRIÇÃO CRÍTICA)
JWT + Refresh Token
Socket.IO (WebSocket namespace /rooms)
RBAC (PROFESSOR | COORDENADOR | ADMIN)

### Infraestrutura

Supabase free tier (pausa após ~5-10min de inatividade — Bug Histórico #1)
RLS habilitado em todas as tabelas (ADR-001)
Google Apps Script (legado — apenas fonte de sync de aulas)
GitHub Pages (frontend legado estático)

---

## ESTADO POR FASE

✅ Fase 0 Legado funcional (HTML + Apps Script + Google Sheets)
✅ Fase 1 Modularização do frontend legado
✅ Fase 2 Backend proxy (absorvido pelo NestJS)
✅ Fase 3 React + Vite + hooks + componentes
✅ Fase 4 Backend NestJS completo
AuthModule, UsersModule, RoomsModule, ReservationsModule
AvailabilityModule, AuditModule, SyncModule, SchedulesModule
RealtimeGateway (Socket.IO /rooms + JWT no handshake)
HealthModule, RBAC guards
✅ Fase 5 Migração frontend + cutover definitivo (NestJS = backend oficial)
LoginPage + authStore + tokenStorage
apiClient (JWT auto-header + refreshLock + retry 401)
nestjsApiService (adapter drop-in + ReservationAdminApi)
SyncModule (DELETE + INSERT batch 500, sem $transaction)
AvailabilityModule com Schedule (livre|reserva|aula|conflito)
ADR-003: cutover oficial declarado
✅ F6.1 Portal Aprovações
usePendingReservations + useApproveReservation + useRejectReservation
ReservationAdminApi (interface por domínio, AppsScriptService intacta)
Página /aprovacoes (cards + busca + toggle + estados)
ProtectedRoute requiredRole=COORDENADOR
🔄 F6.2 Shell do Portal Admin (próxima sprint)
⏳ F6.3 Dashboard Admin
⏳ F6.4 Auditoria
⏳ F6.5 Sincronização
⏳ F6.6 Sistema
⏳ F6.7 Usuários + Permissões (requer backend: UsersController não existe)
⏳ F6.8 Configurações + Logs + API + Health (placeholders)
⏳ F7.1 Remover CURRENT_USER hardcoded
⏳ F7.2 Cron de sync (@nestjs/schedule)
⏳ F7.3 Socket.IO client no frontend
⏳ F7.4 Testes E2E com Playwright

---

## CONTAGEM DE TESTES

Frontend (apps/reservations): 281 testes (24 suites)
Backend (apps/api): 54 testes (5 suites)
Total: 335 testes

---

## ENDPOINTS DO BACKEND (todos em produção)

POST /auth/login @Public
POST /auth/refresh @Public
POST /auth/logout JWT
GET /health @Public
GET /rooms @Public (34 salas)
GET /rooms/:id @Public
GET /rooms/admin/all ADMIN
POST /rooms ADMIN
PATCH /rooms/:id ADMIN
DELETE /rooms/:id ADMIN
GET /reservations JWT (filtros: roomId, date, status, mine)
GET /reservations/:id JWT
POST /reservations JWT
PATCH /reservations/:id/status COORDENADOR|ADMIN (APPROVED|REJECTED)
PATCH /reservations/:id JWT
DELETE /reservations/:id JWT
GET /availability @Public (filtros: date obrigatório, turno opcional)
→ status: livre|reserva|aula|conflito por sala
GET /schedules @Public → { registros, turnoMap }
POST /sync/schedules ADMIN → DELETE + INSERT batch 500 (sem $transaction)
GET /audit ADMIN (filtros: entityType, entityId, userId,
action, from, to, page, limit max 100)
WebSocket /rooms JWT no handshake
eventos: reservation.created/updated/approved/rejected/cancelled

---

## SCHEMA PRISMA (modelos em produção)

User id, name, email, passwordHash, role, active, deletedAt
Room id, name, type, capacity, floor, available
Reservation id, userId, roomId, groupId, date(string), inicio, fim,
status, notes, clientRequestId, deletedAt
AuditLog id, action, entityType, entityId, userId, before, after, ip
RefreshToken id, userId, tokenHash, expiresAt, revokedAt
Schedule id, date, sala, turma, mes, turno (sem FK para Room)
enum Role: PROFESSOR | COORDENADOR | ADMIN
enum RoomType: SALA_COMUM | LAB_GERAL | LAB_INFORMATICA |
LAB_CLP | LAB_ELETRICA | LAB_SMT | LAB_ELETRONICA
enum ReservationStatus: PENDING | APPROVED | REJECTED | CANCELLED

---

## HOOKS FRONTEND (todos testados)

useListReservations(service) → { data, status, error, refetch }
useCreateReservation(service) → { execute, status, error }
useCancelReservation(service) → { execute, status, error } + retry idempotente
useSchedule(service) → { data, status, error, refetch }
useAvailability(registros, ...) → AvailabilityResult (local)
useAvailabilityBackend(date, turno) → AvailabilityResult (NestJS)
usePendingReservations(service, filters) → { data, status, error, refetch }
useApproveReservation(service) → { execute, status, error }
useRejectReservation(service) → { execute, status, error }

---

## SERVICE LAYER

appsScript.ts AppsScriptService (interface legado — NUNCA ALTERAR)
nestjsApiService.ts createNestjsApiService(fallback)
→ AppsScriptService & ReservationAdminApi
→ drop-in replacement nos orquestradores
apiClient.ts apiFetch<T>(path, init?) — JWT auto-header
refreshLock — evita refresh concorrente
ApiError(status, message, code)
authStore.ts Zustand — selectUser, selectAccessToken, clearAuth
tokenStorage.ts localStorage swappable — isolado do authStore

---

## DESIGN SYSTEM (frontend)

```css
/* Tokens obrigatórios — em global.css */
--color-brand: #1e3a5f /* azul SENAI */ --color-accent: #e07c2b /* laranja SENAI */
  --color-bg: #f4f5f7 --color-surface: #ffffff --color-surface-2: #f8f9fb --color-border: #e4e6ea
  --color-text: #111827 --color-muted: #6b7280 --color-subtle: #9ca3af --color-green: #16a34a
  --color-green-l: #dcfce7 --color-amber: #b45309 --color-amber-l: #fef3c7 --color-red: #dc2626
  --color-red-l: #fee2e2 --color-blue: #2563eb --color-blue-l: #dbeafe --sidebar-bg: #0f2440
  /* sidebar escura */;
```

Ícones: lucide-react
Sem Tailwind, sem CSS-in-JS, sem bibliotecas UI novas
Dark mode: data-theme="dark" no documentElement

---

## SITEMAP E ROUTER

section: 'principal' | 'gestao' | 'sistema' | 'admin' (admin ainda não implementado)
PRINCIPAL (todos)
/ Dashboard
/agendamentos Agendamentos
/reservas PROFESSOR+
GESTÃO (COORDENADOR+)
/aprovacoes COORDENADOR+ ← F6.1
/salas COORDENADOR+
/turmas COORDENADOR+
SISTEMA
/relatorios COORDENADOR+
/configuracoes ADMIN
ADMIN (F6.2+ — só ADMIN, seção separada)
/admin Dashboard admin
/admin/usuarios Usuários
/admin/permissoes Permissões
/admin/auditoria Auditoria
/admin/sync Sincronização
/admin/sistema Sistema
/admin/configuracoes Configurações
/admin/logs Logs (placeholder)
/admin/api API (placeholder)
/admin/health Health (placeholder)

---

## BUGS HISTÓRICOS (NUNCA REPETIR)

#1 Supabase free tier pausa após ~5-10min de inatividade
→ Primeira request acorda o banco; transações longas expiram
→ Fix: DIRECT_URL (porta 5432) para migrations; retry manual no smoke test
#2 pgbouncer transaction mode NÃO suporta $transaction interativo
→ Operações longas (ex: sync 1522 registros) excedem timeout de 5s
→ Fix: DELETE + INSERT sequenciais em batches de 500 SEM $transaction
#3 PowerShell Invoke-RestMethod trunca arrays JSON grandes silenciosamente
→ registros.Count = 0 mesmo com 1522 itens no banco
→ Fix: usar Invoke-WebRequest + .Content para ver o raw JSON
#4 RLS na tabela Schedule bloqueia SELECT mesmo com dados inseridos
→ count() funciona (postgres bypassa RLS), findMany() retorna []
→ Fix: CREATE POLICY "schedule_select_all" + GRANT SELECT TO anon, authenticated
#5 window.clear() colide com método nativo do browser
→ Renomear funções customizadas para evitar shadowing de globals
#6 $transaction com timeout insuficiente para batches grandes
→ Usar { timeout: 30000 } ou eliminar $transaction (preferido para pgbouncer)
#7 exactOptionalPropertyTypes: true no tsconfig
→ groupId: undefined é inválido — usar spread condicional:
→ ...(value !== undefined ? { groupId: value } : {})
#8 instanceof ApiError falha em módulos mockados pelo Vitest
→ Fix: duck-typing com isApiLike(e): e is { status: number; message: string }
#9 ESLint no-redundant-type-constituents: enum union em param vira 'any'
→ Usar o enum completo no tipo, não union de valores
#10 Mocks de teste quebram quando construtor ganha novo argumento
→ Sempre atualizar makeService() nos specs ao adicionar dependência
→ Adicionar mockDelegate ao mockPrisma ao adicionar novo model
#11 Idempotência do cancel(): quickLookup (findUnique) roda ANTES de assertCanModify
→ Teste de idempotência DEVE mockar findUnique com status CANCELLED
→ Caso contrário $transaction é chamado mesmo para reserva já cancelada
#12 Prisma seed com pgbouncer: usar DIRECT_URL (porta 5432, não pooler)
#13 .env corrompido pelo Notepad (junta linhas de URL)
→ Sempre editar via PowerShell com [System.IO.File]::WriteAllText
#14 PowerShell WriteAllLines corrompe arquivo quando AddRange falha
→ Usar str_replace via Claude Code para edições de arquivo, não PS array ops
#15 TestAPIError.code com exactOptionalPropertyTypes
→ Declarar como: code: string | undefined (não code?: string)

---

## PADRÕES OBRIGATÓRIOS

### Anti-invenção

SEMPRE ler arquivos-fonte antes de propor código.
NUNCA inventar estrutura, interfaces, tipos ou imports.
Comando de verificação:

```powershell
Get-Content ".\apps\...\arquivo.ts" | Select-Object -First 50
Select-String -Path ".\apps\...\arquivo.ts" -Pattern "export"
```

### Escrita de arquivos (PowerShell)

```powershell
[System.IO.File]::WriteAllText(
  (Resolve-Path ".\path\arquivo.ts"),
  $content,
  [System.Text.UTF8Encoding]::new($false)  # UTF-8 sem BOM
)
```

### Validação obrigatória após cada sprint

```powershell
pnpm --filter @salas-senai/reservations typecheck
pnpm --filter @salas-senai/reservations exec vitest run --reporter=dot --no-coverage
pnpm --filter @salas-senai/reservations build
pnpm --filter @salas-senai/api test:unit
pnpm --filter @salas-senai/api build
```

### Lazy loading de páginas (padrão obrigatório)

```typescript
const MinhaPage = lazy(() => import('../pages/Minha'));
// + Suspense fallback={<RouteLoader />} no router
// + ProtectedRoute com requiredRole quando necessário
```

### Padrão de hook de query

```typescript
export function useXxx(service: XxxFetcher, options = {}): UseXxxResult {
  const [status, setStatus] = useState<QueryStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const [data, setData] = useState<XxxResponse['data']>(null);
  const serviceRef = useRef(service);
  serviceRef.current = service;
  // refetch + useEffect mount-only
}
```

### Padrão de hook de mutation

```typescript
export function useXxx(service: XxxUpdater): UseXxxResult {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<BackendError | null>(null);
  const serviceRef = useRef(service);
  // execute via useCallback
}
```

### Instanciação do service nos orquestradores

```typescript
const service = useMemo(() => {
  const appsScript = createAppsScriptService({ url: APPS_SCRIPT_URL, token: APPS_SCRIPT_TOKEN });
  return createNestjsApiService(appsScript);
}, []);
```

---

## DECISÕES ARQUITETURAIS TRAVADAS (ADRs)

ADR-001 RLS defense-in-depth — todas as tabelas com RLS + REVOKE anon/authenticated
ADR-002 Estado pré-cutover F4 — checklist completo (todos os itens marcados em F5)
ADR-003 Cutover oficial F5.8 — NestJS = backend oficial
Apps Script = apenas fonte de sync de aulas (POST /sync/schedules)
Decisão F4.0-A Reservation.date como String (YYYY-MM-DD), não DateTime
Paridade com legado Google Sheets
Decisão F4.10b Auth JWT no handshake WebSocket (sem cliente no frontend ainda — F7.3)
Decisão F5.3-B turma='' no nestjsApiService (campo legado sem equivalente no NestJS)
Decisão F6.1 AppsScriptService NUNCA alterada
Funcionalidades NestJS-only via ReservationAdminApi (interface por domínio)

---

## O QUE NÃO FAZER (proibições absolutas)

❌ Alterar AppsScriptService
❌ Usar $transaction com pgbouncer para operações longas
❌ Criar componentes genéricos prematuros sem uso real imediato
❌ Duplicar /admin/rooms ou /admin/classes (já existem em /salas e /turmas)
❌ Instalar bibliotecas UI novas (sem Tailwind, sem MUI, sem Chakra)
❌ Colocar regra de negócio no Controller (vai no Service/UseCase)
❌ Validar conflito de horário só no frontend
❌ Usar raw SQL sem Prisma
❌ Commitar sem typecheck + vitest + build verdes
❌ Criar UsersController sem sprint dedicada (F6.7)

---

## PRÓXIMA SPRINT — F6.2 Shell do Portal Admin

### O que criar

router/config.ts → adicionar section='admin' ao union type
→ adicionar 7 rotas /admin/\* com requiredRole='ADMIN'
AppLayout.tsx → renderizar seção ADMIN condicionalmente (role=ADMIN)
→ adicionar ícones necessários ao ICON_MAP
layouts/AdminLayout.tsx → wrapper para páginas admin (breadcrumb /admin/)
router/index.tsx → lazy imports + rotas /admin/ com ProtectedRoute ADMIN
pages/Admin/
Dashboard/index.tsx → placeholder "Em breve" elegante (F6.3 preenche)
Usuarios/index.tsx → placeholder
Permissoes/index.tsx → placeholder
Auditoria/index.tsx → placeholder (F6.4 preenche)
Sync/index.tsx → placeholder (F6.5 preenche)
Sistema/index.tsx → placeholder (F6.6 preenche)
Configuracoes/index.tsx → placeholder
Logs/index.tsx → placeholder
Api/index.tsx → placeholder
Health/index.tsx → placeholder

### Regra de ouro do F6.2

Não implementar nenhuma funcionalidade real.
Somente estrutura, navegação e placeholders.
Cada subpágina recebe implementação em sua própria sprint (F6.3–F6.8).

---

## COMANDOS DE EMERGÊNCIA

```powershell
# Acordar Supabase (Bug #1)
cd C:\dev\monorepo\apps\api
$env:DATABASE_URL = (Select-String ".\.env" -Pattern "^DIRECT_URL=").Line -replace "^DIRECT_URL=",""
.\node_modules\.bin\prisma migrate deploy
Remove-Item Env:DATABASE_URL

# Sync de aulas (após acordar banco)
$auth = Invoke-RestMethod "http://localhost:3000/auth/login" -Method Post -ContentType "application/json" -Body '{"email":"admin@senai.edu","password":"admin@senai2026"}'
Invoke-RestMethod "http://localhost:3000/sync/schedules" -Method Post -Headers @{ Authorization = "Bearer $($auth.accessToken)" } -TimeoutSec 60

# Checar banco diretamente (bypassa RLS)
"SELECT COUNT(*) FROM public.""Schedule"";" | .\node_modules\.bin\prisma db execute --stdin

# Restaurar arquivo corrompido
git checkout apps/reservations/src/caminho/arquivo.ts
```
