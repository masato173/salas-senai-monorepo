// Este arquivo é o código-fonte do Google Apps Script publicado que
// alimenta o SyncModule do backend NestJS (POST /sync/schedules).
// Vive em apps/reservations/backend/ por razões históricas (era
// consumido pelo frontend legado antes do F5/F8). Mantido aqui como
// referência — a fonte real é o script publicado no Google Apps Script,
// não este arquivo. Ver docs/adr/ADR-004 e apps/api/src/modules/sync/.
// ============================================================
// CONTROLE DE SALAS SENAI — Google Apps Script
// Versão limpa — bugs de runtime corrigidos:
//   [1] Cache removido — cache.put() explode com payload > 100KB (3.485 registros)
//   [2] Variável 'c' redeclarada — trocada por 'col' no segundo loop
//   [3] err.message não exposto ao cliente — vai só pro Logger
//   [4] TURNOS_VALIDOS whitelist mantida
//   [5] getTurnoMap com .find().trim() mantido
//
// SECRET_TOKEN e SPREADSHEET_ID vêm de Script Properties, NUNCA hardcoded
// aqui. Configurar em: Apps Script Editor → Configurações do projeto (⚙️)
// → Script Properties → adicionar SECRET_TOKEN e SPREADSHEET_ID. Sem essas
// properties configuradas, SECRET_TOKEN fica null e o token nunca bate
// (fail-closed) — não é um bug, é o comportamento seguro por padrão.
//
// Após salvar: Implantar → Gerenciar implantações → lápis
//              → Nova versão → Implantar
// ============================================================

var SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
var SECRET_TOKEN   = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
var TURNOS_VALIDOS = ['M', 'V', 'N'];
var MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

// ── Ponto de entrada HTTP GET ──────────────────────────────────
function doGet(e) {
  var token = (e.parameter && e.parameter.token) || '';
  if (token !== SECRET_TOKEN) {
    return jsonResponse({ error: 'Acesso negado.' });
  }

  if (e.parameter.action === 'debug') {
    return debugReservas();
  }
  if (e.parameter.action === 'debugconflict') {
    return debugConflict();
  }
  if (e.parameter.action === 'listReservations') {
    return listReservations(e.parameter);
  }

  try {
    var ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
    var dados    = parsePlanilha(ss);
    var turnoMap = getTurnoMap(ss);
    return jsonResponse({ ok: true, total: dados.length, dados: dados, turnoMap: turnoMap });
  } catch (err) {
    Logger.log('ERRO em doGet: ' + err.stack);
    return jsonResponse({ error: 'Erro interno ao processar dados.' });
  }
}

// ── Lê abas de mês e retorna registros de sala ─────────────────
function parsePlanilha(ss) {
  var registros = [];

  ss.getSheets().forEach(function(sheet) {
    var nome = sheet.getName().trim();
    var mes  = MESES.find(function(m) { return nome.includes(m); });
    if (!mes) return;

    // Sprint B3.2 — detecta limites dos 3 blocos UMA VEZ por aba.
    // Retorna [] se não achar exatamente 3 → todos os registros da aba
    // saem com turno=null (fallback pra Lista no front).
    var limitesBlocos = detectarLimitesBlocos(sheet);

    var data = sheet.getDataRange().getValues();
    if (data.length < 4) return;

    // Linha 2 do Sheets (índice 1) = nomes das salas
    var linhasSalas = data[1] || [];
    var salas = [];

    // [2] FIX: variável nomeada 'c' — sem conflito com loop interno
    for (var c = 1; c < linhasSalas.length; c++) {
      salas.push((linhasSalas[c] || '').toString().trim() || null);
    }

    // Dados começam na linha 5 do Sheets (índice 4)
    for (var r = 4; r < data.length; r++) {
      var row     = data[r];
      var dateRaw = row[0];
      if (!dateRaw) continue;

      var dateStr;
      if (dateRaw instanceof Date) {
        var d = new Date(dateRaw.getTime() + 3 * 3600000);
        dateStr = Utilities.formatDate(d, 'America/Manaus', 'yyyy-MM-dd');
      } else {
        dateStr = dateRaw.toString().substring(0, 10);
      }

      // [2] FIX: 'col' em vez de 'c' — evita redeclaração de var no mesmo escopo
      for (var col = 1; col < row.length; col++) {
        var sala  = salas[col - 1];
        if (!sala) continue;
        var turma = (row[col] || '').toString().trim();
        if (turma) {
          // Sprint B3.2 — sheet row é r+1 (data[r] corresponde à row r+1 1-based).
          registros.push({
            data:  dateStr,
            sala:  sala,
            turma: turma,
            mes:   mes,
            turno: turnoPorBloco(r + 1, limitesBlocos)  // 'M'|'V'|'N'|null
          });
        }
      }
    }
  });

  return registros;
}

// ── Lê "Lista de turmas" → { turma: turno } ────────────────────
// Busca a aba com .find() + .trim() — imune a espaço no nome
// Só aceita M, V, N — whitelist explícita
function getTurnoMap(ss) {
  var sheet = ss.getSheets().find(function(s) {
    return s.getName().trim() === 'Lista de turmas';
  });

  if (!sheet) {
    Logger.log('AVISO: aba "Lista de turmas" nao encontrada.');
    return {};
  }

  var rows = sheet.getDataRange().getValues();
  var map  = {};

  // i=2: pula linha vazia (0) e cabeçalho (1)
  for (var i = 2; i < rows.length; i++) {
    var turma = String(rows[i][1] || '').trim();
    var turno = String(rows[i][5] || '').trim().toUpperCase();
    if (!turma || TURNOS_VALIDOS.indexOf(turno) === -1) continue;
    if (!map[turma]) map[turma] = turno;
  }

  return map;
}

// ── Helper: serializa resposta JSON ───────────────────────────
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
// ── Ponto de entrada HTTP POST ──────────────────────────────
// ── Ponto de entrada HTTP POST ──────────────────────────────
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';

    // Sync de Schedule (SyncModule/NestJS) — token no corpo, não na URL,
    // pra não vazar em logs de proxy/servidor nem no header Referer.
    if (action === 'listSchedules') {
      var reqToken = body.token || '';
      if (reqToken !== SECRET_TOKEN) {
        return jsonResponse({ error: 'Acesso negado.' });
      }
      try {
        var ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
        var dados    = parsePlanilha(ss);
        var turnoMap = getTurnoMap(ss);
        return jsonResponse({ ok: true, total: dados.length, dados: dados, turnoMap: turnoMap });
      } catch (err) {
        Logger.log('ERRO em doPost/listSchedules: ' + err.stack);
        return jsonResponse({ error: 'Erro interno ao processar dados.' });
      }
    }

    if (action === 'createReservation')         return createReservation(body);
    if (action === 'createReservationRange')    return createReservationRange(body);
    if (action === 'cancelReservation')         return cancelReservation(body);
    if (action === 'updateReservation')         return updateReservation(body);
    if (action === 'updateReservationGroup')    return updateReservationGroup(body);
    if (action === 'updateReservationSelected') return updateReservationSelected(body);

    return jsonResponse({ error: 'Ação desconhecida.' });

  } catch (err) {
    Logger.log('ERRO em doPost: ' + err.stack);
    return jsonResponse({ ok: false, error: { code: 'INTERNAL', message: 'Erro interno.' } });
  }
}


