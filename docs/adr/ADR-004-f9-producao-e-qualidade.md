# ADR-004 — F9: Produção e Qualidade

**Data:** 2026-07-19
**Status:** Ativo
**Contexto de arquitetura:** Fase 9 — hardening de produção pós-cutover (ADR-003)

---

## Contexto

Após o cutover oficial (ADR-003, F5.8), o NestJS passou a ser o backend
real de reservas, mas o sistema ainda tinha lacunas típicas de "funciona
localmente" que não tinha em produção: sem deploy automatizado, sem
headers de segurança HTTP, sem proteção contra brute force, seed com
senhas conhecidas sem guarda contra rodar em produção, sem backup
documentado, logs não estruturados, e um bug crítico de concorrência em
`createRange` (reserva em período) que não validava conflito de horário
nem usava lock — violação direta da regra mais importante do projeto.
Havia também uma dívida de configuração no ESLint que fazia o lint
falhar silenciosamente ao rodar por pacote isolado, o que levou à
remoção temporária do lint do CI.

Esta ADR consolida as decisões da sprint F9, que endereçou essas
lacunas uma a uma.

---

## Decisões

### a) Deploy do backend: Railway

**Decisão:** hospedar o backend NestJS no Railway, com deploy via
GitHub Actions (`railway up --service salas-senai-api --ci`), não via
integração nativa GitHub↔Railway.

**Alternativas consideradas:** Render, Fly.io. A escolha do Railway foi
uma decisão do usuário/mantenedor do projeto, registrada aqui como
decisão tomada — não foi feita uma comparação técnica formal entre os
três neste ADR.

**Por que via GitHub Actions e não integração nativa:** o deploy só deve
acontecer depois que o job `validate` + `e2e` do CI passar (branch verde).
Conectar o Railway direto ao repositório dispararia deploy a cada push,
inclusive com CI vermelho. O workflow `cd.yml` dispara em `workflow_run`
do CI com `conclusion == success` e faz checkout do SHA exato validado.

**Consequências:** o build/start do Railway é definido por `railway.json`
na raiz do repo (builder Nixpacks, pois o projeto é um monorepo pnpm com
workspace); o job `deploy-backend` roda `prisma migrate deploy` antes do
deploy do código, e migrations do projeto são sempre aditivas (regra já
existente), então a janela entre migration e novo deploy nunca quebra o
código anterior.

---

### b) Segurança: Helmet + `@nestjs/throttler`

**Decisão:** aplicar `helmet()` como middleware global (`main.ts`, antes
da configuração de CORS) e `ThrottlerModule` como guard global via
`APP_GUARD`, com dois níveis de limite:

- **Global:** 100 requisições/min por IP (`ThrottlerModule.forRoot`, `ttl: 60_000, limit: 100`).
- **`POST /auth/login` e `POST /auth/refresh`:** 5 requisições/min via `@Throttle({ default: { limit: 5, ttl: 60_000 } })` — alvo típico de força bruta de credenciais.

**Alternativas consideradas:** nenhuma alternativa de biblioteca foi
avaliada — `helmet` e `@nestjs/throttler` são os pacotes oficiais/padrão
do ecossistema Nest para esses dois problemas.

**Trade-off aceito:** o CI E2E precisou de uma válvula de escape
(`THROTTLE_SKIP=true`) porque o helper `wait-for-backend` do Playwright
faz polling em `POST /auth/login` até o backend responder, o que
estouraria o limite de 5/min antes mesmo do primeiro teste rodar. Essa
variável nunca deve ser usada em produção (documentado em `.env.example`
e no `CLAUDE.md`).

**Consequências:** `ThrottlerGuard` é registrado **antes** de
`JwtAuthGuard` na ordem dos `APP_GUARD` — brute force é barrado antes de
gastar CPU com verificação de senha (bcrypt), e rotas `@Public()`
continuam acessíveis (throttling e autenticação são mecanismos
independentes). `app.set('trust proxy', 1)` foi necessário para que o
throttling por IP funcione corretamente atrás do proxy do Railway.

---

### c) Seed bloqueado em produção via `NODE_ENV`

**Decisão:** `prisma/seed.ts` lança erro e aborta se
`process.env.NODE_ENV === 'production'`, na primeira linha executável do
script. As senhas de teste (`admin@senai2026`, `professor@senai2026`,
`coordenador@senai2026`) permanecem como estão — não foram rotacionadas.

**Alternativas consideradas:**

1. Trocar as senhas de teste por algo não previsível.
2. Bloquear por `NODE_ENV` (escolhida).

**Trade-off:** a opção escolhida é mais simples e não exige gerenciar um
segredo adicional, mas depende inteiramente de `NODE_ENV=production`
estar corretamente configurado no ambiente de produção (Railway) — se
essa variável estiver ausente ou errada, a guarda não protege. O ganho
de simplicidade foi considerado maior que o risco, dado que `NODE_ENV`
já é uma variável padrão e checada em outros pontos do sistema (CORS,
logging). Rotação de credenciais fica como possível trabalho futuro se o
risco for reavaliado.

---

### d) Backup: recurso nativo do Supabase

