#!/bin/sh
# infra/docker/entrypoint.sh
#
# Entrypoint do container do backend (@salas-senai/api). Roda em TODO boot
# do container — primeira subida e todo restart — e decide o que aplicar
# no banco antes de o servidor NestJS realmente subir.
#
# sh (POSIX), não bash — a imagem runner é node:22-alpine, e o Alpine usa
# BusyBox ash como /bin/sh (sem bash instalado por padrão).
#
# set -e: qualquer comando que falhe aborta o script inteiro. Um banco em
# estado inconsistente (migration que só aplicou pela metade, por exemplo)
# é pior do que o container simplesmente não subir — melhor falhar alto e
# visível aqui do que o backend subir contra um schema desatualizado.
set -e

echo "[entrypoint] Aplicando migrations (prisma migrate deploy)..."
# migrate deploy é idempotente — só aplica as migrations que ainda não
# rodaram nesse banco, então é seguro rodar em TODO boot, não só na
# primeira vez.
#
# node_modules/.bin/prisma existe na imagem runner porque o Dockerfile.api
# copia o node_modules INTEIRO do estágio builder (incluindo
# devDependencies — "prisma", o pacote do CLI, está em devDependencies de
# apps/api/package.json). Não precisa de pnpm instalado na imagem final
# pra isso funcionar: é só um binário local dentro de node_modules/.bin,
# igual apps/api/package.json já chama node_modules/.bin/ts-node
# diretamente no script "seed" (mesmo padrão do projeto, não inventado
# aqui). --schema aponta pro caminho real a partir do WORKDIR /app.
node_modules/.bin/prisma migrate deploy --schema apps/api/prisma/schema.prisma
echo "[entrypoint] Migrations aplicadas."

# Seed só roda quando pedido explicitamente via SEED_FORCE=true, e NUNCA em
# produção (issue 2). O container roda com NODE_ENV=production o tempo todo
# (Dockerfile.api + docker-compose.yml), então neste deploy SEED_FORCE=true
# falha fechado: aborta o boot com exit 1 em vez de rodar o seed.
#
# Antes isto forçava o NODE_ENV de desenvolvimento só no comando do seed — na
# prática CONTORNAVA o guard de produção de apps/api/prisma/seed.ts. O
# guard continua intacto; aqui ele não é mais burlado. Dados iniciais de
# produção vêm de dump/restore ou do procedimento manual do README.md.
#
# Fora de produção o seed roda normalmente e exige SEED_ADMIN_PASSWORD,
# SEED_COORDENADOR_PASSWORD e SEED_PROFESSOR_PASSWORD no ambiente.
if [ "$SEED_FORCE" = "true" ]; then
  if [ "$NODE_ENV" = "production" ]; then
    echo "[entrypoint] ERRO: SEED_FORCE=true com NODE_ENV=production — o seed nao roda em producao." >&2
    echo "[entrypoint] Dados iniciais vem de dump/restore ou do procedimento manual (infra/docker/README.md)." >&2
    echo "[entrypoint] Volte SEED_FORCE para false e suba de novo." >&2
    exit 1
  fi
  echo "[entrypoint] SEED_FORCE=true — rodando seed..."
  node apps/api/prisma/seed.js
  echo "[entrypoint] Seed concluído."
else
  echo "[entrypoint] SEED_FORCE != true — pulando seed."
fi

echo "[entrypoint] Subindo o backend..."
# exec substitui o processo do shell (PID 1 do container) pelo processo do
# node — em vez de o node rodar como processo FILHO do shell. Sem isso,
# `docker stop`/`docker compose down` manda SIGTERM pro PID 1 (o shell),
# que não repassa o sinal automaticamente pro node; o Docker então espera
# o timeout de graceful shutdown e manda SIGKILL — o node nunca teria
# chance de fechar conexões e terminar requests em andamento. Com exec, o
# node passa a SER o PID 1 e recebe o SIGTERM diretamente.
exec node apps/api/dist/main.js
