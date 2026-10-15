# ADR-009 — nginx como borda única e TRUST_PROXY explícito

**Data:** 2026-10-14
**Status:** Ativo
**Contexto de arquitetura:** `infra/docker` (servidor local / VPS), rate
limiting por IP (`@nestjs/throttler`), Socket.IO (`/rooms`) — issue #21.

---

## Contexto

No `infra/docker`, a api publicava `0.0.0.0:3000` sem nada na frente, e o
`main.ts` fixava `app.set('trust proxy', 1)` (pensado para a borda do
Railway). Com um salto confiável e nenhum proxy real, o Express usa o último
`X-Forwarded-For` **enviado pelo próprio cliente** como `req.ip`. O ensaio
local provou: 8 tentativas de login, cada uma com um `X-Forwarded-For`
diferente, retornaram 401 nas 8 — o limite de 5/min do login nunca disparou.
Sem a forja, a 6ª tentativa retorna 429.

Agravantes no VPS:

- o `ufw` não filtra portas publicadas pelo Docker (o Docker grava regras
  próprias no iptables, antes das do ufw);
- com o frontend em HTTPS, chamar `http://ip:3000` seria bloqueado como
  conteúdo misto.

## Decisão

1. **nginx do container frontend como borda única.** Rotas (snippet
   `infra/docker/nginx-rotas.conf`, incluído no `server :80`):

   | Caminho público   | Destino interno              | Observação                                        |
   | ----------------- | ---------------------------- | ------------------------------------------------- |
   | `/api/socket.io/` | `http://api:3000/socket.io/` | `Upgrade`/`Connection`, HTTP/1.1, timeouts de 1 h |
   | `/api/`           | `http://api:3000/`           | prefixo removido; leitura de 90 s (sync até 60 s) |
   | `/`               | arquivos do SPA              | fallback para `index.html`                        |

   A api não tem prefixo global; o nginx remove o `/api`
   (`rewrite ^/api/(.*)$ /$1 break`). O destino vem de variável
   (`set $api_upstream http://api:3000`) com `resolver 127.0.0.11 valid=10s`
   (DNS do Docker): recriar só a api muda o IP do container, e um host literal
   no `proxy_pass` deixaria o nginx preso no IP antigo (502) — além de fazer o
   `nginx -t` falhar fora da rede do compose ("host not found in upstream").

2. **`X-Forwarded-For` sobrescrito com `$remote_addr`**, não
   `$proxy_add_x_forwarded_for`. Com `TRUST_PROXY=1` os dois seriam seguros
   hoje; sobrescrever é defesa em profundidade (se alguém aumentar o
   `TRUST_PROXY` por engano, o valor do cliente já foi descartado).
   **Premissa:** este nginx é a borda. Se um dia houver CDN ou outro
   balanceador à frente dele, `$remote_addr` passa a ser o IP desse
   intermediário — aí é preciso o módulo **realip** (`set_real_ip_from` +
   `real_ip_header`), não mais saltos confiáveis.

3. **`TRUST_PROXY` por variável de ambiente**, validada no `env.schema.ts`:
   inteiro ≥ 0 (proxies à frente da api) ou `'false'`, convertido para
   `number | false`; `'true'`, vazio e qualquer outro valor derrubam o boot.
   **Obrigatória com `NODE_ENV=production`**, sem default (o número depende da
   topologia; um palpite errado reabre a forja ou junta todos os clientes num
   IP só). Fora de produção, ausente = `false` (em dev e no CI e2e o browser
   fala direto com a api). O `main.ts` lê o valor validado pelo
   `ConfigService`.
   **Armadilha:** o Express interpreta _string_ como lista de IPs —
   `app.set('trust proxy', '1')` confia no IP `0.0.0.1`, não em um salto, e
   `'false'` derruba o boot com "invalid IP address". Por isso a conversão
   acontece no schema, nunca com o valor cru de `process.env`.

4. **A api não publica porta.** Só a `80` (frontend) é publicada. Depuração:
   `curl.exe http://localhost/api/health` ou
   `docker compose exec api wget -qO- http://127.0.0.1:3000/health`.

