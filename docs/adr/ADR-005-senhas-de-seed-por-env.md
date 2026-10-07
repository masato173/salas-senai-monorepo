# ADR-005 — Senhas de seed por variável de ambiente

**Data:** 2026-10-07
**Status:** Ativo
**Contexto de arquitetura:** hardening de segurança pós-auditoria (issue 2,
achados D2/D3)
**Substitui:** o trecho do [ADR-004](ADR-004-f9-producao-e-qualidade.md),
seção "c) Seed bloqueado em produção via `NODE_ENV`", que registrava que as
senhas de teste "não foram rotacionadas".

---

## Contexto

O `prisma/seed.ts` criava as contas `admin@senai.edu`,
`coordenador@senai.edu` e `professor@senai.edu` com senhas **fixas e
previsíveis** escritas no código, e as imprimia no stdout. As mesmas senhas
estavam em texto claro no `ci.yml` (`E2E_*_PASSWORD`) e na documentação.

A única proteção era o guard de `NODE_ENV=production` no seed (ADR-004), e
ele era contornado pelo `infra/docker/entrypoint.sh`: com `SEED_FORCE=true`,
o entrypoint rodava o seed forçando o `NODE_ENV` de desenvolvimento só para
aquele comando — embora o próprio comentário afirmasse não contornar o
guard. Qualquer pessoa com acesso ao repositório conhecia as credenciais de
um banco populado por esse caminho.

## Decisão

1. **Senhas só por variável de ambiente, sem default.** O seed exige
   `SEED_ADMIN_PASSWORD`, `SEED_COORDENADOR_PASSWORD` e
   `SEED_PROFESSOR_PASSWORD`, cada uma com pelo menos 12 caracteres.
   Ausente, vazia ou curta: o seed aborta **antes de acessar o banco**, com
   mensagem que cita só o nome da variável, nunca o valor. A validação é a
   função pura `resolveSeedPasswords` (`apps/api/prisma/seed-passwords.ts`),
   coberta por teste unitário.
2. **O seed não imprime senha.** Os logs mostram só o e-mail e a variável
   de onde a senha veio.
3. **Entrypoint falha fechado.** `SEED_FORCE=true` com
   `NODE_ENV=production` aborta o boot (exit 1) sem rodar o seed. O
   contorno do `NODE_ENV` foi removido; o guard do `seed.ts` segue intacto.
   Dados iniciais de produção vêm de dump/restore ou do procedimento manual
   documentado em `infra/docker/README.md`, com senhas vindas do shell do
   operador.
4. **CI com senhas efêmeras.** O job e2e gera três senhas aleatórias por
   execução (`openssl rand`), registra `::add-mask::` antes de gravá-las no
   `GITHUB_ENV` e usa o mesmo valor em `SEED_*_PASSWORD` e `E2E_*_PASSWORD`.
   Nenhuma senha literal no workflow. O banco do e2e já é descartável
   (Postgres do próprio runner).
5. **Testes e2e sem fallback.** Senha ausente falha o teste com o nome da
   variável (`tests/e2e/helpers/env.ts`), em vez de cair em string vazia.

## Consequências

- **Dev local:** rodar o seed passa a exigir as três `SEED_*_PASSWORD` no
  `apps/api/.env`; o e2e local exige `E2E_*_PASSWORD` com os mesmos valores.
- **Bancos existentes não mudam.** O seed usa `upsert` com `update: {}`:
  ele não altera a senha de usuário que já existe. Este ADR remove as senhas
  conhecidas do código, mas **não** troca as senhas de contas já criadas.
- **Docker em produção** não popula mais o banco sozinho; deixar
  `SEED_FORCE=true` derruba o boot de propósito.

## Pendência operacional (fora do código)

Trocar as senhas das contas `admin`, `coordenador` e `professor` em
produção antes de a API voltar ao ar, e confirmar que as senhas antigas
falham no login. Até isso acontecer, as senhas antigas (conhecidas pelo
histórico do repositório) continuam válidas nesses bancos.

## Referências

- Issue #2 — credenciais de seed conhecidas
- `apps/api/prisma/seed.ts`, `apps/api/prisma/seed-passwords.ts`
- `infra/docker/entrypoint.sh`, `infra/docker/README.md`
- `.github/workflows/ci.yml` (step "Generate ephemeral E2E passwords")
