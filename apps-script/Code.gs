/**
 * PPA-Cost 기록 서버 (Google Apps Script, 스프레드시트에 연결된 스크립트)
 * - 접속 키는 코드에 넣지 않고 스크립트 속성 PPA_KEY 에 저장합니다.
 * - 데이터는 'records' 시트에 저장됩니다.
 */
var SHEET_NAME = 'records';
var HEAD = ['id', 'date', 'side', 'level', 'spot', 'gap', 'price', 'manual', 'deleted', 'updatedAt'];

function doGet() {
  return out_({ ok: true, service: 'ppa-cost' });
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var key = PropertiesService.getScriptProperties().getProperty('PPA_KEY');
    if (!key || req.key !== key) return out_({ ok: false, error: 'unauthorized' });
    if (req.collection !== 'records') return out_({ ok: false, error: 'bad_collection' });
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var sh = sheet_();
      if (req.action === 'list') return out_({ ok: true, docs: list_(sh) });
      if (req.action === 'get') return out_({ ok: true, doc: get_(sh, req.id) });
      if (req.action === 'set') return out_(set_(sh, req.id, req.data || {}));
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

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, 1, HEAD.length).setValues([HEAD]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), 3).setNumberFormat('@'); // id, date, side 는 텍스트
  }
  return sh;
}

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  return v;
}

function rowToDoc_(row) {
  var d = {};
  for (var i = 1; i < HEAD.length; i++) {
    var v = cell_(row[i]);
    if (v === '' || v === null) continue;
    if (HEAD[i] === 'updatedAt') continue;
    if (HEAD[i] === 'manual' || HEAD[i] === 'deleted') v = (v === true || v === 'TRUE' || v === 'true');
    d[HEAD[i]] = v;
  }
  return d;
}

function list_(sh) {
  var n = sh.getLastRow();
  if (n < 2) return [];
  var rows = sh.getRange(2, 1, n - 1, HEAD.length).getValues();
  var docs = [];
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i][0]) continue;
    docs.push({ id: String(rows[i][0]), data: rowToDoc_(rows[i]) });
  }
  return docs;
}

function findRow_(sh, id) {
  var n = sh.getLastRow();
  if (n < 2) return -1;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}

function get_(sh, id) {
  var r = findRow_(sh, id);
  if (r < 0) return null;
  return rowToDoc_(sh.getRange(r, 1, 1, HEAD.length).getValues()[0]);
}

function set_(sh, id, data) {
  if (!id) return { ok: false, error: 'bad_id' };
  var row = [id];
  for (var i = 1; i < HEAD.length; i++) {
    var f = HEAD[i];
    row.push(f === 'updatedAt' ? new Date() : (data[f] === undefined || data[f] === null ? '' : data[f]));
  }
  var r = findRow_(sh, id);
  if (r < 0) r = sh.getLastRow() + 1;
  sh.getRange(r, 1, 1, 3).setNumberFormat('@');
  sh.getRange(r, 1, 1, HEAD.length).setValues([row]);
  return { ok: true };
}

function delete_(sh, id) {
  var r = findRow_(sh, id);
  if (r > 0) sh.deleteRow(r);
  return { ok: true };
}
