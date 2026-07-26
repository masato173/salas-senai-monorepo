---
name: Controle de Salas SENAI
description: Sistema institucional de reserva de salas do SENAI Manaus — camadas de vidro translúcido sobre um mesh navy/laranja, calmo e procedural.
colors:
  senai-ink: '#1e3a5f'
  senai-ink-deep: '#2a4f80'
  senai-ember: '#e07c2b'
  senai-ember-soft: '#fef0e4'
  canvas: '#f4f5f7'
  surface-glass: 'rgba(255, 255, 255, 0.7)'
  surface-glass-soft: 'rgba(255, 255, 255, 0.48)'
  ink-text: '#111827'
  ink-muted: '#6b7280'
  ink-subtle: '#9ca3af'
  hairline: 'rgba(17, 24, 39, 0.08)'
  hairline-strong: 'rgba(17, 24, 39, 0.16)'
  status-green: '#16a34a'
  status-green-soft: '#dcfce7'
  status-amber: '#b45309'
  status-amber-soft: '#fef3c7'
  status-red: '#dc2626'
  status-red-soft: '#fee2e2'
  status-blue: '#2563eb'
  status-blue-soft: '#dbeafe'
typography:
  headline:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: '20px'
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: '-0.4px'
  title:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: 'normal'
  body:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 'normal'
  label:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: '10px'
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: '0.06em'
  numeric:
    fontFamily: "'DM Sans', system-ui, sans-serif"
    fontSize: '13px'
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 'normal'
    fontFeature: 'tabular-nums'
rounded:
  sm: '8px'
  md: '12px'
  pill: '20px'
spacing:
  xs: '8px'
  sm: '12px'
  md: '16px'
  lg: '24px'
components:
  button-toggle:
    backgroundColor: '{colors.surface-glass}'
    textColor: '{colors.ink-muted}'
    typography: '{typography.title}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '32px'
  button-toggle-active:
    backgroundColor: '{colors.senai-ink}'
    textColor: '#ffffff'
    typography: '{typography.title}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '32px'
  button-secondary:
    backgroundColor: '{colors.surface-glass}'
    textColor: '{colors.ink-text}'
    typography: '{typography.title}'
    rounded: '{rounded.sm}'
    padding: '0 10px'
    height: '28px'
  card-glass:
    backgroundColor: '{colors.surface-glass}'
    textColor: '{colors.ink-text}'
    rounded: '{rounded.md}'
    padding: '16px'
  badge-status-approved:
    backgroundColor: '{colors.status-green-soft}'
    textColor: '{colors.status-green}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    padding: '3px 10px'
  input-search:
    backgroundColor: '{colors.surface-glass}'
    textColor: '{colors.ink-text}'
    typography: '{typography.body}'
    rounded: '{rounded.sm}'
    padding: '0 10px'
    height: '34px'
---

# Design System: Controle de Salas SENAI

## Overview

**Creative North Star: "The Liquid Glass Deck"**

Painéis translúcidos empilhados sobre um mesh gradient navy/laranja fixo no fundo — nunca o inverso. A superfície nunca é opaca de propósito: `--color-surface` é sempre uma rgba com blur atrás (`backdrop-filter`), então o gradiente do body sempre respira por trás de cada card, sidebar e popover. É vidro operacional, não vidro decorativo — a transparência existe pra dar profundidade num sistema por lo demais denso de dados (tabelas, grades de horário, listas de auditoria), nunca pra chamar atenção pra si mesma.

O humor é calmo e procedural — confirmado como intenção. Este é um sistema de Operate (professor reservando sala, coordenador aprovando pedido, admin gerenciando usuários): a tarefa vence a expressão. Cor entra quase exclusivamente pra comunicar estado (verde=livre/aprovado, âmbar=pendente, vermelho=conflito/rejeitado, azul=informativo), não decoração. O laranja de marca (`--color-accent`) é deliberadamente raro — indicador ativo da sidebar, badge de notificação, barra de progresso do logo — nunca preenche área grande.

Profundidade vem de camadas translúcidas (blur + saturate + um brilho interno de 1px — `--glass-sheen`), não de sombra dramática — confirmado como filosofia real, não acidente: toda superfície elevada do sistema usa a mesma receita de três partes (`background: var(--color-surface)`, `backdrop-filter: blur(...) saturate(...)`, `box-shadow: var(--shadow-s), var(--glass-sheen)`).

**Key Characteristics:**

- Vidro translúcido com blur variável (22px em cards/popovers, 38px só na sidebar) sobre um mesh gradient fixo navy+laranja no `body`
- Cor é sinal de estado, não decoração — o laranja de marca aparece em ≤3 lugares por tela
- Tipografia única (DM Sans) em toda a interface, sem fonte secundária/mono
- Números sempre tabulares (`font-variant-numeric: tabular-nums`) — nunca fonte mono
- Bordas finas (1px, quase invisíveis — `rgba(17,24,39,.08)`), nunca bordas grossas ou coloridas decorativas
- Cada token de cor/vidro tem contraparte dark mode via `[data-theme='dark']` — a sidebar é a única superfície intencionalmente theme-invariant

