---
name: memory-sync
description: Use quando o usuario pedir para "atualizar o MEMORY.md", "atualiza o memory", "sincroniza o memory", ou qualquer variacao pedindo para levar o estado atual do projeto para o MEMORY.md. Le o estado real do codigo/git e atualiza o arquivo preservando a estrutura e o rigor ja estabelecidos — nunca inventa informacao.
---

# Memory Sync — Controle de Salas SENAI

## Objetivo

Manter o MEMORY.md na raiz do repo como fonte de verdade precisa do
estado do projeto, sem deixar ele ficar desatualizado (como aconteceu
antes — ficou 3+ meses parado na fase F6.1 enquanto o projeto avancou
ate F9 completo).

## Processo obrigatorio

1. **Ler o MEMORY.md atual por inteiro** antes de tocar em qualquer coisa
   — nunca reescrever as cegas.

2. **Levantar o que mudou de verdade**, na ordem:
   - `git log --oneline -30` (ou mais, se a ultima atualizacao do
     MEMORY.md for antiga — comparar a data no cabecalho do arquivo
     "Atualizado: YYYY-MM-DD" com a data de hoje pra saber quantos
     commits cobrir)
   - Para cada commit relevante desde a ultima atualizacao, ler o
     `git show --stat` se o titulo do commit nao for autoexplicativo
   - Verificar se algo documentado no MEMORY.md ficou desatualizado
     por causa de commits recentes (ex: endpoint que mudou de
     assinatura, arquivo que foi deletado/movido, contagem de testes)

3. **Confirmar contra o codigo real antes de escrever qualquer fato
   tecnico especifico** — nunca copiar informacao de commits sem
   confirmar no arquivo real quando o dado for preciso (nome de
   endpoint, campo de schema, nome de variavel, token de CSS). Esta e
   a mesma regra de anti-invencao que vale pro resto do projeto.

4. **Preservar a estrutura de secoes ja estabelecida** no MEMORY.md
   atual (Identidade, Stack, Estado por fase, Regras absolutas, Bugs
   historicos, Convencoes criticas, Endpoints, Schema Prisma, Modulos,
   Frontend arquivos-chave, Design system, Sitemap, Contagem de testes,
   CI/CD, Padroes obrigatorios, Comandos de emergencia) — atualizar o
   conteudo de cada secao existente, nao reorganizar do zero sem motivo.

5. **Atualizar a linha de cabecalho** `# Atualizado: YYYY-MM-DD | Fase
atual: ...` para refletir a data de hoje e a fase/estado real.

6. **Adicionar bugs novos a lista de "Bugs historicos"** se algum bug
   real foi corrigido desde a ultima atualizacao (seguir a numeracao
   sequencial ja existente, formato `#N Descricao do bug -> Fix`).

7. **Nunca remover informacao ainda valida** so para "limpar" — só
   remover o que genuinamente ficou obsoleto/incorreto (ex: uma
   pendencia que ja foi resolvida sai da lista de pendencias, mas o
   aprendizado/regra que ela gerou pode continuar registrado).

## Apos atualizar

Sempre reportar ao usuario um resumo do que mudou no MEMORY.md (secoes
tocadas, principais adicoes) — nao só confirmar silenciosamente que
"atualizou". Sugerir o commit (`docs: atualizar MEMORY.md — <resumo>`)
mas NAO commitar sozinho sem o usuario validar o diff primeiro.

## Restricoes

- Nunca inventar numero de commits, contagem de testes, ou nomes de
  arquivo — sempre confirmar no codigo/git real
- Nunca sobrescrever o arquivo inteiro sem antes ter lido o conteudo
  atual completo
- Nunca rodar `git commit`/`git push` como parte desta skill — só
  editar o arquivo e sugerir o commit, deixando o usuario revisar
