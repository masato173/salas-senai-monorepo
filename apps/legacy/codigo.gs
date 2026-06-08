// ============================================================
// CONTROLE DE SALAS SENAI — Google Apps Script
// Versão limpa — bugs de runtime corrigidos:
//   [1] Cache removido — cache.put() explode com payload > 100KB (3.485 registros)
//   [2] Variável 'c' redeclarada — trocada por 'col' no segundo loop
//   [3] err.message não exposto ao cliente — vai só pro Logger
//   [4] TURNOS_VALIDOS whitelist mantida
//   [5] getTurnoMap com .find().trim() mantido
//
// Após salvar: Implantar → Gerenciar implantações → lápis
//              → Nova versão → Implantar
// ============================================================

var SPREADSHEET_ID = '1m97CzLNYJIqTq3qECYtpGgeS_skIL0B3eoWNlx7edXk';
var SECRET_TOKEN   = 'senai@2026';
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
          registros.push({ data: dateStr, sala: sala, turma: turma, mes: mes });
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
