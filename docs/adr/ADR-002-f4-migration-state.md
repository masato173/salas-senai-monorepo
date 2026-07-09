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

- [ ] `useListReservations` consumindo `GET /reservations` do NestJS
- [ ] `useCreateReservation` consumindo `POST /reservations` do NestJS
- [ ] `useCancelReservation` consumindo `DELETE /reservations/:id` do NestJS
- [ ] `useSchedule` substituído por sincronização de aulas no NestJS
      (SyncModule F4.5 ou equivalente)
- [ ] `CURRENT_USER` hardcoded substituído por autenticação JWT real

### Backend

- [ ] SyncModule: importação dos registros do Google Sheets para PostgreSQL
      (ou descontinuação da funcionalidade de aulas no frontend)
- [ ] Endpoint de autenticação integrado ao sistema de usuários SENAI

### Operacional

- [ ] Testes E2E cobrindo todos os fluxos acima com o NestJS como backend
- [ ] `VITE_BACKEND_DRIVER=true` como padrão de produção validado
- [ ] Apps Script configurado em modo read-only (sem escritas)
- [ ] Monitoramento básico no NestJS (health + logs estruturados)
- [ ] Plano de rollback documentado e testado

---

## Decisão

**O cutover oficial está adiado para a Fase 5.**

A Fase 4 é declarada completa como fase de **infraestrutura e coexistência**:
o NestJS está em produção para disponibilidade e pronto para receber os
demais fluxos, mas o Apps Script permanece como backend operacional principal
até que todos os pré-requisitos acima sejam atendidos.

`VITE_BACKEND_DRIVER=true` NÃO será definido como padrão nesta fase para
não criar a percepção incorreta de que o NestJS já é o backend oficial.

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
