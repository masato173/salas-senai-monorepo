# Controle de Salas SENAI — Contexto do Projeto para Agentes

Este arquivo é lido automaticamente pelo Google Antigravity antes de qualquer tarefa.
Conteúdo idêntico ao MEMORY.md da raiz — fonte de verdade compartilhada.

> Ver MEMORY.md na raiz do repositório para o conteúdo completo e atualizado.
> Este arquivo é um alias intencional para garantir que o Antigravity encontre
> o contexto na estrutura esperada (.gemini/antigravity/brain/).

## Resumo executivo para agentes

**Projeto:** Sistema institucional de reserva de salas — SENAI Manaus
**Stack:** React 18 + TypeScript + Vite (frontend) | NestJS + PostgreSQL + Prisma (backend)
**Fase atual:** F6.1 concluída | F6.2 (Shell Portal Admin) é a próxima sprint
**Testes:** 335 total (281 frontend + 54 backend) — todos devem passar antes de qualquer commit
**Regra #1:** Ler MEMORY.md ANTES de qualquer tarefa
**Regra #2:** NUNCA alterar AppsScriptService
**Regra #3:** NUNCA usar $transaction com pgbouncer para operações longas (>500 registros)
**Regra #4:** Anti-invenção — ler arquivos-fonte antes de propor código
**Regra #5:** typecheck + vitest + build verdes antes de qualquer commit

## Onde encontrar o que

MEMORY.md → Estado completo, bugs históricos, padrões
CLAUDE.md → Regras arquiteturais e contexto institucional
docs/adr/ADR-001-rls-defense-in-depth.md → RLS defense-in-depth
docs/adr/ADR-002-f4-migration-state.md → Checklist de migração F4→F5
docs/adr/ADR-003-f5-cutover-oficial.md → Cutover oficial F5.8
apps/api/prisma/schema.prisma → Schema completo do banco
apps/reservations/src/services/ → apiClient, nestjsApiService, appsScript
apps/reservations/src/hooks/ → Todos os hooks do frontend
apps/reservations/src/router/ → config.ts (rotas) + index.tsx (React Router)
apps/reservations/src/layouts/ → AppLayout.tsx
apps/reservations/src/styles/ → global.css (tokens de design)