// ── Criar reserva ────────────────────────────────────────────
function createReservation(body) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({ ok: false, error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente.' } });
  }

  try {
    var payload = body.payload || {};

    // Validação básica
    var erros = validateReservationPayload(payload);
    if (erros) {
      return jsonResponse({ ok: false, error: { code: 'VALIDATION', message: erros } });
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');

    if (!sheet) {
      return jsonResponse({ ok: false, error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' } });
    }

    // Idempotência — evita duplicata por retry
    var clientId = body.clientRequestId || '';
    if (clientId) {
      var dados = sheet.getDataRange().getValues();
      for (var i = 1; i < dados.length; i++) {
        if (dados[i][12] === clientId) {
          return jsonResponse({ ok: true, data: rowToObj(dados[i]), error: null });
        }
      }
    }

    // Sprint Disponibilidade S4 — pré-carga de aulas (1x por request).
    // Fallback restritivo: erro ao ler aulas -> bloqueia como conflito.
    var registrosAulas;
    try {
      registrosAulas = parsePlanilha(ss);
    } catch (e) {
      Logger.log('[S4] Erro ao carregar aulas para verificação: ' + e.message);
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Não foi possível verificar conflito com aulas.' }
      });
    }
    if (verificaAulaConflito(registrosAulas, payload.sala, payload.data,
                              payload.inicio, payload.fim)) {
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Sala com aula neste horário.' }
      });
    }

    // Verifica conflito
    var conflito = checkConflicts(sheet, payload);
    if (conflito) {
      return jsonResponse({ ok: false, error: { code: 'CONFLICT', message: 'Sala já reservada neste horário.' } });
    }

    // Salva
    var now = new Date().toISOString();
    var id  = Utilities.getUuid();
    var row = [
      id,                                  // 0  A  id
      (payload.sala        || '').trim(),  // 1  B  sala
      (payload.data        || '').trim(),  // 2  C  data
      (payload.inicio      || '').trim(),  // 3  D  inicio
      (payload.fim         || '').trim(),  // 4  E  fim
      (payload.professor   || '').trim(),  // 5  F  professor
      (payload.turma       || '').trim(),  // 6  G  turma
      sanitize(payload.observacao || ''),  // 7  H  observacao
      'ACTIVE',                            // 8  I  status
      (body.userEmail      || '').trim(),  // 9  J  createdBy
      now,                                 // 10 K  createdAt
      now,                                 // 11 L  updatedAt
      clientId,                            // 12 M  clientRequestId
      id                                   // 13 N  groupId — única usa o próprio id
    ];

    sheet.appendRow(row);

    var lastrow = sheet.getLastRow();
    sheet.getRange(lastrow, 3,1,3).setNumberFormat('@');

    return jsonResponse({ ok: true, data: rowToObj(row), error: null });

  } catch (err) {
    Logger.log('ERRO em createReservation: ' + err.stack);
    return jsonResponse({ ok: false, error: { code: 'INTERNAL', message: 'Erro interno ao salvar.' } });
  } finally {
    lock.releaseLock();
  }
}


// ── Criar múltiplas reservas em período (tudo ou nada) ────────
// Mesma sala+horário em N datas. Atomicidade: 1 lock, valida tudo,
// checa conflito em todas, só então escreve. Idempotente via clientRequestId.
function createReservationRange(body) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({ ok: false, error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente.' } });
  }

  try {
    var payload  = body.payload || {};
    var clientId = body.clientRequestId || '';

    // 1) Valida campos específicos do range (dataInicio/dataFim/diasSemana)
    var rangeErr = validateRangeRequest(payload);
    if (rangeErr) {
      return jsonResponse({ ok: false, error: { code: 'VALIDATION', message: rangeErr } });
    }

    // 2) Expande as datas
    var datas = expandDateRange(payload.dataInicio, payload.dataFim, payload.diasSemana);
    if (datas.length === 0) {
      return jsonResponse({ ok: false, error: { code: 'VALIDATION', message: 'Nenhuma data válida no período para os dias selecionados.' } });
    }
    if (datas.length > 60) {
      return jsonResponse({ ok: false, error: { code: 'VALIDATION', message: 'Máximo 60 reservas por requisição.' } });
    }

    // 3) Valida horário/sala/etc UMA vez (mesmo payload pra todas as datas)
    var basePayload = clonePayloadForDate(payload, datas[0]);
    var erros = validateReservationPayload(basePayload);
    if (erros) {
      return jsonResponse({ ok: false, error: { code: 'VALIDATION', message: erros } });
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');
    if (!sheet) {
      return jsonResponse({ ok: false, error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' } });
    }

    // 4) Idempotência — se clientId já existe, devolve todas as rows desse clientId
    if (clientId) {
      var existentes = findRowsByClientId(sheet, clientId);
      if (existentes.length > 0) {
        return jsonResponse({
          ok: true,
          data: { count: existentes.length, reservations: existentes },
          error: null
        });
      }
    }

    // Sprint Disponibilidade S4 — pré-carga de aulas UMA vez antes do loop.
    // Fallback restritivo: erro ao ler aulas -> bloqueia como conflito.
    var registrosAulas;
    try {
      registrosAulas = parsePlanilha(ss);
    } catch (e) {
      Logger.log('[S4] Erro ao carregar aulas para verificação: ' + e.message);
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Não foi possível verificar conflito com aulas.' }
      });
    }

    // 5) Checa conflito em CADA data — tudo ou nada
    var conflitos = [];
    for (var i = 0; i < datas.length; i++) {
      var pCheck = clonePayloadForDate(payload, datas[i]);
      if (verificaAulaConflito(registrosAulas, pCheck.sala, pCheck.data,
                                pCheck.inicio, pCheck.fim)) {
        conflitos.push(datas[i]);
      } else if (checkConflicts(sheet, pCheck)) {
        conflitos.push(datas[i]);
      }
    }
    if (conflitos.length > 0) {
      return jsonResponse({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Conflito em ' + conflitos.length + ' data(s).',
          details: { conflicts: conflitos }
        }
      });
    }

    // 6) Sem conflito → grava todas
    // groupId é gerado UMA vez antes do loop e compartilhado por todas as linhas
    // do período. Permite, na Fase B/C, editar/cancelar todas de uma vez.
    var now     = new Date().toISOString();
    var groupId = Utilities.getUuid();
    var reservasCriadas = [];

    for (var j = 0; j < datas.length; j++) {
      var id  = Utilities.getUuid();
      var row = [
        id,                                  // 0  A  id (por reserva)
        (payload.sala       || '').trim(),   // 1  B  sala
        datas[j],                            // 2  C  data
        (payload.inicio     || '').trim(),   // 3  D  inicio
        (payload.fim        || '').trim(),   // 4  E  fim
        (payload.professor  || '').trim(),   // 5  F  professor
        (payload.turma      || '').trim(),   // 6  G  turma
        sanitize(payload.observacao || ''),  // 7  H  observacao
        'ACTIVE',                            // 8  I  status
        (body.userEmail     || '').trim(),   // 9  J  createdBy
        now,                                 // 10 K  createdAt
        now,                                 // 11 L  updatedAt
        clientId,                            // 12 M  clientRequestId
        groupId                              // 13 N  groupId — compartilhado
      ];

      sheet.appendRow(row);
      var lastrow = sheet.getLastRow();
      sheet.getRange(lastrow, 3, 1, 3).setNumberFormat('@');  // força C/D/E como texto
      reservasCriadas.push(rowToObj(row));
    }

    return jsonResponse({
      ok: true,
      data: { count: reservasCriadas.length, reservations: reservasCriadas },
      error: null
    });

  } catch (err) {
    Logger.log('ERRO em createReservationRange: ' + err.stack);
    return jsonResponse({ ok: false, error: { code: 'INTERNAL', message: 'Erro interno ao salvar.' } });
  } finally {
    lock.releaseLock();
  }
}

// ── Helpers de range (novos) ──────────────────────────────────

// Valida dataInicio, dataFim, diasSemana. Retorna string (mensagem) ou null.
// Segue o estilo de validateReservationPayload (primeira falha já retorna).
function validateRangeRequest(p) {
  var DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  if (!p.dataInicio || !DATE_RE.test(String(p.dataInicio).trim())) {
    return 'Data de início inválida. Use YYYY-MM-DD.';
  }
  if (!p.dataFim    || !DATE_RE.test(String(p.dataFim).trim())) {
    return 'Data de fim inválida. Use YYYY-MM-DD.';
  }
  if (String(p.dataFim).trim() < String(p.dataInicio).trim()) {
    return 'Data de fim deve ser igual ou posterior à data de início.';
  }
  if (!Array.isArray(p.diasSemana) || p.diasSemana.length === 0) {
    return 'Selecione ao menos um dia da semana.';
  }
  for (var i = 0; i < p.diasSemana.length; i++) {
    var d = p.diasSemana[i];
    if (typeof d !== 'number' || d < 0 || d > 6 || (d | 0) !== d) {
      return 'Dia da semana inválido (use inteiros 0-6, sendo 0=domingo).';
    }
  }
  return null;
}

