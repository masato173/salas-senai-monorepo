# ============================================================
# Testes Sprint 4 — FASE A: groupId no schema + criação
# Uso: roda no PowerShell 7+ sequencialmente.
#
# Pré-requisitos:
#   1) Cabeçalho 'groupId' na célula N1 da aba "Reservas" da DEV.
#   2) codigo.gs.sprint4 colado no editor + Nova versão implantada.
# ============================================================

# Antes de rodar, defina (nunca hardcode aqui):
#   $env:APPS_SCRIPT_URL   = "https://script.google.com/macros/s/XXXX/exec"
#   $env:APPS_SCRIPT_TOKEN = "valor-aqui"
$URL   = $env:APPS_SCRIPT_URL
$TOKEN = $env:APPS_SCRIPT_TOKEN


# ── Datas únicas por execução ────────────────────────────────
# Base 2030 + random 0..730 dias (~2 anos). Re-execução idempotente.
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
    [string]$Data       = '2030-04-10',
    [string]$Inicio     = '08:00',
    [string]$Fim        = '09:00',
    [string]$Email      = 'owner.sprint4@senai.edu',
    [string]$Professor  = 'Sprint4 Owner',
    [string]$Turma      = 'ADS-A',
    [string]$Observacao = 'sprint4 faseA',
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
    [string]$Sala       = '608 Sala',
    [string]$DataInicio,
    [string]$DataFim,
    [int[]] $DiasSemana = @(1,3),   # seg + qua
    [string]$Inicio     = '14:00',
    [string]$Fim        = '15:00',
    [string]$Email      = 'range.sprint4@senai.edu',
    [string]$Professor  = 'Sprint4 Range',
    [string]$Turma      = 'ADS-B',
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
      observacao = 'sprint4 range'
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


# ── TESTE 1: createReservation única → groupId == id ──────────
Write-Host "`n--- TESTE 1: createReservation unica → groupId == id ---" -ForegroundColor Cyan
$body1 = New-CreateBody -Data (Get-TestDate 0) -Inicio '08:00' -Fim '09:00'
$res1  = Invoke-RestMethod -Uri $URL -Method Post -Body $body1 -ContentType 'text/plain'
$res1  | ConvertTo-Json -Depth 5
if (-not $res1.ok) {
  Write-Host "TESTE 1 FALHOU — nao deu pra criar." -ForegroundColor Red
  return
}
$idUnica = $res1.data.id
$groupIdUnica = $res1.data.groupId
if ($groupIdUnica -eq $idUnica -and -not [string]::IsNullOrWhiteSpace($groupIdUnica)) {
  Write-Host "OK — groupId == id ($groupIdUnica)" -ForegroundColor Green
} else {
  Write-Host "ERRO — esperava groupId==id; veio id=$idUnica, groupId=$groupIdUnica" -ForegroundColor Red
}


# ── TESTE 2: createReservationRange → todos com MESMO groupId ─
Write-Host "`n--- TESTE 2: createReservationRange → groupId compartilhado ---" -ForegroundColor Cyan
# Janela de 14 dias garante pelo menos 3-4 batidas com diasSemana=[1,3] (seg+qua).
$rangeStart = Get-TestDate 60
$rangeEnd   = Get-TestDate 73
$body2 = New-RangeBody -DataInicio $rangeStart -DataFim $rangeEnd
$res2  = Invoke-RestMethod -Uri $URL -Method Post -Body $body2 -ContentType 'text/plain'
$res2  | ConvertTo-Json -Depth 6
if (-not $res2.ok) {
  Write-Host "TESTE 2 FALHOU — range nao criou." -ForegroundColor Red
} else {
  $reservasRange = $res2.data.reservations
  $groupIds      = $reservasRange | ForEach-Object { $_.groupId } | Sort-Object -Unique
  if ($groupIds.Count -eq 1 -and -not [string]::IsNullOrWhiteSpace($groupIds[0])) {
    $groupIdRange = $groupIds[0]
    Write-Host "OK — todas as $($reservasRange.Count) reservas tem groupId=$groupIdRange" -ForegroundColor Green
    # Sanity: groupId NAO eh igual ao id de nenhuma linha (eh um UUID novo)
    $ids = $reservasRange | ForEach-Object { $_.id }
    if ($ids -contains $groupIdRange) {
      Write-Host "AVISO — groupId colide com algum id da linha (esperado: UUID novo)" -ForegroundColor Yellow
    } else {
      Write-Host "OK — groupId eh UUID independente dos ids das linhas" -ForegroundColor Green
    }
  } else {
    Write-Host "ERRO — esperava 1 groupId unico; veio $($groupIds.Count): $($groupIds -join ', ')" -ForegroundColor Red
  }
}


# ── TESTE 3: listReservations → cada reserva tem groupId ──────
Write-Host "`n--- TESTE 3: listReservations expoe groupId ---" -ForegroundColor Cyan
$res3 = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations" -Method Get
$encontrada1 = $res3.data.reservations | Where-Object { $_.id -eq $idUnica }
if ($encontrada1 -and $encontrada1.groupId -eq $idUnica) {
  Write-Host "OK — list devolve groupId da reserva unica (=$($encontrada1.groupId))" -ForegroundColor Green
} else {
  Write-Host "ERRO — reserva unica nao apareceu com groupId esperado" -ForegroundColor Red
}
if ($groupIdRange) {
  $matchRange = $res3.data.reservations | Where-Object { $_.groupId -eq $groupIdRange }
  if ($matchRange.Count -ge 1) {
    Write-Host "OK — list devolve $($matchRange.Count) reserva(s) do range com groupId=$groupIdRange" -ForegroundColor Green
  } else {
    Write-Host "ERRO — reservas do range nao apareceram no list" -ForegroundColor Red
  }
}


