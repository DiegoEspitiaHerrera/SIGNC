/**
 * Capa de repositorio desacoplada sobre Google Sheets.
 * Todas las lecturas y escrituras se realizan en lote (getValues / setValues).
 */

/**
 * Ejecuta una función crítica bajo ScriptLock para evitar colisiones de consecutivos o estado.
 * @param {Function} fn
 * @return {*}
 */
function withScriptLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/**
 * Genera un identificador único con prefijo de módulo.
 * @param {string} prefix
 * @return {string}
 */
function generateId(prefix) {
  var shortUuid = Utilities.getUuid().split('-')[0].toUpperCase();
  var ts = new Date().getTime().toString(36).toUpperCase();
  return (prefix ? prefix + '-' : '') + ts + '-' + shortUuid;
}

/**
 * Lee todas las filas de una hoja y las convierte en arreglo de objetos usando la fila 1 como encabezados.
 * @param {string} sheetName
 * @return {Array<Object>}
 */
function repoGetAll(sheetName) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Hoja no encontrada: ' + sheetName);
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) {
    return [];
  }
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      var key = String(headers[c]).trim();
      if (!key) continue;
      var val = values[r][c];
      if (val !== '' && val !== null && val !== undefined) {
        hasData = true;
      }
      rowObj[key] = val;
    }
    if (hasData) {
      rows.push(rowObj);
    }
  }
  return rows;
}

/**
 * Lee filas filtradas estrictamente por empresa_id (aislamiento multiempresa).
 * @param {string} sheetName
 * @param {string} empresaId
 * @param {boolean=} includeGlobal
 * @return {Array<Object>}
 */
function repoGetByEmpresa(sheetName, empresaId, includeGlobal) {
  var all = repoGetAll(sheetName);
  return all.filter(function(row) {
    if (includeGlobal && row.empresa_id === 'GLOBAL') return true;
    return row.empresa_id === empresaId;
  });
}

/**
 * Inserta una fila en la hoja respetando el orden exacto de los encabezados.
 * @param {string} sheetName
 * @param {Object} record
 * @return {Object}
 */
function repoInsert(sheetName, record) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Hoja no encontrada: ' + sheetName);
  }
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rowValues = headers.map(function(h) {
    var key = String(h).trim();
    return record.hasOwnProperty(key) && record[key] !== undefined ? record[key] : '';
  });
  var nextRow = sheet.getLastRow() + 1;
  sheet.getRange(nextRow, 1, 1, headers.length).setValues([rowValues]);
  return record;
}

/**
 * Actualiza una fila por su columna 'id' (y valida empresa_id si se provee).
 * @param {string} sheetName
 * @param {string} id
 * @param {Object} patch
 * @param {string=} empresaId
 * @return {Object}
 */
function repoUpdateById(sheetName, id, patch, empresaId) {
  var ss = getDbSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Hoja no encontrada: ' + sheetName);
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) {
    throw new Error('Registro no encontrado: ' + id);
  }
  var values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[0].map(function(h) { return String(h).trim(); });
  var idIdx = headers.indexOf('id');
  var empIdx = headers.indexOf('empresa_id');

  for (var r = 1; r < values.length; r++) {
    if (String(values[r][idIdx]) === String(id)) {
      if (empresaId && empIdx !== -1 && String(values[r][empIdx]) !== String(empresaId)) {
        throw new Error('Acceso denegado al registro fuera de tu empresa.');
      }
      var updatedObj = {};
      for (var c = 0; c < headers.length; c++) {
        var key = headers[c];
        if (!key) continue;
        if (patch.hasOwnProperty(key) && patch[key] !== undefined) {
          values[r][c] = patch[key];
        }
        updatedObj[key] = values[r][c];
      }
      sheet.getRange(r + 1, 1, 1, headers.length).setValues([values[r]]);
      return updatedObj;
    }
  }
  throw new Error('Registro no encontrado: ' + id);
}

/**
 * Registra un evento en la tabla polimórfica HIS_Historial.
 * @param {Object} entry
 */
function repoLogHistorial(entry) {
  var record = {
    id: generateId('HIS'),
    empresa_id: entry.empresa_id,
    modulo: entry.modulo || 'CORE',
    entidad_id: entry.entidad_id || '',
    evento: entry.evento,
    fase_anterior: entry.fase_anterior || '',
    fase_nueva: entry.fase_nueva || '',
    estado_anterior: entry.estado_anterior || '',
    estado_nuevo: entry.estado_nuevo || '',
    usuario_id: entry.usuario_id || '',
    motivo: entry.motivo || '',
    creado_en: new Date().toISOString()
  };
  return repoInsert(SHEETS.HISTORIAL, record);
}
