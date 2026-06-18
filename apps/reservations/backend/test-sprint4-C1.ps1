# ============================================================
# Testes Sprint 4 — FASE C1: updateReservation (editar UMA reserva)
# Uso: PowerShell 7+, sequencial. Idempotente entre runs (base 2030 + RUN_OFFSET).
#
# Pré-requisitos:
#   1) Fase A já live (coluna N = groupId).
#   2) codigo.gs.sprint4-C1 colado + Nova versão implantada.
# ============================================================

$URL   = 'https://script.google.com/macros/s/AKfycbyAxnzsvR4ogYUtHsa-lWLC8DE_8FsQedC6fPgBtn--BZGSVgTsGcfDE96RFwCGrpI8Ww/exec'
$TOKEN = 'senai@2026'


# ── Datas únicas por execução ────────────────────────────────
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
    [string]$Data,
    [string]$Inicio     = '08:00',
    [string]$Fim        = '09:00',
    [string]$Email      = 'owner.c1@senai.edu',
    [string]$Professor  = 'C1 Owner',
    [string]$Turma      = 'ADS-A',
    [string]$Observacao = 'sprint4 c1 setup',
    [string]$ClientId   = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'createReservation'
    clientRequestId = $ClientId
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

function New-UpdateBody {
  param(
    [string]$Id,
    [string]$Sala,
    [string]$Data,
    [string]$Inicio,
    [string]$Fim,
    [string]$Turma,
    [string]$Observacao = '',
    [string]$Email      = 'owner.c1@senai.edu',
    [string]$ClientId   = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'updateReservation'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{
      id         = $Id
      sala       = $Sala
      data       = $Data
      inicio     = $Inicio
      fim        = $Fim
      turma      = $Turma
      observacao = $Observacao
    }
  } | ConvertTo-Json -Depth 5
}

function New-CancelBody {
  param(
    [string]$Id,
    [string]$Email    = 'owner.c1@senai.edu',
    [string]$ClientId = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'cancelReservation'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{ id = $Id }
  } | ConvertTo-Json -Depth 5
}


# ── TESTE 1: setup — cria reserva ACTIVE pra ser editada ─────
Write-Host "`n--- TESTE 1: setup — cria reserva base ---" -ForegroundColor Cyan
$dataT1 = Get-TestDate 0
$bodyT1 = New-CreateBody -Sala '603 Sala' -Data $dataT1 -Inicio '08:00' -Fim '09:00'
$resT1  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT1 -ContentType 'text/plain'
if (-not $resT1.ok) {
  Write-Host "TESTE 1 FALHOU: $($resT1.error.code) — abortando" -ForegroundColor Red
  return
}
$idBase            = $resT1.data.id
$updatedAtOriginal = $resT1.data.updatedAt
$groupIdOriginal   = $resT1.data.groupId
$createdByOriginal = $resT1.data.createdBy
$createdAtOriginal = $resT1.data.createdAt
Write-Host "OK — id=$idBase, groupId=$groupIdOriginal, updatedAt=$updatedAtOriginal" -ForegroundColor Green


# ── TESTE 2: edita sala (campo simples) → row mudou + updatedAt novo + imutáveis preservados
Write-Host "`n--- TESTE 2: edita sala '603 Sala' → '604 Sala' ---" -ForegroundColor Cyan
$bodyT2 = New-UpdateBody -Id $idBase -Sala '604 Sala' -Data $dataT1 -Inicio '08:00' -Fim '09:00' -Turma 'ADS-A'
$resT2  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT2 -ContentType 'text/plain'
$resT2 | ConvertTo-Json -Depth 5
if ($resT2.ok -and
    $resT2.data.sala -eq '604 Sala' -and
    $resT2.data.updatedAt -ne $updatedAtOriginal -and
    $resT2.data.groupId   -eq $groupIdOriginal -and
    $resT2.data.createdBy -eq $createdByOriginal -and
    $resT2.data.createdAt -eq $createdAtOriginal -and
    $resT2.data.id        -eq $idBase) {
  Write-Host "OK — sala editada, updatedAt avançou, imutáveis preservados" -ForegroundColor Green
} else {
  Write-Host "ERRO — sala=$($resT2.data.sala) updatedAt=$($resT2.data.updatedAt) groupId=$($resT2.data.groupId)" -ForegroundColor Red
}
$updatedAtPosT2 = $resT2.data.updatedAt


