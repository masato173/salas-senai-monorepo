---
name: controle-salas-senai
description: "Use SEMPRE que o trabalho envolver o projeto Controle de Salas SENAI — sistema institucional do SENAI Manaus de reserva de salas, com frontend React/TypeScript/Vitest, backend Google Apps Script + Google Sheets, e migração planejada pra NestJS/PostgreSQL. Aplica quando o usuário menciona controle de salas, salas SENAI, reservas, agendamento, useCreateReservation, useCreateReservationRange, useListReservations, useCancelReservation, useConflict, Apps Script, codigo.gs, planilha Reservas, sprint do projeto, ou qualquer trabalho tocando hooks, services, endpoints, validação de conflito, política de retry ou fases de migração. Aplica também quando o contexto sugere o projeto sem nomeá-lo — caminhos apps/reservations, PT-BR informal, suite Vitest do projeto, validação PowerShell do Apps Script, envelope ok/data/error. Codifica anti-invention, bugs históricos (Sheets 1899, clear vs window.clear, UTC noon, .bak fora do tree, .env não protege frontend estático), padrão de hooks, backend e comunicação."
---

# Controle de Salas SENAI

Sistema REAL de gestão e agendamento de salas institucional do SENAI Manaus.
NÃO é protótipo. NÃO é exemplo. NÃO recriar do zero.

## Identidade do projeto

- **Stack atual**: React + TypeScript + Vite + Vitest + Zustand + React Query + Tailwind + FullCalendar (novo) | HTML/CSS/JS + Apps Script + Google Sheets + GitHub Pages (legado em produção)
- **Stack futuro**: PostgreSQL + NestJS + Prisma + Redis + Socket.IO + JWT + RBAC
- **Estratégia**: migração incremental — legado nunca quebra durante a transição
- **Monorepo**: `C:\Users\Fernando Masato\OneDrive\Desktop\projetos\monorepo`
- **App novo**: `apps/reservations/`
- **DEV spreadsheet**: `1Y4DP1Q4nxx4BMwEoYFd7R673G8asaubM9-XzSrGUPLE` (safe)
- **PROD spreadsheet**: `1m97CzLNYJlqTq3qECYtpGgeS_skIL0B3eoWNIx7edXk` (**nunca tocar**)

## Regra suprema — anti-invention

NUNCA inferir nem fabricar:
- Nomes de campos (`startTime` vs `inicio` — sempre verificar no `appsScript.ts`)
- Comportamento de backend não confirmado por teste rodado ou doc explícita
- Tipos exportados, contratos, ordem de colunas
- Códigos de erro do enum `BackendErrorCode`

Antes de afirmar qualquer coisa sobre o sistema, **ler o arquivo fonte**. Se o arquivo não está acessível na sessão, dizer abertamente "não verifiquei, suposição minha" — nunca apresentar inferência como fato.

Comentário em teste que descreve contrato de backend **documenta**. Se o `como` não está confirmado, escrever o que foi observado, não o que se imagina que acontece.

## Prioridades (ordem rígida)

1. Estabilidade
2. Compatibilidade
3. Segurança
4. Experiência do usuário
5. Testabilidade
6. Escalabilidade
7. Performance
8. Velocidade de entrega

Quando dois conflitam, o de cima ganha. Sempre.

## Calibração de esforço (Regra Zero)

Antes de começar qualquer tarefa de código, classifique e declare o nível na primeira linha da resposta. O rigor escala com o nível.

- TRIVIAL — renomear, ajuste de texto/formatação, mudança óbvia e isolada. → Implementação + revisão curta. Diga em uma linha por que é trivial.
- PADRÃO — nova função, bug localizado, ajuste em um módulo. → Fluxo conciso (Diagnóstico → Decisão → Impacto → Implementação → Validação).
- CRÍTICA — contrato de API, schema/dados, autenticação, lógica de conflito/concorrência, ou algo que afete produção ou várias camadas. → Rigor máximo E PARA para confirmação antes de implementar.

Exemplos neste projeto:
- TRIVIAL: renomear variável local, corrigir typo, ajustar mensagem.
- PADRÃO: novo hook seguindo o padrão, novo teste, ajuste de UI isolado.
- CRÍTICA: tocar checkConflicts, createReservation, schema da aba Reservas, qualquer endpoint Apps Script em produção, política de retry, owner validation.

