# Servidor local Docker — Controle de Salas SENAI

Guia curto pra subir o sistema num servidor Windows local do SENAI via
Docker, substituindo Railway (backend) + Supabase (banco) + GitHub Pages
(frontend). Uso só na rede interna, via HTTP.

## Pré-requisitos

- Docker Desktop instalado e rodando (WSL2 habilitado, no Windows)
- IP fixo (ou reserva DHCP) pro servidor na rede interna — os outros PCs
  vão acessar por esse IP, não por "localhost"
- Porta 80 livre no servidor (a única publicada — a api e o Postgres não
  publicam porta; ver "Rotas e portas" abaixo)

## 1. Configurar variáveis de ambiente

```powershell
cd infra\docker
copy .env.local.example .env.local
notepad .env.local
```

Preencha pelo menos: `POSTGRES_PASSWORD`, `JWT_SECRET`,
`JWT_REFRESH_SECRET` (gere cada um com `openssl rand -base64 32` ou, sem
openssl, `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
no PowerShell). Detalhes de cada variável estão comentados no próprio
`.env.local.example`.

`VITE_API_URL` (`/api`) e `TRUST_PROXY` (`1`) são valores da topologia e
ficam **fixos no `docker-compose.yml`**, não no `.env.local` — se o seu
`.env.local` antigo ainda tem `VITE_API_URL`, ela é ignorada.
`CORS_ORIGIN` ficou opcional (o frontend chama a api na mesma origem).

`.env.local` (o arquivo com os valores reais) nunca deve ser commitado —
já está no `.gitignore` da raiz do repo. Só o `.env.local.example`
(template, sem segredo) é versionado.

## 2. Ordem de subida

1. **Build das imagens** (primeira vez demora — baixa as base images e
   reinstala o monorepo inteiro):
   ```powershell
   docker compose --env-file .env.local build
   ```
2. **Subir os 3 serviços**:
   ```powershell
   docker compose --env-file .env.local up -d
   ```
   `postgres` sobe primeiro; `api` só inicia depois que o healthcheck
   (`pg_isready`) do Postgres passa.
3. **Migrations rodam sozinhas** — o container `api` roda
   `infra/docker/entrypoint.sh` antes de subir o servidor:
   `prisma migrate deploy` (idempotente — seguro em todo boot, aplica só
   o que ainda falta) sempre, e o seed só fora de produção (ver passo 4). Nada
   manual aqui, diferente de uma primeira versão desta migração.
4. **Dados iniciais (salas e contas)** — o seed **não roda em produção**.
   Este compose sobe com `NODE_ENV=production`, e o entrypoint aborta o
   boot (exit 1) se `SEED_FORCE=true` (issue 2). Deixe `SEED_FORCE=false`.
   - **Migrando um banco que já existe**: restaure um dump (ver "Backup
     manual do banco (pg_dump)" abaixo). É o caminho preferido.
   - **Banco novo, sem dump** (procedimento manual, uma vez só, decisão
     consciente do operador): defina no SEU shell três senhas fortes e
     únicas (12+ caracteres, nunca reaproveitadas nem gravadas em arquivo do
     repo) e rode o seed num container avulso:
     ```powershell
     $env:SEED_ADMIN_PASSWORD = Read-Host "Senha admin"
     $env:SEED_COORDENADOR_PASSWORD = Read-Host "Senha coordenador"
     $env:SEED_PROFESSOR_PASSWORD = Read-Host "Senha professor"
     docker compose --env-file .env.local run --rm `
       -e NODE_ENV=development `
       -e SEED_ADMIN_PASSWORD -e SEED_COORDENADOR_PASSWORD -e SEED_PROFESSOR_PASSWORD `
       --entrypoint node api apps/api/prisma/seed.js
     Remove-Item Env:SEED_ADMIN_PASSWORD, Env:SEED_COORDENADOR_PASSWORD, Env:SEED_PROFESSOR_PASSWORD
     ```
     `-e VAR` sem valor repassa do seu shell — a senha não fica no comando
     nem no histórico. O seed cria as 34 salas e as contas
     `admin@senai.edu`/`coordenador@senai.edu`/`professor@senai.edu`, e
     não imprime senha. Guarde as senhas num cofre e troque-as no primeiro
     acesso.
5. **Acessar**: `http://<IP-do-servidor>` pro frontend. A API responde
   **só pelo nginx**, em `http://<IP-do-servidor>/api/health` (não existe
   mais `:3000`).

## Rotas e portas (nginx como borda única — ADR-009)

O nginx do serviço `frontend` é o único ponto de entrada:

| Caminho público   | Destino interno              |
| ----------------- | ---------------------------- |
| `/api/socket.io/` | `http://api:3000/socket.io/` |
| `/api/`           | `http://api:3000/`           |
| `/`               | arquivos do SPA              |

O prefixo `/api` é removido no caminho (`/api/auth/login` →
`/auth/login`). O nginx sobrescreve `X-Forwarded-For` com o IP de quem
conectou nele, e a api confia em exatamente um proxy (`TRUST_PROXY: '1'`)
— por isso forjar o header não contorna mais o rate limit.

Portas publicadas: só `80` (frontend). `docker compose ps` não deve mostrar
`0.0.0.0:3000` na api.

> **VPS: o `ufw` NÃO filtra portas publicadas pelo Docker.** O Docker grava
> regras próprias no iptables, que passam na frente das do ufw — uma porta
> em `ports:` fica aberta pra internet mesmo com `ufw deny`. Por isso a api
> não publica porta nenhuma: não dependa do firewall pra fechar o que o
> compose publica.

## Depurar a api (sem porta publicada)

```powershell
# Pelo nginx, como o navegador faz
curl.exe http://localhost/api/health

# De dentro do container da api (wget do BusyBox; a imagem não tem curl)
docker compose exec api wget -qO- http://127.0.0.1:3000/health

# Logs da api
docker compose logs -f api
```

## Comandos do dia a dia

```powershell
# Build (depois de mudar código, Dockerfile ou dependências)
docker compose --env-file .env.local build

# Subir (recriando containers se precisar)
docker compose --env-file .env.local up -d

# Logs de todos os serviços, seguindo em tempo real
docker compose logs -f

# Logs só de um serviço
docker compose logs -f api

# Reiniciar um serviço sem rebuildar a imagem
docker compose restart api

# Parar tudo (mantém os dados do Postgres no volume pgdata)
docker compose down

# Parar E apagar os dados do Postgres — CUIDADO, é destrutivo
docker compose down -v
```

## Backup manual do banco (pg_dump)

```powershell
docker compose exec postgres pg_dump -U postgres salas_senai > backup-$(Get-Date -Format yyyyMMdd).sql
```

Restaurar (banco vazio):

```powershell
Get-Content backup-20260810.sql | docker compose exec -T postgres psql -U postgres salas_senai
```

## Entrypoint do backend

`infra/docker/entrypoint.sh` roda em todo boot do container `api`, nesta
ordem: `prisma migrate deploy` (sempre) → seed (só se `SEED_FORCE=true` E
`NODE_ENV` diferente de `production` — em produção ele aborta o boot) →
`exec node apps/api/dist/main.js`. Comentários
completos de cada passo estão no próprio script.

## O que ainda não foi testado de verdade

Estes arquivos foram criados/ajustados sem um ambiente Docker disponível
pra rodar `docker build`/`docker compose up` de fato — a primeira subida
real no servidor é quando isso é validado pela primeira vez. Prestar
atenção especial a:

- Se `pnpm install` completa no builder do `Dockerfile.api` (bcrypt
  precisa compilar o binding nativo — `python3 make g++` já estão
  instalados, mas nunca foi exercitado de verdade).
- Se `node_modules/.bin/prisma` realmente existe e funciona na imagem
  runner (copiada do builder — depende da estrutura de symlinks do pnpm
  se comportar como esperado dentro do container).
- Se o `prisma migrate deploy` do entrypoint encontra o Postgres a
  tempo (o healthcheck do `postgres` já cobre isso, mas vale confirmar
  no primeiro boot real).
- Se o procedimento manual do passo 4 (seed em container avulso) povoa as
  34 salas e as 3 contas esperadas.