# ── TESTE 3: edita horário pra outro slot livre → ok
Write-Host "`n--- TESTE 3: edita horario 08:00-09:00 → 10:00-11:00 ---" -ForegroundColor Cyan
$bodyT3 = New-UpdateBody -Id $idBase -Sala '604 Sala' -Data $dataT1 -Inicio '10:00' -Fim '11:00' -Turma 'ADS-A'
$resT3  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT3 -ContentType 'text/plain'
if ($resT3.ok -and $resT3.data.inicio -eq '10:00' -and $resT3.data.fim -eq '11:00') {
  Write-Host "OK — horario editado: $($resT3.data.inicio)-$($resT3.data.fim)" -ForegroundColor Green
} else {
  Write-Host "ERRO — esperava 10:00-11:00; veio $($resT3.data.inicio)-$($resT3.data.fim) (ok=$($resT3.ok), code=$($resT3.error.code))" -ForegroundColor Red
}


# ── TESTE 4: edita pra horário que CONFLITA com outra reserva → CONFLICT
Write-Host "`n--- TESTE 4: edita pra slot ja ocupado por outra reserva (deve CONFLICT) ---" -ForegroundColor Cyan
# Setup: cria reserva "B" em 14:00-15:00 na mesma sala 604
$dataT4 = $dataT1
$bodyT4Setup = New-CreateBody -Sala '604 Sala' -Data $dataT4 -Inicio '14:00' -Fim '15:00'
$resT4Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT4Setup -ContentType 'text/plain'
if (-not $resT4Setup.ok) {
  Write-Host "Setup T4 falhou: $($resT4Setup.error.code) — pulando" -ForegroundColor Yellow
} else {
  $idOutra = $resT4Setup.data.id
  Write-Host "Setup OK — outra reserva $idOutra em 14:00-15:00" -ForegroundColor DarkGray

  # Tenta editar idBase pra 14:00-15:00 (mesma sala/data) → deve conflitar com idOutra
  $bodyT4 = New-UpdateBody -Id $idBase -Sala '604 Sala' -Data $dataT4 -Inicio '14:00' -Fim '15:00' -Turma 'ADS-A'
  $resT4  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT4 -ContentType 'text/plain'
  if ($resT4.error.code -eq 'CONFLICT') {
    Write-Host "OK — CONFLICT detectado" -ForegroundColor Green
  } else {
    Write-Host "ERRO — esperava CONFLICT; veio ok=$($resT4.ok), code=$($resT4.error.code)" -ForegroundColor Red
  }
}


# ── TESTE 5: edita pro próprio horário atual (mesmos valores) → ok (no-op state-based)
Write-Host "`n--- TESTE 5: edita pro PROPRIO horario atual (no-op state-based) ---" -ForegroundColor Cyan
# Estado atual: idBase em 604 Sala / 10:00-11:00 / ADS-A / observacao='sprint4 c1 setup'
# Mas atenção: o sanitize() pode ter alterado a observacao original.
# Pra T5 ser confiável, busca a row atual e usa OS MESMOS valores.
$resLista = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
$atual    = $resLista.data.reservations | Where-Object { $_.id -eq $idBase }
if (-not $atual) {
  Write-Host "ERRO — idBase nao apareceu no list" -ForegroundColor Red
} else {
  $updatedAtAntes = $atual.updatedAt
  $bodyT5 = New-UpdateBody -Id $idBase -Sala $atual.sala -Data $atual.data -Inicio $atual.inicio -Fim $atual.fim -Turma $atual.turma -Observacao $atual.observacao
  $resT5  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT5 -ContentType 'text/plain'
  if ($resT5.ok -and $resT5.data.updatedAt -eq $updatedAtAntes) {
    Write-Host "OK — no-op: updatedAt preservado ($updatedAtAntes)" -ForegroundColor Green
  } else {
    Write-Host "ERRO — esperava no-op; updatedAt antes=$updatedAtAntes depois=$($resT5.data.updatedAt) (ok=$($resT5.ok))" -ForegroundColor Red
  }
}


