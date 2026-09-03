# ============================================================
# Testes Sprint 4 -- FASE C3: updateReservationSelected
# Uso: pwsh (PowerShell 7+). Idempotente entre runs (base 2030 + RUN_OFFSET).
#
# Pre-requisitos:
#   1) Fases A + C1 + C2 ja live.
#   2) codigo.gs.sprint4-C3 colado + Nova versao implantada.
#
# ATENCAO: todos os Write-Host usam ASCII puro (sem acentos, sem em-dash).
# PowerShell 5.1 corrompe UTF-8 sem BOM -- rode SEMPRE com pwsh (PS7+).
#
# Marker pra limpeza/identificacao: turma comeca com "C3-TST-" em todos os setups.
# Permite filtrar/deletar reservas de teste depois (limpeza eventual da DEV).
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
    [string]$Email      = 'owner.c3@senai.edu',
    [string]$Professor  = 'C3 Owner',
    [string]$Turma      = 'C3-TST-A',
    [string]$Observacao = 'sprint4 c3 setup',
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
    [string]$Sala       = '630 Sala',
    [string]$DataInicio,
    [string]$DataFim,
    [int[]] $DiasSemana = @(1,2,3,4,5),
    [string]$Inicio     = '14:00',
    [string]$Fim        = '15:00',
    [string]$Email      = 'owner.c3@senai.edu',
    [string]$Professor  = 'C3 Owner',
    [string]$Turma      = 'C3-TST-RANGE',
    [string]$Observacao = 'sprint4 c3 grupo',
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