// Expande [dataInicio..dataFim] filtrando pelos diasSemana (0=dom..6=sab).
// Itera em meio-dia UTC pra evitar DST. Limite hard de 60 datas.
function expandDateRange(dataInicio, dataFim, diasSemana) {
  var datas = [];
  var seen  = {};

  var p1 = String(dataInicio).split('-');
  var p2 = String(dataFim).split('-');
  var start = Date.UTC(parseInt(p1[0],10), parseInt(p1[1],10) - 1, parseInt(p1[2],10), 12);
  var end   = Date.UTC(parseInt(p2[0],10), parseInt(p2[1],10) - 1, parseInt(p2[2],10), 12);

  for (var ms = start; ms <= end; ms += 86400000) {
    var d = new Date(ms);
    if (diasSemana.indexOf(d.getUTCDay()) === -1) continue;
    var iso = Utilities.formatDate(d, 'America/Manaus', 'yyyy-MM-dd');
    if (!seen[iso]) {
      seen[iso] = true;
      datas.push(iso);
    }
    if (datas.length > 120) break;  // proteção: estouramos o limite, deixa quem chama rejeitar
  }
  return datas;
}

// Cópia do payload trocando só o campo `data` — pra passar pra checkConflicts/validateReservationPayload.
function clonePayloadForDate(p, dataStr) {
  return {
    sala:       p.sala,
    data:       dataStr,
    inicio:     p.inicio,
    fim:        p.fim,
    professor:  p.professor,
    turma:      p.turma,
    observacao: p.observacao
  };
}

// Idempotência multi-row: coleta TODAS as linhas com o clientRequestId dado.
function findRowsByClientId(sheet, clientId) {
  var dados = sheet.getDataRange().getValues();
  var found = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][12] === clientId) {
      found.push(rowToObj(dados[i]));
    }
  }
  return found;
}

// ── Validação do payload ─────────────────────────────────────
function validateReservationPayload(p) {
  if (!p.sala    || !p.sala.trim())   return 'Sala é obrigatória.';
  if (!p.data    || !p.data.trim())   return 'Data é obrigatória.';
  if (!p.inicio  || !p.inicio.trim()) return 'Horário de início é obrigatório.';
  if (!p.fim     || !p.fim.trim())    return 'Horário de fim é obrigatório.';

  var ini = toMinutes(p.inicio);
  var fim = toMinutes(p.fim);

  if (isNaN(ini) || isNaN(fim))       return 'Formato de horário inválido. Use HH:MM.';
  if (ini < 360)                      return 'Horário mínimo permitido: 06:00.';
  if (fim > 1380)                     return 'Horário máximo permitido: 23:00.';
  if (fim <= ini)                     return 'Horário de fim deve ser após o início.';

  return null;
}

// ── Verificação de conflito ──────────────────────────────────
function checkConflicts(sheet, payload, excludeId, excludeGroupId, excludeIds) {
  var dados   = sheet.getDataRange().getValues();
  var sala    = (payload.sala || '').trim();
  var dataReq = (payload.data || '').trim();
  var newIni  = toMinutes(payload.inicio);
  var newFim  = toMinutes(payload.fim);

  // Pre-indexa excludeIds pra lookup O(1).
  var excludeSet = null;
  if (excludeIds && excludeIds.length > 0) {
    excludeSet = {};
    for (var k = 0; k < excludeIds.length; k++) {
      excludeSet[excludeIds[k]] = true;
    }
  }

  for (var i = 1; i < dados.length; i++) {
    var row = dados[i];
    if (excludeId && row[0] === excludeId)             continue;  // Sprint 4 Fase C1
    if (excludeGroupId && row[13] === excludeGroupId)  continue;  // Sprint 4 Fase C2
    if (excludeSet && excludeSet[row[0]])              continue;  // Sprint 4 Fase C3
    if (row[8] === 'CANCELLED')                        continue;
    if (String(row[1]).trim() !== sala)                continue;
    if (normalizeDate(row[2])  !== dataReq)            continue;

    var exIni = toMinutes(row[3]);
    var exFim = toMinutes(row[4]);

    if (isNaN(exIni) || isNaN(exFim)) continue;
    if (newIni < exFim && newFim > exIni) return true;
  }

  return false;
}

// ── Sprint Disponibilidade S4 ─────────────────────────────────
// Verifica conflito entre uma reserva e aulas na planilha mensal.
// Recebe registros já carregados (parsePlanilha chamado 1x por request).
// Retorna true se a reserva conflita com alguma aula.
//
// Fórmula canônica (mesma do checkConflicts):
//   newIni < aulaFim && newFim > aulaIni
//
// turno=null → conservador: bloqueia 00:00-23:59 (aula sem turno conhecido).
function verificaAulaConflito(registros, sala, data, inicio, fim) {
  var TURNO_HORARIO = {
    'M': { inicio: '07:30', fim: '12:00' },
    'V': { inicio: '13:00', fim: '17:30' },
    'N': { inicio: '18:30', fim: '22:00' }
  };
  var newIni = toMinutes(inicio);
  var newFim = toMinutes(fim);
  for (var i = 0; i < registros.length; i++) {
    var r = registros[i];
    if (r.sala !== sala) continue;
    if (r.data !== data)  continue;
    var h = r.turno ? TURNO_HORARIO[r.turno] : null;
    var aulaIni = h ? toMinutes(h.inicio) : 0;     // null → 00:00
    var aulaFim = h ? toMinutes(h.fim)    : 1439;  // null → 23:59
    if (newIni < aulaFim && newFim > aulaIni) return true;
  }
  return false;
}

// READ-ONLY — para validar no Sheet DEV antes de deploy.
function debugVerificaAula() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var registros = parsePlanilha(ss);
  var casos = [
    // Deve detectar conflito (aula M = 07:30-12:00)
    { sala: '603 Sala', data: '2026-06-15', inicio: '09:00', fim: '11:00',
      esperado: true,  descricao: 'reserva dentro da aula M' },
    // Não deve conflitar (V = 13:00-17:30, reserva é de manhã)
    { sala: '603 Sala', data: '2026-06-15', inicio: '08:00', fim: '09:00',
      esperado: false, descricao: 'reserva antes da aula V' },
    // Sala sem aula — não deve conflitar
    { sala: '707 Sala', data: '2026-06-15', inicio: '09:00', fim: '11:00',
      esperado: false, descricao: 'sala sem aula cadastrada' },
    // Tangência (borda) — NÃO deve conflitar
    { sala: '603 Sala', data: '2026-06-15', inicio: '12:00', fim: '13:00',
      esperado: false, descricao: 'reserva começa quando aula M termina' }
  ];
  Logger.log('=== debugVerificaAula ===');
  Logger.log('Total registros carregados: ' + registros.length);
  for (var i = 0; i < casos.length; i++) {
    var c = casos[i];
    var resultado = verificaAulaConflito(registros, c.sala, c.data,
                                          c.inicio, c.fim);
    var ok = resultado === c.esperado ? 'OK' : 'FALHOU';
    Logger.log('[' + ok + '] ' + c.descricao +
               ' -> esperado=' + c.esperado + ', got=' + resultado);
  }
}


// DEBUG temporário
function debugConflict() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Reservas');
  var dados = sheet.getDataRange().getValues();

  var payload = { sala: '603 Sala', data: '2026-12-10', inicio: '09:00', fim: '11:00' };
  var sala    = payload.sala.trim();
  var dataReq = payload.data.trim();
  var newIni  = toMinutes(payload.inicio);
  var newFim  = toMinutes(payload.fim);

  var out = { newIni: newIni, newFim: newFim, sala: sala, dataReq: dataReq, linhas: [] };

  for (var i = 1; i < dados.length; i++) {
    var row = dados[i];
    out.linhas.push({
      i: i,
      rowSala:       String(row[1]).trim(),
      salaBate:      String(row[1]).trim() === sala,
      rowDataNorm:   normalizeDate(row[2]),
      dataBate:      normalizeDate(row[2]) === dataReq,
      exIni:         toMinutes(row[3]),
      exFim:         toMinutes(row[4]),
      status:        row[8]
    });
  }
  return jsonResponse({ ok: true, debug: out });
}