## Colors

Paleta institucional restrita: dois tons de marca (navy + laranja) usados com moderação extrema, uma família neutra translúcida pra toda superfície, e quatro cores semânticas de status. Nenhuma cor decorativa fora desse conjunto.

### Primary

- **SENAI Ink** (`#1e3a5f`): navy institucional. Usado em: fundo da sidebar (via `--sidebar-bg`, uma rgba derivada), avatar do usuário, barra ativa da sidebar quando _não_ é o indicador de notificação, botões pill no estado ativo (ex.: toggle Tabela/Linha do tempo, filtro de Turno selecionado). Nunca usado como cor de texto de corpo.
- **SENAI Ink Deep** (`#2a4f80`): variante mais clara do navy, reservada pra estados de hover/gradiente (usada hoje só como segundo stop do gradiente diagonal da sidebar).

### Secondary

- **SENAI Ember** (`#e07c2b`): laranja de marca. Uso deliberadamente raro — barra de 3px que marca o item ativo da sidebar, badge de notificação efêmera (com pulso), ícone do logo, badge "em breve". **Nunca** preenche uma área grande ou vira cor de fundo de botão primário.
- **SENAI Ember Soft** (`#fef0e4` claro / `rgba(224,124,43,.15)` escuro): halo do laranja — glow do badge de notificação, fundo do badge "em breve".

### Neutral (translúcida — o corpo do sistema)

- **Canvas** (`#f4f5f7` claro / `#0d1117` escuro): cor sólida de base por trás do mesh gradient do `body` — nunca visível diretamente, só como camada mais funda.
- **Surface Glass** (`rgba(255,255,255,.7)` claro / `rgba(22,27,34,.62)` escuro): a superfície-padrão de todo card, popover, input, topbar. Sempre acompanhada de `backdrop-filter: blur(22px) saturate(140–150%)`.
- **Surface Glass Soft** (`rgba(255,255,255,.48)` claro / `rgba(28,33,40,.5)` escuro): variante mais fraca — cabeçalho de card (contraste sutil sobre o corpo), elemento aninhado dentro de outro glass (ex.: `.slot-item` dentro de `.avail-card`).
- **Ink Text** (`#111827` claro / `#e6edf3` escuro): texto primário.
- **Ink Muted** (`#6b7280` claro / `#8b949e` escuro): texto secundário, labels, metadados.
- **Ink Subtle** (`#9ca3af` claro / `#6e7681` escuro): texto terciário — placeholders, estado vazio.
- **Hairline** (`rgba(17,24,39,.08)` claro / `rgba(255,255,255,.08)` escuro): toda borda de card/input/divisor. Sempre 1px.
- **Hairline Strong** (`rgba(17,24,39,.16)` claro / `rgba(255,255,255,.14)` escuro): borda em estado hover, quando a borda padrão precisa ficar mais presente.

### Status (única família de cor não-neutra usada em área ampla — badges, dots)

- **Status Green** (`#16a34a` / soft `#dcfce7`): sala livre, reserva aprovada.
- **Status Amber** (`#b45309` / soft `#fef3c7`): reserva pendente, ocupação parcial.
- **Status Red** (`#dc2626` / soft `#fee2e2`): conflito, reserva rejeitada/ocupada.
- **Status Blue** (`#2563eb` / soft `#dbeafe`): contadores informativos (ex.: badge de contagem "N reservas").

### Named Rules

**The Rare Ember Rule.** SENAI Ember (`#e07c2b`) nunca é a cor de fundo de uma área grande — só indicador, badge, barra de 3px ou ícone. Se o laranja está cobrindo mais de um pequeno elemento pontual na tela, é uso incorreto.

**The Status-Only Color Rule.** Fora de navy/laranja/neutro, a única cor permitida é uma das quatro semânticas (verde/âmbar/vermelho/azul), e só pra comunicar estado real de um dado (status de reserva, disponibilidade de sala) — nunca decoração.

## Typography

**Body/UI Font:** DM Sans (com fallback `system-ui, sans-serif`)
**Nenhuma fonte secundária ou monoespaçada.** DM Mono foi removida do projeto inteiro (causava bold sintético borrado em pesos não carregados) — números usam DM Sans + `tabular-nums`, nunca fonte mono.

**Character:** uma família só, carregada em 5 pesos (300/400/500/600/700 via Google Fonts) — a hierarquia inteira vem de tamanho, peso e letter-spacing, nunca de trocar de fonte.

