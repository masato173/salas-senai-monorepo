# CLAUDE.md — Controle de Salas SENAI

## O que é

Sistema institucional de gestão e agendamento de salas do SENAI (Manaus).
**Está EM PRODUÇÃO e EM USO REAL.** Não é protótipo, não é exemplo, não recriar do zero.

Objetivo: evoluir o sistema atual para uma plataforma SaaS de gestão de salas,
reservas, calendário, disponibilidade, auditoria, aprovação e administração —
**sem quebrar o legado**, de forma incremental.

---

## Estado atual

| Camada | Tecnologia | Estado |
|---|---|---|
| Frontend legado | HTML/CSS/JS + GitHub Pages | Funcional, em produção (somente leitura) |
| Frontend novo | React + TypeScript + Vite + Zustand + React Query | Em construção |
| Backend | Google Apps Script (Web App) | Funcional |
| Dados | Google Sheets | Em produção |

**Features:**
- Leitura de ocupação (legado): **completa**
- Reserva única (criar 1 reserva): **completa e validada** (backend + service + hook + form)
- Reserva em período (multi-dia, mesma sala/horário em vários dias): **em andamento**

---

## Arquitetura-alvo (SaaS)

Destino da evolução — **não construir tudo de uma vez**, migrar incrementalmente:

- **Frontend:** React + TypeScript + Vite + Zustand + React Query + Tailwind + FullCalendar
- **Backend:** NestJS + Prisma + PostgreSQL + Redis
- **Realtime:** Socket.IO
- **Auth:** JWT + Refresh Token + RBAC (PROFESSOR / COORDENADOR / ADMIN)
- **Domínio:** User · Room · Reservation · AuditLog
- **Módulos:** auth, rooms, reservations, schedules, availability, notifications, dashboard, users, audit
- Validação de conflito em **transaction** no banco.

Hoje o backend é Apps Script + Sheets. Ele será substituído gradualmente,
**mantendo o contrato estável para o frontend** (o frontend não deve saber qual backend está por trás).

---

## Roadmap oficial

Migração incremental. **Cada item só inicia com o anterior estável; o legado nunca para de funcionar; nenhuma fase quebra a anterior.**

**✅ Concluído**
- **F0 — Legado:** leitura de ocupação (HTML/CSS/JS + Apps Script + Sheets), filtros (turma/data/sala/mês/turno), paginação, proteção XSS.
- **F1 — Frontend React:** estrutura Vite + TS + Zustand + React Query, roteamento, Dashboard exibindo o legado via iframe.
- **F2 — Backend de reservas (Apps Script):** `doPost` + `LockService` + `checkConflicts` + idempotência; aba `Reservas`.
- **Sprint 2 — Reserva única ponta-a-ponta:** service + hook + `ReservationForm` + página `/reservas`. Validada no navegador.
- **Sprint 2.5 — Reserva em período** (multi-dia, mesma sala/horário; tudo-ou-nada; dias da semana escolhidos; limite 60 datas). 104/104 testes verdes, validada no navegador, 4 cleanups aplicados.

**🔄 Em andamento**
- **Sprint 3 — Visualização (calendário) + cancelar:** FullCalendar (mês/semana/dia), `listReservations`, soft delete via status='CANCELLED', validação de owner por `createdBy`.

**⏭️ Próximo (curto prazo)**
- **Sprint 4 — Editar reserva:** revalidar conflito no backend; decidir comportamento ao editar uma reserva de um período (única data ou todas).
- Limpeza dos dados de teste na DEV.

**📦 Médio prazo**
- Autenticação (login SENAI) + remover token do frontend (proxy / backend intermediário).
- Aprovação de reservas (coordenador) + RBAC básico (PROFESSOR / COORDENADOR / ADMIN).
- Notificações e realtime (Socket.IO).

**🎯 Longo prazo (arquitetura-alvo)**
- Migração Apps Script → NestJS + Prisma + PostgreSQL, **mantendo o contrato do frontend**.
- Redis (cache/filas), audit trail completo.
- Dashboard administrativo, relatórios/exportação, analytics.
- PWA, dark mode, preparação multi-tenant.

---

## REGRA ABSOLUTA

**NUNCA:**
- recriar o projeto do zero
- remover funcionalidades existentes
- quebrar Apps Script ou Google Sheets
- alterar APIs/payloads silenciosamente
- remover compatibilidade
- ignorar regressões, testes ou concorrência

**SEMPRE:**
1. analisar o contexto atual antes de mexer
2. reutilizar o que já existe
3. implementar incrementalmente
4. preservar compatibilidade
5. pensar em segurança, concorrência, UX, escalabilidade, rollback e observabilidade

Se houver dúvida: **PARE, explique os trade-offs, não assuma silenciosamente.**

---

## O que conta como REGRESSÃO