// ── DEBUG temporário — remover depois ──
function debugReservas() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName('Reservas');
  var dados = sheet.getDataRange().getValues();

  var out = [];
  for (var i = 0; i < dados.length; i++) {
    out.push({
      linha: i,
      col_A_id:        { val: dados[i][0], tipo: typeof dados[i][0] },
      col_B_sala:      { val: dados[i][1], tipo: typeof dados[i][1] },
      col_C_data:      { val: String(dados[i][2]), tipo: typeof dados[i][2] },
      col_D_inicio:    { val: String(dados[i][3]), tipo: typeof dados[i][3] },
      col_E_fim:       { val: String(dados[i][4]), tipo: typeof dados[i][4] },
      col_I_status:    { val: dados[i][8], tipo: typeof dados[i][8] }
    });
  }
  return jsonResponse({ ok: true, debug: out });
}
// ── Helpers ──────────────────────────────────────────────────
function toMinutes(val) {
  if (!val && val !== 0) return NaN;

  // Se vier como Date (Sheets converte "08:00" automaticamente)
  if (val instanceof Date) {
    return val.getHours() * 60 + val.getMinutes();
  }

  // Se vier como string "08:00"
  var s = String(val).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return NaN;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function normalizeDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var y  = val.getFullYear();
    var mo = String(val.getMonth() + 1).padStart(2, '0');
    var d  = String(val.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  }
  return String(val).trim();
}

function sanitize(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowToObj(row) {
  return {
    id:         row[0],  sala:       row[1],
    data:       row[2],  inicio:     row[3],
    fim:        row[4],  professor:  row[5],
    turma:      row[6],  observacao: row[7],
    status:     row[8],  createdBy:  row[9],
    createdAt:  row[10], updatedAt:  row[11],
    groupId:    row[13] || ''  // tolerante: '' para linhas legacy sem col N
  };
}

// ── Lista reservas da aba "Reservas". Read-only, sem lock. ────
// Por padrão devolve só status='ACTIVE'. Flag ?includeCancelled=true devolve tudo.
// Resposta: { ok, data: { count, reservations: [...rowToObj] }, error }.
function listReservations(params) {
  try {
    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' }
      });
    }

    var includeCancelled = String((params && params.includeCancelled) || '').toLowerCase() === 'true';
    var dados = sheet.getDataRange().getValues();
    var reservations = [];

    // i=1: pula cabeçalho. Coluna 8 (índice 8) = status.
    for (var i = 1; i < dados.length; i++) {
      if (!includeCancelled && dados[i][8] === 'CANCELLED') continue;
      reservations.push(rowToObj(dados[i]));
    }

    return jsonResponse({
      ok: true,
      data: { count: reservations.length, reservations: reservations },
      error: null
    });

  } catch (err) {
    Logger.log('ERRO em listReservations: ' + err.stack);
    return jsonResponse({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno ao listar reservas.' }
    });
  }
}


// ── Cancela uma reserva (soft delete: status='CANCELLED'). ────
// Idempotência state-based:
//   • Se status já é CANCELLED → devolve ok=true sem owner check (operação já aplicada).
//   • Se status é ACTIVE       → valida owner; só createdBy pode cancelar.
// clientRequestId é aceito e logado para audit, mas NÃO usado pra dedupe.
function cancelReservation(body) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente.' }
    });
  }

  try {
    // Audit-only: registra o clientRequestId no log; idempotência é state-based.
    var clientId = (body && body.clientRequestId) || '';
    Logger.log('cancelReservation clientRequestId=' + clientId);

    var validationErr = validateCancelPayload(body);
    if (validationErr) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: validationErr }
      });
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' }
      });
    }

    var id        = String(body.payload.id).trim();
    var userEmail = String(body.userEmail).trim();

    var found = findRowByIdWithIndex(sheet, id);
    if (!found) {
      return jsonResponse({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Reserva não encontrada.' }
      });
    }

    // Idempotência state-based — se já CANCELLED, devolve ok sem owner check.
    if (found.row[8] === 'CANCELLED') {
      return jsonResponse({
        ok: true,
        data: rowToObj(found.row),
        error: null
      });
    }

    // Owner check só pra reservas ACTIVE. createdBy = coluna J = índice 9.
    if (found.row[9] !== userEmail) {
      return jsonResponse({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Apenas o criador pode cancelar a reserva.' }
      });
    }

    // Atualiza:
    //   status     → coluna I (1-based: 9)
    //   updatedAt  → coluna L (1-based: 12)
    // NÃO toca C/D/E — setNumberFormat('@') preservado.
    var now = new Date().toISOString();
    sheet.getRange(found.sheetRowIndex, 9 ).setValue('CANCELLED');
    sheet.getRange(found.sheetRowIndex, 12).setValue(now);

    // Reconstrói row atualizada para o response (sem reler a planilha).
    var updated = found.row.slice();
    updated[8]  = 'CANCELLED';
    updated[11] = now;

    return jsonResponse({
      ok: true,
      data: rowToObj(updated),
      error: null
    });

  } catch (err) {
    Logger.log('ERRO em cancelReservation: ' + err.stack);
    return jsonResponse({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno ao cancelar.' }
    });
  } finally {
    lock.releaseLock();
  }
}


// ── Valida o payload de cancelamento. ────────────────────────
// Mesmo padrão de validateReservationPayload / validateRangeRequest:
// retorna string (primeira mensagem de erro) ou null se tudo ok.
function validateCancelPayload(body) {
  if (!body || typeof body !== 'object') {
    return 'Body inválido.';
  }
  if (!body.userEmail || !String(body.userEmail).trim()) {
    return 'userEmail é obrigatório.';
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return 'payload é obrigatório.';
  }
  if (!body.payload.id || !String(body.payload.id).trim()) {
    return 'payload.id é obrigatório.';
  }
  return null;
}


// ── Localiza row por id na aba "Reservas". ───────────────────
// Retorna { row, sheetRowIndex } (sheetRowIndex 1-based pra sheet.getRange)
// ou null se não encontrar.
function findRowByIdWithIndex(sheet, id) {
  var dados = sheet.getDataRange().getValues();
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][0] === id) {
      // dados[0] é o cabeçalho (sheet row 1); dados[i] → sheet row i+1.
      return { row: dados[i], sheetRowIndex: i + 1 };
    }
  }
  return null;
}

