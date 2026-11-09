# Controle de Salas SENAI

Sistema institucional de gestão e agendamento de salas do SENAI Manaus.
Em produção e em uso real — reservas, disponibilidade, aprovação por
coordenação, calendário, auditoria e administração de salas/usuários.

## Stack

| Camada   | Tecnologia                                                   |
| -------- | ------------------------------------------------------------ |
| Frontend | React 18 + TypeScript + Vite + Zustand + FullCalendar        |
| Backend  | NestJS 10 + Prisma 5                                         |
| Banco    | PostgreSQL (Supabase)                                        |
| Auth     | JWT + Refresh Token + RBAC (PROFESSOR / COORDENADOR / ADMIN) |
| Realtime | Socket.IO (namespace `/rooms`)                               |
| CI       | GitHub Actions (typecheck, lint, testes, build, E2E)         |
| Deploy   | Vercel (frontend) + Render (API) — ADR-010                   |

Aulas/turmas continuam sendo importadas de uma planilha institucional via
Google Apps Script (`POST /sync/schedules`) — a única função remanescente
do Apps Script no sistema.

## Como rodar localmente

Pré-requisitos: Node 20 ou 22 (`engines`: `>=20.0.0 <23.0.0`), pnpm ≥ 8.

```bash
git clone <url-do-repositorio>
cd monorepo
pnpm install
```

### Backend (`apps/api`)

Copiar `apps/api/.env.example` para `apps/api/.env` e preencher:

```
NODE_ENV=development
PORT=3000
DATABASE_URL=            # Postgres, pooled (pgbouncer)
DIRECT_URL=               # Postgres, direto — migrations e seed
JWT_SECRET=                # mín. 32 caracteres
JWT_REFRESH_SECRET=        # mín. 32 caracteres
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=                # origens permitidas, separadas por vírgula
APPS_SCRIPT_URL=            # sync de aulas (opcional em dev)
APPS_SCRIPT_TOKEN=
REDIS_URL=                  # reservado, ainda não usado em runtime
```

```bash
pnpm --filter @salas-senai/api exec prisma generate
pnpm --filter @salas-senai/api exec prisma migrate deploy
pnpm --filter @salas-senai/api build
pnpm --filter @salas-senai/api start:dev
```

### Frontend (`apps/reservations`)

Copiar `apps/reservations/.env.example` para `apps/reservations/.env.local`:

```
VITE_API_URL=http://localhost:3000
VITE_BACKEND_DRIVER=true
```

```bash
pnpm --filter @salas-senai/reservations dev
```

## Como rodar os testes

```bash
# Backend — testes unitários
pnpm --filter @salas-senai/api test:unit

# Frontend — testes unitários
pnpm --filter @salas-senai/reservations test

# E2E (Playwright) — requer backend e frontend no ar
pnpm test:e2e

# Typecheck e lint (apps/api e apps/reservations)
pnpm --filter @salas-senai/api build
pnpm --filter @salas-senai/api lint
pnpm --filter @salas-senai/reservations typecheck
pnpm --filter @salas-senai/reservations lint
```

## Estrutura do monorepo

```
apps/
  api/            NestJS — auth, reservas, salas, disponibilidade,
                   auditoria, sync de aulas, dashboard, realtime
  reservations/    React — SPA consumida pelos usuários finais
packages/
  contracts/       tipos/contratos compartilhados
  eslint-config/    config ESLint compartilhada
  shared/           utilitários compartilhados entre apps
  tsconfig/         tsconfig base compartilhado
  validators/       validadores compartilhados
docs/
  adr/              Architecture Decision Records
  deploy.md         passo a passo de deploy (Vercel + Render; plano B)
  backup-restore.md  backup e restauração do banco (Supabase)
```

## Contribuindo com auxílio de IA

Para contribuir usando Claude Code ou outro agente de IA, leia
[`CLAUDE.md`](./CLAUDE.md) primeiro — define regras de anti-invenção,
protocolo de mudança, critérios de aceite e o estado real da arquitetura.

## Deploy e operação

- [`docs/deploy.md`](./docs/deploy.md) — frontend na Vercel, API na Render (plano gratuito), plano B (Railway / Lightsail) e secrets do GitHub
- [`docs/backup-restore.md`](./docs/backup-restore.md) — backup automático do Supabase e procedimento de restauração