# ── TESTE 4: reserva legacy → groupId vazio (informativo) ─────
Write-Host "`n--- TESTE 4: legacy (sem col N) → groupId='' (informativo) ---" -ForegroundColor Cyan
$resAll = Invoke-RestMethod -Uri "${URL}?token=${TOKEN}&action=listReservations&includeCancelled=true" -Method Get
$legacy = $resAll.data.reservations | Where-Object { [string]::IsNullOrEmpty($_.groupId) } | Select-Object -First 3
if ($legacy) {
  Write-Host "OK — encontradas $($legacy.Count) reserva(s) legacy com groupId vazio (nao quebrou)" -ForegroundColor Green
  $legacy | ForEach-Object { Write-Host "  id=$($_.id) data=$($_.data) status=$($_.status) groupId='$($_.groupId)'" -ForegroundColor DarkGray }
} else {
  Write-Host "INFO — nenhuma reserva legacy na DEV (planilha pode ter sido limpa). Skip." -ForegroundColor DarkYellow
}


# ── TESTE 5: anti-regressao CONFLICT ──────────────────────────
Write-Host "`n--- TESTE 5: conflito ainda detectado (anti-regressao) ---" -ForegroundColor Cyan
$dataConf = Get-TestDate 5
$bodyA = New-CreateBody -Sala '610 Sala' -Data $dataConf -Inicio '10:00' -Fim '11:00'
$resA  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyA -ContentType 'text/plain'
if (-not $resA.ok) {
  Write-Host "Setup falhou: $($resA.error.code)" -ForegroundColor Red
} else {
  # mesma sala/data/hora — clientRequestId diferente pra forcar checkConflicts
  $bodyB = New-CreateBody -Sala '610 Sala' -Data $dataConf -Inicio '10:00' -Fim '11:00'
  $resB  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyB -ContentType 'text/plain'
  if ($resB.error.code -eq 'CONFLICT') {
    Write-Host "OK — CONFLICT detectado normalmente" -ForegroundColor Green
  } else {
    Write-Host "ERRO — esperava CONFLICT; veio ok=$($resB.ok) code=$($resB.error.code)" -ForegroundColor Red
  }
}


# ── TESTE 6: anti-regressao cancelReservation + groupId no retorno ─
Write-Host "`n--- TESTE 6: cancel funciona e resposta tem groupId ---" -ForegroundColor Cyan
$bodySetup6 = New-CreateBody -Sala '611 Sala' -Data (Get-TestDate 10) -Inicio '13:00' -Fim '14:00'
$resSetup6  = Invoke-RestMethod -Uri $URL -Method Post -Body $bodySetup6 -ContentType 'text/plain'
if (-not $resSetup6.ok) {
  Write-Host "Setup do TESTE 6 falhou: $($resSetup6.error.code)" -ForegroundColor Red
} else {
  $idCancelar      = $resSetup6.data.id
  $groupIdEsperado = $resSetup6.data.groupId
  $body6 = New-CancelBody -Id $idCancelar -Email 'owner.sprint4@senai.edu'
  $res6  = Invoke-RestMethod -Uri $URL -Method Post -Body $body6 -ContentType 'text/plain'
  if ($res6.ok -and $res6.data.status -eq 'CANCELLED' -and $res6.data.groupId -eq $groupIdEsperado) {
    Write-Host "OK — cancel ok, status=CANCELLED, groupId preservado ($($res6.data.groupId))" -ForegroundColor Green
  } else {
    Write-Host "ERRO — cancel inesperado: ok=$($res6.ok) status=$($res6.data.status) groupId=$($res6.data.groupId)" -ForegroundColor Red
  }
}


# ── TESTE 7: idempotencia createReservationRange preserva groupId ─
Write-Host "`n--- TESTE 7: idempotencia (range) preserva groupId ---" -ForegroundColor Cyan
$cidIdem = [guid]::NewGuid().ToString()
$body7a  = New-RangeBody -Sala '612 Sala' -DataInicio (Get-TestDate 100) -DataFim (Get-TestDate 110) -DiasSemana @(2,4) -ClientId $cidIdem
$res7a   = Invoke-RestMethod -Uri $URL -Method Post -Body $body7a -ContentType 'text/plain'
$res7b   = Invoke-RestMethod -Uri $URL -Method Post -Body $body7a -ContentType 'text/plain'
if ($res7a.ok -and $res7b.ok) {
  $gA = ($res7a.data.reservations | ForEach-Object { $_.groupId } | Sort-Object -Unique)
  $gB = ($res7b.data.reservations | ForEach-Object { $_.groupId } | Sort-Object -Unique)
  if ($gA.Count -eq 1 -and $gB.Count -eq 1 -and $gA[0] -eq $gB[0]) {
    Write-Host "OK — chamadas idempotentes devolvem mesmo groupId=$($gA[0])" -ForegroundColor Green
  } else {
    Write-Host "ERRO — groupId divergente entre chamadas idempotentes (a=$($gA -join ','), b=$($gB -join ','))" -ForegroundColor Red
  }
} else {
  Write-Host "ERRO — uma das chamadas idempotentes falhou (a.ok=$($res7a.ok), b.ok=$($res7b.ok))" -ForegroundColor Red
}

Write-Host "`nFASE A — testes encerrados." -ForegroundColor Cyan