function updateReservation(body) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente.' }
    });
  }

  try {
    // Audit-only: registra clientRequestId no log; idempotência é state-based.
    var clientId = (body && body.clientRequestId) || '';
    Logger.log('updateReservation clientRequestId=' + clientId);

    var validationErr = validateUpdatePayload(body);
    if (validationErr) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: validationErr }
      });
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' }
      });
    }

    var id        = String(body.payload.id).trim();
    var userEmail = String(body.userEmail).trim();

    var found = findRowByIdWithIndex(sheet, id);
    if (!found) {
      return jsonResponse({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Reserva não encontrada.' }
      });
    }

    // Owner-check espelha cancelReservation. createdBy = col J = idx 9.
    if (found.row[9] !== userEmail) {
      return jsonResponse({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Apenas o criador pode editar a reserva.' }
      });
    }

    // Só ACTIVE pode ser editada. CANCELLED → VALIDATION.
    if (found.row[8] !== 'ACTIVE') {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: 'Reserva cancelada não pode ser editada.' }
      });
    }

    // EDITÁVEIS: lidos SÓ do payload, trimados/sanitizados.
    var newSala       = String(body.payload.sala       || '').trim();
    var newData       = String(body.payload.data       || '').trim();
    var newInicio     = String(body.payload.inicio     || '').trim();
    var newFim        = String(body.payload.fim        || '').trim();
    var newTurma      = String(body.payload.turma      || '').trim();
    var newObservacao = sanitize(body.payload.observacao || '');

    // IMUTÁVEIS: lidos DA ROW LIDA, NUNCA do payload.
    // Defesa contra payload malicioso (createdBy='admin@x', groupId='falso', etc.).
    var rowAtual            = found.row;
    var preservedId         = rowAtual[0];   // A — id
    var preservedProfessor  = rowAtual[5];   // F — professor (não editável)
    var preservedStatus     = rowAtual[8];   // I — status (== 'ACTIVE' aqui)
    var preservedCreatedBy  = rowAtual[9];   // J — createdBy (owner imutável)
    var preservedCreatedAt  = rowAtual[10];  // K — createdAt (audit)
    var preservedClientId   = rowAtual[12];  // M — clientRequestId do create (audit)
    var preservedGroupId    = rowAtual[13];  // N — groupId (Fase A; única=id, período=UUID)

    // Idempotência state-based: payload === row atual (campos editáveis) → no-op.
    // Devolve row atual SEM chamar setValues e SEM tocar em updatedAt.
    var nothingChanged =
      String(rowAtual[1]).trim()  === newSala     &&
      normalizeDate(rowAtual[2])  === newData     &&
      String(rowAtual[3]).trim()  === newInicio   &&
      String(rowAtual[4]).trim()  === newFim      &&
      String(rowAtual[6]).trim()  === newTurma    &&
      String(rowAtual[7] || '')   === newObservacao;

    if (nothingChanged) {
      return jsonResponse({
        ok: true,
        data: rowToObj(rowAtual),
        error: null
      });
    }

    // Sprint Disponibilidade S4 — pré-carga de aulas (1x por request).
    // Fallback restritivo: erro ao ler aulas -> bloqueia como conflito.
    var registrosAulas;
    try {
      registrosAulas = parsePlanilha(ss);
    } catch (e) {
      Logger.log('[S4] Erro ao carregar aulas para verificação: ' + e.message);
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Não foi possível verificar conflito com aulas.' }
      });
    }
    if (verificaAulaConflito(registrosAulas, newSala, newData,
                              newInicio, newFim)) {
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Sala com aula neste horário.' }
      });
    }

    // Revalida conflito IGNORANDO a própria reserva (excludeId === id).
    var conflitou = checkConflicts(
      sheet,
      { sala: newSala, data: newData, inicio: newInicio, fim: newFim },
      id
    );
    if (conflitou) {
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Sala já reservada neste horário.' }
      });
    }

    // Monta row nova: editáveis do payload + imutáveis da row lida + updatedAt=now.
    var now = new Date().toISOString();
    var novaRow = [
      preservedId,           // 0  A id            (PRESERVADO)
      newSala,               // 1  B sala
      newData,               // 2  C data
      newInicio,             // 3  D inicio
      newFim,                // 4  E fim
      preservedProfessor,    // 5  F professor     (PRESERVADO)
      newTurma,              // 6  G turma
      newObservacao,         // 7  H observacao
      preservedStatus,       // 8  I status        (PRESERVADO == 'ACTIVE')
      preservedCreatedBy,    // 9  J createdBy     (PRESERVADO)
      preservedCreatedAt,    // 10 K createdAt     (PRESERVADO)
      now,                   // 11 L updatedAt
      preservedClientId,     // 12 M clientReqId   (PRESERVADO — audit do create)
      preservedGroupId       // 13 N groupId       (PRESERVADO — vínculo de grupo Fase A)
    ];

    // setValues atômico em B-N (13 cols). A=id NÃO é tocado fisicamente.
    sheet.getRange(found.sheetRowIndex, 2, 1, 13).setValues([novaRow.slice(1)]);

    // Reforço anti-regressão Sheets 1899 — C/D/E como texto.
    sheet.getRange(found.sheetRowIndex, 3, 1, 3).setNumberFormat('@');

    return jsonResponse({
      ok: true,
      data: rowToObj(novaRow),
      error: null
    });

  } catch (err) {
    Logger.log('ERRO em updateReservation: ' + err.stack);
    return jsonResponse({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno ao editar.' }
    });
  } finally {
    lock.releaseLock();
  }
}

function validateUpdatePayload(body) {
  if (!body || typeof body !== 'object') {
    return 'Body inválido.';
  }
  if (!body.userEmail || !String(body.userEmail).trim()) {
    return 'userEmail é obrigatório.';
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return 'payload é obrigatório.';
  }
  if (!body.payload.id || !String(body.payload.id).trim()) {
    return 'payload.id é obrigatório.';
  }

  // Mesmas regras de sala/data/inicio/fim do create.
  var p = body.payload;
  if (!p.sala    || !String(p.sala).trim())    return 'Sala é obrigatória.';
  if (!p.data    || !String(p.data).trim())    return 'Data é obrigatória.';
  if (!p.inicio  || !String(p.inicio).trim())  return 'Horário de início é obrigatório.';
  if (!p.fim     || !String(p.fim).trim())     return 'Horário de fim é obrigatório.';

  var ini = toMinutes(p.inicio);
  var fim = toMinutes(p.fim);

  if (isNaN(ini) || isNaN(fim))                return 'Formato de horário inválido. Use HH:MM.';
  if (ini < 360)                               return 'Horário mínimo permitido: 06:00.';
  if (fim > 1380)                              return 'Horário máximo permitido: 23:00.';
  if (fim <= ini)                              return 'Horário de fim deve ser após o início.';

  // FLAG TURMA — assimetria deliberada com o create (que não valida turma).
  // Remover esta linha se reservas legacy/sem turma precisarem ser editáveis.
  if (!p.turma   || !String(p.turma).trim())   return 'Turma é obrigatória.';

  return null;
}

function updateReservationGroup(body) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente.' }
    });
  }

  try {
    // Audit-only: clientRequestId logado, NÃO usado pra dedupe.
    var clientId = (body && body.clientRequestId) || '';
    Logger.log('updateReservationGroup clientRequestId=' + clientId);

    var validationErr = validateGroupUpdatePayload(body);
    if (validationErr) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: validationErr }
      });
    }

    var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' }
      });
    }

    var groupId   = String(body.payload.groupId).trim();
    var userEmail = String(body.userEmail).trim();

    var found = findActiveRowsByGroupId(sheet, groupId);
    if (found.length === 0) {
      return jsonResponse({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Nenhuma reserva ativa neste grupo.' }
      });
    }

    // Owner-check em TODAS as linhas — defesa-em-profundidade.
    for (var ic = 0; ic < found.length; ic++) {
      if (found[ic].row[9] !== userEmail) {
        return jsonResponse({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Apenas o criador pode editar o grupo.' }
        });
      }
    }

    // EDITÁVEIS: lidos SÓ do payload, trimados/sanitizados.
    var newSala       = String(body.payload.sala       || '').trim();
    var newInicio     = String(body.payload.inicio     || '').trim();
    var newFim        = String(body.payload.fim        || '').trim();
    var newTurma      = String(body.payload.turma      || '').trim();
    var newObservacao = sanitize(body.payload.observacao || '');

    // Idempotência state-based no GRUPO: se TODAS as linhas já estão no estado
    // novo, devolve lista atual SEM tocar setValues nem updatedAt.
    var allEqual = true;
    for (var ie = 0; ie < found.length; ie++) {
      var r = found[ie].row;
      var same =
        String(r[1]).trim()  === newSala     &&
        String(r[3]).trim()  === newInicio   &&
        String(r[4]).trim()  === newFim      &&
        String(r[6]).trim()  === newTurma    &&
        String(r[7] || '')   === newObservacao;
      if (!same) { allEqual = false; break; }
    }

    if (allEqual) {
      var noopList = [];
      for (var inm = 0; inm < found.length; inm++) {
        noopList.push(rowToObj(found[inm].row));
      }
      return jsonResponse({
        ok: true,
        data: { count: noopList.length, reservations: noopList },
        error: null
      });
    }

    // Sprint Disponibilidade S4 — pré-carga de aulas UMA vez antes do loop.
    // Fallback restritivo: erro ao ler aulas -> bloqueia como conflito.
    var registrosAulas;
    try {
      registrosAulas = parsePlanilha(ss);
    } catch (e) {
      Logger.log('[S4] Erro ao carregar aulas para verificação: ' + e.message);
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Não foi possível verificar conflito com aulas.' }
      });
    }

    // Revalida conflito em CADA data — tudo ou nada.
    // Ignora todas as irmãs via excludeGroupId.
    var conflitos = [];
    for (var ich = 0; ich < found.length; ich++) {
      var rowAtual = found[ich].row;
      var pCheck = {
        sala:   newSala,
        data:   normalizeDate(rowAtual[2]),
        inicio: newInicio,
        fim:    newFim
      };
      if (verificaAulaConflito(registrosAulas, pCheck.sala, pCheck.data,
                                pCheck.inicio, pCheck.fim)) {
        conflitos.push(pCheck.data);
      } else if (checkConflicts(sheet, pCheck, undefined, groupId)) {
        conflitos.push(pCheck.data);
      }
    }

    if (conflitos.length > 0) {
      return jsonResponse({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Conflito em ' + conflitos.length + ' data(s) do grupo.',
          details: { conflicts: conflitos }
        }
      });
    }

    // Escrita: pra cada linha, preserva imutáveis (incluindo data própria) e
    // troca só os campos editáveis + updatedAt.
    var now = new Date().toISOString();
    var reservasAtualizadas = [];

    for (var iw = 0; iw < found.length; iw++) {
      var rowOrig = found[iw].row;

      var preservedId         = rowOrig[0];   // A
      var preservedData       = rowOrig[2];   // C  ← cada linha mantém sua data
      var preservedProfessor  = rowOrig[5];   // F
      var preservedStatus     = rowOrig[8];   // I  ← 'ACTIVE'
      var preservedCreatedBy  = rowOrig[9];   // J
      var preservedCreatedAt  = rowOrig[10];  // K
      var preservedClientId   = rowOrig[12];  // M
      var preservedGroupId    = rowOrig[13];  // N  ← == groupId do payload

      var novaRow = [
        preservedId,           // 0  A id            (PRESERVADO)
        newSala,               // 1  B sala
        preservedData,         // 2  C data          (PRESERVADO — própria da linha)
        newInicio,             // 3  D inicio
        newFim,                // 4  E fim
        preservedProfessor,    // 5  F professor     (PRESERVADO)
        newTurma,              // 6  G turma
        newObservacao,         // 7  H observacao
        preservedStatus,       // 8  I status        (PRESERVADO == 'ACTIVE')
        preservedCreatedBy,    // 9  J createdBy     (PRESERVADO)
        preservedCreatedAt,    // 10 K createdAt     (PRESERVADO)
        now,                   // 11 L updatedAt
        preservedClientId,     // 12 M clientReqId   (PRESERVADO — audit do create)
        preservedGroupId       // 13 N groupId       (PRESERVADO)
      ];

      // setValues atômico em B-N (13 cols). A=id NÃO é tocado fisicamente.
      sheet.getRange(found[iw].sheetRowIndex, 2, 1, 13).setValues([novaRow.slice(1)]);

      // Reforço anti-regressão Sheets 1899 — C/D/E como texto.
      sheet.getRange(found[iw].sheetRowIndex, 3, 1, 3).setNumberFormat('@');

      reservasAtualizadas.push(rowToObj(novaRow));
    }

    return jsonResponse({
      ok: true,
      data: { count: reservasAtualizadas.length, reservations: reservasAtualizadas },
      error: null
    });

  } catch (err) {
    Logger.log('ERRO em updateReservationGroup: ' + err.stack);
    return jsonResponse({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno ao editar grupo.' }
    });
  } finally {
    lock.releaseLock();
  }
}