Se pular uma etapa, é pela Regra Zero — diga qual e por quê.

## Comunicação

- **Idioma**: PT-BR informal
- **Justificativa técnica obrigatória** em toda decisão não trivial
- **Pushback honesto**: quando o usuário propõe algo problemático, explicar o trade-off antes de executar
- **Per-edit review**: nunca sugerir "Yes, allow all edits during this session" no Claude Code — usuário revisa edit por edit
- **Sem teoria solta**: toda resposta deve ter código, arquivo, comando ou caminho concreto

### Formato pra resposta de mudança significativa
1. Objetivo
2. Impacto no legado
3. Riscos
4. Estratégia
5. Testes
6. Implementação
7. Segurança
8. Performance
9. Rollback
10. Próximos passos

Pra revisão de código de 1 arquivo, formato livre — direto ao ponto.

## Pré-change protocol

Antes de qualquer modificação:

1. **Impact analysis** — o que toca, o que não toca, fronteiras claras
2. **Acceptance criteria** — como saber se está pronto
3. **Regression check** — quais testes existentes podem quebrar
4. **Migration safety** — legado continua funcionando?
5. **Rollback plan** — como desfazer se der ruim
6. **Observability** — logs novos? métricas? como diagnosticar produção?
7. **Tests first quando aplicável** — RED → GREEN → REFACTOR
8. **Autocrítica** — revisar o próprio plano como sênior cético antes de implementar: falha de lógica, caso não tratado, requisito esquecido, regressão, acoplamento. Corrigir aqui. Se nada mudou, dizer "plano mantido" e o motivo. Obrigatória em CRÍTICA, recomendada em PADRÃO.

Quando em dúvida: PARE. Explique trade-offs. Nunca assuma silenciosamente.

## Padrão de hooks (envelope + retry)

Todos os hooks que falam com o backend seguem o mesmo formato. Detalhes completos em `references/hooks.md`.

**Envelope**: `{ ok: boolean, data: T | null, error: BackendError | null }`

**Política de retry** (idêntica em todos os hooks de mutation/query):
- Retenta APENAS: falha de rede + envelope `ok=false` com `error.code === 'INTERNAL'`
- Nunca retenta: `NOT_FOUND`, `FORBIDDEN`, `VALIDATION`, `LOCK_TIMEOUT`, `DUPLICATE`, `CONFLICT`
- `maxRetries` default = 2
- Em retry de mutation, **mesmo `clientRequestId`** em todas as tentativas (idempotência)

**`useEffect` mount-only** com comentário justificando o `exhaustive-deps` disable. Caller chama `refetch` explicitamente quando deps mudam.

**`serviceRef = useRef(service)`** atualizado a cada render — evita stale closure no callback.

**`autoFetch` togglável** em hooks de query (default true) — caller desliga em testes e StrictMode.

Hooks existentes (referência canônica): `useCreateReservation`, `useCreateReservationRange`, `useListReservations`, `useCancelReservation`, `useConflict`.

Tech-debt conhecida: lógica de retry duplicada entre hooks. Generalização planejada pra cleanup futuro — não fazer agora.

## Padrão de backend (Apps Script)

Fluxo obrigatório de mutation:

```
POST → doPost → LockService.tryLock → validate (Zod-like) →
  checkConflict (queries existentes na aba Reservas) →
  saveRow + setNumberFormat → release lock → response
```

### Regras invioláveis

- **Validação crítica no backend**. Frontend pode mostrar conflito como UX, nunca como única proteção.
- **Fórmula de conflito**: `newStart < existingEnd && newEnd > existingStart` (cobre overlap parcial, total, containment)
- **Owner validation**: coluna `createdBy` no índice 9 da aba Reservas. Sempre comparar com `userEmail` do request.
- **Idempotência por estado**: cancel de reserva já `CANCELLED` retorna `ok=true` com a reserva. Validado pelos 11/11 PowerShell tests.
- **Token**: `senai@2026` (todos os endpoints exigem)
- **Deploy URL**: `https://script.google.com/macros/s/AKfycbyAxnzsvR4ogYUtHsa-lWLC8DE_8FsQedC6fPgBtn--BZGSVgTsGcfDE96RFwCGrpI8Ww/exec`

### Horários

- Reservas permitidas: `06:00` → `23:00`
- Usuário escolhe data, sala, início, fim — **sem turnos fixos no novo sistema**
- Legado tem turnos M/V/N (não mexer no legado)

