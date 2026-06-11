# ============================================================
# Testes Sprint 3 — listReservations + cancelReservation
# Uso: roda no PowerShell 7+ sequencialmente (testes 1→11 dependem do anterior).
# ============================================================

$URL   = 'https://script.google.com/macros/s/AKfycbyAxnzsvR4ogYUtHsa-lWLC8DE_8FsQedC6fPgBtn--BZGSVgTsGcfDE96RFwCGrpI8Ww/exec'
$TOKEN = 'senai@2026'


# ── Datas únicas por execução ────────────────────────────────
# Base distante (2030) + random 0..730 dias = espaço de ~2 anos.
# Garante que runs sequenciais no MESMO Sheets nunca colidam.
# Tests usam offsets fixos sobre RUN_OFFSET (T1=+0, T5=+1, T9=+2, T10=+30..+37).
$RUN_OFFSET = Get-Random -Minimum 0 -Maximum 730
$BASE_DATE  = (Get-Date '2030-01-01').AddDays($RUN_OFFSET)
Write-Host "RUN_OFFSET = $RUN_OFFSET dias (base $($BASE_DATE.ToString('yyyy-MM-dd')))" -ForegroundColor DarkGray

function Get-TestDate {
  param([int]$DayOffset = 0)
  $BASE_DATE.AddDays($DayOffset).ToString('yyyy-MM-dd')
}


# ── Helpers de body ───────────────────────────────────────────
function New-CreateBody {
  param(
    [string]$Sala       = '603 Sala',
    [string]$Data       = '2027-04-10',
    [string]$Inicio     = '08:00',
    [string]$Fim        = '09:00',
    [string]$Email      = 'owner.sprint3@senai.edu',
    [string]$Professor  = 'Sprint3 Owner',
    [string]$Turma      = 'ADS-A',
    [string]$Observacao = 'sprint3 setup'
  )
  @{
    action          = 'createReservation'
    clientRequestId = [guid]::NewGuid().ToString()
    userEmail       = $Email
    payload         = @{
      sala       = $Sala
      data       = $Data
      inicio     = $Inicio
      fim        = $Fim
      professor  = $Professor
      turma      = $Turma
      observacao = $Observacao
    }
  } | ConvertTo-Json -Depth 5
}

function New-CancelBody {
  param(
    [string]$ClientId = ([guid]::NewGuid().ToString()),
    [string]$Id,
    [string]$Email
  )
  @{
    action          = 'cancelReservation'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{ id = $Id }
  } | ConvertTo-Json -Depth 5
}


# ── TESTE 1: setup — cria reserva ACTIVE que será cancelada ────
Write-Host "`n--- TESTE 1: setup — cria reserva ACTIVE p/ testes seguintes ---" -ForegroundColor Cyan
$body1 = New-CreateBody -Data (Get-TestDate 0) -Inicio '08:00' -Fim '09:00'
$res1  = Invoke-RestMethod -Uri $URL -Method Post -Body $body1 -ContentType 'text/plain'
$res1  | ConvertTo-Json -Depth 5
if (-not $res1.ok) {
  Write-Host "TESTE 1 FALHOU — não dá pra prosseguir." -ForegroundColor Red
  return
}
$idAtivo = $res1.data.id
Write-Host "idAtivo capturado: $idAtivo" -ForegroundColor Green


# ── TESTE 2: listReservations sem flag → só ACTIVE ────
Write-Host "`n--- TESTE 2: listReservations sem flag (so ACTIVE) ---" -ForegroundColor Cyan
$res2 = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
Write-Host "count=$($res2.data.count)"
$found2 = $res2.data.reservations | Where-Object { $_.id -eq $idAtivo }
if ($found2) {
  Write-Host "OK — idAtivo aparece na lista ACTIVE (status=$($found2.status))" -ForegroundColor Green
} else {
  Write-Host "ERRO — idAtivo NAO apareceu" -ForegroundColor Red
}