Regressão = qualquer comportamento que funcionava e **parou de funcionar** (ou mudou de resultado). Neste projeto, conta como regressão:

- Leitura de ocupação do legado para de carregar ou retorna resultado diferente
- Qualquer filtro (turma / data / sala / mês / turno) para de funcionar
- Paginação, botão "Hoje", "Limpar" ou refresh quebram
- `createReservation` (reserva única) falha ou muda o contrato de request/response
- Conflito de horário deixa de ser detectado (overlap parcial/total/containment)
- Idempotência para de funcionar (cria linha duplicada para o mesmo `clientRequestId`)
- Um teste que passava passa a falhar
- Contrato de API muda (nome/tipo de campo, formato de resposta) **sem versionar**
- XSS deixa de ser sanitizado em dado externo
- `setNumberFormat('@')` removido das colunas C/D/E
- Tempo de resposta degrada de forma relevante

**Regra:** nenhuma entrega pode introduzir regressão. Se uma mudança exigir quebrar um contrato, isso é uma **decisão explícita e documentada** — nunca silenciosa.

---

## Protocolo OBRIGATÓRIO antes de qualquer alteração

1. Ler este `CLAUDE.md`.
2. Ler os arquivos que serão tocados **e os que dependem deles**.
3. Rodar os testes ANTES (baseline) e anotar quantos passam.
4. Fazer a **análise de impacto** (seção abaixo).
5. Confirmar em qual camada/feature a mudança entra e se respeita o legado.
6. Só então alterar — **mudança mínima necessária**.
7. Rodar os testes DEPOIS e comparar com o baseline.
8. Validar manualmente o caminho afetado (navegador / PowerShell).

Em caso de dúvida sobre escopo: **PARE e pergunte.** Nunca alterar contrato no escuro.

---

## Análise de impacto (responder ANTES de mexer)

- O que esta mudança toca? (arquivos, funções, contratos)
- Quem depende disso? (legado, outras telas, backend)
- Quebra algum contrato de API ou formato de dados?
- Afeta concorrência? (locks, race conditions, reservas simultâneas)
- Afeta performance? (mais leituras/escritas, lock segurado por mais tempo)
- Qual é o plano de **rollback** se der errado?

Se a resposta a "quebra o legado?" for **sim**, reavaliar a abordagem antes de prosseguir.

---

## Regra anti-invenção — a IA NÃO inventa código

A IA (Claude Code ou assistente) **NUNCA inventa**:
- nomes de funções, métodos, variáveis, campos ou tipos que não existem no código
- contratos de API, formatos de request/response ou nomes de campo (`dataInicio` **não** vira `startDate`)
- helpers, módulos, bibliotecas ou imports não verificados
- IDs, URLs, tokens, caminhos de arquivo, nomes de aba ou de planilha
- estrutura de arquivos ou comportamento de função sem ter **lido o código real**

**Antes de referenciar qualquer coisa, VERIFICAR que ela existe:**
- ler o arquivo real (não assumir pelo nome)
- confirmar a assinatura da função / o nome exato do campo
- usar os contratos já validados (ver seção Backend e os tipos em `appsScript.ts`)

Se a informação não estiver disponível: **perguntar, ou marcar `// TODO` explícito** — nunca preencher a lacuna com suposição. Código inventado que "parece certo" é pior que um TODO honesto, porque esconde o bug até a integração.

---

## Critérios de aceite (definição de "pronto")

Uma tarefa só está concluída quando **TODOS** forem verdadeiros:

- [ ] compila sem erros
- [ ] lint passa
- [ ] todos os testes passam, **sem reduzir** a cobertura existente
- [ ] **zero regressão** (todos os testes antigos seguem verdes)
- [ ] tipagem válida (sem `any` desnecessário, imports válidos)
- [ ] validado manualmente no caminho real (navegador / `Invoke-RestMethod`)
- [ ] backend: validação **dentro do lock**, idempotência mantida, contrato preservado
- [ ] decisão técnica relevante registrada na tabela de Decisões

---

## Regra mais importante — conflito de horário

```js
const hasConflict = newStart < existingEnd && newEnd > existingStart;
```

Toda validação de conflito é **autoritativa no backend**, dentro do `LockService`.
O frontend pode mostrar conflito como UX (otimista), mas **nunca é a única proteção**.

Cobrir: overlap parcial, overlap total, containment, múltiplas datas, race conditions, reservas simultâneas.

---

## Horários (horário LIVRE, não fixo)

Reservas permitidas em qualquer faixa dentro de **06:00 → 23:00**.
O usuário escolhe: **data, sala, hora de início, hora de fim**.

**NÃO usar horários fixos.** Turnos M/V/N são apenas **rótulos derivados** da hora de início
(M = manhã, V = tarde, N = noite), usados para exibição — **não são restrições de horário**.