function validateGroupUpdatePayload(body) {
  if (!body || typeof body !== 'object') {
    return 'Body inválido.';
  }
  if (!body.userEmail || !String(body.userEmail).trim()) {
    return 'userEmail é obrigatório.';
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return 'payload é obrigatório.';
  }
  if (!body.payload.groupId || !String(body.payload.groupId).trim()) {
    return 'payload.groupId é obrigatório.';
  }

  var p = body.payload;
  if (!p.sala    || !String(p.sala).trim())    return 'Sala é obrigatória.';
  if (!p.inicio  || !String(p.inicio).trim())  return 'Horário de início é obrigatório.';
  if (!p.fim     || !String(p.fim).trim())     return 'Horário de fim é obrigatório.';

  var ini = toMinutes(p.inicio);
  var fim = toMinutes(p.fim);

  if (isNaN(ini) || isNaN(fim))                return 'Formato de horário inválido. Use HH:MM.';
  if (ini < 360)                               return 'Horário mínimo permitido: 06:00.';
  if (fim > 1380)                              return 'Horário máximo permitido: 23:00.';
  if (fim <= ini)                              return 'Horário de fim deve ser após o início.';

  // FLAG TURMA — assimetria deliberada com o create. Remover esta linha se
  // reservas legacy sem turma precisarem ser editáveis via grupo.
  if (!p.turma   || !String(p.turma).trim())   return 'Turma é obrigatória.';

  return null;
}

function findActiveRowsByGroupId(sheet, groupId) {
  var dados = sheet.getDataRange().getValues();
  var found = [];
  for (var i = 1; i < dados.length; i++) {
    if (dados[i][13] === groupId && dados[i][8] === 'ACTIVE') {
      // dados[0] = header (sheet row 1); dados[i] → sheet row i+1.
      found.push({ row: dados[i], sheetRowIndex: i + 1 });
    }
  }
  return found;
}

