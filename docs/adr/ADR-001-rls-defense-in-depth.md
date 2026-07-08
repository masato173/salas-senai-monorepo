# ADR-001 — RLS como camada de defense-in-depth

**Data:** 2026-07-08
**Status:** Aceito
**Contexto de arquitetura:** Fase 4 — migração NestJS + Prisma + Supabase

---

## Contexto

O banco PostgreSQL do projeto é hospedado no Supabase. O Supabase, por
padrão, concede privilégios amplos (SELECT/INSERT/UPDATE/DELETE) aos papéis
`anon` e `authenticated` em todas as tabelas do schema `public`.

Esses papéis são utilizados quando o Supabase Client faz requisições
diretamente ao PostgreSQL, autenticando via chaves públicas (`anon key`)
ou tokens de usuário final (`authenticated`).

**Nossa arquitetura NÃO utiliza Supabase Client no frontend.** O caminho
é sempre:

React → NestJS → Prisma → PostgreSQL (Supabase)

O NestJS é o único ponto de entrada. Autenticação (JWT), autorização
(RolesGuard), validação, regras de negócio e owner validation acontecem
exclusivamente no backend.

Ainda assim, os grants para `anon`/`authenticated` existiam no banco
(verificado em 2026-07-08 via information_schema.role_table_grants).
Se em algum momento a chave `anon` do Supabase fosse exposta, qualquer
pessoa teria acesso completo ao banco — incluindo `passwordHash` de
usuários, `RefreshToken` para roubo de sessão, e capacidade de
modificar `AuditLog`.

---

## Decisão

Implementar **Row Level Security (RLS)** em todo o schema `public`,
com a estratégia mais simples possível:

1. `ENABLE ROW LEVEL SECURITY` em cada tabela
2. **Nenhuma policy criada** — o default do PostgreSQL para RLS
   habilitado sem policy é deny all
3. `REVOKE ALL PRIVILEGES` de `anon` e `authenticated` em cada tabela
   (defesa dupla)

Escopo: **todo o schema public**:

- `User`, `Room`, `Reservation`, `AuditLog`, `RefreshToken`
- `_prisma_migrations` (mesma política aplicada a todo o schema)

**Papéis afetados pelo REVOKE:** apenas `anon` e `authenticated`.

**Papéis preservados:**

- `postgres` — usado pelo backend; possui `rolbypassrls = true`
- `service_role` — não usado hoje, mas faz parte da infraestrutura
  padrão do Supabase e pode ser necessário futuramente em jobs,
  Edge Functions ou integrações administrativas

---

## Consequências arquiteturais

**A arquitetura permanece Backend Gatekeeper.** O NestJS continua sendo
responsável por autenticação, autorização e regras de negócio. O RLS
existe apenas como camada adicional de proteção contra acesso direto
ao banco de dados (defense in depth).

**Regras de negócio NÃO devem ser duplicadas no PostgreSQL.** Owner
validation, conflito de horários, permissões por perfil, aprovação
de reservas etc. continuam exclusivamente no backend. Se em algum
momento essas regras aparecerem como policy no banco, isso é bug
arquitetural — deve ser removido.

**O backend continua funcionando idêntico.** O role `postgres` usado
pelo backend tem `rolbypassrls = true`, o que significa que ele
ignora automaticamente qualquer política RLS, e seus grants não
foram revogados. Nenhuma linha de código do NestJS/Prisma muda.
Migrations futuras (`migrate dev`, `migrate deploy`, `resolve`),
`db push` e `seed` continuam funcionando.

**Evolução futura (F5+).** Se algum módulo passar a utilizar Supabase
Client diretamente (ex: Realtime), policies por usuário poderão ser
adicionadas por cima desta base — RLS já estará habilitado, bastando
criar policies permissivas específicas para os casos de uso.

---

## Alternativas consideradas

**A. Manter estado atual (sem RLS).** Rejeitado: a chave `anon` pública
do Supabase tinha acesso completo de leitura e escrita a
`passwordHash`, `RefreshToken` etc. Vulnerabilidade real, mesmo sem
exploração ativa.

**B. RLS + `FORCE ROW LEVEL SECURITY`.** Rejeitado nesta fase.
`FORCE RLS` faria com que até o role dono das tabelas respeitasse as
policies, exigindo policy explícita para o backend. Reavaliado em
fase futura, após arquitetura estável.

**C. RLS + policies explícitas de negação (`USING (false)`).**
Rejeitado: redundante. RLS habilitado sem policy já é deny all no
PostgreSQL.

**D. Migrar frontend para Supabase Client + policies por usuário.**
Rejeitado nesta fase. Mudança arquitetural profunda que não resolve o
problema imediato. Reavaliado em F5+.

---

## Rollback

Em caso de emergência, aplicar o script:

`apps/api/prisma/rollback/20260708000000_rls_defense_in_depth_rollback.sql`

no SQL Editor do Supabase. Ele desabilita RLS e restaura os grants
originais de `anon` e `authenticated` em todas as tabelas.

---

## Referências

- Migration: `apps/api/prisma/migrations/20260708000000_rls_defense_in_depth/migration.sql`
- Rollback: `apps/api/prisma/rollback/20260708000000_rls_defense_in_depth_rollback.sql`
- Investigação prévia: queries de pg_roles, pg_class, role_table_grants e pg_policies executadas em 2026-07-08
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