5. **Valores de topologia fixos no compose**, não no `.env.local` (que cada
   operador preenche à mão): `TRUST_PROXY: '1'` na api e
   `VITE_API_URL: /api` no build do frontend (o `Dockerfile.frontend` tem o
   mesmo default, porque a imagem traz o `nginx-rotas.conf` que define
   `/api`).

6. **Frontend em mesma origem, socket incluído.** O `apiClient` só concatena
   strings e aceita `/api`. O socket não: o socket.io-client trata o
   **caminho da URL como namespace**, não como caminho do transporte —
   `io('/api/rooms')` entraria no namespace `/api/rooms` em `/socket.io` e a
   conexão falharia em silêncio (o `/socket.io` cairia no fallback do SPA).
   `resolveSocketTarget` (`apps/reservations/src/config/api.ts`) monta
   URL = origem + `/rooms` e `path` = caminho da base + `/socket.io`. O build
   do GitHub Pages (URL absoluta) fica igual: mesma URL, `path` `/socket.io`.

## Alternativas descartadas

- **Publicar em `127.0.0.1:3000`**: qualquer processo no host falaria direto
  com a api, furando o nginx (e a forja voltaria); engines Docker antigas
  (< 28) ainda expunham portas em `127.0.0.1` à LAN.
- **`setGlobalPrefix('api')` na api**: mudaria todas as rotas do contrato
  (Pages, Railway, e2e) — o prefixo é só do nginx.
- **`$proxy_add_x_forwarded_for`**: seguro com `TRUST_PROXY=1`, mas deixa o
  valor do cliente na cadeia (ver decisão 2).
- **`TRUST_PROXY`/`VITE_API_URL` no `.env.local`**: valor de topologia não
  deve depender de cada operador; o `.env.local` antigo ainda tinha a URL
  `:3000`.
- **`proxy_pass http://api:3000/` estático**: IP gravado na partida (ver
  decisão 1).

## Consequências

- O rate limiting por IP (`ThrottlerGuard`, que usa `req.ip`) volta a valer
  no `infra/docker`: forjar `X-Forwarded-For` não muda o `req.ip`.
- **Logs:** o `pino-http` registra o `remoteAddress` do socket, não o
  `req.ip` — atrás do nginx, os logs passam a mostrar o **IP do nginx** em
  toda requisição. Follow-up: registrar `req.ip` nos logs.
- `AuditLog.ip` existe no schema, mas nenhum código o grava (sem mudança).
- **Docker Desktop (Windows)** não preserva o IP de origem: todos os
  clientes chegam ao nginx com o mesmo IP, e o rate limit é compartilhado.
  Já era assim antes desta mudança; no VPS Linux o IP real é preservado.
- **Railway:** `TRUST_PROXY=1` passa a ser obrigatório nas Variables
  (`docs/deploy.md`); sem ela o boot falha e o deploy é recusado pelo
  healthcheck. Hoje o deploy do backend está desligado (sem
  `RAILWAY_TOKEN`).
- `CORS_ORIGIN` fica opcional no `infra/docker` (mesma origem); continua
  obrigatória no Railway/Pages.

## Próximo passo: TLS

Fora do escopo do #21. Um `server { listen 443 ssl; ... }` com o mesmo
`include` do snippet reaproveita as rotas sem reescrita; o
`X-Forwarded-Proto $scheme` passa a valer `https` sozinho. O `server :80`
passa a só redirecionar (`return 301 https://$host$request_uri;`), com HSTS
no 443 e a porta 443 publicada no compose.

## Testes

- `env.schema.spec.ts`: produção sem `TRUST_PROXY` falha; `'1'` → `1`,
  `'0'` → `0`, `'false'` → `false`; `'1.5'`, `'-1'`, `'abc'`, `''`, `'true'`
  e `' 1'` falham; dev/test/sem `NODE_ENV` → `false`.
- `config/__tests__/api.test.ts` e `services/__tests__/socketClient.test.ts`:
  `/api`, URL absoluta (Pages) e URL com prefixo; o caminho da base nunca
  entra no namespace.
- `nginx -t` (container descartável, `--network none`) e
  `docker compose config --quiet`. O ponta a ponta (login, WebSocket e a
  forja de `X-Forwarded-For` com 429 a partir da 6ª tentativa) é manual, no
  ensaio local.
