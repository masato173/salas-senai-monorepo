# 0.0.0 (2026-07-05)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c
- **reservations:** s3 add missing useAvailability hook to git tracking aa4cb93

### Features

- **backend:** s4 verificaAulaConflito integrada nos 5 pontos de checkConflicts ae7de91
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** s5 dashboard com disponibilidade real de salas (aulas + reservas) 36a0cd8
- **reservations:** s6 fluxo data-sala-form com disponibilidade real na pagina reservas ca266c2
- **reservations:** s7 status por data no preview de periodo (getStatusParaHorario) 02a0494
- **reservations:** s8 painel de disponibilidade da sala na pagina reservas 75f166a
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-03)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** s4 verificaAulaConflito integrada nos 5 pontos de checkConflicts ae7de91
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** s5 dashboard com disponibilidade real de salas (aulas + reservas) 36a0cd8
- **reservations:** s6 fluxo data-sala-form com disponibilidade real na pagina reservas ca266c2
- **reservations:** s7 status por data no preview de periodo (getStatusParaHorario) 02a0494
- **reservations:** s8 painel de disponibilidade da sala na pagina reservas 75f166a
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-03)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** s4 verificaAulaConflito integrada nos 5 pontos de checkConflicts ae7de91
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** s5 dashboard com disponibilidade real de salas (aulas + reservas) 36a0cd8
- **reservations:** s6 fluxo data-sala-form com disponibilidade real na pagina reservas ca266c2
- **reservations:** s7 status por data no preview de periodo (getStatusParaHorario) 02a0494
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-03)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** s4 verificaAulaConflito integrada nos 5 pontos de checkConflicts ae7de91
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** s5 dashboard com disponibilidade real de salas (aulas + reservas) 36a0cd8
- **reservations:** s6 fluxo data-sala-form com disponibilidade real na pagina reservas ca266c2
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-02)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** s5 dashboard com disponibilidade real de salas (aulas + reservas) 36a0cd8
- **reservations:** s6 fluxo data-sala-form com disponibilidade real na pagina reservas ca266c2
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-02)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** s5 dashboard com disponibilidade real de salas (aulas + reservas) 36a0cd8
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-02)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** s1+s2 disponibilidade - tipos, mapper puro e 31 testes (buildRoomAvailability) 21dd23b
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-01)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a

# 0.0.0 (2026-07-01)

### Bug Fixes

- **e2e:** identifica reserva pelo MARKER, remove fallback inseguro, espera robusta 09840ec
- **husky:** corrige prepare para husky v9 + arma hooks a045803
- **lint:** configura eslint reservations + react-hooks plugin + corrige imports mortos e7803eb
- **lint:** zera warnings reservations + torna pacote eslint-config lintavel + ignora .turbo bdd17ee
- **reservations:** publica backend sprint 3 + script de teste idempotente (11/11) 4cf9e4c

### Features

- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil eb5d03a
- **backend:** versiona codigo.gs com b3.2 (snapshot do apps script) e remove fossil 250eb6f
- **reservations:** a3.1 hook use-schedule e export schedule-result (dashboard nativo) 70fd3ad
- **reservations:** a3.2 tabela de ocupacao e filtros do dashboard nativo (espelha legado) 6bc4150
- **reservations:** a3.3 cards de resumo do dashboard (salas, hoje, por turno) 1ae5e4d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado 1e2fe6d
- **reservations:** a3.5 dashboard nativo controlado substitui o iframe legado e7af0a6
- **reservations:** b3.3 frontend consome turno por bloco com fallback pra lista 8be6f30
- **reservations:** d4.1 service e hook update-reservation-selected (c3, retry zero por flag 1) b6d75d4
- **reservations:** d4.2 mini-calendario timezone-safe para selecao de datas do grupo b836cc8
- **reservations:** d4.3 view de remanejamento de datas selecionadas (c3) 5028a1b
- **reservations:** d4.4 wiring do caso c3 no modal (3o caminho algumas datas) 7fe3e28
- **reservations:** sprint 3 completo - calendario + cancelar com owner-check 7f09194
- **reservations:** sprint 3 etapas 1-3 (backend list/cancel + service + hooks) d1179ae
- **reservations:** sprint 3.4.0 - fullcalendar instalado + calendario vazio na pagina 5b453fb
- **reservations:** sprint 3.4.2a - modal de detalhes da reserva d2283bc
- **sprint4-A:** groupId no schema + criacao (unica=id, periodo=UUID compartilhado) 425ee7d
- **sprint4-B:** le groupId no frontend + selo Periodo (isRangeReservation) b11e13c
- **sprint4-C1:** updateReservation backend (editar 1, checkConflicts excludeId, owner-check) bb8dbe6
- **sprint4-C2:** updateReservationGroup backend (editar grupo, checkConflicts excludeGroupId, atomico) c8d7e04
- **sprint4-C3:** updateReservationSelected backend (remanejar selecionadas, atomico, 13/13) 08364e0
- **sprint4-D1:** service + hooks de update (C1 + C2, 30 testes verdes) 264b048
- **sprint4-D2:** ReservationForm modo edit (create intacto, buildUpdatePayload, 7 testes) ddc6840
- **sprint4-D3:** wiring do modal de edicao (3 views, turma no mapper, Cenario C verde) ce8f13a
