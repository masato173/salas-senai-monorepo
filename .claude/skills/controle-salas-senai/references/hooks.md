# Padrão de Hooks — Referência Detalhada

Carregar este arquivo quando criar/revisar hook que fala com o Apps Script.

## Anatomia padrão

Todo hook tem **duas funções exportadas**:

1. `executeX(service, request, options?)` — função pura, sem React. Aceita injeção de service. Aplica retry policy. Testável em isolamento.
2. `useX(service, hookOptions?)` — wrapper React que envolve `executeX` com state (`status`, `data`, `error`) e expõe `refetch` (query) ou `mutate` (mutation).

Essa separação é deliberada: testes de retry policy ficam em `execute*` sem precisar de React Testing Library. Testes do hook em si ficam em testes separados que validam estado, mount-only effect, strict-mode.

## Envelope canônico

```typescript
export type BackendErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'DUPLICATE'
  | 'LOCK_TIMEOUT'
  | 'INTERNAL';

export interface BackendError {
  code:    BackendErrorCode;
  message: string;
}

export interface Envelope<T> {
  ok:    boolean;
  data:  T | null;
  error: BackendError | null;
}
```

**Invariantes**:
- `ok=true` → `data` não-nulo, `error=null`
- `ok=false` → `data=null`, `error` não-nulo
- Nunca `ok=true` com `error` preenchido

## Política de retry (idêntica em TODOS os hooks)

Retenta **somente**:
- Fetch lançou (rede caiu)
- Envelope `ok=false` com `error.code === 'INTERNAL'`

**Nunca** retenta:
- `NOT_FOUND` — recurso não existe, tentar de novo não vai criar
- `FORBIDDEN` — owner check, não muda em retry
- `VALIDATION` — payload errado, mesmo erro de novo
- `LOCK_TIMEOUT` — contenção, retry vai disputar de novo. Caller pode invocar `refetch` se quiser
- `DUPLICATE` — já existe, retornar imediatamente
- `CONFLICT` — sala ocupada, mesma resposta de novo

`maxRetries` default = 2 (total: 1 tentativa + 2 retries = 3 chamadas no pior caso).

## Idempotência em mutations

Em hooks de mutation (`useCreateReservation`, `useCreateReservationRange`, `useCancelReservation`), o `clientRequestId` é gerado **uma vez** e reutilizado em todas as tentativas:

```typescript
const clientRequestId =
  executeOptions.clientRequestId ?? globalThis.crypto.randomUUID();

for (let attempt = 0; attempt <= maxRetries; attempt++) {
  try {
    const res = await service.cancelReservation({ ...request, clientRequestId });
    if (res.ok || !isRetryable(res.error?.code)) return res;
    lastEnvelope = res;
  } catch (err) {
    lastNetError = err;
  }
}
```

Backend usa `clientRequestId` pra detectar retry vs nova request e retornar idempotente.

## Mount-only effect (queries)

```typescript
useEffect(() => {
  if (autoFetch) refetch();
  // Mount-only: intencionalmente sem deps de service/options.
  // Se service mudar, caller chama refetch explicitamente.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

Comentário **obrigatório** quando desabilitar `exhaustive-deps`. Sem comentário, próximo dev (ou o próprio Claude em revisão futura) vai tentar "consertar" e quebrar o padrão.

## serviceRef pra evitar stale closure

```typescript
const serviceRef = useRef(service);
serviceRef.current = service;

const refetch = useCallback(async (options?) => {
  // usa serviceRef.current, não service direto
  const res = await executeX(serviceRef.current, request, options);
  // ...
}, []);
```

`refetch` precisa ser estável (deps vazias no `useCallback`) pra não disparar effects no consumidor. Mas chamada precisa ver o service atual. `serviceRef` resolve sem custar identidade.

## Race condition em queries com filtros

**Não resolvido nos hooks atuais.** Se `refetch({ from: A })` e `refetch({ from: B })` disparam em sequência rápida e B chega antes de A, o estado fica com dados de A (último a chamar `setData`).

Mitigação atual: queries são "fetch all" (sem filtros server-side). Filtros aplicam no client. Quando entrar paginação/filtros server-side, adicionar `requestIdRef` que invalida respostas obsoletas.

## Template de teste para `execute*`

Matriz mínima por hook de mutation:

```
[
  'chama service uma vez em caso de sucesso',
  'NÃO retenta em NOT_FOUND',
  'NÃO retenta em FORBIDDEN',
  'NÃO retenta em VALIDATION',
  'NÃO retenta em LOCK_TIMEOUT',
  'NÃO retenta em DUPLICATE',
  'NÃO retenta em CONFLICT',           // só pra create*, não cancel
  'retenta em INTERNAL com o MESMO clientRequestId',
  'retenta em falha de rede com o MESMO clientRequestId',
  'após esgotar retries em INTERNAL, devolve último envelope ok=false',
  'após esgotar retries em falha de rede, lança o erro',
  'respeita clientRequestId fornecido externamente',
  'gera clientRequestId via crypto.randomUUID quando não fornecido',
  'encaminha payload ao service',
  'encaminha userEmail ao service',
]
```

Para hook de query (sem mutation), pular os testes de `clientRequestId`.

## Mock pattern

```typescript
beforeEach(() => {
  vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
    '11111111-2222-3333-4444-555555555555',
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

UUID fixo permite asserir `clientRequestId` em testes de retry sem flakiness.

## Pegadinhas comuns

- **Esquecer `=> {`** em arrow function de teste assíncrono (já aconteceu duas vezes no projeto)
- **Esquecer `)` em `new TypeError(...)`** dentro de `mockRejectedValue`
- **Objeto de opções não fechado**: `executeX(svc, req, {` sem `})` no fim
- **Comentário no teste afirmando comportamento de backend não verificado** (anti-invention)
- **Reusar `it.only`** e commitar — sempre rodar suite inteira antes de commit
