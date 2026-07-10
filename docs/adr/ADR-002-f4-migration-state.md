# ADR-002 — Estado da Migração Fase 4 e Pré-requisitos para Cutover

**Data:** 2026-07-08
**Status:** Ativo
**Contexto de arquitetura:** Fase 4 — migração NestJS + Prisma + Supabase

---

## Contexto

A Fase 4 implementou um backend NestJS completo que coexiste com o backend
legado (Google Apps Script + Google Sheets). A estratégia adotada foi de
**migração incremental**: o legado continua funcionando em produção enquanto
o novo backend é construído e validado.

A feature flag `VITE_BACKEND_DRIVER` controla qual backend fornece os dados
de disponibilidade de salas. Todos os demais fluxos operacionais ainda usam
o Apps Script.

---

## O que foi migrado para o NestJS (F4.0–F4.10)

| Módulo             | Endpoint                         | Status                     |
| ------------------ | -------------------------------- | -------------------------- |
| HealthModule       | `GET /health`                    | ✅ Produção                |
| AuthModule         | `POST /auth/login`               | ✅ Produção                |
| AuthModule         | `POST /auth/refresh`             | ✅ Produção                |
| AuthModule         | `POST /auth/logout`              | ✅ Produção                |
| RoomsModule        | `GET /rooms`                     | ✅ Produção                |
| RoomsModule        | `GET /rooms/admin/all`           | ✅ Produção                |
| RoomsModule        | `GET /rooms/:id`                 | ✅ Produção                |
| RoomsModule        | `POST /rooms`                    | ✅ Produção                |
| RoomsModule        | `PATCH /rooms/:id`               | ✅ Produção                |
| RoomsModule        | `DELETE /rooms/:id`              | ✅ Produção                |
| ReservationsModule | `POST /reservations`             | ✅ Produção                |
| ReservationsModule | `GET /reservations`              | ✅ Produção                |
| ReservationsModule | `GET /reservations/:id`          | ✅ Produção                |
| ReservationsModule | `PATCH /reservations/:id`        | ✅ Produção                |
| ReservationsModule | `DELETE /reservations/:id`       | ✅ Produção                |
| ReservationsModule | `PATCH /reservations/:id/status` | ✅ Produção                |
| AvailabilityModule | `GET /availability`              | ✅ Em uso via feature flag |
| AuditModule        | `GET /audit`                     | ✅ Produção                |
| RealtimeModule     | WebSocket `/rooms`               | ✅ Produção                |

**Infraestrutura:**

- PostgreSQL (Supabase, região `sa-east-1`) com 34 salas seedadas
- RLS ativo em 6 tabelas (ADR-001)
- JWT + RBAC (PROFESSOR / COORDENADOR / ADMIN)
- Refresh token com rotação automática
- Advisory locks para concorrência
- AuditLog em todas as mutations
- Socket.IO para notificações realtime

---

## O que ainda usa o Apps Script (legado)

| Fluxo                            | Hook/Service             | Motivo                       |
| -------------------------------- | ------------------------ | ---------------------------- |
| Listagem de reservas no frontend | `useListReservations`    | Ainda chama Apps Script      |
| Criação de reserva no frontend   | `useCreateReservation`   | Ainda chama Apps Script      |
| Cancelamento no frontend         | `useCancelReservation`   | Ainda chama Apps Script      |
| Aulas/ocupação (planilha)        | `useSchedule`            | Sem SyncModule (F4.5 pulado) |
| Autenticação do usuário          | `CURRENT_USER` hardcoded | Auth real pendente           |

**Consequência:** o NestJS possui os endpoints de reserva funcionando e
testados, mas o frontend ainda não os consome. As operações críticas do
usuário final passam pelo Apps Script.

---

## Estado atual da coexistência

Frontend React
│
├── useAvailabilityBackend (VITE_BACKEND_DRIVER=true)
│ └── GET /availability ──────────────────────► NestJS ✅
│
├── useListReservations ────────────────────────────► Apps Script ⚠️
├── useCreateReservation ───────────────────────────► Apps Script ⚠️
├── useCancelReservation ───────────────────────────► Apps Script ⚠️
└── useSchedule (aulas) ────────────────────────────► Apps Script ⚠️

**NÃO executar o cutover enquanto este diagrama não tiver todas as setas
apontando para o NestJS.**

---

## Pré-requisitos para o cutover definitivo (Fase 5)

O cutover será declarado concluído somente quando **todos** os itens abaixo
estiverem entregues e validados em produção:

### Frontend

- [x] `useListReservations` consumindo `GET /reservations` do NestJS — F5.4
- [x] `useCreateReservation` consumindo `POST /reservations` do NestJS — F5.5
- [x] `useCancelReservation` consumindo `DELETE /reservations/:id` do NestJS — F5.6
- [x] `useSchedule` substituído por `GET /schedules` do NestJS (SyncModule) — F5.7
- [x] `CURRENT_USER` hardcoded substituído por autenticação JWT real — F5.1

### Backend

- [x] SyncModule: importação dos registros do Google Sheets para PostgreSQL — F5.7
- [ ] Autenticação integrada ao sistema institucional SENAI (SSO/LDAP) — futuro

### Operacional

- [ ] Testes E2E cobrindo todos os fluxos com NestJS como backend — futuro
- [x] `VITE_BACKEND_DRIVER=true` como padrão de produção — F5.8
- [x] Apps Script em modo read-only (apenas fonte de sync de aulas) — F5.8
- [x] Monitoramento básico (GET /health ativo desde F4.0)
- [x] Plano de rollback documentado (seção Rollback de emergência neste ADR)

---

## Decisão

**O cutover oficial foi executado na Fase 5 (F5.8).**

A Fase 5 entregou a migração completa dos hooks do frontend para o NestJS.
O NestJS é o backend oficial da aplicação a partir de F5.8.

O Apps Script permanece **apenas** como fonte temporária de sincronização
de aulas (via `POST /sync/schedules`). Não recebe mais nenhuma escrita
direta do frontend.

`VITE_BACKEND_DRIVER=true` é o padrão de produção desde F5.8.

Itens pendentes para sprints futuras:

- Autenticação integrada ao sistema institucional SENAI (SSO/LDAP)
- Testes E2E cobrindo todos os fluxos no NestJS
- Remoção completa do Apps Script (quando sync de aulas for interno)

---

## Rollback de emergência

Caso qualquer módulo NestJS apresente problema em produção:

1. Setar `VITE_BACKEND_DRIVER=false` no `.env.local` e rebuildar
2. Apps Script continua funcionando independentemente
3. Banco PostgreSQL preservado — nenhum dado perdido
4. Reativar módulo após investigação

---

## Referências

- ADR-001: `docs/adr/ADR-001-rls-defense-in-depth.md`
- Roadmap: `CLAUDE.md` (seção "Roadmap oficial")
- Feature flag: `apps/reservations/src/hooks/useAvailabilityBackend.ts`
- Backend: `apps/api/src/`
