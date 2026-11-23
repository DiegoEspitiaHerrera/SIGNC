/**
 * Gestión de archivos de evidencia en Google Drive, organizados por Empresa / Módulo / Entidad.
 */

/**
 * Obtiene o crea una subcarpeta dentro de una carpeta padre.
 * @param {GoogleAppsScript.Drive.Folder} parentFolder
 * @param {string} name
 * @return {GoogleAppsScript.Drive.Folder}
 */
function getOrCreateSubfolder(parentFolder, name) {
  var safeName = String(name || 'GENERAL').replace(/[\\/:*?"<>|]/g, '_');
  var iter = parentFolder.getFoldersByName(safeName);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(safeName);
}

/**
 * Sube un archivo en base64 a Drive y registra la fila en EVI_Evidencias.
 * @param {Object} user Sesión validada
 * @param {Object} payload { modulo, entidad_tipo, entidad_id, nombre_archivo, mime_type, base64 }
 * @return {Object} registro de evidencia
 */
function driveUploadEvidence(user, payload) {
  if (!payload || !payload.base64 || !payload.nombre_archivo) {
    throw new Error('Archivo inválido para subir.');
  }
  var rootFolder = DriveApp.getFolderById(getRootDriveFolderId());
  var empFolder = getOrCreateSubfolder(rootFolder, user.empresa_id);
  var modFolder = getOrCreateSubfolder(empFolder, payload.modulo || 'SNC');
  var entFolder = getOrCreateSubfolder(modFolder, payload.entidad_id || 'SIN_ID');

  var bytes = Utilities.base64Decode(payload.base64);
  var blob = Utilities.newBlob(bytes, payload.mime_type || 'application/octet-stream', payload.nombre_archivo);
  var file = entFolder.createFile(blob);

  var record = {
    id: generateId('EVI'),
    empresa_id: user.empresa_id,
    modulo: payload.modulo || 'SNC',
    entidad_tipo: payload.entidad_tipo || 'HALLAZGO',
    entidad_id: payload.entidad_id,
    nombre_archivo: payload.nombre_archivo,
    drive_file_id: file.getId(),
    url: file.getUrl(),
    subido_por_id: user.id,
    creado_en: new Date().toISOString()
  };
  return repoInsert(SHEETS.EVIDENCIAS, record);
}
