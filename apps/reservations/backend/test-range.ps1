# ============================================================
# Testes da função createReservationRange (Etapa 1 backend)
# Uso: roda no PowerShell 7+ sequencialmente.
# Entre TESTE 2 e TESTE 3, abra a aba "Reservas" na planilha
# e confirme visualmente que não houve duplicação.
# ============================================================

# Antes de rodar, defina (nunca hardcode aqui):
#   $env:APPS_SCRIPT_URL = "https://script.google.com/macros/s/XXXX/exec"
$URL = $env:APPS_SCRIPT_URL


# ── Helper: monta o body JSON ─────────────────────────────────
function New-RangeBody {
  param(
    [string]$ClientId       = ([guid]::NewGuid().ToString()),
    [string]$Sala           = '603 Sala',
    [string]$DataInicio     = '2026-12-10',
    [string]$DataFim        = '2026-12-15',
    [int[]] $DiasSemana     = @(2, 4),     # ter, qui
    [string]$Inicio         = '08:00',
    [string]$Fim            = '10:00',
    [string]$Professor      = 'Teste Range',
    [string]$Turma          = 'ADS-A',
    [string]$Observacao     = 'reserva em periodo'
  )
  @{
    action          = 'createReservationRange'
    clientRequestId = $ClientId
    userEmail       = 'teste@senai.edu'
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


# ── TESTE 1: sucesso — cria 2 reservas (ter + qui entre 10 e 15/dez) ────
Write-Host "`n--- TESTE 1: sucesso (2 reservas) ---" -ForegroundColor Cyan
$body1 = New-RangeBody
$res1  = Invoke-RestMethod -Uri $URL -Method Post -Body $body1 -ContentType 'text/plain'
$res1 | ConvertTo-Json -Depth 10
# Esperado: ok=true, data.count=2, data.reservations array com 2 itens
# Datas: 2026-12-10 (qui) e 2026-12-15 (ter)


# ── TESTE 2: idempotência — repete com mesmo clientId ────
Write-Host "`n--- TESTE 2: idempotencia (mesmo clientId, mesmo retorno) ---" -ForegroundColor Cyan
$id      = [guid]::NewGuid().ToString()
$body2a  = New-RangeBody -ClientId $id -Sala '605 Sala' -DataInicio '2027-01-04' -DataFim '2027-01-08' -DiasSemana @(1,3,5) -Inicio '14:00' -Fim '15:30'
$res2a   = Invoke-RestMethod -Uri $URL -Method Post -Body $body2a -ContentType 'text/plain'
$res2b   = Invoke-RestMethod -Uri $URL -Method Post -Body $body2a -ContentType 'text/plain'   # mesmo body, mesmo clientId
Write-Host "1a chamada count: $($res2a.data.count)"
Write-Host "2a chamada count: $($res2b.data.count)"
# Esperado: ambos data.count iguais. Confirma na planilha que NAO existem rows duplicadas.


# ── TESTE 3: conflito — sobrepõe horario do TESTE 1 ────
Write-Host "`n--- TESTE 3: conflito (deve rejeitar tudo) ---" -ForegroundColor Cyan
$body3 = New-RangeBody -Sala '603 Sala' -DataInicio '2026-12-10' -DataFim '2026-12-15' -DiasSemana @(2,4) -Inicio '08:30' -Fim '09:30'
$res3  = Invoke-RestMethod -Uri $URL -Method Post -Body $body3 -ContentType 'text/plain'
$res3 | ConvertTo-Json -Depth 10
# Esperado: ok=false, error.code='CONFLICT', error.details.conflicts contem datas que colidem
# CONFIRMAR na planilha: NENHUMA linha do TESTE 3 foi gravada


# ── TESTE 4: validação — dataFim antes de dataInicio ────
Write-Host "`n--- TESTE 4: validacao dataFim < dataInicio ---" -ForegroundColor Cyan
$body4 = New-RangeBody -DataInicio '2026-12-20' -DataFim '2026-12-10'
$res4  = Invoke-RestMethod -Uri $URL -Method Post -Body $body4 -ContentType 'text/plain'
$res4 | ConvertTo-Json -Depth 5
# Esperado: ok=false, error.code='VALIDATION', mensagem sobre dataFim >= dataInicio


# ── TESTE 5: validação — diasSemana vazio ────
Write-Host "`n--- TESTE 5: validacao diasSemana vazio ---" -ForegroundColor Cyan
$body5 = New-RangeBody -DiasSemana @()
$res5  = Invoke-RestMethod -Uri $URL -Method Post -Body $body5 -ContentType 'text/plain'
$res5 | ConvertTo-Json -Depth 5
# Esperado: ok=false, error.code='VALIDATION', "Selecione ao menos um dia da semana."


# ── TESTE 6: validação — horário fora de 06:00-23:00 ────
Write-Host "`n--- TESTE 6: validacao horario < 06:00 ---" -ForegroundColor Cyan
$body6 = New-RangeBody -Inicio '05:00' -Fim '06:00'
$res6  = Invoke-RestMethod -Uri $URL -Method Post -Body $body6 -ContentType 'text/plain'
$res6 | ConvertTo-Json -Depth 5
# Esperado: ok=false, error.code='VALIDATION', "Horario minimo permitido: 06:00."


# ── TESTE 7: limite — estoura 60 datas ────
Write-Host "`n--- TESTE 7: limite (mais de 60 datas) ---" -ForegroundColor Cyan
$body7 = New-RangeBody -DataInicio '2027-01-01' -DataFim '2027-06-30' -DiasSemana @(1,2,3,4,5)
$res7  = Invoke-RestMethod -Uri $URL -Method Post -Body $body7 -ContentType 'text/plain'
$res7 | ConvertTo-Json -Depth 5
# Esperado: ok=false, error.code='VALIDATION', "Maximo 60 reservas por requisicao."


# ── TESTE 8: período de 1 dia (extremo válido) ────
Write-Host "`n--- TESTE 8: periodo de 1 dia (extremo valido) ---" -ForegroundColor Cyan
$body8 = New-RangeBody -Sala '701 Sala' -DataInicio '2027-02-15' -DataFim '2027-02-15' -DiasSemana @(1) -Inicio '13:00' -Fim '14:00'
$res8  = Invoke-RestMethod -Uri $URL -Method Post -Body $body8 -ContentType 'text/plain'
$res8 | ConvertTo-Json -Depth 5
# Esperado: 15/02/2027 e segunda -> cria 1 reserva; ok=true, data.count=1


# ── TESTE 9: createReservation antigo continua funcionando (NÃO REGREDIR) ────
Write-Host "`n--- TESTE 9: smoke do createReservation antigo (nao regredir) ---" -ForegroundColor Cyan
$bodyOld = @{
  action          = 'createReservation'
  clientRequestId = [guid]::NewGuid().ToString()
  userEmail       = 'teste@senai.edu'
  payload         = @{
    sala       = '702 Sala'
    data       = '2027-03-02'
    inicio     = '10:00'
    fim        = '11:00'
    professor  = 'Smoke teste'
    turma      = 'ELE-A'
    observacao = ''
  }
} | ConvertTo-Json -Depth 5
$resOld = Invoke-RestMethod -Uri $URL -Method Post -Body $bodyOld -ContentType 'text/plain'
$resOld | ConvertTo-Json -Depth 5
# Esperado: ok=true, data.id presente, data.sala='702 Sala'. Confirma que createReservation nao quebrou.