### Hierarchy

Não existe uma escala tokenizada formal no CSS hoje (tamanhos são valores literais por componente) — os papéis abaixo capturam os tamanhos que realmente se repetem:

- **Headline** (700, 20px, letter-spacing -0.4px): título de página (`.page-title`). Usado uma vez por tela.
- **Title** (600, 13px): título de card/seção (`.avail-card-title`, cabeçalhos de tabela de dados).
- **Body** (400–500, 13px): texto de corpo, células de tabela, conteúdo padrão.
- **Label** (600, 10–11px, letter-spacing .05–.08em, uppercase): labels de campo, seção da sidebar, badges de status. Sempre uppercase quando é label estrutural.
- **Numeric** (500–600, mesmo tamanho do contexto, `font-variant-numeric: tabular-nums`): qualquer número — horário, contagem, data. Nunca peso 700 (ver regra abaixo).

### Named Rules

**The Tabular Numbers Rule.** Todo número (horário, contagem, data) usa DM Sans com `font-variant-numeric: tabular-nums`, nunca uma fonte mono. Peso fica em 500–600 mesmo com 700 disponível — 700 em contexto numérico já causou renderização borrada (bold sintético) documentada no histórico do projeto.

**The One Voice Rule.** Uma família tipográfica pro sistema inteiro. Se uma tela nova "precisa" de uma segunda fonte pra parecer mais rica, o problema é hierarquia (peso/tamanho/tracking), não a ausência de uma segunda fonte.

## Layout

Estrutura de shell fixo: sidebar fixa (240px expandida / 64px colapsada, com transição) + área principal com `margin-left` acompanhando o estado. Conteúdo de página usa `padding: 24px 24px 48px` (16px nas laterais em mobile, breakpoint 768px). Sidebar vira off-canvas (`translateX(-100%)`) abaixo de 768px, com overlay escuro.

Cards/painéis dentro do conteúdo se empilham em `flex-direction: column` com `gap: 16px` como ritmo padrão entre blocos; dentro de um card, `gap: 12px` é o ritmo interno mais comum. Grids (ex.: `.schedule-grid`) usam 3 colunas em desktop, 2 em telas médias (1100px), 1 em mobile.

Densidade é alta — este é um sistema de dados operacionais (tabelas, grades de horário), não uma superfície de marketing — mas o vidro/blur evita que a densidade fique pesada visualmente.

## Elevation & Depth

Sistema translúcido em camadas, confirmado como filosofia real — não sombra dramática. Toda superfície elevada segue a mesma receita: fundo translúcido (`--color-surface` ou `--color-surface-2`) + `backdrop-filter: blur(...) saturate(140–165%)` + sombra suave de duas camadas + um brilho interno de 1px no topo (`--glass-sheen`, simula luz pegando a borda superior do vidro).

Dois níveis de blur, não mais: 22px (`--glass-blur-s`) pra cards/topbar/popovers, 38px (`--glass-blur-l`) só pra sidebar — a superfície mais "funda" do sistema, então o blur mais pronunciado.

### Shadow Vocabulary

- **Soft** (`box-shadow: 0 1px 2px rgba(17,24,39,.04), 0 2px 10px rgba(17,24,39,.05)`, + `--glass-sheen`): repouso padrão de card, input, topbar.
- **Medium** (`box-shadow: 0 4px 18px rgba(17,24,39,.08), 0 14px 36px rgba(17,24,39,.06)`, + `--glass-sheen`): elementos flutuantes acima do conteúdo (popover do FullCalendar) — mais elevação que um card em repouso.

### Named Rules

**The Sheen-Always Rule.** Nenhuma superfície de vidro aparece sem `--glass-sheen` junto da sombra — o brilho interno de 1px é o que diferencia "vidro" de "card cinza com blur". Sombra sozinha, sem sheen, não é o sistema.

**The Two-Blur Rule.** Só dois valores de blur existem: 22px (padrão) e 38px (só sidebar). Uma superfície nova não inventa um terceiro valor.

## Shapes

Cantos moderados, nunca afiados nem excessivamente arredondados: 12px (`--radius`) é o padrão de card/painel, 8px (`--radius-s`) pra elementos menores (botão, input, item de lista). Badges/pills de status usam um raio bem maior (20px, efetivamente cápsula) — o único lugar onde a forma vira propositalmente "pill" em vez de "card com canto arredondado".

Bordas são sempre 1px, sempre `hairline` (quase invisível) — nunca 2px+, nunca cor de marca como borda decorativa.

## Components

Caráter confirmado: precisos e discretos. Bordas finas, cantos moderados (8–12px), sem sombra dramática, cor só entra pra indicar estado.

### Buttons

