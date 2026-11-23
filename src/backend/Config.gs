/**
 * Configuración global, constantes de hojas, roles, fases y estados de SIGNC.
 * Alineado con docs/MDD-002_Modelo_Datos_Sheets.md y docs/DDS-004_Maquina_Estados_Permisos.md.
 */

var PROP_KEYS = {
  SPREADSHEET_ID: 'SIGNC_SPREADSHEET_ID',
  DRIVE_FOLDER_ID: 'SIGNC_DRIVE_FOLDER_ID'
};

var SHEETS = {
  EMPRESAS: 'EMP_Empresas',
  AREAS: 'ARE_Areas',
  PROCESOS: 'PRO_Procesos',
  USUARIOS: 'USR_Usuarios',
  CATALOGOS: 'CFG_Catalogos',
  EVIDENCIAS: 'EVI_Evidencias',
  HISTORIAL: 'HIS_Historial',
  SNC_HALLAZGOS: 'SNC_Hallazgos',
  SNC_CORRECCIONES: 'SNC_Correcciones',
  SNC_ASIGNACIONES: 'SNC_Asignaciones',
  SNC_ANALISIS: 'SNC_Analisis',
  SNC_PLANES: 'SNC_Planes',
  SNC_ACTIVIDADES: 'SNC_Actividades',
  SNC_COSTOS: 'SNC_Costos',
  AUD_PLANTILLAS: 'AUD_Plantillas',
  AUD_CRITERIOS: 'AUD_Criterios',
  AUD_AUDITORIAS: 'AUD_Auditorias',
  AUD_RESPUESTAS: 'AUD_Respuestas'
};

var ROLES = {
  ADMIN: 'ADMIN',
  GERENCIA: 'GERENCIA',
  COORDINADOR: 'COORDINADOR',
  LIDER: 'LIDER',
  COLABORADOR: 'COLABORADOR'
};

var FASES = {
  SOLICITUD: 'SOLICITUD',
  ASIGNACION: 'ASIGNACION',
  DESARROLLO: 'DESARROLLO',
  ANALISIS: 'ANALISIS',
  REVISION: 'REVISION',
  FINALIZACION: 'FINALIZACION'
};

var ESTADOS = {
  PENDIENTE: 'PENDIENTE',
  ACTIVA: 'ACTIVA',
  PAUSADA: 'PAUSADA',
  CERRADA: 'CERRADA',
  ANULADA: 'ANULADA'
};

/**
 * Obtiene el Spreadsheet principal configurado en ScriptProperties.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getDbSpreadsheet() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.SPREADSHEET_ID);
  if (!id) {
    throw new Error('Base de datos no inicializada. Ejecuta setupInicial() desde el editor de Apps Script.');
  }
  return SpreadsheetApp.openById(id);
}

/**
 * Obtiene el ID de la carpeta raíz de evidencias en Drive.
 * @return {string}
 */
function getRootDriveFolderId() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.DRIVE_FOLDER_ID);
  if (!id) {
    throw new Error('Carpeta de evidencias no inicializada. Ejecuta setupInicial().');
  }
  return id;
}

/**
 * Respuesta estándar exitosa para llamadas RPC del frontend.
 * @param {*} data
 * @return {{ok: boolean, data: *}}
 */
function okResponse(data) {
  return { ok: true, data: data };
}

/**
 * Respuesta estándar de error para llamadas RPC del frontend.
 * @param {Error|string} err
 * @return {{ok: boolean, error: string}}
 */
function errorResponse(err) {
  var msg = (err && err.message) ? err.message : String(err || 'Error interno inesperado.');
  console.error('SIGNC_ERROR:', err);
  return { ok: false, error: msg };
}
