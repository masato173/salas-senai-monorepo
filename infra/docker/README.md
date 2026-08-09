# Servidor local Docker — Controle de Salas SENAI

Guia curto pra subir o sistema num servidor Windows local do SENAI via
Docker, substituindo Railway (backend) + Supabase (banco) + GitHub Pages
(frontend). Uso só na rede interna, via HTTP.

## Pré-requisitos

- Docker Desktop instalado e rodando (WSL2 habilitado, no Windows)
- IP fixo (ou reserva DHCP) pro servidor na rede interna — os outros PCs
  vão acessar por esse IP, não por "localhost"
- Portas 80 e 3000 livres no servidor

## 1. Configurar variáveis de ambiente

```powershell
cd infra\docker
copy .env.local.example .env.local
notepad .env.local
```

Preencha pelo menos: `POSTGRES_PASSWORD`, `JWT_SECRET`,
`JWT_REFRESH_SECRET` (gere cada um com `openssl rand -base64 32` ou, sem
openssl, `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
no PowerShell), `CORS_ORIGIN` e `VITE_API_URL` com o IP real do servidor
(ex.: `192.168.1.50`). Detalhes de cada variável estão comentados no
próprio `.env.local.example`.

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
3. **Banco vazio na primeira subida** — nesta versão (Missão 1 da
   migração), o `api` sobe mas ainda **não** roda `prisma migrate
deploy` nem o seed sozinho (isso é a Missão 2, via `entrypoint.sh`).
   Até lá, rodar manualmente uma vez:
   ```powershell
   docker compose exec api node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
   docker compose exec api node apps/api/prisma/seed.js
   ```
   (`node_modules/.bin/prisma` funciona porque a imagem copia o
   `node_modules` inteiro do builder, incluindo devDependencies — ver
   nota no `Dockerfile.api` sobre isso ser deliberado nesta missão.)
4. **Acessar**: `http://<IP-do-servidor>` pro frontend. A API responde
   em `http://<IP-do-servidor>:3000/health`.

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

## O que falta (Missão 2)

O `entrypoint.sh` do backend ainda não existe — hoje o container `api`
só sobe `node apps/api/dist/main.js` direto (placeholder, ver
`Dockerfile.api`). A Missão 2 troca isso por um entrypoint que roda
`prisma migrate deploy` e o seed (condicional a `SEED_FORCE`)
automaticamente antes de subir o servidor, pra não depender dos
comandos manuais do passo 3 acima toda vez que o banco for recriado do
zero.
