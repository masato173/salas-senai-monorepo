# ADR-007 — Conflito de horário na edição em lote e na reaprovação

**Data:** 2026-10-09
**Status:** Ativo
**Contexto de arquitetura:** regra central do projeto (nunca permitir
conflito de horário; validação autoritativa no backend, dentro de transação
com lock). Issues #22 e #23, achados d e e da auditoria da issue #6.

---

## Contexto

`create`, `update` e `createRange` validam conflito dentro de
`$transaction` + `pg_advisory_xact_lock(hashtext(roomId), hashtext(date))`.
Dois caminhos ficavam fora desse padrão:

- **#22 — edição em lote** (`PATCH /reservations/group/:groupId` e
  `PATCH /reservations/selected`): `hasConflict` rodava sem transação e sem
  lock, no client global; cada item era gravado e commitado na hora. Dois
  lotes simultâneos podiam gravar sobreposição. Conflito fazia o item ser
  **pulado** (200 com `count` parcial); erro de posse/horário no meio do
  lote abortava **depois** de já ter gravado os itens anteriores. Nenhum
  AuditLog.
- **#23 — reaprovação**: `REJECTED` não ocupa horário no `ConflictService`
  (só `PENDING`/`APPROVED` contam). `updateStatus` permitia `REJECTED →
APPROVED` sem checar se o horário foi ocupado depois da rejeição.

## Decisão

### 1. Edição em lote numa única transação, com locks de todas as chaves em ordem

`updateGroup` e `updateSelected` delegam a `applyBatchUpdate`
(`reservations.service.ts`), numa única `$transaction`:

1. pré-leitura + validação, só para descobrir as chaves;
2. **locks** `(sala, data)` de **todas** as chaves do lote — sala atual e
   sala destino de cada item (o lote não muda a data) — **sem duplicata e
   em ordem crescente** (`sortedLockKeys`: sala, depois data, comparação
   por code unit), **antes de qualquer checagem**;
3. releitura + validação; item que mudou de sala/data, ou sumiu, entre a
   pré-leitura e o lock → 409 "alterada por outra operação";
4. gravação (o DTO é uniforme para o lote: uma `updateMany`);
5. verificação de conflito (ver 3);
6. AuditLog por item (`UPDATE_RESERVATION`, ator, antes/depois — mesmo
   formato do `update`).

**Sem deadlock:** dois lotes concorrentes adquirem os locks na mesma ordem
total, então não formam ciclo. `create`, `update`, `createRange` e
`updateStatus` seguram **um** lock por transação e nunca esperam por um
segundo. Uma colisão de `hashtext` (dois pares distintos com o mesmo par de
hashes) poderia inverter a ordem; nesse caso o Postgres detecta o deadlock
e aborta uma das transações — o resultado é erro, nunca sobreposição.

### 2. Política de falha: tudo-ou-nada

Qualquer conflito → **409** e nada gravado (rollback). Erro de posse ou de
existência → 403/404 e nada gravado (antes gravava parcialmente). O formato
do sucesso não muda (`{ count, reservations }`); `count` passa a ser sempre
o lote inteiro. A validação por item mantém **os mesmos status e
mensagens** do `assertCanModify` (404 "não existe"/soft-deleted antes de
403 "não é seu", na ordem dos ids da requisição) — sem oráculo de
existência novo.

A mensagem do 409 cita só dados dos itens do próprio lote (as datas, em
DD/MM/AAAA) — nunca dono, turma, notes ou id da reserva conflitante.

### 3. Checagem dentro do lote: "grava e depois verifica"

O `ConflictService` ficou **intocado** (fórmula, critérios e assinatura —
`excludeId` aceita um id só). Em vez de excluir os ids do lote da consulta,
o lote grava primeiro e verifica depois, **dentro da transação**: cada item
que bloqueia (`PENDING`/`APPROVED`) é checado na posição nova com
`excludeId` = ele mesmo. Como os outros itens do lote já estão nas posições
novas, a checagem pega:

- conflito com reserva de fora do lote;
- conflito entre itens do próprio lote;
- e **não** conta as posições antigas dos itens (que já saíram de lá).

Item que não bloqueia (`REJECTED`) não é verificado: movê-lo para um
horário ocupado não gera 409 falso, porque ele não ocupa nada.

### 4. Reaprovação

Em `updateStatus`, a transição que **volta a bloquear** (destino em
`PENDING`/`APPROVED`, origem fora deles — hoje só `REJECTED → APPROVED` é
possível pela API) roda dentro do lock `(sala, data)`: relê a reserva (404
se cancelada/soft-deleted no meio, 400 se `CANCELLED`, 409 se mudou de sala
ou data), checa conflito excluindo a própria e devolve 409 sem alterar o
status. `PENDING → APPROVED` e as rejeições seguem sem checagem extra
(`PENDING` já bloqueia).

### 5. Duração da transação de lote

- `$transaction(fn, { maxWait: 5_000, timeout: 20_000 })` **só** na
  transação de lote (`BATCH_TX_OPTIONS`). O default do Prisma (5 s) não
  cobre ~2N + K idas ao banco de um lote grande pela latência **Railway →
  Supabase** (pooler pgbouncer em transaction mode). Os valores foram
  dimensionados para essa topologia e **devem ser revistos no VPS**
  (Postgres local, sem pgbouncer), onde a latência é muito menor.
- `ids` de `PATCH /reservations/selected` limitado a **60**
  (`UPDATE_SELECTED_MAX_IDS`, mesmo teto do `createRange`); acima disso → 400. Grupos já nascem com no máximo 60 itens (`createRange`).

## Testes

- Unitários (`reservations.service.spec.ts`,
  `reservations-status.service.spec.ts`,
  `update-reservation-selected.dto.spec.ts`): ordem e unicidade dos locks,
  locks antes de qualquer checagem, verificação depois da gravação com
  `tx` e `excludeId` próprio, 409 sem audit, item REJECTED sem 409 falso,
  posse por item com as mesmas mensagens, 404 antes de 403, item alterado
  entre a pré-leitura e o lock, audit por item, reaprovação com e sem
  conflito, teto de 60 ids.
- **Concorrência real** (`tests/e2e/batch-conflict.spec.ts`, job e2e do CI
  contra Postgres 17 descartável): dois `PATCH /reservations/selected`
  simultâneos que, juntos, sobreporiam a mesma sala/horário → exatamente um
  200 e um 409, e a reserva do 409 continua onde estava.

## Fora do escopo

- **Aulas (`Schedule`) não são checadas no backend.** O `ConflictService`
  consulta só `Reservation`; o `AvailabilityService` apenas **marca** o
  status `conflito` para exibição. Sem issue aberta até a data deste ADR.
- **TOCTOU do `update()`**: lê a reserva fora da transação e trava só a
  chave de destino. Sem issue aberta até a data deste ADR.
- Edição em lote não emite realtime nem notificação (comportamento anterior
  mantido).
- `PENDING → APPROVED` não checa conflito; sobreposições legadas (corrida
  do #22 antes desta correção, migração do legado ou escrita direta no
  banco) continuam aprováveis. Auditoria somente leitura recomendada.

## Consequências

- Mudança de contrato (registrada no `CHANGELOG.md`, bloco "Não lançado"):
  lote com conflito passa de 200 parcial para 409; 403/404 deixam de gravar
  parcialmente; `selected` acima de 60 ids → 400; reaprovação com horário
  ocupado → 409.
- O frontend mostra a mensagem do 409 (`batchConflictMessage`) em vez de
  "Conflito em 0 data(s)".
- Rollback independente por commit; sem schema nem migration.