---

## Planilhas (CRÍTICO — não confundir DEV com PRODUÇÃO)

| Ambiente | Nome | ID | Regra |
|---|---|---|---|
| **PRODUÇÃO** | Controle das salas | `1m97CzLNYJlqTq3qECYtpGgeS_skIL0B3eoWNIx7edXk` | **NÃO TOCAR** — funcionários usam agora |
| **DEV** | SENAI Salas - DEV copia | `1Y4DP1Q4nxx4BMwEoYFd7R673G8asaubM9-XzSrGUPLE` | Trabalhar aqui |

Todo desenvolvimento e teste acontece na planilha **DEV**.

---

## Backend (Apps Script)

- Deploy: App da Web, executar como "eu", acesso "qualquer pessoa".
- **Redeploy SEMPRE como Nova versão:** Implantar → Gerenciar implantações → lápis → Nova versão → Implantar. A URL `/exec` não muda.
- URL/token: ver `apps/reservations/src/config.ts` (frontend) e `SPREADSHEET_ID` / `SECRET_TOKEN` no `codigo.gs`.

**Fluxo de escrita (obrigatório):**
```
POST → doPost → LockService → validate → checkConflict → saveReservation → response
```

**Aba `Reservas` (colunas A–M):**
```
id | sala | data | inicio | fim | professor | turma | observacao | status | createdBy | createdAt | updatedAt | clientRequestId
```

- Idempotência por `clientRequestId`.
- Colunas C/D/E (data/inicio/fim) forçadas como texto via `setNumberFormat('@')` após `appendRow` — **não regredir** (Sheets converte "08:00"/"2026-12-10" em Date de 1899 ao reler, quebrando a comparação de conflito).
- Códigos de erro padronizados: `CONFLICT`, `VALIDATION`, `LOCK_TIMEOUT`, `DUPLICATE`, `INTERNAL`.

---

## Estrutura do frontend (apps/reservations)

```
src/
├── config.ts                 ← URL, token, SALAS, CURRENT_USER
├── services/appsScript.ts    ← fetchSchedule, createReservation (+ range)
├── hooks/useCreateReservation.ts
├── components/reservations/ReservationForm.tsx
├── pages/Reservas/index.tsx
├── validators/               ← conflict.ts, reservation.ts
└── store/reservationStore.ts ← Zustand
```

Fluxo local (proxy/VPN bloqueia o dev server, usar preview):
```
npx vite build
copy public\legacy-index.html dist\legacy-index.html
npx vite preview        # http://localhost:4173
```

---

## Padrões de código

- **Mínimo e sem duplicação.** Não criar camadas, helpers, DTOs ou abstrações desnecessárias.
- Funções curtas, responsabilidade única, CSS limpo.
- Mudança mínima: não modificar código não relacionado; preservar comportamento existente.
- Preferir solução simples e de baixo risco à solução "esperta".
- **TDD:** RED → GREEN → REFACTOR. Frontend com Vitest; backend Apps Script testado via PowerShell (`Invoke-RestMethod`, **não** `curl.exe`).

---

## Segurança

- Sanitização anti-XSS em todo dado externo (`esc()` no legado, `sanitize` no backend).
- Validação **sempre** no backend; nunca confiar só no frontend.
- `LockService` em toda escrita.
- Token: dados de sala são públicos e não sensíveis; o token atual é suficiente para a fase atual. **Auth real (JWT/RBAC) entra na fase do proxy** — não antes.
- Timezone: **America/Manaus (UTC-4)**.
- Nunca expor secrets em código público ou neste arquivo.

---

## Observabilidade e logs

- **Backend:** `Logger.log` em toda ação crítica e em **todo** `catch` (incluir `err.stack`). **Nunca catch vazio.**
- Toda resposta de erro no formato `{ ok:false, error:{ code, message } }` com código padronizado.
- **Frontend:** erros tratados e exibidos ao usuário (toast/alerta), nunca engolidos; `console.error` com contexto em falhas inesperadas.
- **Audit:** toda escrita registra quem (`createdBy`), quando (`createdAt`/`updatedAt`) e o quê.
- Mensagens de erro claras e acionáveis para o usuário final, em PT-BR.

---

## Regras de migração futura

- Migração **sempre incremental**: o sistema anterior continua funcionando durante a transição.
- A nova camada **coexiste** com a antiga (ex.: React novo + HTML legado via fallback/iframe).
- Mudança de contrato de API é **versionada**, nunca silenciosa.
- Antes de remover algo antigo: garantir que o novo cobre 100% e está estável em produção.
- Cada fase é **independente e reversível** (rollback claro e testado).

### Migração Sheets → PostgreSQL (decidido)