**Decisão:** usar o backup automático diário incluso no plano do
Supabase (retenção de 7 dias), sem construir um script de export
customizado. Procedimento de restauração documentado em
`docs/backup-restore.md`.

**Alternativas consideradas:** script próprio de `pg_dump` agendado
(cron/GitHub Actions) para um bucket externo.

**Por que a opção nativa:** o recurso já está incluso no plano
contratado — construir e manter um pipeline de backup próprio seria
esforço de engenharia duplicado sem ganho adicional na fase atual do
projeto. `docs/backup-restore.md` documenta onde encontrar o backup no
painel, como restaurar em emergência (incluindo pausar o serviço no
Railway antes de restaurar) e recomenda teste trimestral de restauração
quando existir um ambiente de staging.

**Consequência aceita:** granularidade de restauração é o backup diário
(sem Point-in-Time Recovery, que é um add-on pago não contratado) — em
caso de incidente, a janela de dados potencialmente perdida pode chegar
a quase 24h.

---

### e) Correção crítica: `createRange` sem validação de conflito

**Contexto do bug:** `ReservationsService.createRange` (reserva em
período/multi-dia) fazia `INSERT` direto via
`this.prisma.reservation.create`, sem `$transaction`, sem
`pg_advisory_xact_lock` e sem `ConflictService.hasConflict` — violação
direta da regra mais importante do projeto (toda escrita que cria uma
reserva precisa validar conflito dentro de um lock). `create()` (reserva
única) já fazia isso corretamente.

**Decisão:** cada data do range passou a rodar em sua própria
`$transaction`, com `pg_advisory_xact_lock(hashtext(roomId), hashtext(date))`
seguido de `ConflictService.hasConflict(..., tx)` antes do `INSERT` —
replicando exatamente o padrão já usado em `create()`. Datas em conflito
são **puladas** (não abortam o range inteiro), e ficam rastreáveis via
`Logger.warn` (não fazem parte do contrato de resposta `{ count, reservations }`,
que foi preservado).

**Por que uma `$transaction` por data, e não uma única para o range
inteiro:** o Supabase roda em pgbouncer transaction mode, que não
suporta transactions interativas longas (mesma restrição que já havia
motivado o padrão "DELETE + INSERT em batches, sem `$transaction`" no
`SyncModule`). Uma única transaction cobrindo até 60 datas (o teto já
existente do range) correria risco de timeout.

**Consequências:** o comportamento de "pular data com conflito" já
existia em `updateGroup`/`updateSelected` (atualização de grupo/seleção)
— `createRange` passou a seguir a mesma convenção, em vez de abortar tudo
ou inserir sem checagem. Gap conhecido e **não corrigido** nesta sprint:
`createRange` ainda não verifica existência/disponibilidade da sala
(`room.findUnique`/`available`) como `create()` verifica — registrado
como próximo passo em aberto no `CLAUDE.md`.

---

### f) ESLint: causa raiz e correção definitiva

**Causa raiz identificada:** dois problemas compostos faziam o lint
falhar de forma confusa ("No files matching the pattern src") ao rodar
por pacote isolado (`pnpm --filter ... lint`):

1. `eslint` não estava declarado como `devDependency` explícita na raiz do monorepo — dependia de resolução transitiva via os pacotes que o usavam.
2. Os `.eslintrc.cjs` de `apps/api` e `apps/reservations` não tinham `root: true`, então o ESLint continuava subindo a árvore de diretórios até encontrar (ou não encontrar corretamente) configuração na raiz do monorepo, caindo em `ignorePatterns` que bloqueiam `apps/` quando resolvido no contexto errado.

**Decisão:** adicionar `"eslint": "^8.57.1"` como `devDependency` explícita
no `package.json` raiz, e `root: true` no topo de `module.exports` de
ambos os `.eslintrc.cjs` (`apps/api` e `apps/reservations`), garantindo
que cada pacote resolve sua própria configuração sem subir para a raiz
do monorepo.

**Consequência:** lint reativado no CI (`ci.yml`, etapas "Lint (frontend)"
e "Lint (backend)") e no `lint-staged` (`npx eslint --fix` antes de
`npx prettier --write` para `*.{ts,tsx,js}`), depois de validado
localmente com 0 erros/warnings em ambos os pacotes. Antes desta
correção, o lint estava **temporariamente removido do CI** com um
comentário explícito prometendo reativação — esta ADR documenta essa
reativação como definitiva.

---

## Referências

- ADR-003: `docs/adr/ADR-003-f5-cutover-oficial.md`
- Deploy: `docs/deploy.md`
- Backup/restore: `docs/backup-restore.md`
- Pipeline CI: `.github/workflows/ci.yml`
- Pipeline CD: `.github/workflows/cd.yml`
- Build/start do Railway: `railway.json`
- Regra de conflito de horário: `apps/api/src/modules/reservations/conflict.service.ts`, `apps/api/src/modules/reservations/reservations.service.ts`
- Seed: `apps/api/prisma/seed.ts`
- Segurança HTTP/rate limiting: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/modules/auth/auth.controller.ts`
