---
name: obsidian-sync
description: Use quando o usuario pedir para "atualizar o Obsidian", "sincronizar Obsidian", "atualiza o obsidian", ou qualquer variacao pedindo para levar o estado atual do projeto para o vault Obsidian. Escreve diretamente via MCP do Obsidian (ja conectado) — nao gera comandos PowerShell nem pede pro usuario editar nada manualmente.
---

# Obsidian Sync — Controle de Salas SENAI

## Objetivo

Atualizar o vault Obsidian do projeto (`Controle-Salas-SENAI`) com o estado
atual, escrevendo diretamente via ferramentas MCP do Obsidian — sem gerar
comandos PowerShell nem pedir pro usuario copiar/colar nada.

## Processo obrigatorio

1. **Ler o estado atual do projeto** antes de escrever qualquer coisa:
   - MEMORY.md na raiz do repo (fonte de verdade do estado tecnico)
   - `git log --oneline -15` para ver os commits mais recentes (o que
     mudou desde a ultima atualizacao do Obsidian)
   - Se relevante para o pedido, `git status` para mudancas nao commitadas

2. **Descobrir as ferramentas MCP do Obsidian disponiveis** — nao assumir
   nomes de tool fixos, usar tool_search ou o catalogo de tools ja
   carregado para achar as ferramentas de leitura/escrita de notas
   (costumam existir operacoes tipo listar notas, ler nota, criar nota,
   atualizar/anexar a nota existente — confirmar os nomes reais antes
   de chamar).

3. **Localizar a nota certa** — o padrao existente no vault e uma nota
   por sessao de trabalho, nomeada `Estado do Projeto — YYYY-MM-DD.md`
   (ver nota de 2026-07-22 como exemplo de estrutura/tom). Antes de
   escrever:
   - Verificar se ja existe uma nota com a data de HOJE no vault
   - Se existir: ANEXAR uma nova secao a ela (nao sobrescrever o que
     ja tem), com um cabecalho de horario/sessao separando do conteudo
     anterior do mesmo dia
   - Se nao existir: criar nota nova seguindo o MESMO formato das notas
     anteriores (secoes: Resumo executivo, Stack, o que foi feito por
     area, pendencias, bugs corrigidos, contagem de testes — adaptar
     as secoes ao que realmente mudou nesta sessao, nao copiar a
     estrutura antiga se nao fizer sentido)

4. **Conteudo da atualizacao** — resumir de forma factual o que mudou
   desde a ultima nota do Obsidian (cruzar com o git log), no mesmo
   tom das notas anteriores (PT-BR, direto, sem enfeite). Sempre incluir:
   - O que foi commitado (features, fixes, refactors)
   - Pendencias que continuam em aberto (ex: deploy Railway, senhas
     de producao — conferir MEMORY.md pra lista atual)
   - Contagem de testes se mudou

5. **Nunca inventar informacao** — se o MEMORY.md ou o git log nao
   deixar claro algo, nao adivinhar. Perguntar ao usuario antes de
   escrever um dado incerto na nota.

## Restricoes

- Nunca usar PowerShell/`[System.IO.File]::WriteAllText` para essa tarefa
  — o MCP do Obsidian ja resolve a escrita diretamente
- Nunca sobrescrever notas antigas (de dias anteriores) — so a nota do
  dia atual pode ser criada ou anexada
- Se o MCP do Obsidian nao estiver conectado/disponivel nesta sessao,
  avisar o usuario em vez de tentar contornar com escrita manual de
  arquivo local