function New-SelectedUpdateBody {
  param(
    [string[]]$Ids,
    [string]$Sala,
    [string]$Inicio,
    [string]$Fim,
    [string]$Turma,
    [string]$Observacao = '',
    [string]$Email      = 'owner.c3@senai.edu',
    [string]$ClientId   = ([guid]::NewGuid().ToString())
  )
  @{
    action          = 'updateReservationSelected'
    clientRequestId = $ClientId
    userEmail       = $Email
    payload         = @{
      ids        = $Ids
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
    [string]$Email    = 'owner.c3@senai.edu',
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
    [string]$Email      = 'owner.c3@senai.edu',
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

function New-GroupUpdateBody {
  param(
    [string]$GroupId,
    [string]$Sala,
    [string]$Inicio,
    [string]$Fim,
    [string]$Turma,
    [string]$Observacao = '',
    [string]$Email      = 'owner.c3@senai.edu',
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


# -- TESTE 1: setup -- cria range de 5 datas (mesmo groupId) --
Write-Host "`n--- TESTE 1: setup -- cria range de 5 datas (mesmo groupId) ---" -ForegroundColor Cyan
$rangeStart = Get-TestDate 0
$rangeEnd   = Get-TestDate 13
$bodyT1 = New-RangeBody -Sala '630 Sala' -DataInicio $rangeStart -DataFim $rangeEnd -DiasSemana @(1,2,3,4,5) -Inicio '14:00' -Fim '15:00' -Turma 'C3-TST-T1'
$resT1  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT1 -ContentType 'text/plain'
if (-not $resT1.ok) {
  Write-Host "TESTE 1 FALHOU: $($resT1.error.code) -- abortando" -ForegroundColor Red
  return
}
$grupoT1 = $resT1.data.reservations | Sort-Object data
$totalT1 = $grupoT1.Count
if ($totalT1 -lt 5) {
  Write-Host "TESTE 1 ABORTADO -- esperava >= 5 datas; veio $totalT1." -ForegroundColor Red
  return
}
$groupIdOriginal = $grupoT1[0].groupId
$idsTodos = $grupoT1 | ForEach-Object { $_.id }
Write-Host ("OK -- groupIdOriginal={0} count={1}" -f $groupIdOriginal, $totalT1) -ForegroundColor Green
Write-Host "  datas: $(($grupoT1 | ForEach-Object { $_.data }) -join ', ')" -ForegroundColor DarkGray


# -- TESTE 2: remaneja 2 de 5 -> novo UUID compartilhado (PONTO A) --
Write-Host "`n--- TESTE 2: remaneja 2 de 5 (UUID compartilhado != original) ---" -ForegroundColor Cyan
$idsSelecT2 = @($idsTodos[0], $idsTodos[1])
$bodyT2 = New-SelectedUpdateBody -Ids $idsSelecT2 -Sala '631 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'C3-TST-T2-REM' -Observacao 'remanejado T2'
$resT2  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT2 -ContentType 'text/plain'

if (-not $resT2.ok) {
  Write-Host "ERRO -- code=$($resT2.error.code) msg=$($resT2.error.message)" -ForegroundColor Red
} else {
  $rem = $resT2.data.reservations
  # PONTO A: mesmo UUID entre as 2 selecionadas, E != original
  $groupIdsRem = ($rem | ForEach-Object { $_.groupId } | Sort-Object -Unique)
  if ($groupIdsRem.Count -eq 1 -and $groupIdsRem[0] -ne $groupIdOriginal -and -not [string]::IsNullOrWhiteSpace($groupIdsRem[0])) {
    $newUuidT2 = [string]($groupIdsRem | Select-Object -First 1)
    Write-Host ("OK -- 2 selecionadas com MESMO groupId novo: {0}" -f $newUuidT2) -ForegroundColor Green
    Write-Host ("  (!= original {0})" -f $groupIdOriginal) -ForegroundColor DarkGray
  } else {
    Write-Host "ERRO -- groupIds das remanejadas: $($groupIdsRem -join ',') (original: $groupIdOriginal)" -ForegroundColor Red
  }

  # Asserts adicionais: sala/horario/turma novos
  $todasComSalaNova = ($rem | Where-Object { $_.sala -ne '631 Sala' }).Count -eq 0
  $todasComHorarioNovo = ($rem | Where-Object { $_.inicio -ne '16:00' -or $_.fim -ne '17:00' }).Count -eq 0
  if ($todasComSalaNova -and $todasComHorarioNovo) {
    Write-Host "OK -- 2 remanejadas com sala/horario novos" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- sala/horario nao aplicados em todas" -ForegroundColor Red
  }

  # Verifica origem ($totalT1 - 2 restantes mantem groupIdOriginal)
  $origemEsperada = $totalT1 - 2
  $resLista = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
  $origemAtual = $resLista.data.reservations | Where-Object { $_.groupId -eq $groupIdOriginal }
  if ($origemAtual.Count -eq $origemEsperada) {
    Write-Host ("OK -- origem manteve {0} linha(s) com groupIdOriginal" -f $origemEsperada) -ForegroundColor Green
  } else {
    Write-Host ("ERRO -- origem esperada={0}, veio {1}" -f $origemEsperada, $origemAtual.Count) -ForegroundColor Red
  }
}


# -- TESTE 3: remaneja 1 -> vira unica (groupId == proprio id) --
Write-Host "`n--- TESTE 3: remaneja 1 (S=1 -> groupId == proprio id) ---" -ForegroundColor Cyan
$idSelecT3 = $idsTodos[2]
$bodyT3 = New-SelectedUpdateBody -Ids @($idSelecT3) -Sala '632 Sala' -Inicio '18:00' -Fim '19:00' -Turma 'C3-TST-T3-UNICA' -Observacao 'unica T3'
$resT3  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT3 -ContentType 'text/plain'

if (-not $resT3.ok) {
  Write-Host "ERRO -- code=$($resT3.error.code) msg=$($resT3.error.message)" -ForegroundColor Red
} else {
  $unica = $resT3.data.reservations[0]
  if ($unica.id -eq $unica.groupId) {
    Write-Host "OK -- S=1: groupId == id == $($unica.id)" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- esperava groupId==id; id=$($unica.id) groupId=$($unica.groupId)" -ForegroundColor Red
  }
}


# -- TESTE 4: conflito atomico (ZERO-write) --
Write-Host "`n--- TESTE 4: conflito atomico (zero-write quando 1 conflita) ---" -ForegroundColor Cyan
# Estado atual: ids[3] e ids[4] ainda no grupo original
$dadosOrig = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
$linhaT4a  = $dadosOrig.data.reservations | Where-Object { $_.id -eq $idsTodos[3] }
$linhaT4b  = $dadosOrig.data.reservations | Where-Object { $_.id -eq $idsTodos[4] }
if (-not $linhaT4a -or -not $linhaT4b) {
  Write-Host "Setup T4 incompleto -- ids[3]/ids[4] sumiram. Skip." -ForegroundColor Yellow
} else {
  # Cria reserva conflitante na data de ids[3], em 640 Sala / 20:00-21:00
  $bodyExtra = New-CreateBody -Sala '640 Sala' -Data $linhaT4a.data -Inicio '20:00' -Fim '21:00' -Turma 'C3-TST-T4-EXTRA'
  $resExtra  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyExtra -ContentType 'text/plain'
  if (-not $resExtra.ok) {
    Write-Host "Setup T4 falhou: $($resExtra.error.code). Skip." -ForegroundColor Yellow
  } else {
    # Captura assinatura ANTES de TODAS as duas linhas do grupo (ids[3] e ids[4])
    $assinaturaAntes = ($dadosOrig.data.reservations |
      Where-Object { $_.id -eq $idsTodos[3] -or $_.id -eq $idsTodos[4] } |
      ForEach-Object { "$($_.id)|$($_.sala)|$($_.data)|$($_.inicio)|$($_.fim)|$($_.turma)|$($_.observacao)|$($_.updatedAt)|$($_.groupId)" } |
      Sort-Object) -join "`n"

    # Tenta remanejar ids[3] + ids[4] pra 640/20:00-21:00 (conflita com idExtra na data de ids[3])
    $bodyT4 = New-SelectedUpdateBody -Ids @($idsTodos[3], $idsTodos[4]) -Sala '640 Sala' -Inicio '20:00' -Fim '21:00' -Turma 'C3-TST-T4-REM'
    $resT4  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT4 -ContentType 'text/plain'

    if ($resT4.error.code -eq 'CONFLICT') {
      $datasConflito = $resT4.error.details.conflicts
      Write-Host "OK -- CONFLICT detectado, datas: $($datasConflito -join ', ')" -ForegroundColor Green

      # Zero-write check: re-le e compara assinatura
      $dadosDepois = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
      $assinaturaDepois = ($dadosDepois.data.reservations |
        Where-Object { $_.id -eq $idsTodos[3] -or $_.id -eq $idsTodos[4] } |
        ForEach-Object { "$($_.id)|$($_.sala)|$($_.data)|$($_.inicio)|$($_.fim)|$($_.turma)|$($_.observacao)|$($_.updatedAt)|$($_.groupId)" } |
        Sort-Object) -join "`n"

      if ($assinaturaAntes -eq $assinaturaDepois) {
        Write-Host "OK -- ZERO-WRITE: ids[3]/ids[4] intactos pos CONFLICT (assinatura exata preservada)" -ForegroundColor Green
      } else {
        Write-Host "ERRO -- alguma linha mudou apesar do CONFLICT" -ForegroundColor Red
        Write-Host "antes:`n$assinaturaAntes" -ForegroundColor DarkGray
        Write-Host "depois:`n$assinaturaDepois" -ForegroundColor DarkGray
      }
    } else {
      Write-Host "ERRO -- esperava CONFLICT; veio ok=$($resT4.ok), code=$($resT4.error.code)" -ForegroundColor Red
    }
  }
}


# -- TESTE 5: ids de grupos diferentes -> VALIDATION --
Write-Host "`n--- TESTE 5: ids de grupos diferentes (deve VALIDATION) ---" -ForegroundColor Cyan
# Mistura: ids[3] (ainda no groupIdOriginal) + ids[0] (ja em novo UUID do T2)
$bodyT5 = New-SelectedUpdateBody -Ids @($idsTodos[3], $idsTodos[0]) -Sala '633 Sala' -Inicio '10:00' -Fim '11:00' -Turma 'C3-TST-T5'
$resT5  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT5 -ContentType 'text/plain'
if ($resT5.error.code -eq 'VALIDATION' -and $resT5.error.message -like '*mesmo grupo*') {
  Write-Host "OK -- VALIDATION: $($resT5.error.message)" -ForegroundColor Green
} else {
  Write-Host "ERRO -- esperava VALIDATION/mesmo grupo; veio code=$($resT5.error.code) msg=$($resT5.error.message)" -ForegroundColor Red
}


# -- TESTE 6: owner errado -> FORBIDDEN --
Write-Host "`n--- TESTE 6: owner errado (deve FORBIDDEN) ---" -ForegroundColor Cyan
$bodyT6 = New-SelectedUpdateBody -Ids @($idsTodos[3], $idsTodos[4]) -Sala '634 Sala' -Inicio '10:00' -Fim '11:00' -Turma 'C3-TST-T6' -Email 'invasor@senai.edu'
$resT6  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT6 -ContentType 'text/plain'
if ($resT6.error.code -eq 'FORBIDDEN') {
  Write-Host "OK -- FORBIDDEN como esperado" -ForegroundColor Green
} else {
  Write-Host "ERRO -- esperava FORBIDDEN; veio code=$($resT6.error.code)" -ForegroundColor Red
}


# -- TESTE 7: inclui id CANCELLED -> VALIDATION --
Write-Host "`n--- TESTE 7: inclui id CANCELLED na selecao (deve VALIDATION) ---" -ForegroundColor Cyan
$dataT7 = Get-TestDate 200
$bodyT7Setup = New-CreateBody -Sala '650 Sala' -Data $dataT7 -Inicio '08:00' -Fim '09:00' -Turma 'C3-TST-T7-CANCEL'
$resT7Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT7Setup -ContentType 'text/plain'
if (-not $resT7Setup.ok) {
  Write-Host "Setup T7 (create) falhou. Skip." -ForegroundColor Yellow
} else {
  $idParaCancelar = $resT7Setup.data.id
  $resCancelT7 = Invoke-RestMethod -Uri $URL -Method Post -Body (New-CancelBody -Id $idParaCancelar) -ContentType 'text/plain'
  if (-not $resCancelT7.ok) {
    Write-Host "Setup T7 (cancel) falhou. Skip." -ForegroundColor Yellow
  } else {
    # NOTA: a reserva cancelada eh de grupo diferente (groupId == id, por C3 N=1?
    # nao -- aqui eh um create unica simples, groupId == id desde Fase A).
    # Vai falhar PRIMEIRO em "mesmo grupo" ou "ativas"? Backend checa ACTIVE antes
    # de groupId (ver fluxo do BLOCO 3). Esperamos VALIDATION/ativas.
    $bodyT7 = New-SelectedUpdateBody -Ids @($idsTodos[3], $idParaCancelar) -Sala '635 Sala' -Inicio '10:00' -Fim '11:00' -Turma 'C3-TST-T7'
    $resT7  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT7 -ContentType 'text/plain'
    if ($resT7.error.code -eq 'VALIDATION' -and $resT7.error.message -like '*ativas*') {
      Write-Host "OK -- VALIDATION: $($resT7.error.message)" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- esperava VALIDATION/ativas; veio code=$($resT7.error.code) msg=$($resT7.error.message)" -ForegroundColor Red
    }
  }
}


# -- TESTE 8: origem resta 1 -> origem vira unica, sem corrupcao de data/hora --
Write-Host "`n--- TESTE 8: origem resta 1 (vira unica; data/hora NAO mudam) ---" -ForegroundColor Cyan
# Range independente (T1 ja foi consumido pelos testes 2/3)
$rangeStartT8 = Get-TestDate 300
$rangeEndT8   = Get-TestDate 313
$bodyT8Setup = New-RangeBody -Sala '660 Sala' -DataInicio $rangeStartT8 -DataFim $rangeEndT8 -DiasSemana @(1,2,3,4,5) -Inicio '14:00' -Fim '15:00' -Turma 'C3-TST-T8'
$resT8Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8Setup -ContentType 'text/plain'
if (-not $resT8Setup.ok -or $resT8Setup.data.reservations.Count -lt 2) {
  Write-Host "Setup T8 falhou ou < 2 datas. Skip." -ForegroundColor Yellow
} else {
  $grupoT8 = $resT8Setup.data.reservations | Sort-Object data
  $totalT8 = $grupoT8.Count
  $groupIdT8 = $grupoT8[0].groupId
  $idsTodosT8 = $grupoT8 | ForEach-Object { $_.id }
  $idOrigemSoUm = $idsTodosT8[$totalT8 - 1]   # ultimo da lista vira a origem

  # Captura SNAPSHOT da linha de origem ANTES (data, inicio, fim, sala, turma, observacao)
  $origemAntes = $grupoT8 | Where-Object { $_.id -eq $idOrigemSoUm } | Select-Object -First 1
  $dataOrigemAntes      = $origemAntes.data
  $inicioOrigemAntes    = $origemAntes.inicio
  $fimOrigemAntes       = $origemAntes.fim
  $salaOrigemAntes      = $origemAntes.sala
  $turmaOrigemAntes     = $origemAntes.turma
  $observacaoOrigAntes  = $origemAntes.observacao
  $updatedAtOrigemAntes = $origemAntes.updatedAt

  # Remaneja (totalT8 - 1) ids (sobra exatamente 1 -- forca o caminho "origem resta 1")
  $idsSelecT8 = $idsTodosT8[0..($totalT8 - 2)]
  $bodyT8 = New-SelectedUpdateBody -Ids $idsSelecT8 -Sala '661 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'C3-TST-T8-REM'
  $resT8  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT8 -ContentType 'text/plain'

  if (-not $resT8.ok) {
    Write-Host "ERRO update T8 -- code=$($resT8.error.code) msg=$($resT8.error.message)" -ForegroundColor Red
  } else {
    # selecionadas (totalT8-1) com mesmo novo UUID, != groupIdT8
    $newUuidT8arr = ($resT8.data.reservations | ForEach-Object { $_.groupId } | Sort-Object -Unique)
    if ($newUuidT8arr.Count -eq 1 -and $newUuidT8arr[0] -ne $groupIdT8 -and -not [string]::IsNullOrWhiteSpace($newUuidT8arr[0])) {
      $newUuidT8 = [string]($newUuidT8arr | Select-Object -First 1)
      Write-Host ("OK -- {0} selecionadas com novo UUID compartilhado: {1}" -f ($totalT8 - 1), $newUuidT8) -ForegroundColor Green
    } else {
      Write-Host "ERRO -- selecionadas nao compartilham 1 UUID novo" -ForegroundColor Red
    }

    # Origem (idOrigemSoUm) DEPOIS: groupId == proprio id; data/hora/sala/turma/observacao IGUAIS ao antes
    $resListaT8 = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
    $origemDepois = $resListaT8.data.reservations | Where-Object { $_.id -eq $idOrigemSoUm }

    $virouUnica       = ($origemDepois.groupId -eq $idOrigemSoUm)
    $dataPreservada   = ($origemDepois.data       -eq $dataOrigemAntes)
    $inicioPreservado = ($origemDepois.inicio     -eq $inicioOrigemAntes)
    $fimPreservado    = ($origemDepois.fim        -eq $fimOrigemAntes)
    $salaPreservada   = ($origemDepois.sala       -eq $salaOrigemAntes)
    $turmaPreservada  = ($origemDepois.turma      -eq $turmaOrigemAntes)
    $obsPreservada    = ($origemDepois.observacao -eq $observacaoOrigAntes)
    $updatedAtMudou   = ($origemDepois.updatedAt  -ne $updatedAtOrigemAntes)

    if ($virouUnica) {
      Write-Host ("OK -- origem virou unica (groupId == id == {0})" -f $idOrigemSoUm) -ForegroundColor Green
    } else {
      Write-Host "ERRO -- origem nao virou unica; groupId=$($origemDepois.groupId)" -ForegroundColor Red
    }

    if ($dataPreservada -and $inicioPreservado -and $fimPreservado -and $salaPreservada -and $turmaPreservada -and $obsPreservada) {
      Write-Host "OK -- origem: data/hora/sala/turma/observacao PRESERVADAS (so groupId/updatedAt mudaram)" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- alguma propriedade da origem foi corrompida:" -ForegroundColor Red
      Write-Host "  data:       antes=$dataOrigemAntes      depois=$($origemDepois.data)" -ForegroundColor DarkGray
      Write-Host "  inicio:     antes=$inicioOrigemAntes    depois=$($origemDepois.inicio)" -ForegroundColor DarkGray
      Write-Host "  fim:        antes=$fimOrigemAntes       depois=$($origemDepois.fim)" -ForegroundColor DarkGray
      Write-Host "  sala:       antes=$salaOrigemAntes      depois=$($origemDepois.sala)" -ForegroundColor DarkGray
      Write-Host "  turma:      antes=$turmaOrigemAntes     depois=$($origemDepois.turma)" -ForegroundColor DarkGray
      Write-Host "  observacao: antes=$observacaoOrigAntes  depois=$($origemDepois.observacao)" -ForegroundColor DarkGray
    }

    if ($updatedAtMudou) {
      Write-Host "OK -- origem.updatedAt avancou (write da origem ocorreu)" -ForegroundColor Green
    } else {
      Write-Host "ERRO -- origem.updatedAt NAO mudou; deveria refletir o write do groupId" -ForegroundColor Red
    }
  }
}


# -- TESTE 9: caso D -- selecionar TODAS as ACTIVE -> VALIDATION --
Write-Host "`n--- TESTE 9: selecionar grupo inteiro (deve VALIDATION) ---" -ForegroundColor Cyan
$rangeStartT9 = Get-TestDate 500
$rangeEndT9   = Get-TestDate 507
$bodyT9Setup = New-RangeBody -Sala '670 Sala' -DataInicio $rangeStartT9 -DataFim $rangeEndT9 -DiasSemana @(1,3) -Inicio '14:00' -Fim '15:00' -Turma 'C3-TST-T9'
$resT9Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT9Setup -ContentType 'text/plain'
if (-not $resT9Setup.ok) {
  Write-Host "Setup T9 falhou. Skip." -ForegroundColor Yellow
} else {
  $idsTodosT9 = $resT9Setup.data.reservations | ForEach-Object { $_.id }
  $bodyT9 = New-SelectedUpdateBody -Ids $idsTodosT9 -Sala '671 Sala' -Inicio '18:00' -Fim '19:00' -Turma 'C3-TST-T9-REM'
  $resT9  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT9 -ContentType 'text/plain'
  if ($resT9.error.code -eq 'VALIDATION' -and $resT9.error.message -like '*grupo inteiro*') {
    Write-Host "OK -- VALIDATION: $($resT9.error.message)" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- esperava VALIDATION/grupo inteiro; veio code=$($resT9.error.code) msg=$($resT9.error.message)" -ForegroundColor Red
  }
}


# -- TESTE 10: anti-regressao create CONFLICT --
Write-Host "`n--- TESTE 10: anti-regressao create CONFLICT (Sprint 2) ---" -ForegroundColor Cyan
$dataT10 = Get-TestDate 600
$bodyT10a = New-CreateBody -Sala '680 Sala' -Data $dataT10 -Inicio '08:00' -Fim '09:00' -Turma 'C3-TST-T10'
$resT10a  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT10a -ContentType 'text/plain'
if (-not $resT10a.ok) {
  Write-Host "Setup T10 falhou: $($resT10a.error.code)" -ForegroundColor Red
} else {
  $bodyT10b = New-CreateBody -Sala '680 Sala' -Data $dataT10 -Inicio '08:00' -Fim '09:00' -Turma 'C3-TST-T10'
  $resT10b  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT10b -ContentType 'text/plain'
  if ($resT10b.error.code -eq 'CONFLICT') {
    Write-Host "OK -- create CONFLICT segue funcionando" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- esperava CONFLICT; veio code=$($resT10b.error.code)" -ForegroundColor Red
  }
}


# -- TESTE 11: anti-regressao cancel --
Write-Host "`n--- TESTE 11: anti-regressao cancel (Sprint 3) ---" -ForegroundColor Cyan
$dataT11 = Get-TestDate 700
$bodyT11Setup = New-CreateBody -Sala '681 Sala' -Data $dataT11 -Inicio '08:00' -Fim '09:00' -Turma 'C3-TST-T11'
$resT11Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT11Setup -ContentType 'text/plain'
if (-not $resT11Setup.ok) {
  Write-Host "Setup T11 falhou: $($resT11Setup.error.code)" -ForegroundColor Red
} else {
  $idT11 = $resT11Setup.data.id
  $resT11 = Invoke-RestMethod -Uri $URL -Method Post -Body (New-CancelBody -Id $idT11) -ContentType 'text/plain'
  if ($resT11.ok -and $resT11.data.status -eq 'CANCELLED') {
    Write-Host "OK -- cancel segue funcionando" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- cancel: ok=$($resT11.ok) status=$($resT11.data.status)" -ForegroundColor Red
  }
}


# -- TESTE 12: anti-regressao updateReservation C1 --
Write-Host "`n--- TESTE 12: anti-regressao updateReservation C1 (Sprint 4 C1) ---" -ForegroundColor Cyan
$dataT12 = Get-TestDate 800
$bodyT12Setup = New-CreateBody -Sala '682 Sala' -Data $dataT12 -Inicio '08:00' -Fim '09:00' -Turma 'C3-TST-T12'
$resT12Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT12Setup -ContentType 'text/plain'
if (-not $resT12Setup.ok) {
  Write-Host "Setup T12 falhou: $($resT12Setup.error.code)" -ForegroundColor Red
} else {
  $idT12 = $resT12Setup.data.id
  $bodyT12 = New-UpdateBody -Id $idT12 -Sala '683 Sala' -Data $dataT12 -Inicio '08:00' -Fim '09:00' -Turma 'C3-TST-T12-EDIT'
  $resT12  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT12 -ContentType 'text/plain'
  if ($resT12.ok -and $resT12.data.sala -eq '683 Sala') {
    Write-Host "OK -- update C1 segue funcionando, sala=683" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- update C1: ok=$($resT12.ok) sala=$($resT12.data.sala) code=$($resT12.error.code)" -ForegroundColor Red
  }
}


# -- TESTE 13: anti-regressao updateReservationGroup C2 --
Write-Host "`n--- TESTE 13: anti-regressao updateReservationGroup C2 (Sprint 4 C2) ---" -ForegroundColor Cyan
$rangeStartT13 = Get-TestDate 900
$rangeEndT13   = Get-TestDate 906
$bodyT13Setup = New-RangeBody -Sala '690 Sala' -DataInicio $rangeStartT13 -DataFim $rangeEndT13 -DiasSemana @(1,3) -Inicio '14:00' -Fim '15:00' -Turma 'C3-TST-T13'
$resT13Setup  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT13Setup -ContentType 'text/plain'
if (-not $resT13Setup.ok) {
  Write-Host "Setup T13 falhou: $($resT13Setup.error.code)" -ForegroundColor Red
} else {
  $groupIdT13 = $resT13Setup.data.reservations[0].groupId
  $bodyT13 = New-GroupUpdateBody -GroupId $groupIdT13 -Sala '691 Sala' -Inicio '16:00' -Fim '17:00' -Turma 'C3-TST-T13-EDIT'
  $resT13  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyT13 -ContentType 'text/plain'
  if ($resT13.ok -and ($resT13.data.reservations | Where-Object { $_.sala -ne '691 Sala' }).Count -eq 0) {
    Write-Host "OK -- update group C2 segue funcionando ($($resT13.data.count) linhas em 691 Sala)" -ForegroundColor Green
  } else {
    Write-Host "ERRO -- update C2: ok=$($resT13.ok) count=$($resT13.data.count) code=$($resT13.error.code)" -ForegroundColor Red
  }
}

Write-Host "`nFASE C3 -- testes encerrados." -ForegroundColor Cyan
