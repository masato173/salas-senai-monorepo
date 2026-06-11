# Padrão de Backend Apps Script — Referência Detalhada

Carregar quando trabalhar em `codigo.gs`, endpoints do Apps Script, ou validação de comportamento backend nos testes.

## Fluxo canônico de mutation

```
doPost(e)
  ↓
  parse body + validate token
  ↓
  LockService.getScriptLock().tryLock(timeoutMs)
    ↓ se timeout → return { ok:false, error:{ code:'LOCK_TIMEOUT' } }
  ↓
  validate payload (campos obrigatórios, formato, owner)
    ↓ inválido → return { ok:false, error:{ code:'VALIDATION' } }
  ↓
  state check (idempotência)
    ↓ já no estado alvo → return { ok:true, data:current }
  ↓
  business check (conflito, owner, etc.)
    ↓ inválido → return { ok:false, error:{ code:'CONFLICT' | 'FORBIDDEN' | 'NOT_FOUND' } }
  ↓
  mutate sheet (appendRow / setValues + setNumberFormat)
  ↓
  release lock (finally)
  ↓
  return { ok:true, data:result }
```

## Endpoints atuais

| Endpoint | Método | Status | Testes |
|----------|--------|--------|--------|
| `createReservation` | POST | produção | Vitest + PowerShell |
| `createReservationRange` | POST | produção | Vitest + PowerShell |
| `listReservations` | GET | produção | PowerShell |
| `cancelReservation` | POST | produção | 11/11 PowerShell |
| `checkConflict` | GET | produção | Vitest |

## LockService

Toda mutation que escreve na aba `Reservas` usa `LockService.getScriptLock()` com timeout (~10s):

```javascript
const lock = LockService.getScriptLock();
const acquired = lock.tryLock(10000);
if (!acquired) {
  return jsonResponse({
    ok: false,
    data: null,
    error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado, tente novamente.' }
  });
}

try {
  // ... mutation
} finally {
  lock.releaseLock();
}
```

Lock é por script (não por linha). Contention real esperada em horário de pico.

## Aba Reservas — ordem de colunas

Índices (1-based, como Apps Script usa):

| Col | Índice | Tipo | Observação |
|-----|--------|------|------------|
| A | 1 | id | ULID/UUID gerado no backend |
| B | 2 | sala | string |
| C | 3 | data | **text format obrigatório** |
| D | 4 | inicio | **text format obrigatório** |
| E | 5 | fim | **text format obrigatório** |
| F | 6 | professor | string |
| G | 7 | turma | string |
| H | 8 | observacao | string opcional |
| I | 9 | status | `ACTIVE` \| `CANCELLED` |
| J | 10 | createdBy | email do criador — **owner validation** |
| K | 11 | createdAt | ISO timestamp |
| L | 12 | updatedAt | ISO timestamp |

⚠️ **Memória do projeto diz "createdBy at column index 9".** Se a contagem do projeto for **0-based** (J seria índice 9), o mapping é diferente. **Verificar no `codigo.gs` antes de assumir.** Anti-invention rule.

## setNumberFormat — bug histórico

Toda inserção em C/D/E **precisa** forçar text format:

```javascript
const row = sheet.getLastRow();
sheet.getRange(row, 3, 1, 3).setNumberFormat('@'); // C, D, E
```

Sem isso, `'08:00'` vira `Date(1899-12-30 08:00:00)` no Sheets. Bug pego em produção, custou debug pesado. Nunca pular este passo.

## Idempotência por estado

Backend reconhece dois mecanismos de idempotência:

1. **State-based**: cancel de reserva já `CANCELLED` retorna `ok=true` com a reserva atual, sem segunda tentativa de cancel. **Comportamento observado em 11/11 PowerShell tests.** O `como` interno (pula owner-check? checa state primeiro?) não está confirmado pelo arquivo fonte na memória atual — anti-invention: descrever o **observável**, não o mecanismo.

2. **`clientRequestId`-based**: hooks de mutation enviam mesmo `clientRequestId` em retries. Backend usa pra detectar retry vs nova request.

## Owner validation

```
campo `createdBy` na linha = `userEmail` do request?
  sim → autorizado
  não → return { ok:false, error:{ code:'FORBIDDEN' } }
```

Exceções (quando aplicável, **verificar antes de assumir**):
- Admins/coordenadores podem cancelar reservas de terceiros
- Cancel de reserva já `CANCELLED` pode pular owner-check (depende da implementação — verificar `codigo.gs`)

## Validação de conflito

Fórmula canônica:

```javascript
const hasConflict =
  newStart < existingEnd &&
  newEnd > existingStart;
```

Cobre:
- Overlap parcial (qualquer direção)
- Overlap total
- Containment (nova dentro de existente ou vice-versa)
- Bordas iguais → não conflita (`start === end` é tangência, não overlap)

Comparações devem ser feitas com objetos Date construídos em **UTC noon** (paridade frontend/backend).

Query no Sheets: ler aba Reservas, filtrar onde `data === newData && sala === newSala && status === 'ACTIVE'`, aplicar fórmula em JavaScript. Não tem otimização de índice — em ~2000 linhas começa a ficar lento, gatilho pra migrar pro Postgres.

## Token e deploy

- **Token atual**: `senai@2026` (passado em todas as requests)
- **Deploy URL atual** (sujeita a mudança em redeploy): `https://script.google.com/macros/s/AKfycbyAxnzsvR4ogYUtHsa-lWLC8DE_8FsQedC6fPgBtn--BZGSVgTsGcfDE96RFwCGrpI8Ww/exec`
- **DEV spreadsheet**: `1Y4DP1Q4nxx4BMwEoYFd7R673G8asaubM9-XzSrGUPLE` — safe pra testes
- **PROD spreadsheet**: `1m97CzLNYJlqTq3qECYtpGgeS_skIL0B3eoWNIx7edXk` — **NUNCA tocar em sessão de dev**

Quando a sessão for tocar backend, confirmar com o usuário em qual planilha o Apps Script está deployado antes de rodar testes destrutivos.

## Validação local (PowerShell)

Padrão do projeto: scripts PowerShell que batem direto no deploy URL pra validar contratos antes de o frontend integrar. Exemplo:

```powershell
$body = @{
  token = 'senai@2026'
  action = 'cancelReservation'
  payload = @{ id = 'r-test-1' }
  userEmail = 'professor@senai.edu'
  clientRequestId = [guid]::NewGuid().ToString()
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri $env:APPS_SCRIPT_URL -Method POST -Body $body -ContentType 'application/json'
```

Resultados esperados rodam antes de Vitest. Backend validado → frontend pode integrar com confiança.