# ── TESTE 6: owner-check — userEmail != createdBy → FORBIDDEN
Write-Host "`n--- TESTE 6: update com email errado (deve FORBIDDEN) ---" -ForegroundColor Cyan
$bodyT6 = New-UpdateBody -Id $idBase -Sala '604 Sala' -Data $dataT1 -Inicio '10:00' -Fim '11:00' -Turma 'ADS-A' -Email 'invasor@senai.edu'
$resT6  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT6 -ContentType 'text/plain'
if ($resT6.error.code -eq 'FORBIDDEN') {
  Write-Host "OK — FORBIDDEN como esperado" -ForegroundColor Green
} else {
  Write-Host "ERRO — esperava FORBIDDEN; veio ok=$($resT6.ok), code=$($resT6.error.code)" -ForegroundColor Red
}


# ── TESTE 7: editar reserva CANCELLED → VALIDATION
Write-Host "`n--- TESTE 7: cancela e tenta editar (deve VALIDATION) ---" -ForegroundColor Cyan
# Cria reserva nova, cancela, tenta editar
$dataT7  = Get-TestDate 100
$bodyT7Setup = New-CreateBody -Sala '605 Sala' -Data $dataT7 -Inicio '08:00' -Fim '09:00'
$resT7Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT7Setup -ContentType 'text/plain'
if (-not $resT7Setup.ok) {
  Write-Host "Setup T7 falhou: $($resT7Setup.error.code)" -ForegroundColor Red
} else {
  $idParaCancelar = $resT7Setup.data.id
  $resCancel = Invoke-RestMethod -Uri $URL -Method Post -Body (New-CancelBody -Id $idParaCancelar) -ContentType 'text/plain'
  if ($resCancel.ok -and $resCancel.data.status -eq 'CANCELLED') {
    Write-Host "Setup OK — $idParaCancelar cancelada" -ForegroundColor DarkGray
    $bodyT7 = New-UpdateBody -Id $idParaCancelar -Sala '605 Sala' -Data $dataT7 -Inicio '10:00' -Fim '11:00' -Turma 'ADS-A'
    $resT7  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT7 -ContentType 'text/plain'
    if ($resT7.error.code -eq 'VALIDATION' -and $resT7.error.message -like '*cancelada*') {
      Write-Host "OK — VALIDATION: $($resT7.error.message)" -ForegroundColor Green
    } else {
      Write-Host "ERRO — esperava VALIDATION/cancelada; veio code=$($resT7.error.code) msg=$($resT7.error.message)" -ForegroundColor Red
    }
  } else {
    Write-Host "Setup cancel T7 falhou — pulando" -ForegroundColor Red
  }
}


