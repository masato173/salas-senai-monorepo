# ============================================================
# Testes Sprint 4 -- FASE C2: updateReservationGroup
# Uso: pwsh (PowerShell 7+). Idempotente entre runs (base 2030 + RUN_OFFSET).
#
# Pre-requisitos:
#   1) Fases A + C1 ja live.
#   2) codigo.gs.sprint4-C2 colado + Nova versao implantada.
#
# ATENCAO: todos os Write-Host usam ASCII puro (sem acentos, sem em-dash).
# Salvar este arquivo como UTF-8 sem BOM eh seguro pra ASCII puro.
# ============================================================

# Antes de rodar, defina (nunca hardcode aqui):
#   $env:APPS_SCRIPT_URL   = "https://script.google.com/macros/s/XXXX/exec"
#   $env:APPS_SCRIPT_TOKEN = "valor-aqui"
$URL   = $env:APPS_SCRIPT_URL
$TOKEN = $env:APPS_SCRIPT_TOKEN


# -- Datas unicas por execucao --------------------------------
$RUN_OFFSET = Get-Random -Minimum 0 -Maximum 730
$BASE_DATE  = (Get-Date '2030-01-01').AddDays($RUN_OFFSET)
Write-Host "RUN_OFFSET = $RUN_OFFSET dias (base $($BASE_DATE.ToString('yyyy-MM-dd')))" -ForegroundColor DarkGray

function Get-TestDate {
  param([int]$DayOffset = 0)
  $BASE_DATE.AddDays($DayOffset).ToString('yyyy-MM-dd')
}


