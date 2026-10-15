# Deploy — Controle de Salas SENAI (F9.3)

Fluxo completo de CD (deploy contínuo) do monorepo:

```
push na master
   └─► CI (.github/workflows/ci.yml)   typecheck + testes + build + E2E
          └─► verde? ─► CD (.github/workflows/cd.yml)
                          ├─► deploy-backend  → Railway   (API NestJS)
                          └─► deploy-frontend → gh-pages  (React/Vite)
```

O CD **nunca roda em cima de CI vermelho** (trigger `workflow_run` com
`conclusion == 'success'`) e deploya **exatamente o SHA que o CI validou**.

Enquanto os secrets de deploy não existirem, os jobs do CD são **pulados sem
falhar** (job `preflight`) — o repositório continua utilizável normalmente.

---

## 1. Backend → Railway

### 1.1 Criar o projeto no Railway (uma única vez)

1. Criar conta em https://railway.com (login com GitHub).
2. **New Project** → **Empty Project** (não usar o deploy via GitHub do
   Railway — o deploy é feito pelo GitHub Actions via CLI, para garantir que
   só sobe código com CI verde. Não conectar o repo no Railway).
3. Dentro do projeto: **+ New** → **Empty Service**.
4. Renomear o serviço para exatamente **`salas-senai-api`**
   (o `cd.yml` usa `railway up --service salas-senai-api`; se usar outro nome,
   ajustar o workflow).
5. O build/start é definido pelo **`railway.json` na raiz do repo** (builder
   Nixpacks, build do workspace pnpm, start `node apps/api/dist/main.js`,
   healthcheck em `/health`). Não precisa configurar comando nenhum no painel.

### 1.2 Variáveis de ambiente no Railway (Service → Variables)

As mesmas do `apps/api/.env`, **exceto `PORT`** (o Railway injeta sozinho):

| Variável                 | Valor                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `NODE_ENV`               | `production`                                                                                |
| `DATABASE_URL`           | URL pooled do Supabase (porta 6543, `?pgbouncer=true`)                                      |
| `DIRECT_URL`             | URL direta do Supabase (porta 5432)                                                         |
| `JWT_SECRET`             | o mesmo segredo já em uso                                                                   |
| `JWT_REFRESH_SECRET`     | o mesmo segredo já em uso                                                                   |
| `JWT_EXPIRES_IN`         | `15m`                                                                                       |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                                                                        |
| `APPS_SCRIPT_URL`        | URL `/exec` do Apps Script (sync de aulas)                                                  |
| `APPS_SCRIPT_TOKEN`      | token do Apps Script                                                                        |
| `CORS_ORIGIN`            | `https://masato173.github.io` (origem do Pages — **sem** o caminho `/salas-senai-monorepo`) |
| `TRUST_PROXY`            | `1` — **obrigatória**: sem ela o boot falha em produção (proxies à frente da api; ADR-009)  |
| `NIXPACKS_NODE_VERSION`  | `22` (mesma versão do CI)                                                                   |

> **Nunca** definir `THROTTLE_SKIP` em produção (desligaria o rate limiting).

### 1.3 Gerar o token de deploy

1. No projeto Railway: **Settings → Tokens**.
2. Criar um **Project Token** para o environment `production`.
3. Copiar o valor — ele é o secret `RAILWAY_TOKEN` do GitHub (passo 3).

### 1.4 Teste manual antes do primeiro deploy automático

Na sua máquina (valida projeto/serviço/variáveis sem depender do Actions):

```powershell
npm install -g @railway/cli
railway login                       # abre o navegador
Set-Location C:\dev\monorepo
railway link                        # escolher o projeto e o serviço salas-senai-api
railway up --service salas-senai-api --ci
```

Quando o deploy terminar, validar:

```powershell
Invoke-RestMethod "https://<dominio-do-servico>.up.railway.app/health"
```

O domínio público é gerado em **Service → Settings → Networking →
Generate Domain**. Essa URL é o valor do secret `VITE_API_URL_PROD`.

---

## 2. Secrets no GitHub (Settings → Secrets and variables → Actions)

| Secret              | Valor                                                                                                      | Usado por                 |
| ------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------- |
| `RAILWAY_TOKEN`     | token do passo 1.3                                                                                         | `cd.yml` (deploy backend) |
| `VITE_API_URL_PROD` | URL pública do Railway (ex.: `https://salas-senai-api-production.up.railway.app`) — **sem barra no final** | `cd.yml` (build frontend) |
| `DATABASE_URL`      | _(já existe, usado pelo CI)_                                                                               | `cd.yml` (migrate deploy) |
| `DIRECT_URL`        | _(já existe, usado pelo CI)_                                                                               | `cd.yml` (migrate deploy) |

---

## 3. Frontend → GitHub Pages

O job `deploy-frontend` builda `apps/reservations` com
`--base=/salas-senai-monorepo/` e `VITE_API_URL` apontando pra produção,
cria o fallback SPA (`404.html`) e publica na branch **`gh-pages`**.

Ativação (uma única vez), **depois** do primeiro CD verde:

1. GitHub → **Settings → Pages**.
2. **Source**: `Deploy from a branch` → branch **`gh-pages`** → `/ (root)`.
3. A URL final é `https://masato173.github.io/salas-senai-monorepo/`.

> **Atenção (legado):** antes de mudar a source do Pages, confira o que ela
> serve hoje. Se o frontend legado em produção for servido por **este**
> repositório, trocar a source substitui o site publicado — nesse caso, fazer
> o corte só quando o app novo estiver validado na URL de produção. Se o
> legado mora em outro repositório/URL (caso mais comum), nada é afetado:
> publicar a branch `gh-pages` aqui não toca o site legado.

---

## 4. Ordem de ativação recomendada

1. Criar projeto/serviço/variáveis no Railway (1.1–1.2).
2. Teste manual com a CLI (1.4) até o `/health` responder.
3. Criar os secrets `RAILWAY_TOKEN` e `VITE_API_URL_PROD` no GitHub.
4. Próximo push na master com CI verde → CD deploya backend e frontend.
5. Ativar o GitHub Pages na branch `gh-pages` (seção 3).
6. Validar login + reservas na URL do Pages (o CORS já deve permitir a origem).

## 5. Rollback

- **Backend:** Railway → Service → **Deployments** → deploy anterior →
  **Redeploy**. (Migrations são aditivas por regra do projeto, então o código
  anterior continua compatível com o schema.)
- **Frontend:** a branch `gh-pages` guarda o histórico — `git revert` do
  commit de publicação, ou rodar o CD de novo a partir de um SHA anterior.
- **Banco:** ver `docs/backup-restore.md`.
