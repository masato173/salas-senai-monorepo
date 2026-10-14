# ADR-008 — Redirecionamento do Apps Script no sync de aulas

**Data:** 2026-10-14
**Status:** Ativo
**Contexto de arquitetura:** `SyncModule` (`POST /sync/schedules` e cron
diário às 03h UTC), achado do ensaio local da issue #1.

---

## Contexto

O sync faz POST em `APPS_SCRIPT_URL` (`/exec`) com
`{ action: 'listSchedules', token }` no corpo. O Apps Script **executa nesse
primeiro POST** (o painel de Execuções mostra "concluída") e responde
**302** para `script.googleusercontent.com/macros/echo?...` — o link do
resultado.

O `SyncService` reenviava o **mesmo POST** ao `Location`. O Google responde
a esse POST com uma página HTML de erro; o `JSON.parse` quebrava e o sync
devolvia 500 ("Unexpected token '<'…"), sem atualizar a tabela `Schedule` —
nem pelo botão, nem pelo cron. O comentário do código justificava o reenvio
dizendo que seguir o redirecionamento "perde o corpo"; o ensaio mostrou que
o corpo não é necessário no segundo passo, porque a execução já aconteceu
no primeiro.

Problemas correlatos encontrados na mesma análise:

- sem prazo nenhum: uma resposta que nunca chega deixava o lock estático
  `isRunning` preso, e todo sync seguinte recebia 409 até reiniciar o
  processo;
- nenhum controle do destino do `Location`: o POST com o token era
  reenviado para qualquer host;
- a mensagem de erro de JSON inválido incluía o começo do corpo;
- status final fora de 2xx era tratado como sucesso.

## Decisão

Laço manual com `https.request` (`sync.service.ts`, `fetchFromAppsScript`):

1. **301/302/303 → a próxima requisição é GET**, sem corpo e sem
   `Content-Type`/`Content-Length`. **307/308 mantêm método e corpo.**
   Outros 3xx não são seguidos (viram resposta final, logo erro). É a regra
   HTTP aplicada pelos navegadores e pelo `fetch`.
2. **Limite de 5 redirecionamentos** (`APPS_SCRIPT_MAX_REDIRECTS`); o fluxo
   normal usa 1. Acima disso: "redirecionamentos demais".
3. **Prazo total de 60 s** (`APPS_SCRIPT_TIMEOUT_MS`), um único
   `AbortController` para todos os saltos. O `listSchedules` lê ~1500
   linhas (poucos segundos + cold start); o prazo dá folga e garante que o
   lock seja liberado.
4. **Destinos de redirecionamento permitidos:** só `https:` e hosts
   `google.com`/`googleusercontent.com` ou seus subdomínios (comparação com
   ponto: `evilgoogle.com` e `google.com.evil.io` são recusados). Qualquer
   outro destino → erro, sem seguir; a mensagem cita só protocolo e host,
   nunca a URL inteira (o link do resultado carrega uma chave de acesso). A
   URL inicial vem do `.env` e não passa por essa trava.
5. **Resposta final:** status fora de 2xx ou corpo que não é JSON → erro com
   status e content-type, **sem o corpo**, antes do DELETE — o `Schedule`
   nunca é substituído por causa de uma página de erro.

O token só trafega no corpo do primeiro POST (e de um eventual 307/308,
sempre para host permitido) e nunca aparece em mensagem de erro ou log
(coberto por teste).

**Alternativa descartada:** voltar ao `fetch` com `redirect: 'follow'`.
Aplicaria a regra 1 sozinho, mas trocaria a camada HTTP e o spec inteiros e
seguiria qualquer destino sem chance de validar.

**Trade-off da trava de host:** se o Google passar a redirecionar por outro
domínio, o sync falha — com erro explícito citando o host, que dá o
diagnóstico imediato.

## Testes

`sync.service.spec.ts` (`node:https` mockado): GET sem corpo após
301/302/303, Location relativo, POST mantido em 307/308, limite de saltos,
3xx sem Location, destinos recusados, tabela de `isAllowedRedirectTarget`,
corpo não-JSON e status 500 sem DELETE, prazo de 60 s com liberação do
lock, token ausente de erros e logs. O teste que travava o reenvio do POST
foi invertido. O teste de ponta a ponta (Apps Script real) é manual, no
ensaio local.

## Fora do escopo

- `codigo.gs` (sem mudança: o `doPost/listSchedules` já respondia certo).
- Contratos de `/sync`, schema do `Schedule` e a substituição dos registros
  (DELETE + INSERT).
- Cache, retentativa automática do cron (uma falha às 03h deixa o
  `Schedule` desatualizado até o dia seguinte ou até um sync manual) e
  agendamento.
- `MEMORY.md` repete a explicação antiga (Bug histórico #24) e precisa ser
  ajustado à parte.
