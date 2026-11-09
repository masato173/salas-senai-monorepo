# Deploy — Controle de Salas SENAI

Topologia de produção (ADR-010): **Vercel** (frontend) + **Render** (API) +
**Supabase** (banco).

```
navegador ──► https://agendasalas.com.br       Vercel  (SPA estática, build do Vite)
          └─► https://api.agendasalas.com.br   Render  (NestJS + Socket.IO + cron)
                                                  └─► Supabase (PostgreSQL)
```

O navegador chama a API por **URL absoluta**. REST e Socket.IO vão direto à
Render; nada passa pela Vercel.

```
push na master
   ├─► CI (.github/workflows/ci.yml)  typecheck + lint + testes + build + E2E
   ├─► Vercel  build do SPA → domínio de produção só com o CI verde (1.4)
   └─► Render  build da imagem → deploy só com o CI verde (2.1, Auto-Deploy)
CD (.github/workflows/cd.yml): só o job do Railway (plano B, seção 3),
pulado enquanto o secret RAILWAY_TOKEN não existir.
```

> Regra do projeto: **deploy nunca em cima de CI vermelho.** Na Vercel e na
> Render isso depende das configurações das seções 1.4 e 2.1. Sem elas, as
> duas fazem deploy a cada push na `master`.

---

## 1. Frontend na Vercel

O build é definido pelo `vercel.json` na raiz:

- **Install e build:** `npx --yes pnpm@8.15.0 install --frozen-lockfile` e
  `npx --yes pnpm@8.15.0 --filter @salas-senai/reservations build`.
- **Saída:** `apps/reservations/dist`.
- **Rotas:** rewrite de fallback do SPA para `/index.html`. Arquivos que
  existem são servidos antes do rewrite.
- **pnpm:** fixado em 8.15.0, a mesma versão do `packageManager`. O motivo
  está no ADR-010.
- **Node:** o `engines.node` da raiz (`>=20.0.0 <23.0.0`) faz a Vercel usar
  22.x, como o CI.
- **Guard:** com `VERCEL` no ambiente, o build **falha** se `VITE_API_URL`
  estiver ausente, apontar para a máquina local, não for `https://` absoluta
  ou terminar com `/` (`apps/reservations/src/config/vercelBuildGuard.ts`).
  Quando passa, o log do build mostra `[vercel] VITE_API_URL = …`.

### 1.1 Criar o projeto (uma vez)

Vercel → **Add New → Project** → **Import Git Repository** → este
repositório. Na tela **Configure Project**:

| Campo                     | Valor                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| Project Name              | livre (ex.: `agendasalas`)                                             |
| Framework Preset          | **Other** (o `vercel.json` já define `framework: null`)                |
| Root Directory            | `./` — a raiz do repositório (o build precisa do workspace pnpm)       |
| Build and Output Settings | **não alterar** — install, build e saída vêm do `vercel.json`          |
| Environment Variables     | `VITE_API_URL` = `https://api.agendasalas.com.br` (sem barra no final) |

Depois, **Deploy**.

### 1.2 Variáveis (Settings → Environment Variables)

| Variável       | Valor                            | Ambientes                |
| -------------- | -------------------------------- | ------------------------ |
| `VITE_API_URL` | `https://api.agendasalas.com.br` | **Production e Preview** |

- Sem a variável no Preview, todo build de preview falha no guard, de
  propósito.
- Os previews (`*.vercel.app`) **não falam com a API**: o CORS só libera o
  domínio de produção. Eles servem para ver a interface, não para testar login.
- `VITE_API_URL` é gravada no bundle durante o build. Mudar o valor exige um
  novo deploy (**Redeploy**).

### 1.3 Domínio

**Settings → Domains** → adicionar `agendasalas.com.br` e, se quiser,
`www.agendasalas.com.br` redirecionando para ele.

- Crie no DNS os registros que a Vercel mostrar nessa tela. O certificado
  HTTPS é da Vercel.
- Se o `www` também servir o site, em vez de redirecionar, inclua
  `https://www.agendasalas.com.br` no `CORS_ORIGIN` da Render (2.2).

### 1.4 Só promover com o CI verde (Deployment Checks)

**Settings → Deployment Checks** → **Add Checks** → GitHub → selecione os
jobs **`Typecheck + Lint + Unit Tests`** e **`E2E (Playwright)`**.

A Vercel continua fazendo o build, mas só aponta o domínio de produção para o
novo deploy quando os checks passam.

> Confirme se o recurso aparece no plano Hobby. Se não aparecer, o deploy
> acontece a cada push na `master`.

### 1.5 Validar

- `https://agendasalas.com.br` abre, e F5 numa rota (ex.: `/reservas`) não dá 404.
- O login funciona. Em DevTools → Network, as chamadas vão para
  `https://api.agendasalas.com.br/…`.
- Na aba **WS**, `wss://api.agendasalas.com.br/socket.io/?EIO=4&transport=websocket`
  responde com status **101**.
- **Admin → API** mostra `https://api.agendasalas.com.br`.

---

## 2. API na Render (plano gratuito)