- **Shape:** 8px de raio (`--radius-s`) em todos os botões — nenhuma variante usa `--radius` (12px) ou pill.
- **Toggle/Pill** (filtro de Turno, alternância Tabela/Linha do tempo): altura 32–34px, padding `0 14px`. Inativo: fundo `surface-glass`, texto `ink-muted`, borda `hairline`. Ativo: fundo `senai-ink` sólido, texto branco, borda `senai-ink`.
- **Secondary** (Atualizar, Tentar novamente): altura 28px, padding `0 10px`, fundo `surface-glass`, texto `ink-text` ou cor semântica (vermelho em contexto de erro), borda `hairline`.
- **Transição:** `background .15s, border-color .15s, color .15s` — nunca instantâneo, nunca mais que ~200ms.
- **Não existe** um botão "primary" sólido de alto contraste no sistema hoje além do estado ativo dos toggles — não inventar um sem confirmar com o time.

### Badges / Status Pills

- **Style:** raio pill (20px), padding `3–4px 10–12px`, fundo = versão "soft" da cor semântica, texto = versão "forte" da mesma cor (ex.: fundo `status-green-soft`, texto `status-green`).
- **Uso:** status de reserva (Pendente/Aprovada/Rejeitada/Cancelada), badge "em breve", contador de itens.

### Cards / Containers

- **Corner Style:** 12px (`--radius`).
- **Background:** `surface-glass` + blur 22px + saturate 140%.
- **Shadow Strategy:** Soft (ver Elevation) — Medium só para overlays flutuantes (popover).
- **Border:** 1px `hairline`.
- **Internal Padding:** 16px é o padrão de card de conteúdo; 12px em variantes mais compactas.

### Inputs / Fields

- **Style:** altura 34px, fundo `surface-glass`, borda 1px `hairline`, raio 8px, texto 12px.
- **Focus:** `outline: none` está setado explicitamente hoje — não há um tratamento de foco visível customizado documentado no CSS além do padrão do browser sendo suprimido. **Flag:** vale revisar acessibilidade de foco de teclado aqui (ver Do's and Don'ts).

### Navigation (Sidebar)

- **Style:** item de nav com ícone (20×20px, opacidade 0.8 em repouso, 1 em hover/ativo) + label (13px/500). Item ativo ganha fundo translúcido branco (`--sidebar-active-bg`) + barra de 3px em `senai-ember` na borda esquerda.
- **Colapso:** sidebar colapsa pra 64px (só ícones), label e barra de toggle encolhem com `opacity`+`width` animados, tooltip aparece no hover via `::after` com o `data-label`.
- **Mobile:** vira off-canvas, overlay escuro por trás.

### Notification Dot (signature component)

Indicador efêmero de "algo novo" — um dot de 8px em `senai-ember` posicionado no canto do ícone de nav, com halo (`senai-ember-soft`) pulsando (`animation: notifyPulse 1.8s ease-in-out infinite`, alternando raio do halo entre 2px e 4px). Único elemento do sistema com animação contínua (todo o resto é transição orientada a estado) — reservado propositalmente pra esse único caso de "chame atenção sem interromper".

## Do's and Don'ts

### Do:

- **Do** usar a receita de três partes em qualquer superfície elevada nova: `background: var(--color-surface[-2])` + `backdrop-filter: blur(var(--glass-blur-s)) saturate(140–150%)` + `box-shadow: var(--shadow-s), var(--glass-sheen)`.
- **Do** manter cor restrita a estado (status de reserva/disponibilidade) — se uma tela nova quer "mais cor", a resposta é hierarquia tipográfica ou espaçamento, não uma paleta nova.
- **Do** usar `tabular-nums` em todo número nesta tela — hora, contagem, data.
- **Do** confirmar todo valor de token lendo `global.css` direto antes de reusar — este sistema já passou por 3 rounds de ajuste "liquid glass" na mesma sessão em que valores antigos ficaram obsoletos.

### Don't:

- **Don't** usar Tailwind. O projeto não tem a dependência instalada — `components/ui/StatusBadge.tsx`, `ConflictAlert.tsx` e `LoadingSkeleton.tsx` usam classes Tailwind hoje e `ConflictAlert` está em uso real em `ReservationForm.tsx`, renderizando **sem nenhum estilo** em produção. Não copiar o padrão desses três arquivos — eles são uma exceção quebrada, não uma segunda linguagem válida.
- **Don't** introduzir uma fonte secundária ou mono. DM Mono já foi removida do projeto inteiro por causar bold sintético borrado — não reintroduzir.
- **Don't** usar peso 700 em números, mesmo DM Sans com 700 carregado — mantém 500–600 em contexto tabular.
- **Don't** preencher área grande com `senai-ember` (laranja) — é sinal, não fundo.
- **Don't** inventar um terceiro valor de blur ou um raio fora de 8/12/20px sem necessidade real.