- **Postgres será a FONTE ÚNICA de verdade.** Sem sync bidirecional.
- **Funcionários migram pro app web; Sheets é descontinuado** (ou vira espelho read-only unidirecional Postgres→Sheets, nunca editável). Sync bidirecional foi descartado por gerar dupla escrita e conflitos.
- **Migração de dados:** script único que lê o Sheets e popula o Postgres (seed). NÃO é sync contínuo.
- **O contrato do service (`appsScript.ts`) deve permanecer estável:** trocar Apps Script por NestJS muda só a implementação interna, não a interface que hooks/componentes consomem. O frontend não deve saber qual backend está por trás.
- **Pré-condição do corte:** o app cobre 100% das operações que os funcionários fazem hoje no Sheet (criar, listar, cancelar, editar, eventualmente aprovar).
- **Trigger pra começar a planejar a migração:** aba `Reservas` passar de ~2000 linhas em produção, OU latência percebida do Apps Script ficar inaceitável.

---

## Prioridades quando requisitos conflitam (regra de desempate)

Quando dois objetivos colidem, **vence o de cima**:

1. Não quebrar o legado / estabilidade
2. Compatibilidade de contrato
3. Segurança e integridade de dados (conflito de horário, concorrência)
4. Correção funcional
5. Experiência do usuário
6. Testabilidade / manutenibilidade
7. Performance
8. Velocidade de entrega

Exemplos: segurança vence conveniência · não quebrar legado vence nova feature · correção vence performance · simplicidade vence "esperteza".

---

## Política de commits e entregas

- Commits **pequenos e atômicos**: uma mudança lógica por commit.
- **Nunca** commitar código que não compila ou com teste vermelho.
- Mensagem no imperativo, com tipo e escopo. Ex.:
  - `feat(reservations): adiciona reserva em período (tudo-ou-nada)`
  - `fix(conflict): corrige detecção quando hora é lida como Date de 1899`
- Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Uma feature por branch quando possível; o branch principal **nunca** com legado quebrado.
- Rodar os testes antes de cada entrega.
- Registrar decisões técnicas relevantes na tabela abaixo.

---

## Como responder (mudanças significativas)

Para tarefas relevantes, cobrir:
objetivo · impacto no legado · riscos · estratégia · testes · implementação · segurança · performance · rollback · próximos passos.

Sempre entregar artefatos completos (código, imports, configs, testes, comandos) — nunca só teoria.
Para micro-tarefas, ser direto e conciso (não inflar a resposta).

Mentalidade: pensar como Staff Engineer / Software Architect / Security Engineer / especialista em SaaS institucional.

---

## Comandos úteis

```powershell
# Testes do frontend
.\node_modules\.bin\vitest.CMD run --reporter=basic

# Build + preview (contorna bloqueio do dev server)
npx vite build
copy public\legacy-index.html dist\legacy-index.html
npx vite preview

# Testar backend (PowerShell, nunca curl.exe)
Invoke-RestMethod -Uri $URL -Method Post -Body $body -ContentType 'text/plain'
```

---

## Decisões técnicas registradas

| Data | Decisão | Motivo |
|---|---|---|
| 2026-05 | Cache removido do Apps Script | Limite de 100KB do CacheService estourava com milhares de registros |
| 2026-05 | XSS protegido via `esc()` | Dados da planilha renderizados via innerHTML sem escape |
| 2026-05 | `getTurnoMap` usa `.find().trim()` | Nome da aba tinha espaço no final |
| 2026-05 | `clear()` renomeado para `resetFilters()` | Conflito com `window.clear()` nativo causava falha silenciosa |
| 2026-06 | Colunas C/D/E forçadas como texto (`setNumberFormat('@')`) | Sheets convertia "08:00"/datas em Date de 1899, quebrando detecção de conflito |
| 2026-06 | Reservas novas em aba separada `Reservas` (formato tabela) | Abas mensais são grade dia×sala incompatível; legado não é tocado |
| 2026-06 | Reserva em período: tudo-ou-nada, dias da semana escolhidos, limite 60 datas | Atomicidade dentro do lock; proteção contra timeout/abuso |
| 2026-06 | `dateRange.ts` (frontend) usa `getUTC*` + meio-dia UTC | Determinístico independente do fuso do browser; mantém paridade com `expandDateRange` do backend |
| 2026-06 | Sem optimistic update no modo período | Datas distintas com mesma sala/horário não conflitam entre si; rollback de N inserts seria custo sem benefício |
| 2026-06 | `anyLoading` derivado como fonte única no `ReservationForm` | Todos os usos de "form ocupado" passam por uma constante; muda só num lugar se um terceiro mutation entrar |
| 2026-06 | Migração Sheets → Postgres: Postgres como fonte única, sem sync bidirecional | Sync bidirecional gera dupla escrita e conflitos; funcionários migrarão pro app, Sheets é descontinuado |