# ── TESTE 3: cancelReservation com id válido + email correto ────
Write-Host "`n--- TESTE 3: cancel com id valido + email correto ---" -ForegroundColor Cyan
$body3 = New-CancelBody -Id $idAtivo -Email 'owner.sprint3@senai.edu'
$res3  = Invoke-RestMethod -Uri $URL -Method Post -Body $body3 -ContentType 'text/plain'
$res3  | ConvertTo-Json -Depth 5
# Esperado: ok=true, data.status='CANCELLED', data.id == idAtivo


# ── TESTE 4: cancel 2× mesmo clientRequestId → idempotente ────
Write-Host "`n--- TESTE 4: cancel 2x mesmo clientRequestId (idempotente) ---" -ForegroundColor Cyan
$sameClient = [guid]::NewGuid().ToString()
$body4      = New-CancelBody -ClientId $sameClient -Id $idAtivo -Email 'owner.sprint3@senai.edu'
$res4a      = Invoke-RestMethod -Uri $URL -Method Post -Body $body4 -ContentType 'text/plain'
$res4b      = Invoke-RestMethod -Uri $URL -Method Post -Body $body4 -ContentType 'text/plain'
Write-Host "1a chamada: ok=$($res4a.ok), status=$($res4a.data.status)"
Write-Host "2a chamada: ok=$($res4b.ok), status=$($res4b.data.status)"
# Esperado: ambos ok=true, ambos data.status='CANCELLED'


# ── TESTE 5: cancel com email errado (id ACTIVE) → FORBIDDEN ────
Write-Host "`n--- TESTE 5: cancel com email errado (deve FORBIDDEN) ---" -ForegroundColor Cyan
# Setup CRÍTICO: tem que criar com SUCESSO antes de testar FORBIDDEN.
# Se colidir (improvável com data única, mas defensivo), tenta data adiante.
$idAlheio = $null
for ($i = 0; $i -lt 10 -and -not $idAlheio; $i++) {
  $tryDate = Get-TestDate (1 + $i * 100)
  $bodyS5  = New-CreateBody -Sala '605 Sala' -Data $tryDate -Inicio '08:00' -Fim '09:00'
  $resS5   = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyS5 -ContentType 'text/plain'
  if ($resS5.ok) {
    $idAlheio = $resS5.data.id
    Write-Host "Setup OK: criada $idAlheio em $tryDate" -ForegroundColor DarkGray
  } else {
    Write-Host "Setup tentativa $($i+1) falhou ($($resS5.error.code) em $tryDate), tentando outra data..." -ForegroundColor Yellow
  }
}
if (-not $idAlheio) {
  Write-Host "TESTE 5 ABORTADO — não consegui criar reserva de setup em 10 tentativas." -ForegroundColor Red
} else {
  $body5 = New-CancelBody -Id $idAlheio -Email 'outro.email@senai.edu'
  $res5  = Invoke-RestMethod -Uri $URL -Method Post -Body $body5 -ContentType 'text/plain'
  $res5  | ConvertTo-Json -Depth 5
  if ($res5.error.code -eq 'FORBIDDEN') {
    Write-Host "OK — FORBIDDEN confirmado (cancel com email errado em reserva ACTIVE)" -ForegroundColor Green
  } else {
    Write-Host "ERRO: esperava FORBIDDEN, veio $($res5.error.code) (ok=$($res5.ok))" -ForegroundColor Red
  }
}


# ── TESTE 6: cancel com id inexistente → NOT_FOUND ────
Write-Host "`n--- TESTE 6: cancel com id inexistente (deve NOT_FOUND) ---" -ForegroundColor Cyan
$body6 = New-CancelBody -Id 'id-que-nao-existe-12345' -Email 'qualquer@senai.edu'
$res6  = Invoke-RestMethod -Uri $URL -Method Post -Body $body6 -ContentType 'text/plain'
$res6  | ConvertTo-Json -Depth 5
# Esperado: ok=false, error.code='NOT_FOUND'