- **Imagem:** a do `infra/docker/Dockerfile.api`, com contexto na raiz.
- **Boot:** o `infra/docker/entrypoint.sh` roda `prisma migrate deploy` a cada
  boot e depois `node apps/api/dist/main.js`.
- **TLS:** não há nginx neste caminho; o proxy da Render termina o TLS.

### 2.1 Criar o Web Service (uma vez)

Render → **New → Web Service** → conectar este repositório:

| Campo                          | Valor                                                                                                                                                |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                           | livre (ex.: `salas-senai-api`)                                                                                                                       |
| Language                       | **Docker**                                                                                                                                           |
| Branch                         | `master`                                                                                                                                             |
| Region                         | a mais próxima da região do projeto Supabase — a Render não tem região na América do Sul (para Supabase em `sa-east-1`, **Virginia / US East**)      |
| Root Directory                 | **em branco** (raiz do repositório)                                                                                                                  |
| Dockerfile Path                | `infra/docker/Dockerfile.api`                                                                                                                        |
| Docker Build Context Directory | `.`                                                                                                                                                  |
| Docker Command                 | em branco (usa o `ENTRYPOINT` da imagem)                                                                                                             |
| Instance Type                  | **Free**                                                                                                                                             |
| Health Check Path              | `/health`                                                                                                                                            |
| Auto-Deploy                    | **After CI Checks Pass**                                                                                                                             |
| Build Filters (opcional)       | incluir `apps/api/**`, `packages/**`, `infra/docker/Dockerfile.api`, `infra/docker/entrypoint.sh`, `.dockerignore`, `package.json`, `pnpm-lock.yaml` |

- **Auto-Deploy "After CI Checks Pass":** a Render só faz o deploy se todos
  os checks do commit passarem. Checks pulados ou neutros contam como
  aprovados. Sem nenhum check no commit, ela não faz o deploy.
- **Build Filters:** os caminhos são relativos à raiz do repositório. Eles
  evitam rebuild da API quando o push mexe só no frontend.

### 2.2 Variáveis (Environment)

| Variável                 | Valor                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`           | pooler do Supabase em modo transação (porta `6543`, `?pgbouncer=true`)                                                                                           |
| `DIRECT_URL`             | pooler do Supabase em modo **sessão** (porta `5432`, host `*.pooler.supabase.com`) — a conexão direta costuma ser só IPv6; é usada pelo `migrate deploy` no boot |
| `JWT_SECRET`             | o segredo em uso (mínimo 32 caracteres)                                                                                                                          |
| `JWT_REFRESH_SECRET`     | o segredo em uso (mínimo 32 caracteres)                                                                                                                          |
| `JWT_EXPIRES_IN`         | `15m`                                                                                                                                                            |
| `JWT_REFRESH_EXPIRES_IN` | `7d`                                                                                                                                                             |
| `APPS_SCRIPT_URL`        | URL `/exec` do Apps Script (sync de aulas)                                                                                                                       |
| `APPS_SCRIPT_TOKEN`      | token do Apps Script                                                                                                                                             |
| `CORS_ORIGIN`            | `https://agendasalas.com.br` (com `www`: `https://agendasalas.com.br,https://www.agendasalas.com.br`, sem espaço)                                                |
| `TRUST_PROXY`            | `1` — obrigatória em produção; confirmar com o teste da seção 2.5 (pode ser `2`)                                                                                 |

**Não defina:**

- `PORT`: a Render injeta o valor (padrão `10000`), e o `main.ts` lê `PORT`.
- `NODE_ENV`: já vem `production` da imagem.
- `SEED_FORCE` e `THROTTLE_SKIP`: nunca em produção.

> A Render também repassa as variáveis como _build args_ do Docker. O
> `Dockerfile.api` não declara nenhum `ARG`, então os segredos não entram na
> imagem. Mantenha assim.

### 2.3 Domínio

**Settings → Custom Domains** → `api.agendasalas.com.br`. Crie no DNS o
CNAME que a Render indicar. O TLS é gerenciado pela Render.

### 2.4 O plano gratuito

- **Sono:** o serviço dorme depois de **15 min sem tráfego de entrada**
  (requisição HTTP ou mensagem WebSocket). A primeira requisição depois disso
  leva **cerca de 1 min**, somando o cold start e o `migrate deploy`.
- **Horas:** são **750 horas de instância por mês** por workspace. Quando
  acabam, os serviços gratuitos ficam suspensos até o mês seguinte.
- **Instabilidade:** a Render pode **reiniciar o serviço a qualquer
  momento**. Não há disco persistente, e banda e limites podem mudar sem
  aviso.
- **Monitor externo:** um monitor gratuito chamando
  `GET https://api.agendasalas.com.br/health` **a cada 5 min** mantém o
  serviço acordado. Um mês inteiro acordado cabe nas 750 h se este for o
  único serviço gratuito do workspace.
- **Cron:** o sync de aulas das **03h UTC** (`@Cron`) só roda com o serviço
  acordado. Sem o monitor, ele se perde nas noites em que o serviço dormiu. O
  sync manual em **Admin → Sync** continua disponível.
