/**
 * PPA-Cost 기록 서버 (Google Apps Script)
 * - 접속 키는 스크립트 속성 PPA_KEY 에 저장합니다.
 * - 스프레드시트에 연결되지 않은 스크립트면 스크립트 속성 SHEET_ID 에 스프레드시트 ID 를 넣습니다.
 * - 'records' 탭: 체결강도·체결가 기록, 'spot' 탭: 일자별 SMP/REC(현물가)
 */
var COLLECTIONS = {
  records: {
    sheet: 'records',
    head: ['id', 'date', 'side', 'level', 'spot', 'gap', 'price', 'manual', 'deleted', 'updatedAt'],
    textCols: 3,
    bools: ['manual', 'deleted']
  },
  spot: {
    sheet: 'spot',
    head: ['id', 'date', 'smp', 'rec', 'total', 'source', 'updatedAt'],
    textCols: 2,
    bools: []
  }
};

/** 편집기에서 한 번 실행해 권한을 승인하고 탭을 만듭니다. */
function setup() {
  sheet_(COLLECTIONS.records);
  sheet_(COLLECTIONS.spot);
}

function doGet() {
  return out_({ ok: true, service: 'ppa-cost' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('PPA_KEY');
    if (!key || req.key !== key) return out_({ ok: false, error: 'unauthorized' });
    var cfg = COLLECTIONS[req.collection];
    if (!cfg) return out_({ ok: false, error: 'bad_collection' });
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var sh = sheet_(cfg);
      if (req.action === 'list') return out_({ ok: true, docs: list_(sh, cfg) });
      if (req.action === 'get') return out_({ ok: true, doc: get_(sh, cfg, req.id) });
      if (req.action === 'set') return out_(set_(sh, cfg, req.id, req.data || {}));
      if (req.action === 'delete') return out_(delete_(sh, req.id));
      return out_({ ok: false, error: 'bad_action' });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(cfg) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    if (!id) throw new Error('SHEET_ID 속성이 필요합니다(스프레드시트에 연결되지 않은 스크립트)');
    ss = SpreadsheetApp.openById(id);
  }
  var sh = ss.getSheetByName(cfg.sheet);
  if (!sh) {
    sh = ss.insertSheet(cfg.sheet);
    sh.getRange(1, 1, 1, cfg.head.length).setValues([cfg.head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), cfg.textCols).setNumberFormat('@'); // id, date(, side) 는 텍스트
  }
  return sh;
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd');
  return v;
}

function rowToDoc_(cfg, row) {
  var d = {};
  for (var i = 1; i < cfg.head.length; i++) {
    var f = cfg.head[i];
    if (f === 'updatedAt') continue;
    var v = cell_(row[i]);
    if (v === '' || v === null) continue;
    if (cfg.bools.indexOf(f) >= 0) v = (v === true || v === 'TRUE' || v === 'true');
    d[f] = v;
  }
  return d;
}

function list_(sh, cfg) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  var rows = sh.getRange(2, 1, n - 1, cfg.head.length).getValues();
  var docs = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    docs.push({ id: String(cell_(rows[i][0])), data: rowToDoc_(cfg, rows[i]) });
  }
  return docs;
}

function findRow_(sh, id) {
  var n = sh.getLastRow();
  if (n < 2) return -1;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(cell_(ids[i][0])) === String(id)) return i + 2;
  return -1;
}

function get_(sh, cfg, id) {
  var r = findRow_(sh, id);
  if (r < 0) return null;
  return rowToDoc_(cfg, sh.getRange(r, 1, 1, cfg.head.length).getValues()[0]);
}

function set_(sh, cfg, id, data) {
  if (!id) return { ok: false, error: 'bad_id' };
  var row = [id];
  for (var i = 1; i < cfg.head.length; i++) {
    var f = cfg.head[i];
    row.push(f === 'updatedAt' ? new Date() : (data[f] === undefined || data[f] === null ? '' : data[f]));
  }
  var r = findRow_(sh, id);
  if (r < 0) r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, cfg.textCols).setNumberFormat('@');
  sh.getRange(r, 1, 1, cfg.head.length).setValues([row]);
  return { ok: true };
}

function delete_(sh, id) {
  var r = findRow_(sh, id);
  if (r > 0) sh.deleteRow(r);
  return { ok: true };
}
