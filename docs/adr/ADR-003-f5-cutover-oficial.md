# ADR-003 — Cutover Oficial Fase 5: NestJS como Backend Definitivo

**Data:** 2026-07-10
**Status:** Ativo
**Contexto de arquitetura:** Fase 5 — migração completa do frontend para NestJS

---

## Contexto

A Fase 4 entregou o backend NestJS completo em coexistência com o Apps Script.
A Fase 5 migrou todos os hooks do frontend para consumir exclusivamente o NestJS,
completando a migração arquitetural iniciada em F4.0.

---

## Decisão

A partir de F5.8, o **NestJS é o backend oficial** do sistema Controle de Salas SENAI.

---

## O que mudou no frontend (Fase 5)

| Sprint | Entrega                                                             |
| ------ | ------------------------------------------------------------------- |
| F5.1   | LoginPage + authStore + tokenStorage — auth JWT real                |
| F5.2   | ApiClient — injeção automática de Bearer + refresh interceptor      |
| F5.3   | nestjsApiService — adapter com mapper de status e room cache        |
| F5.4   | useListReservations → GET /reservations                             |
| F5.5   | useCreateReservation → POST /reservations                           |
| F5.6   | useCancelReservation → DELETE /reservations/:id                     |
| F5.7   | fetchSchedule → GET /schedules (NestJS, alimentado pelo SyncModule) |
| F5.8   | VITE_BACKEND_DRIVER=true como padrão de produção                    |

---

## Papel do Apps Script após F5.8

Apps Script
│
└── Fonte de dados de aulas (planilha de ocupação)
↓ sincronizado via
POST /sync/schedules (ADMIN, manual ou cron futuro)
↓ armazenado em
tabela Schedule (PostgreSQL)
↓ consumido pelo frontend via
GET /schedules (@Public)

O Apps Script **não recebe mais nenhuma escrita direta do frontend**.
Todas as reservas são criadas, atualizadas e canceladas via NestJS.

---

## Fluxo completo após cutover

Frontend React (VITE_BACKEND_DRIVER=true)
│
├── auth → POST /auth/login + POST /auth/refresh
├── fetchSchedule → GET /schedules (aulas do PostgreSQL)
├── listReservations → GET /reservations
├── createReservation → POST /reservations
├── cancelReservation → DELETE /reservations/:id
├── availability → GET /availability (reservas + aulas)
├── audit → GET /audit (ADMIN)
└── realtime → WebSocket /rooms (Socket.IO)

Apps Script → sync manual/cron → POST /sync/schedules → Schedule table

---

## Rollback de emergência

Se qualquer problema crítico aparecer em produção:

1. Setar `VITE_BACKEND_DRIVER=false` no `.env.local` e rebuildar
2. Apps Script retoma como backend operacional (nunca foi desligado)
3. Banco PostgreSQL preservado — nenhum dado perdido
4. Investigar + corrigir + reativar flag

---

## Pendências para sprints futuras

- [ ] Autenticação integrada ao sistema institucional SENAI (SSO/LDAP)
- [ ] Testes E2E cobrindo todos os fluxos no NestJS (Playwright)
- [ ] Cron periódico para POST /sync/schedules (@nestjs/schedule)
- [ ] Remoção completa do Apps Script (quando sync virar interno)
- [ ] F4.10b — auth JWT no handshake WebSocket (já implementado,
      pendente integração no cliente Socket.IO do frontend)

---

## Referências

- ADR-001: `docs/adr/ADR-001-rls-defense-in-depth.md`
- ADR-002: `docs/adr/ADR-002-f4-migration-state.md`
- Feature flag: `apps/reservations/src/hooks/useAvailabilityBackend.ts`
- ApiClient: `apps/reservations/src/services/apiClient.ts`
- Adapter: `apps/reservations/src/services/nestjsApiService.ts`