# ── TESTE 7: listReservations sem flag depois de cancelar → cancelada NAO aparece ────
Write-Host "`n--- TESTE 7: list sem flag depois de cancelar (idAtivo nao deve aparecer) ---" -ForegroundColor Cyan
$res7 = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
$found7 = $res7.data.reservations | Where-Object { $_.id -eq $idAtivo }
if (-not $found7) {
  Write-Host "OK — idAtivo cancelado NAO aparece na lista ACTIVE" -ForegroundColor Green
} else {
  Write-Host "ERRO — idAtivo cancelado ainda aparece (status=$($found7.status))" -ForegroundColor Red
}


# ── TESTE 8: listReservations?includeCancelled=true → ACTIVE + CANCELLED ────
Write-Host "`n--- TESTE 8: list com includeCancelled=true (ACTIVE + CANCELLED) ---" -ForegroundColor Cyan
$res8 = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations&includeCancelled=true" -Method Get
$found8 = $res8.data.reservations | Where-Object { $_.id -eq $idAtivo }
if ($found8 -and $found8.status -eq 'CANCELLED') {
  Write-Host "OK — idAtivo aparece com status='CANCELLED'" -ForegroundColor Green
} else {
  Write-Host "ERRO — idAtivo deveria aparecer com status='CANCELLED'" -ForegroundColor Red
}


# ── TESTE 9: smoke createReservation legado (anti-regressao) ────
Write-Host "`n--- TESTE 9: smoke createReservation (anti-regressao Sprint 2) ---" -ForegroundColor Cyan
$body9 = New-CreateBody -Sala '607 Sala' -Data (Get-TestDate 2) -Inicio '10:00' -Fim '11:00'
$res9  = Invoke-RestMethod -Uri $URL -Method Post -Body $body9 -ContentType 'text/plain'
$res9  | ConvertTo-Json -Depth 5
# Esperado: ok=true, data.id presente


# ── TESTE 10: smoke createReservationRange legado (anti-regressao Sprint 2.5) ────
Write-Host "`n--- TESTE 10: smoke createReservationRange (anti-regressao Sprint 2.5) ---" -ForegroundColor Cyan
$body10 = @{
  action          = 'createReservationRange'
  clientRequestId = [guid]::NewGuid().ToString()
  userEmail       = 'sprint3.range@senai.edu'
  payload         = @{
    sala       = '608 Sala'
    dataInicio = (Get-TestDate 30)
    dataFim    = (Get-TestDate 37)
    diasSemana = @(2, 4)
    inicio     = '14:00'
    fim        = '15:00'
    professor  = 'Sprint3 Range'
    turma      = 'ADS-B'
    observacao = ''
  }
} | ConvertTo-Json -Depth 5
$res10 = Invoke-RestMethod -Uri $URL -Method Post -Body $body10 -ContentType 'text/plain'
$res10 | ConvertTo-Json -Depth 5
# Esperado: ok=true, data.count >= 1


# ── TESTE 11: cancel reserva JA CANCELLED com EMAIL DIFERENTE → ok (NAO FORBIDDEN) ────
# Documenta a idempotencia state-based: se ja CANCELLED, owner check eh PULADO.
# idAtivo ja foi cancelado nos testes 3/4 com owner.sprint3@senai.edu.
# Aqui chamamos cancel de novo com um email diferente — espera-se ok=true (operacao idempotente).
Write-Host "`n--- TESTE 11: cancel reserva ja CANCELLED com email diferente (idempotencia da OPERACAO) ---" -ForegroundColor Cyan
$body11 = New-CancelBody -Id $idAtivo -Email 'qualquer.outro@senai.edu'
$res11  = Invoke-RestMethod -Uri $URL -Method Post -Body $body11 -ContentType 'text/plain'
$res11  | ConvertTo-Json -Depth 5
if ($res11.ok -and $res11.data.status -eq 'CANCELLED') {
  Write-Host "OK — cancel idempotente com email diferente passou (status=CANCELLED, sem FORBIDDEN)" -ForegroundColor Green
} else {
  Write-Host "ERRO — esperava ok=true e status=CANCELLED; veio ok=$($res11.ok), code=$($res11.error.code)" -ForegroundColor Red
}