## Bugs históricos (hard-won — não repetir)

### Sheets convertendo C/D/E pra 1899
Toda escrita nas colunas C (data), D (início), E (fim) **deve** chamar `setNumberFormat('@')` logo após `appendRow`. Sem isso, o Sheets transforma strings de hora em objetos Date com base 1899. Custou debug pesado — está documentado e nunca mais.

```javascript
sheet.appendRow([...]);
sheet.getRange(row, 3, 1, 3).setNumberFormat('@'); // C, D, E
```

### `clear()` colide com `window.clear()`
Não criar função global ou método chamado `clear()`. No legado isso quebrou silenciosamente. Usar `resetFilters()`, `clearForm()`, nomes específicos.

### UTC noon obrigatório em datas
Construção de Date no frontend pra paridade exata com backend:
```typescript
const date = new Date(Date.UTC(year, month, day, 12, 0, 0)); // meio-dia UTC
```
Evita off-by-one por timezone do Manaus (BRT, UTC-4 ou -3 dependendo do horário de verão).

### Arquivos `.bak` / backup
Ficar **fora** do tree do projeto. Vitest e tsc escaneiam o monorepo inteiro e quebram em `.bak` com sintaxe parcial. Diretório sugerido: `C:\Users\Fernando Masato\OneDrive\Desktop\projetos\backups\`.

### `.env` no frontend estático = não protege nada
Vite faz inline das vars `VITE_*` no bundle. Tudo que aparece no browser é público. Token atual no legado é aceito porque a planilha não tem dado sensível — não generalizar essa decisão pra dados pessoais futuros.

## Migração

### Fases (do CLAUDE.md original)
- **Fase 0**: Legado funcional (em produção)
- **Fase 1**: Modularização do frontend legado (sem mudar stack)
- **Fase 2**: Backend proxy Node/Express (tira token do browser)
- **Fase 3**: React + Vite coexistindo com HTML legado
- **Fase 4**: NestJS + PostgreSQL
- **Fase 5**: SaaS completo

### Gatilho pra migrar Sheets → Postgres
- Aba `Reservas` passa de ~2000 linhas, **ou**
- Latência de leitura/escrita inaceitável
- Decisão tomada: Postgres é fonte única, sem sync bidirecional

### Forbidden em qualquer fase
- Recriar projeto do zero
- Remover funcionalidade existente
- Quebrar Apps Script ou Sheets em uso
- Alterar API silenciosamente
- Ignorar regressões
- Pular testes
- Fazer deploy sem validação manual

## Estado do projeto (cabeçalho dinâmico)

Quando o usuário pedir status do projeto, o agente deve verificar o que mudou desde a última sessão **lendo arquivos do projeto**, não inferindo. Memória do Claude pode estar desatualizada — o repo é fonte da verdade.

Última snapshot conhecida (sujeita a obsolescência):
- Sprint 2 e 2.5 concluídos
- Sprint 3 em andamento: backend cancel validado (11/11 PowerShell), hooks `useListReservations` + `useCancelReservation` em implementação
- Vitest: ~116 testes passando, alvo ~134 com hooks completos
- Git inicializado
- CLAUDE.md consolidado com 9 regras de engenharia

## Output format

Pra trabalho de código no projeto:

1. **Diagnóstico** — o que foi pedido, o que entendi, o que ainda não sei
2. **Decisão** — qual abordagem e por quê (justificativa técnica)
3. **Implementação** — código completo, imports, paths, sem teoria solta
4. **Validação** — comando pra rodar, teste a checar, browser step se aplicável
5. **Próximo passo** — o que fazer depois ou o que esperar

Pra code review:
- Veredito direto (aplica? não aplica?)
- Bugs encontrados com linha e correção
- Observações secundárias (não bloqueiam)
- Mensagem-pronta pra mandar pro agente refazer (se for review de PR do Claude Code)

## Quando entrar em dúvida

Se o usuário pedir algo que pode ferir uma das regras acima:
- **PARAR** e explicar o trade-off
- Apresentar 2 caminhos: o pedido + a alternativa segura
- Esperar a decisão dele — nunca executar silenciosamente
- Se executar, registrar o desvio explicitamente na resposta

Lembrar sempre: estabilidade > compatibilidade > segurança > tudo o resto.
