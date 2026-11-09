# ADR-010 — Frontend na Vercel, API na Render, banco no Supabase

**Data:** 2026-11-07
**Status:** Ativo
**Contexto de arquitetura:** deploy de produção. Substitui o deploy do F9.3
(frontend no GitHub Pages pelo `cd.yml`, API no Railway pela CLI). O
`infra/docker` e o ADR-009 continuam valendo para servidor próprio.

---

## Contexto

O frontend era publicado no GitHub Pages, no subcaminho
`/salas-senai-monorepo/`, e a API no Railway. O job do Railway está parado:
o secret `RAILWAY_TOKEN` não existe.

O objetivo é ter o sistema em domínio próprio, com custo de US$ 0:

- frontend em `https://agendasalas.com.br`;
- API em `https://api.agendasalas.com.br`.

## Decisão

1. **Topologia.**
   - **Vercel**, plano Hobby: só o SPA estático, com o build do Vite.
   - **Render**, Web Service gratuito: a API (NestJS + Socket.IO + cron),
     construída com `infra/docker/Dockerfile.api` e contexto na raiz.
   - **Supabase**: o banco, que já existe.

   O navegador chama a API por **URL absoluta** (`VITE_API_URL`). REST e
   Socket.IO vão direto à Render; nada passa pela Vercel. Não há nginx neste
   caminho: o proxy da Render termina o TLS. O `resolveSocketTarget` já trata
   base absoluta, com o `path` padrão `/socket.io`.

2. **A API não roda na Vercel.**
   - WebSocket nas Vercel Functions está em **beta público**. Em testes
     publicados, as conexões são encerradas depois de poucos minutos.
   - As Functions são efêmeras e podem rodar em várias instâncias. Socket.IO
     (rooms em memória), o throttler, o lock do sync (`isRunning`) e o `@Cron`
     do sync de aulas dependem de **um processo único e de longa duração**.

3. **Build na Vercel** (`vercel.json` na raiz). O build depende do workspace
   (`shared`, `tsconfig`, `eslint-config`), por isso o Root Directory é a raiz.
   - **pnpm fixado com `npx --yes pnpm@8.15.0`.**
     - Com `installCommand` customizado, a doc da Vercel diz que ela usa o pnpm
       **mais antigo** do container (6), que não lê o lockfile 6.0.
     - O `packageManager` só é respeitado com Corepack, que é experimental e
       não vem mais embutido no Node a partir da versão 25.
     - Custo: a versão aparece em dois lugares (`packageManager` e
       `vercel.json`). Atualizar os dois juntos.
   - **`engines.node` passa a `>=20.0.0 <23.0.0`** (era `>=18.0.0`).
     - A Vercel usa o maior Node disponível que satisfaz o intervalo, e o
       `engines` sobrepõe a configuração do projeto. Com `>=18` ela buildaria
       em Node 26, que o CI nunca testou. Agora builda em 22, como o CI, o
       Docker e o Railway.
     - Efeito colateral: o pnpm recusa o install em Node fora do intervalo.
   - **Guard:** com `VERCEL` no ambiente, o build falha se `VITE_API_URL`:
     - estiver ausente;
     - apontar para a máquina local;
     - não for `https://` absoluta;
     - ou terminar com `/`.

     O guard fica em `apps/reservations/src/config/vercelBuildGuard.ts`,
     chamado no `vite.config.ts`. Sem ele, o bundle cairia no fallback
     `http://localhost:3000` e o login quebraria em produção sem erro no
     build. Fora da Vercel, nada muda.

4. **Deploy só com o CI verde.**
   - **Render:** Auto-Deploy em "After CI Checks Pass".
   - **Vercel:** Deployment Checks com os jobs `Typecheck + Lint + Unit Tests`
     e `E2E (Playwright)`.

   Sem essas configurações, as duas fazem deploy a cada push na `master`, e a
   regra do projeto ("deploy nunca em cima de CI vermelho") deixa de valer.
   Passo a passo em `docs/deploy.md`.

5. **`cd.yml`:** sai o job do GitHub Pages. O job do Railway fica intacto como
   plano B e continua pulado sem o `RAILWAY_TOKEN`.

## Ressalvas e riscos

- **Vercel Hobby é para uso pessoal e não comercial** (termos e _fair use
  guidelines_ da Vercel). Uso institucional é zona cinzenta. Se for
  considerado comercial, o caminho é o plano Pro.
- **Moeda e nota fiscal:** Render e Vercel cobram em dólar e não emitem NFS-e.
  Isso pesa se algum plano pago vier a ser custeado pela instituição.
- **A Render gratuita dorme.**
  - Ela dorme após 15 min sem tráfego de entrada (requisição HTTP ou mensagem
    WebSocket) e leva cerca de 1 min para acordar. O `prisma migrate deploy`
    roda a cada boot e soma tempo ao cold start.
  - São 750 horas de instância por mês por workspace.
  - A Render pode reiniciar o serviço a qualquer momento. Não há disco
    persistente, e banda e limites mudam sem aviso.
  - Um monitor externo gratuito em `/health` a cada 5 min evita o sono.
  - O **cron das 03h UTC só roda com o serviço acordado.**
  - Um reinício zera o throttler e o lock do sync, que ficam em memória.
- **Região:** a Render não tem região na América do Sul. Escolher a mais
  próxima do projeto Supabase.
- **`TRUST_PROXY` na Render** começa em `1` e precisa ser medido: o valor
  certo pode ser `2`. O procedimento está em `docs/deploy.md`.
- **Previews da Vercel** (`*.vercel.app`) não falam com a API, porque o CORS
  só libera o domínio de produção.
- **Sourcemaps** (`build.sourcemap: true`) são publicados junto, como já
  acontecia no Pages. Follow-up: avaliar `'hidden'`.

## Plano B

- **Railway (Hobby, pago):** o job do `cd.yml` está pronto; basta criar o
  secret `RAILWAY_TOKEN`.
- **AWS Lightsail em São Paulo** (`sa-east-1`, disponível no Lightsail desde
  06/2026): VM com o `infra/docker` (nginx como borda, ADR-009), sem sono e
  perto do Supabase. É pago.

## Testes

- `vercelBuildGuard.test.ts` (19 casos):
  - sem `VERCEL`, nunca bloqueia;
  - com `VERCEL`, bloqueia URL ausente, local, não-https e com barra final;
  - aceita a URL pública.
- **Builds locais:**
  - `VERCEL=1` sem a URL falha;
  - `VERCEL=1` com `https://api.agendasalas.com.br` passa e loga a URL;
  - sem `VERCEL`, passa como antes.
- **Bundle de produção:** contém `https://api.agendasalas.com.br` e não contém
  `localhost:3000` em JS, HTML e CSS. Os sourcemaps trazem o texto do
  código-fonte, que tem o literal do fallback.
- **Fica com o operador:** deploy, DNS e validação em produção (login,
  WebSocket 101, `TRUST_PROXY`).