function updateReservationSelected(body) {
  var lock = LockService.getScriptLock();

  try {
    lock.waitLock(15000);
  } catch (e) {
    return jsonResponse({
      ok: false,
      error: { code: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente.' }
    });
  }

  try {
    var clientId = (body && body.clientRequestId) || '';
    Logger.log('updateReservationSelected clientRequestId=' + clientId);

    var validationErr = validateSelectedUpdatePayload(body);
    if (validationErr) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: validationErr }
      });
    }

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName('Reservas');
    if (!sheet) {
      return jsonResponse({
        ok: false,
        error: { code: 'INTERNAL', message: 'Aba Reservas não encontrada.' }
      });
    }

    var userEmail = String(body.userEmail).trim();
    var ids = body.payload.ids.map(function(x) { return String(x).trim(); });

    // 3. Lookup batch
    var rowsMap = findRowsByIdsMap(sheet, ids);
    var missing = [];
    for (var i = 0; i < ids.length; i++) {
      if (!rowsMap[ids[i]]) missing.push(ids[i]);
    }
    if (missing.length > 0) {
      return jsonResponse({
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Reserva(s) não encontrada(s): ' + missing.join(', ') }
      });
    }

    // 4. ACTIVE check
    var notActive = [];
    for (var ia = 0; ia < ids.length; ia++) {
      if (rowsMap[ids[ia]].row[8] !== 'ACTIVE') notActive.push(ids[ia]);
    }
    if (notActive.length > 0) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: 'Selecione apenas reservas ativas. Inválido(s): ' + notActive.join(', ') }
      });
    }

    // 5. Mesmo groupId (non-empty)
    var groupIdOriginal = rowsMap[ids[0]].row[13];
    if (!groupIdOriginal) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: 'Reservas sem grupo (legacy) não podem ser remanejadas por seleção.' }
      });
    }
    for (var ig = 1; ig < ids.length; ig++) {
      if (rowsMap[ids[ig]].row[13] !== groupIdOriginal) {
        return jsonResponse({
          ok: false,
          error: { code: 'VALIDATION', message: 'Todas as reservas devem pertencer ao mesmo grupo.' }
        });
      }
    }

    // 6. Mesmo owner
    var notOwner = [];
    for (var io = 0; io < ids.length; io++) {
      if (rowsMap[ids[io]].row[9] !== userEmail) notOwner.push(ids[io]);
    }
    if (notOwner.length > 0) {
      return jsonResponse({
        ok: false,
        error: { code: 'FORBIDDEN', message: 'Apenas o criador pode remanejar a reserva.' }
      });
    }

    // 7. Caso D — selecionou todas as ACTIVE do grupo?
    var activeNoGrupo = findActiveRowsByGroupId(sheet, groupIdOriginal);
    if (activeNoGrupo.length === ids.length) {
      return jsonResponse({
        ok: false,
        error: { code: 'VALIDATION', message: 'Não selecione o grupo inteiro; use updateReservationGroup.' }
      });
    }

    // Editáveis (lidos só do payload)
    var newSala       = String(body.payload.sala       || '').trim();
    var newInicio     = String(body.payload.inicio     || '').trim();
    var newFim        = String(body.payload.fim        || '').trim();
    var newTurma      = String(body.payload.turma      || '').trim();
    var newObservacao = sanitize(body.payload.observacao || '');

    // Sprint Disponibilidade S4 — pré-carga de aulas UMA vez antes do loop.
    // Fallback restritivo: erro ao ler aulas -> bloqueia como conflito.
    var registrosAulas;
    try {
      registrosAulas = parsePlanilha(ss);
    } catch (e) {
      Logger.log('[S4] Erro ao carregar aulas para verificação: ' + e.message);
      return jsonResponse({
        ok: false,
        error: { code: 'CONFLICT', message: 'Não foi possível verificar conflito com aulas.' }
      });
    }

    // 8-9. Revalida conflito em CADA selecionada — atomicidade lógica.
    var conflitos = [];
    for (var ic = 0; ic < ids.length; ic++) {
      var rowSel = rowsMap[ids[ic]].row;
      var pCheck = {
        sala:   newSala,
        data:   normalizeDate(rowSel[2]),
        inicio: newInicio,
        fim:    newFim
      };
      if (verificaAulaConflito(registrosAulas, pCheck.sala, pCheck.data,
                                pCheck.inicio, pCheck.fim)) {
        conflitos.push(pCheck.data);
      } else if (checkConflicts(sheet, pCheck, undefined, undefined, ids)) {
        conflitos.push(pCheck.data);
      }
    }
    if (conflitos.length > 0) {
      return jsonResponse({
        ok: false,
        error: {
          code: 'CONFLICT',
          message: 'Conflito em ' + conflitos.length + ' data(s) selecionada(s).',
          details: { conflicts: conflitos }
        }
      });
    }

    // 10. Novo groupId pras selecionadas
    var newGroupIdSelecionadas;
    if (ids.length === 1) {
      newGroupIdSelecionadas = ids[0];  // S=1 vira única (Fase A)
    } else {
      newGroupIdSelecionadas = Utilities.getUuid();  // S>=2 → UUID compartilhado
    }

    // 11. Destino da origem (não-selecionadas ACTIVE)
    var selectedSet = {};
    for (var is = 0; is < ids.length; is++) selectedSet[ids[is]] = true;
    var origem = [];
    for (var ie = 0; ie < activeNoGrupo.length; ie++) {
      if (!selectedSet[activeNoGrupo[ie].row[0]]) origem.push(activeNoGrupo[ie]);
    }
    // origem.length === 0 já bloqueado por caso D
    var origemVaiVirarUnica = (origem.length === 1);

    var now = new Date().toISOString();

    // 12. FLAG 2 — observabilidade do bloco de escrita
    Logger.log('updateReservationSelected START write: selecionadas=' + ids.length +
               ', origem=' + origem.length +
               ', newGroupId=' + newGroupIdSelecionadas +
               ', origemVirouUnica=' + origemVaiVirarUnica);

    // 13. Escrita das selecionadas
    var reservasAtualizadas = [];
    for (var iw = 0; iw < ids.length; iw++) {
      var found = rowsMap[ids[iw]];
      var rowOrig = found.row;

      var preservedId         = rowOrig[0];
      var preservedData       = rowOrig[2];
      var preservedProfessor  = rowOrig[5];
      var preservedStatus     = rowOrig[8];
      var preservedCreatedBy  = rowOrig[9];
      var preservedCreatedAt  = rowOrig[10];
      var preservedClientId   = rowOrig[12];

      var novaRow = [
        preservedId,                   // 0  A id            (PRESERVADO)
        newSala,                       // 1  B sala
        preservedData,                 // 2  C data          (PRESERVADO — propria)
        newInicio,                     // 3  D inicio
        newFim,                        // 4  E fim
        preservedProfessor,            // 5  F professor     (PRESERVADO)
        newTurma,                      // 6  G turma
        newObservacao,                 // 7  H observacao
        preservedStatus,               // 8  I status        (PRESERVADO == ACTIVE)
        preservedCreatedBy,            // 9  J createdBy     (PRESERVADO)
        preservedCreatedAt,            // 10 K createdAt     (PRESERVADO)
        now,                           // 11 L updatedAt
        preservedClientId,             // 12 M clientReqId   (PRESERVADO — audit do create)
        newGroupIdSelecionadas         // 13 N groupId       — NOVO (regra C3)
      ];

      sheet.getRange(found.sheetRowIndex, 2, 1, 13).setValues([novaRow.slice(1)]);
      sheet.getRange(found.sheetRowIndex, 3, 1, 3).setNumberFormat('@');
      reservasAtualizadas.push(rowToObj(novaRow));
    }

    // 14. Escrita da origem (se virou única)
    if (origemVaiVirarUnica) {
      var orphanFound = origem[0];
      var orphanId = orphanFound.row[0];
      // Col N (groupId) = 1-based col 14. Col L (updatedAt) = 1-based col 12.
      sheet.getRange(orphanFound.sheetRowIndex, 14).setValue(orphanId);
      sheet.getRange(orphanFound.sheetRowIndex, 12).setValue(now);
      Logger.log('updateReservationSelected: origem resta 1, id=' + orphanId + ' virou unica.');
    }

    Logger.log('updateReservationSelected END write: ok. ' +
               'selecionadasEscritas=' + reservasAtualizadas.length +
               ', origemVirouUnica=' + origemVaiVirarUnica);

    return jsonResponse({
      ok: true,
      data: { count: reservasAtualizadas.length, reservations: reservasAtualizadas },
      error: null
    });

  } catch (err) {
    Logger.log('ERRO em updateReservationSelected: ' + err.stack);
    return jsonResponse({
      ok: false,
      error: { code: 'INTERNAL', message: 'Erro interno ao remanejar selecionadas.' }
    });
  } finally {
    lock.releaseLock();
  }
}

function validateSelectedUpdatePayload(body) {
  if (!body || typeof body !== 'object') {
    return 'Body inválido.';
  }
  if (!body.userEmail || !String(body.userEmail).trim()) {
    return 'userEmail é obrigatório.';
  }
  if (!body.payload || typeof body.payload !== 'object') {
    return 'payload é obrigatório.';
  }
  if (!Array.isArray(body.payload.ids) || body.payload.ids.length === 0) {
    return 'payload.ids deve ser array não-vazio.';
  }

  // Cada id non-empty string
  for (var i = 0; i < body.payload.ids.length; i++) {
    var idi = body.payload.ids[i];
    if (typeof idi !== 'string' || !idi.trim()) {
      return 'payload.ids[' + i + '] inválido (deve ser string não-vazia).';
    }
  }

  // Duplicatas (Set check)
  var seen = {};
  for (var j = 0; j < body.payload.ids.length; j++) {
    var key = String(body.payload.ids[j]).trim();
    if (seen[key]) return 'payload.ids contém duplicatas.';
    seen[key] = true;
  }

  var p = body.payload;
  if (!p.sala    || !String(p.sala).trim())    return 'Sala é obrigatória.';
  if (!p.inicio  || !String(p.inicio).trim())  return 'Horário de início é obrigatório.';
  if (!p.fim     || !String(p.fim).trim())     return 'Horário de fim é obrigatório.';

  var ini = toMinutes(p.inicio);
  var fim = toMinutes(p.fim);
  if (isNaN(ini) || isNaN(fim))                return 'Formato de horário inválido. Use HH:MM.';
  if (ini < 360)                               return 'Horário mínimo permitido: 06:00.';
  if (fim > 1380)                              return 'Horário máximo permitido: 23:00.';
  if (fim <= ini)                              return 'Horário de fim deve ser após o início.';

  // FLAG TURMA — assimetria deliberada com o create. Remover esta linha se
  // reservas legacy sem turma precisarem ser remanejadas via seleção.
  if (!p.turma   || !String(p.turma).trim())   return 'Turma é obrigatória.';

  return null;
}

function findRowsByIdsMap(sheet, ids) {
  var dados = sheet.getDataRange().getValues();
  var wanted = {};
  for (var i = 0; i < ids.length; i++) wanted[ids[i]] = true;

  var result = {};
  for (var k = 1; k < dados.length; k++) {
    var id = dados[k][0];
    if (wanted[id]) {
      // dados[0] = header (sheet row 1); dados[k] → sheet row k+1.
      result[id] = { row: dados[k], sheetRowIndex: k + 1 };
    }
  }
  return result;
}