# -- Helpers de body -------------------------------------------
function New-CreateBody {
  param(
    [string]$Sala       = '603 Sala',
    [string]$Data,
    [string]$Inicio     = '08:00',
    [string]$Fim        = '09:00',
    [string]$Email      = 'owner.c2@senai.edu',
    [string]$Professor  = 'C2 Owner',
    [string]$Turma      = 'ADS-A',
    [string]$Observacao = 'sprint4 c2 setup',
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

function New-RangeBody {
  param(
    [string]$Sala       = '610 Sala',
    [string]$DataInicio,
    [string]$DataFim,
    [int[]] $DiasSemana = @(1,3),
    [string]$Inicio     = '14:00',
    [string]$Fim        = '15:00',
    [string]$Email      = 'owner.c2@senai.edu',
    [string]$Professor  = 'C2 Owner',
    [string]$Turma      = 'ADS-B',
    [string]$Observacao = 'sprint4 c2 grupo',
    [string]$ClientId   = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'createReservationRange'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{
      sala       = $Sala
      dataInicio = $DataInicio
      dataFim    = $DataFim
      diasSemana = $DiasSemana
      inicio     = $Inicio
      fim        = $Fim
      professor  = $Professor
      turma      = $Turma
      observacao = $Observacao
    }
  } | ConvertTo-Json -Depth 5
}

function New-GroupUpdateBody {
  param(
    [string]$GroupId,
    [string]$Sala,
    [string]$Inicio,
    [string]$Fim,
    [string]$Turma,
    [string]$Observacao = '',
    [string]$Email      = 'owner.c2@senai.edu',
    [string]$ClientId   = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'updateReservationGroup'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{
      groupId    = $GroupId
      sala       = $Sala
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
    [string]$Email    = 'owner.c2@senai.edu',
    [string]$ClientId = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'cancelReservation'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{ id = $Id }
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
    [string]$Email      = 'owner.c2@senai.edu',
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


# -- TESTE 1: setup -- cria range de 3-5 datas (groupId compartilhado) --
Write-Host "`n--- TESTE 1: setup -- cria range pra ter grupo ---" -ForegroundColor Cyan
$rangeStart = Get-TestDate 0
$rangeEnd   = Get-TestDate 13   # 14 dias -> ~4 batidas com diasSemana=[1,3]
$bodyT1 = New-RangeBody -Sala '610 Sala' -DataInicio $rangeStart -DataFim $rangeEnd -DiasSemana @(1,3) -Inicio '14:00' -Fim '15:00'
$resT1  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT1 -ContentType 'text/plain'
if (-not $resT1.ok) {
  Write-Host "TESTE 1 FALHOU: $($resT1.error.code) -- abortando" -ForegroundColor Red
  return
}
$grupoT1     = $resT1.data.reservations
$groupIdT1   = $grupoT1[0].groupId
$countT1     = $grupoT1.Count
$datasT1     = ($grupoT1 | ForEach-Object { $_.data } | Sort-Object -Unique)
$idsGrupoT1  = ($grupoT1 | ForEach-Object { $_.id })
Write-Host "OK -- groupId=$groupIdT1 count=$countT1 datas=$($datasT1 -join ',')" -ForegroundColor Green


# -- TESTE 2: edita sala do grupo -> todas mudaram, datas preservadas --
Write-Host "`n--- TESTE 2: edita sala do grupo 610 -> 611 ---" -ForegroundColor Cyan
$bodyT2 = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '14:00' -Fim '15:00' -Turma 'ADS-B' -Observacao 'sprint4 c2 grupo'
$resT2  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT2 -ContentType 'text/plain'
if (-not $resT2.ok) {
  Write-Host "ERRO -- code=$($resT2.error.code) msg=$($resT2.error.message)" -ForegroundColor Red
} else {
  $todasComSalaNova = $true
  $datasPosT2 = ($resT2.data.reservations | ForEach-Object { $_.data } | Sort-Object -Unique)
  foreach ($r in $resT2.data.reservations) {
    if ($r.sala -ne '611 Sala') { $todasComSalaNova = $false; break }
  }
  $datasIguais = ($datasPosT2 -join ',') -eq ($datasT1 -join ',')
  if ($todasComSalaNova -and $datasIguais -and $resT2.data.count -eq $countT1) {
    Write-Host "OK -- $countT1 linhas atualizadas, sala=611, datas preservadas" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- salaNova=$todasComSalaNova datasIguais=$datasIguais count=$($resT2.data.count)" -ForegroundColor Red
  }
}


# -- TESTE 3: edita horario do grupo (sem conflito) -> todas mudaram --
Write-Host "`n--- TESTE 3: edita horario do grupo 14-15 -> 16-17 ---" -ForegroundColor Cyan
$bodyT3 = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'ADS-B' -Observacao 'sprint4 c2 grupo'
$resT3  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT3 -ContentType 'text/plain'
if ($resT3.ok) {
  $todasComHorarioNovo = $true
  foreach ($r in $resT3.data.reservations) {
    if ($r.inicio -ne '16:00' -or $r.fim -ne '17:00') { $todasComHorarioNovo = $false; break }
  }
  if ($todasComHorarioNovo) {
    Write-Host "OK -- horario atualizado em todas as $($resT3.data.count) linhas" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- alguma linha nao tem 16:00-17:00" -ForegroundColor Red
  }
} else {
  Write-Host "ERRO -- ok=false code=$($resT3.error.code)" -ForegroundColor Red
}


# -- TESTE 4: conflito em UMA data do grupo -> CONFLICT, NADA mudou --
Write-Host "`n--- TESTE 4: conflito em 1 data do grupo (atomico, nada muda) ---" -ForegroundColor Cyan
# Cria reserva ESTRANHA na primeira data do grupo, em 18:00-19:00 na sala 611
$dataConflito = $datasT1[0]
$bodyT4Setup  = New-CreateBody -Sala '611 Sala' -Data $dataConflito -Inicio '18:00' -Fim '19:00' -Email 'owner.c2@senai.edu'
$resT4Setup   = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT4Setup -ContentType 'text/plain'
if (-not $resT4Setup.ok) {
  Write-Host "Setup T4 falhou: $($resT4Setup.error.code) -- pulando" -ForegroundColor Yellow
} else {
  $idEstranho = $resT4Setup.data.id
  Write-Host "Setup OK -- reserva estranha $idEstranho em $dataConflito 18:00-19:00" -ForegroundColor DarkGray

  # Captura estado ANTES (vai checar que nao mudou)
  $resBefore = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
  $grupoAntes = $resBefore.data.reservations | Where-Object { $_.groupId -eq $groupIdT1 }
  $assinaturaAntes = ($grupoAntes | ForEach-Object { "$($_.id):$($_.inicio)-$($_.fim):$($_.updatedAt)" } | Sort-Object) -join '|'

  # Tenta editar grupo pra 18:00-19:00 (conflita com idEstranho em dataConflito)
  $bodyT4 = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '18:00' -Fim '19:00' -Turma 'ADS-B' -Observacao 'sprint4 c2 grupo'
  $resT4  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT4 -ContentType 'text/plain'

  if ($resT4.error.code -eq 'CONFLICT') {
    Write-Host "OK -- CONFLICT detectado, datas conflitantes: $($resT4.error.details.conflicts -join ',')" -ForegroundColor Green

    # Re-le e confirma que NENHUMA linha do grupo mudou
    $resAfter = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
    $grupoDepois = $resAfter.data.reservations | Where-Object { $_.groupId -eq $groupIdT1 }
    $assinaturaDepois = ($grupoDepois | ForEach-Object { "$($_.id):$($_.inicio)-$($_.fim):$($_.updatedAt)" } | Sort-Object) -join '|'

    if ($assinaturaAntes -eq $assinaturaDepois) {
      Write-Host "OK -- atomicidade: nenhuma linha do grupo mudou" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- alguma linha mudou apesar do CONFLICT" -ForegroundColor Red
      Write-Host "antes:  $assinaturaAntes" -ForegroundColor DarkGray
      Write-Host "depois: $assinaturaDepois" -ForegroundColor DarkGray
    }
  } else {
    Write-Host "ERRO -- esperava CONFLICT; veio ok=$($resT4.ok), code=$($resT4.error.code)" -ForegroundColor Red
  }
}


# -- TESTE 5: owner-check errado -> FORBIDDEN --
Write-Host "`n--- TESTE 5: update group com email errado (deve FORBIDDEN) ---" -ForegroundColor Cyan
$bodyT5 = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'ADS-B' -Email 'invasor@senai.edu'
$resT5  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT5 -ContentType 'text/plain'
if ($resT5.error.code -eq 'FORBIDDEN') {
  Write-Host "OK -- FORBIDDEN como esperado" -ForegroundColor Green
} else {
  Write-Host "ERRO -- esperava FORBIDDEN; veio code=$($resT5.error.code) ok=$($resT5.ok)" -ForegroundColor Red
}


# -- TESTE 6: 1 linha CANCELLED do grupo -> editar grupo so afeta as ACTIVE --
Write-Host "`n--- TESTE 6: cancela 1 linha do grupo, edita grupo (CANCELLED intacta) ---" -ForegroundColor Cyan
# Estado atual do grupo: 611 Sala / 16:00-17:00 / ADS-B (apos T3 / T4 atomico).
# Cancela a 1a linha do grupo.
$idParaCancelar = $idsGrupoT1[0]
$resCancelT6 = Invoke-RestMethod -Uri $URL -Method Post -Body (New-CancelBody -Id $idParaCancelar) -ContentType 'text/plain'
if (-not $resCancelT6.ok) {
  Write-Host "Setup T6 cancel falhou: $($resCancelT6.error.code) -- pulando" -ForegroundColor Yellow
} else {
  Write-Host "Setup OK -- linha $idParaCancelar cancelada" -ForegroundColor DarkGray

  # Captura updatedAt da cancelada
  $resListaT6a = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations&includeCancelled=true" -Method Get
  $canceladaAntes = $resListaT6a.data.reservations | Where-Object { $_.id -eq $idParaCancelar }
  $updatedAtCanceladaAntes = $canceladaAntes.updatedAt

  # Edita grupo pra turma nova (valor distinto pra forcar reescrita)
  $bodyT6 = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'ADS-C' -Observacao 'sprint4 c2 grupo'
  $resT6  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT6 -ContentType 'text/plain'

  if ($resT6.ok) {
    $countEsperado = $countT1 - 1
    if ($resT6.data.count -eq $countEsperado) {
      Write-Host "OK -- update afetou $($resT6.data.count) linhas (esperado $countEsperado = total - 1 cancelada)" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- update afetou $($resT6.data.count); esperado $countEsperado" -ForegroundColor Red
    }
    # Verifica que turma=ADS-C nas ACTIVE
    $todasTurmaC = $true
    foreach ($r in $resT6.data.reservations) {
      if ($r.turma -ne 'ADS-C') { $todasTurmaC = $false; break }
    }
    if ($todasTurmaC) {
      Write-Host "OK -- todas as ACTIVE retornadas tem turma=ADS-C" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- alguma ACTIVE nao tem turma=ADS-C" -ForegroundColor Red
    }
    # Verifica que CANCELLED ficou intacta (updatedAt nao mudou pelo group update)
    $resListaT6b = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations&includeCancelled=true" -Method Get
    $canceladaDepois = $resListaT6b.data.reservations | Where-Object { $_.id -eq $idParaCancelar }
    if ($canceladaDepois.status -eq 'CANCELLED' -and $canceladaDepois.turma -ne 'ADS-C' -and $canceladaDepois.updatedAt -eq $updatedAtCanceladaAntes) {
      Write-Host "OK -- linha CANCELLED intacta (status, turma, updatedAt preservados)" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- CANCELLED foi tocada: status=$($canceladaDepois.status) turma=$($canceladaDepois.turma) updatedAt_antes=$updatedAtCanceladaAntes updatedAt_depois=$($canceladaDepois.updatedAt)" -ForegroundColor Red
    }
  } else {
    Write-Host "ERRO -- update group falhou: code=$($resT6.error.code)" -ForegroundColor Red
  }
}


# -- TESTE 7: idempotencia state-based no grupo --
Write-Host "`n--- TESTE 7: idempotencia state-based (2 chamadas identicas) ---" -ForegroundColor Cyan
# Estado atual: grupo em 611 Sala / 16:00-17:00 / ADS-C (apos T6).
# Reenviar mesmo payload -> deve ser no-op (updatedAt preservado em todas).
$bodyT7a = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'ADS-C' -Observacao 'sprint4 c2 grupo'
$resT7a  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT7a -ContentType 'text/plain'
$updatedAtAntes = @{}
if ($resT7a.ok) {
  foreach ($r in $resT7a.data.reservations) { $updatedAtAntes[$r.id] = $r.updatedAt }
  Start-Sleep -Milliseconds 1500
  $bodyT7b = New-GroupUpdateBody -GroupId $groupIdT1 -Sala '611 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'ADS-C' -Observacao 'sprint4 c2 grupo'
  $resT7b  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT7b -ContentType 'text/plain'
  if ($resT7b.ok) {
    $allPreserved = $true
    foreach ($r in $resT7b.data.reservations) {
      if ($r.updatedAt -ne $updatedAtAntes[$r.id]) {
        $allPreserved = $false
        Write-Host "diverge id=$($r.id) antes=$($updatedAtAntes[$r.id]) depois=$($r.updatedAt)" -ForegroundColor DarkYellow
      }
    }
    if ($allPreserved) {
      Write-Host "OK -- no-op: updatedAt preservado em todas as $($resT7b.data.count) linhas" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- alguma linha teve updatedAt alterado na 2a chamada" -ForegroundColor Red
    }
  } else {
    Write-Host "ERRO 2a chamada -- code=$($resT7b.error.code)" -ForegroundColor Red
  }
} else {
  Write-Host "ERRO 1a chamada -- code=$($resT7a.error.code)" -ForegroundColor Red
}


# -- TESTE 8: anti-regressao -- createReservation CONFLICT ainda funciona --
Write-Host "`n--- TESTE 8: anti-regressao create CONFLICT (Sprint 2) ---" -ForegroundColor Cyan
$dataT8 = Get-TestDate 300
$bodyT8a = New-CreateBody -Sala '620 Sala' -Data $dataT8 -Inicio '08:00' -Fim '09:00'
$resT8a  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8a -ContentType 'text/plain'
if (-not $resT8a.ok) {
  Write-Host "Setup T8 falhou: $($resT8a.error.code)" -ForegroundColor Red
} else {
  $bodyT8b = New-CreateBody -Sala '620 Sala' -Data $dataT8 -Inicio '08:00' -Fim '09:00'
  $resT8b  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8b -ContentType 'text/plain'
  if ($resT8b.error.code -eq 'CONFLICT') {
    Write-Host "OK -- create CONFLICT segue funcionando" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- esperava CONFLICT; veio code=$($resT8b.error.code)" -ForegroundColor Red
  }
}


# -- TESTE 9: anti-regressao -- cancelReservation ainda funciona --
Write-Host "`n--- TESTE 9: anti-regressao cancel (Sprint 3) ---" -ForegroundColor Cyan
$dataT9 = Get-TestDate 400
$bodyT9Setup = New-CreateBody -Sala '621 Sala' -Data $dataT9 -Inicio '08:00' -Fim '09:00'
$resT9Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT9Setup -ContentType 'text/plain'
if (-not $resT9Setup.ok) {
  Write-Host "Setup T9 falhou: $($resT9Setup.error.code)" -ForegroundColor Red
} else {
  $idT9 = $resT9Setup.data.id
  $resT9 = Invoke-RestMethod -Uri $URL -Method Post -Body (New-CancelBody -Id $idT9) -ContentType 'text/plain'
  if ($resT9.ok -and $resT9.data.status -eq 'CANCELLED') {
    Write-Host "OK -- cancel segue funcionando" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- cancel: ok=$($resT9.ok) status=$($resT9.data.status)" -ForegroundColor Red
  }
}


# -- TESTE 10: anti-regressao -- updateReservation C1 ainda funciona --
Write-Host "`n--- TESTE 10: anti-regressao updateReservation unica (C1) ---" -ForegroundColor Cyan
$dataT10 = Get-TestDate 500
$bodyT10Setup = New-CreateBody -Sala '622 Sala' -Data $dataT10 -Inicio '08:00' -Fim '09:00'
$resT10Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT10Setup -ContentType 'text/plain'
if (-not $resT10Setup.ok) {
  Write-Host "Setup T10 falhou: $($resT10Setup.error.code)" -ForegroundColor Red
} else {
  $idT10 = $resT10Setup.data.id
  $bodyT10 = New-UpdateBody -Id $idT10 -Sala '623 Sala' -Data $dataT10 -Inicio '08:00' -Fim '09:00' -Turma 'ADS-A'
  $resT10  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT10 -ContentType 'text/plain'
  if ($resT10.ok -and $resT10.data.sala -eq '623 Sala') {
    Write-Host "OK -- updateReservation C1 segue funcionando, sala=623" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- update C1: ok=$($resT10.ok) sala=$($resT10.data.sala) code=$($resT10.error.code)" -ForegroundColor Red
  }
}

Write-Host "`nFASE C2 -- testes encerrados." -ForegroundColor Cyan
