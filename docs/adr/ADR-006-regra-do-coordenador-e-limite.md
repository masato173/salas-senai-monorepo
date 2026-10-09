# ADR-006 — Regra do COORDENADOR, papel vindo do banco e limite de requisições

**Data:** 2026-10-09
**Status:** Ativo
**Contexto de arquitetura:** hardening de segurança pós-auditoria (issue 6,
achados B1, B2 e C4)

---

## Contexto

A auditoria apontou três divergências entre a autorização declarada e a
efetivamente aplicada:

- **B2 — papel vindo do token.** `JwtStrategy.validate` já carregava o
  usuário do banco para checar `active`, mas devolvia `payload.role`.
  Rebaixar um ADMIN ou COORDENADOR só tinha efeito quando o access token
  expirava (até 15 min). Desativar a conta, por contraste, já era imediato.
- **B1 — `@Roles(Role.ADMIN)` de classe morto em `UsersController`.** O
  `RolesGuard` usa `getAllAndOverride([handler, classe])`: o `@Roles` do
  handler **substitui** o da classe. Os 4 handlers declaram
  `@Roles(COORDENADOR, ADMIN)`, então o de classe nunca era avaliado. Ele
  parecia proteção sem ser — armadilha para quem adicionasse um handler
  confiando nele, ou removesse os gates do service achando-os redundantes.
- **C4 — bypass do COORDENADOR no `OwnershipService`.** O código libera o
  COORDENADOR para modificar qualquer reserva. Faltava registrar se isso era
  a regra pretendida.

## Decisão

### 1. Regra do COORDENADOR (decisão de produto)

O COORDENADOR pode **editar, cancelar, aprovar e rejeitar qualquer
reserva**, inclusive as variantes em lote (`PATCH /reservations/group/:id`,
`PATCH /reservations/selected`). O bypass em
`OwnershipService.assertOwnerOrPrivileged` é intencional e foi mantido;
comentário e testes foram alinhados ao código
(`ownership.service.spec.ts` trava a matriz dono / outro PROFESSOR /
COORDENADOR / ADMIN × própria / alheia / inexistente / soft-deleted).

O COORDENADOR **continua sem poder**, pelos gates de `UsersService`
(`updateRole`/`setActive`, cobertos por `users.service.spec.ts`):

- promover alguém a ADMIN;
- alterar (papel ou status, ativar ou desativar) um ADMIN;
- alterar outro COORDENADOR — inclusive a si mesmo.

### 2. Fonte do papel: banco, não token

`JwtStrategy.validate` devolve `role` e `email` do usuário carregado do
banco; o token só identifica (`sub`). Sem consulta nova: é a mesma busca que
já checava `active`. Rebaixar um usuário vale na **próxima requisição HTTP**.

### 3. Contrato de autorização de `/users`

`@Roles` de classe removido de `UsersController`. Cada handler declara o
seu. `users.controller.contract.spec.ts` lê os metadados via `Reflector`,
enumera os handlers do prototype e **falha se aparecer um handler sem
expectativa explícita**.

### 4. Limite de requisições do COORDENADOR

| Parâmetro    | Valor                                                                                                                                                         |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quem         | só `COORDENADOR` (ADMIN e PROFESSOR seguem só no limite global)                                                                                               |
| Rotas        | `PATCH /reservations/:id/status`, `PATCH /reservations/:id`, `PATCH /reservations/group/:groupId`, `PATCH /reservations/selected`, `DELETE /reservations/:id` |
| Limite       | **30 ações por 60 s** (`COORDINATOR_ACTIONS_LIMIT`/`_TTL_MS`)                                                                                                 |
| Balde        | **único** para as 5 rotas, por **userId** (não por IP)                                                                                                        |
| Contagem     | 1 por requisição, inclusive em lote e mesmo se a ação terminar em 403/404 ou for sobre a própria reserva                                                      |
| Bloqueio     | `blockDuration = ttl` (60 s); `Retry-After` em segundos                                                                                                       |
| Resposta     | 429 com mensagem em PT-BR                                                                                                                                     |
| Desligamento | mesmo `skipIf` do `THROTTLE_SKIP` (issue 7 — proibido em produção)                                                                                            |

**Justificativa dos números:** 30/min é folgado para uso humano (aprovar
uma fila de pendentes a ~1 ação a cada 2 s) e corta automação abusiva ou um
token de coordenador vazado sendo usado para alterar em massa reservas de
terceiros — o efeito colateral do bypass da decisão 1.

**Implementação:** `CoordinatorActionsThrottleGuard`
(`apps/api/src/common/guards/coordinator-actions-throttle.guard.ts`),
aplicado com `@UseGuards` nas 5 rotas. É guard de **rota**, não throttler
nomeado no `ThrottlerModule`, porque o `ThrottlerGuard` global roda **antes**
do `JwtAuthGuard` — lá o `req.user` ainda não existe. Guards de rota rodam
depois dos globais. A ordem dos guards globais não mudou. O guard usa o
storage e o `skipIf` do próprio `ThrottlerModule` (fonte única).

**Dependências e limitações registradas:**

- O limite por usuário **depende da decisão 2**: é o papel vindo do banco
  que decide quem é COORDENADOR na hora da requisição.
- O storage é o **em memória** do `ThrottlerModule`: o limite é **por
  instância** da api. Com várias réplicas, o limite efetivo se multiplica
  pelo número de réplicas. Limite global exigiria storage compartilhado
  (ex.: Redis), fora desta decisão.
- O limite global de 100/min (e o 5/min de login/refresh) continua **por
  IP**. A confiabilidade dele depende de `trust proxy` refletir a topologia
  real — ver issue #21.
- O e2e do CI roda com `THROTTLE_SKIP=true`, então o limite novo tem
  cobertura **só unitária** (`coordinator-actions-throttle.guard.spec.ts`,
  incluindo o contrato de quais rotas têm o guard e a liberação após o ttl).

## Fora do escopo (issues abertas)

- **#21** — API exposta sem proxy com `trust proxy 1`: `X-Forwarded-For`
  forjado contorna o rate limit por IP (deploy `infra/docker`).
- **#24** — WebSocket usa o papel do token e não checa conta ativa no
  handshake: um COORDENADOR rebaixado segue na room `coordenadores` até o
  token expirar.
- **#22** — `updateGroup`/`updateSelected` checam conflito fora da
  transação/lock e não gravam `AuditLog`.
- **#23** — reaprovar reserva `REJECTED` não verifica conflito de horário.
- **#25** — frontend trata 429 como erro interno e refaz a tentativa (o
  coordenador vê a mensagem do limite só depois das tentativas automáticas).

## Consequências

- Revogar privilégio passa a ser imediato no HTTP; no WebSocket, só após
  #24.
- Nenhum contrato de API muda: mesmas rotas, mesmos status. O único status
  novo possível é 429 para o COORDENADOR acima de 30 ações/min.
- Rollback independente por commit: papel do token, `@Roles` de classe e o
  guard podem ser revertidos isoladamente.