- **Estado em memória:** o throttler e o lock do sync ficam em memória, então
  um reinício zera os dois.

### 2.5 Validar o `TRUST_PROXY`

`TRUST_PROXY` é o número de proxies à frente da API (ADR-009). Na Render ele
começa em `1` e **precisa ser medido**:

1. Faça uma requisição do seu computador, por exemplo abrindo
   `https://api.agendasalas.com.br/health`, e procure o log dela em
   **Logs**. O log do pino traz `req.headers`; olhe o `x-forwarded-for`.
2. Se o seu IP público é a **última** entrada, `TRUST_PROXY=1` está certo. Se
   há entradas depois dele, o valor é a posição do seu IP contando da direita.
   Exemplo: `<seu IP>, <outro IP>` dá `2`.
3. Confirme contra a forja. Espere 60 s e faça 8 logins errados, cada um com
   um `X-Forwarded-For` diferente. O esperado é 401 nas 5 primeiras e 429 a
   partir da 6ª:

```powershell
$body = '{"email":"naoexiste@exemplo.com","password":"senha-errada-ficticia"}'
1..8 | ForEach-Object {
  $r = Invoke-WebRequest -Method Post -Uri https://api.agendasalas.com.br/auth/login `
    -ContentType 'application/json' -Body $body `
    -Headers @{ 'X-Forwarded-For' = "203.0.113.$_" } -SkipHttpErrorCheck
  "tentativa $_ -> $($r.StatusCode)"
}
```

Como interpretar:

- **Valor alto demais:** a forja escapa (oito 401).
- **Valor baixo demais:** o `req.ip` vira o IP de um proxy, e o limite passa a
  ser compartilhado entre usuários.

### 2.6 Validar

```powershell
Invoke-RestMethod https://api.agendasalas.com.br/health
```

Depois disso, faça login pelo site e confirme o WebSocket 101 (seção 1.5).

---

## 3. Plano B

### 3.1 Railway (Hobby, pago)

O `cd.yml` mantém o job `deploy-backend`. Em todo CI verde na `master`, ele
roda `prisma migrate deploy` e depois `railway up`. O build é definido pelo
`railway.json` na raiz: Nixpacks, `node apps/api/dist/main.js` e healthcheck
`/health`.

Para ativar:

1. Crie um projeto com um **Empty Service** no Railway. Não conecte o
   repositório: o deploy é feito pelo GitHub Actions. O `cd.yml` usa o ID do
   serviço (`--service`); se o serviço for novo, troque o ID.
2. Variáveis: as da seção 2.2, exceto `PORT`, que o Railway injeta. Some
   `NIXPACKS_NODE_VERSION=22`.
3. Em **Settings → Tokens**, crie um **Project Token**. Ele vira o secret
   `RAILWAY_TOKEN` no GitHub, e o próximo CI verde já faz o deploy.
4. Aponte `api.agendasalas.com.br` para o domínio do serviço.

Rollback: **Deployments** → deploy anterior → **Redeploy**.

### 3.2 AWS Lightsail (São Paulo)

É uma VM na região `sa-east-1`, disponível no Lightsail desde 06/2026. Fica
perto do Supabase e não dorme, mas é paga.

Roda a pilha do `infra/docker`, com o nginx como borda (ADR-009, README do
diretório). Para usar o Supabase em vez do Postgres do compose, é preciso
ajustar o `DATABASE_URL`/`DIRECT_URL` do compose, o que está fora deste guia.

---

## 4. Secrets no GitHub (Settings → Secrets and variables → Actions)

| Secret                                                                     | Usado por                                        |
| -------------------------------------------------------------------------- | ------------------------------------------------ |
| `RAILWAY_TOKEN`                                                            | `cd.yml`, só no plano B (sem ele o job é pulado) |
| `DATABASE_URL`, `DIRECT_URL`                                               | `cd.yml` (migrate do plano B)                    |
| `JWT_SECRET`, `JWT_REFRESH_SECRET`, `APPS_SCRIPT_URL`, `APPS_SCRIPT_TOKEN` | `ci.yml` (E2E)                                   |

`VITE_API_URL_PROD` não é mais usado: o deploy do GitHub Pages saiu do
`cd.yml`.

---

## 5. Corte do GitHub Pages para a Vercel

1. Valide a API na Render (seções 2.5 e 2.6).
2. Valide a Vercel com o domínio (seção 1.5).
3. Só então:
   - em **Settings → Pages**, desative o site;
   - apague o secret `VITE_API_URL_PROD`;
   - apague a branch `gh-pages`.

Até o corte, o Pages continua servindo o último build publicado.

## 6. Rollback

- **Frontend (Vercel):** **Deployments** → deploy anterior → **Instant
  Rollback**.
- **API (Render):** **Events** → deploy anterior → **Rollback**. O rollback
  pelo painel desliga o Auto-Deploy até ele ser religado.
- **Compatibilidade:** as migrations são aditivas por regra do projeto, então
  o código anterior continua compatível com o schema.
- **Banco:** ver `docs/backup-restore.md`.