function debugDetectarBlocos(nomeAba) {
  // Cores conhecidas (lowercase, formato hex retornado por getBackgrounds).
  var COR_TURNO = {
    '#c5e0b3': 'M',  // verde — Manhã
    '#ffe598': 'V',  // amarelo — Tarde
    '#b4c6e7': 'N'   // azul — Noite
  };

  // SPREADSHEET_ID está no escopo global do codigo.gs.
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    Logger.log('=== ' + nomeAba + ' — ABA NÃO ENCONTRADA ===');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 1) {
    Logger.log('=== ' + nomeAba + ' — VAZIA (lastRow=' + lastRow + ') ===');
    return;
  }

  // Lê a coluna A inteira (datas + cabeçalhos vazios).
  var colA = sheet.getRange(1, 1, lastRow, 1).getValues();

  // ── Estratégia 1: detectar blocos por reinício de data ──
  // sheetRow é 1-based; array index é 0-based. inicioBloco e fim guardam
  // sheet-rows (1-based).
  var blocosPorData = [];
  var inicioBloco = null;
  var ultimoDia = null;

  for (var i = 0; i < colA.length; i++) {
    var sheetRow = i + 1;
    var val = colA[i][0];

    if (val instanceof Date) {
      var dia = val.getDate();
      if (ultimoDia !== null && dia < ultimoDia) {
        // Reinício: fecha o bloco anterior na linha anterior, abre novo aqui.
        blocosPorData.push({ inicio: inicioBloco, fim: sheetRow - 1 });
        inicioBloco = sheetRow;
      } else if (inicioBloco === null) {
        // Primeira data válida — abre o primeiro bloco.
        inicioBloco = sheetRow;
      }
      ultimoDia = dia;
    }
  }
  // Fecha o último bloco (se houver bloco aberto).
  if (inicioBloco !== null) {
    blocosPorData.push({ inicio: inicioBloco, fim: lastRow });
  }

  Logger.log('=== ' + nomeAba + ' — blocos por REINÍCIO DE DATA ===');
  Logger.log('  lastRow=' + lastRow + ', blocos detectados=' + blocosPorData.length);
  for (var bi = 0; bi < blocosPorData.length; bi++) {
    var b = blocosPorData[bi];
    Logger.log('  bloco ' + (bi + 1) + ': linhas ' + b.inicio + '-' + b.fim +
               ' (' + (b.fim - b.inicio + 1) + ' linhas)');
  }

  // ── Estratégia 2: cor de fundo dominante por bloco (validação cruzada) ──
  // Lê backgrounds de B:K (10 colunas) e conta cores conhecidas por bloco.
  // Branco e cores desconhecidas são ignorados na contagem (não contam pra
  // detecção, mas o total ajuda a ver "ruído").
  Logger.log('--- cor de fundo dominante (B:K, 10 cols) por bloco ---');
  for (var bj = 0; bj < blocosPorData.length; bj++) {
    var bl = blocosPorData[bj];
    var numLinhas = bl.fim - bl.inicio + 1;
    if (numLinhas <= 0) {
      Logger.log('  bloco ' + (bj + 1) + ': SEM LINHAS (intervalo inválido)');
      continue;
    }

    var bgs = sheet.getRange(bl.inicio, 2, numLinhas, 10).getBackgrounds();
    var contagem = { M: 0, V: 0, N: 0 };
    var outras = 0;
    var brancas = 0;
    for (var r = 0; r < bgs.length; r++) {
      for (var c = 0; c < bgs[r].length; c++) {
        var hex = String(bgs[r][c]).toLowerCase();
        var turno = COR_TURNO[hex];
        if (turno) {
          contagem[turno] += 1;
        } else if (hex === '#ffffff' || hex === '') {
          brancas += 1;
        } else {
          outras += 1;
        }
      }
    }

    // Determina turno dominante entre as cores conhecidas.
    var dominante = '?';
    var maior = 0;
    if (contagem.M > maior) { maior = contagem.M; dominante = 'M'; }
    if (contagem.V > maior) { maior = contagem.V; dominante = 'V'; }
    if (contagem.N > maior) { maior = contagem.N; dominante = 'N'; }
    if (maior === 0) dominante = '(nenhuma cor de turno encontrada)';

    Logger.log('  bloco ' + (bj + 1) + ' (linhas ' + bl.inicio + '-' + bl.fim + '): ' +
               'M=' + contagem.M + ', V=' + contagem.V + ', N=' + contagem.N +
               ', brancas=' + brancas + ', outras=' + outras +
               ' → dominante=' + dominante);
  }

  Logger.log('=== ' + nomeAba + ': total=' + blocosPorData.length +
             ' (esperado pelo snapshot: 3) ===');
}


// Helper pra rodar todas as abas mensais conhecidas de uma vez.
// Ajuste a lista se a planilha DEV tiver outras abas mensais.
function debugTodasAbas() {
  var ABAS = ['Janeiro', 'Fevereiro', 'Abril', 'Maio', 'Junho'];
  for (var i = 0; i < ABAS.length; i++) {
    debugDetectarBlocos(ABAS[i]);
    Logger.log('');
  }
}


function detectarLimitesBlocos(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];

  var colA = sheet.getRange(1, 1, lastRow, 1).getValues();
  var blocos = [];
  var inicioBloco = null;
  var ultimoDia = null;

  for (var i = 0; i < colA.length; i++) {
    var sheetRow = i + 1;          // 1-based
    var val = colA[i][0];
    if (val instanceof Date) {
      var dia = val.getDate();
      if (ultimoDia !== null && dia < ultimoDia) {
        // Reinício de data → fecha bloco anterior, abre novo.
        blocos.push({ inicio: inicioBloco, fim: sheetRow - 1 });
        inicioBloco = sheetRow;
      } else if (inicioBloco === null) {
        // Primeira data válida.
        inicioBloco = sheetRow;
      }
      ultimoDia = dia;
    }
  }
  if (inicioBloco !== null) {
    blocos.push({ inicio: inicioBloco, fim: lastRow });
  }

  // Validação defensiva: só confia se achou exatamente 3 blocos (M/V/N).
  if (blocos.length !== 3) return [];
  return blocos;
}


// ─────────────────────────────────────────────────────────────
// BLOCO 3 — COLAR turnoPorBloco (NOVA)
//
// Dada a linha (1-based) e os limites de 3 blocos, retorna o turno.
// Ordem dos blocos validada na B3.1: 0=M, 1=V, 2=N (universal nas 5 abas).
// Retorna null pra linhas fora de qualquer bloco (cabeçalho/rodapé) ou
// quando limites é vazio (aba não passou na validação dos 3 blocos).
// ─────────────────────────────────────────────────────────────
function turnoPorBloco(sheetRow, limites) {
  if (!limites || limites.length !== 3) return null;
  var TURNOS = ['M', 'V', 'N'];
  for (var b = 0; b < 3; b++) {
    if (sheetRow >= limites[b].inicio && sheetRow <= limites[b].fim) {
      return TURNOS[b];
    }
  }
  return null;
}


// ─── B3.2 — TESTE DE VALIDAÇÃO (read-only, descartável) ───
function debugTestarTurnoPorBloco() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID); // ou getActiveSpreadsheet()
  var registros = parsePlanilha(ss);

  // 1. Quantos registros agora têm turno por bloco vs null?
  var comTurno = 0, semTurno = 0;
  var amostraComTurno = [];
  var amostraSemTurno = [];
  registros.forEach(function(r) {
    if (r.turno) {
      comTurno++;
      if (amostraComTurno.length < 5) amostraComTurno.push(r.turma + '→' + r.turno + ' (' + r.mes + ')');
    } else {
      semTurno++;
      if (amostraSemTurno.length < 5) amostraSemTurno.push(r.turma + ' (' + r.mes + ')');
    }
  });

  Logger.log('=== B3.2 — turno por bloco ===');
  Logger.log('Total registros: ' + registros.length);
  Logger.log('COM turno (bloco): ' + comTurno);
  Logger.log('SEM turno (null → fallback Lista no front): ' + semTurno);
  Logger.log('Amostra COM turno: ' + JSON.stringify(amostraComTurno));
  Logger.log('Amostra SEM turno: ' + JSON.stringify(amostraSemTurno));

  // 2. Caso específico: TEC.AUT.006 (órfã da Lista, estava em bloco N no Maio)
  var tec = registros.filter(function(r) { return r.turma.indexOf('TEC.AUT.006') !== -1; });
  Logger.log('--- TEC.AUT.006 (órfã da Lista) ---');
  tec.slice(0, 5).forEach(function(r) {
    Logger.log('  ' + r.mes + ' ' + r.data + ' sala=' + r.sala + ' → turno=' + r.turno);
  });
}