# ── TESTE 8: idempotência state-based — 2 chamadas idênticas → updatedAt NÃO muda na 2ª
Write-Host "`n--- TESTE 8: idempotencia state-based (2 chamadas identicas) ---" -ForegroundColor Cyan
# Edita pra valor distinto do atual (vai mudar updatedAt). Depois reenvia o MESMO payload.
$dataT8 = Get-TestDate 200
$bodyT8Setup = New-CreateBody -Sala '606 Sala' -Data $dataT8 -Inicio '08:00' -Fim '09:00'
$resT8Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8Setup -ContentType 'text/plain'
if (-not $resT8Setup.ok) {
  Write-Host "Setup T8 falhou: $($resT8Setup.error.code)" -ForegroundColor Red
} else {
  $idT8 = $resT8Setup.data.id
  # Edição real (vai mexer)
  $bodyT8a = New-UpdateBody -Id $idT8 -Sala '606 Sala' -Data $dataT8 -Inicio '15:00' -Fim '16:00' -Turma 'ADS-B'
  $resT8a  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8a -ContentType 'text/plain'
  $updatedAtT8a = $resT8a.data.updatedAt
  Write-Host "1a chamada: ok=$($resT8a.ok), updatedAt=$updatedAtT8a" -ForegroundColor DarkGray
  # Reenviar idêntico
  Start-Sleep -Milliseconds 1500
  $bodyT8b = New-UpdateBody -Id $idT8 -Sala '606 Sala' -Data $dataT8 -Inicio '15:00' -Fim '16:00' -Turma 'ADS-B'
  $resT8b  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8b -ContentType 'text/plain'
  Write-Host "2a chamada: ok=$($resT8b.ok), updatedAt=$($resT8b.data.updatedAt)" -ForegroundColor DarkGray
  if ($resT8b.ok -and $resT8b.data.updatedAt -eq $updatedAtT8a) {
    Write-Host "OK — state-based no-op: updatedAt preservado na 2a chamada" -ForegroundColor Green
  } else {
    Write-Host "ERRO — esperava updatedAt igual; antes=$updatedAtT8a depois=$($resT8b.data.updatedAt)" -ForegroundColor Red
  }
}


# ── TESTE 9: anti-regressao — createReservation ainda detecta CONFLICT
Write-Host "`n--- TESTE 9: anti-regressao create CONFLICT (Sprint 2 intacto) ---" -ForegroundColor Cyan
$dataT9 = Get-TestDate 300
$bodyT9a = New-CreateBody -Sala '607 Sala' -Data $dataT9 -Inicio '08:00' -Fim '09:00'
$resT9a  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT9a -ContentType 'text/plain'
if (-not $resT9a.ok) {
  Write-Host "Setup T9 falhou: $($resT9a.error.code)" -ForegroundColor Red
} else {
  $bodyT9b = New-CreateBody -Sala '607 Sala' -Data $dataT9 -Inicio '08:00' -Fim '09:00'
  $resT9b  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT9b -ContentType 'text/plain'
  if ($resT9b.error.code -eq 'CONFLICT') {
    Write-Host "OK — create CONFLICT segue funcionando" -ForegroundColor Green
  } else {
    Write-Host "ERRO — esperava CONFLICT; veio code=$($resT9b.error.code)" -ForegroundColor Red
  }
}


# ── TESTE 10: anti-regressao — cancelReservation ainda funciona
Write-Host "`n--- TESTE 10: anti-regressao cancel (Sprint 3 intacto) ---" -ForegroundColor Cyan
$dataT10 = Get-TestDate 400
$bodyT10Setup = New-CreateBody -Sala '608 Sala' -Data $dataT10 -Inicio '08:00' -Fim '09:00'
$resT10Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT10Setup -ContentType 'text/plain'
if (-not $resT10Setup.ok) {
  Write-Host "Setup T10 falhou: $($resT10Setup.error.code)" -ForegroundColor Red
} else {
  $idT10 = $resT10Setup.data.id
  $resT10 = Invoke-RestMethod -Uri $URL -Method Post -Body (New-CancelBody -Id $idT10) -ContentType 'text/plain'
  if ($resT10.ok -and $resT10.data.status -eq 'CANCELLED') {
    Write-Host "OK — cancel segue funcionando, status=CANCELLED" -ForegroundColor Green
  } else {
    Write-Host "ERRO — cancel: ok=$($resT10.ok) status=$($resT10.data.status) code=$($resT10.error.code)" -ForegroundColor Red
  }
}

Write-Host "`nFASE C1 — testes encerrados." -ForegroundColor Cyan
