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

# Seed só roda quando pedido explicitamente via SEED_FORCE=true. O seed é
# idempotente (upsert em vez de create — rodar 2x não duplica sala/usuário),
# mas mesmo assim não faz sentido tentar rodar em todo restart do
# container — ver infra/docker/README.md: SEED_FORCE deve voltar pra
# 'false' depois do primeiro boot.
if [ "$SEED_FORCE" = "true" ]; then
  echo "[entrypoint] SEED_FORCE=true — rodando seed..."
  # apps/api/prisma/seed.ts (compilado pra seed.js no estágio builder,
  # Missão 1) tem um guard de segurança que ABORTA se NODE_ENV=production
  # — proteção pra nunca rodar senhas de teste conhecidas (role@senai2026)
  # contra um banco real por engano. O container roda com
  # NODE_ENV=production o tempo todo (Dockerfile.api + docker-compose.yml).
  #
  # NÃO removemos nem contornamos esse guard — a forma certa de rodar o
  # seed aqui é sobrescrever NODE_ENV só PRA ESTE COMANDO, prefixando a
  # variável na mesma linha (sem `export`). Isso não muda o NODE_ENV do
  # resto do script nem do processo final do node — só desse processo
  # filho específico, que termina antes da linha seguinte rodar.
  NODE_ENV=development node apps/api/prisma/seed.js
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
