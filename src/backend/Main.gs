/**
 * Punto de entrada de la Web App (doGet) y endpoints RPC expuestos a google.script.run.
 */

/**
 * Sirve la interfaz principal HTML5 responsiva.
 * @return {GoogleAppsScript.HTML.HtmlOutput}
 */
function doGet() {
  var template = HtmlService.createTemplateFromFile('frontend/Index');
  return template.evaluate()
    .setTitle('SIGNC — Control de Calidad')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Incluye parciales HTML (CSS / JS / componentes).
 * @param {string} filename
 * @return {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Endpoint RPC: Login propio.
 * @param {string} usuario
 * @param {string} password
 * @return {Object}
 */
function apiLogin(usuario, password) {
  try {
    return okResponse(authLogin(usuario, password));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Cierre de sesión.
 * @param {string} token
 * @return {Object}
 */
function apiLogout(token) {
  try {
    return okResponse(authLogout(token));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Carga inicial agrupada (minimiza llamadas google.script.run).
 * Retorna datos del usuario en sesión, catálogos, áreas, procesos y usuarios de la misma empresa.
 * @param {string} token
 * @return {Object}
 */
function apiGetBootstrap(token) {
  try {
    var user = requireSession(token);
    var empId = user.empresa_id;

    var empresas = repoGetAll(SHEETS.EMPRESAS).filter(function(e) { return e.id === empId; });
    var areas = repoGetByEmpresa(SHEETS.AREAS, empId).filter(function(a) { return a.activa !== false && String(a.activa).toUpperCase() !== 'FALSE'; });
    var procesos = repoGetByEmpresa(SHEETS.PROCESOS, empId).filter(function(p) { return p.activo !== false && String(p.activo).toUpperCase() !== 'FALSE'; });
    var catalogos = repoGetByEmpresa(SHEETS.CATALOGOS, empId, true).filter(function(c) { return c.activo !== false && String(c.activo).toUpperCase() !== 'FALSE'; });
    var usuarios = repoGetByEmpresa(SHEETS.USUARIOS, empId)
      .filter(function(u) { return u.activo !== false && String(u.activo).toUpperCase() !== 'FALSE'; })
      .map(function(u) {
        return { id: u.id, nombre: u.nombre, area_id: u.area_id, rol: u.rol };
      });

    return okResponse({
      user: user,
      empresa: empresas[0] || { id: empId, nombre: 'Empresa' },
      areas: areas,
      procesos: procesos,
      catalogos: catalogos,
      usuarios: usuarios
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Dashboard y lista de SNC visibles según rol.
 * @param {string} token
 * @return {Object}
 */
function apiGetSncDashboard(token) {
  try {
    var user = requireSession(token);
    return okResponse(sncGetDashboardData(user));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Expediente completo de una NC/OM.
 * @param {string} token
 * @param {string} hallazgoId
 * @return {Object}
 */
function apiGetSncDetail(token, hallazgoId) {
  try {
    var user = requireSession(token);
    return okResponse(sncGetDetail(user, hallazgoId));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Crear nueva solicitud de NC/OM.
 * @param {string} token
 * @param {Object} payload
 * @return {Object}
 */
function apiCreateSnc(token, payload) {
  try {
    var user = requireSession(token);
    return okResponse(sncCreate(user, payload));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Ejecutar transición o acción sobre una NC/OM.
 * @param {string} token
 * @param {Object} payload
 * @return {Object}
 */
function apiSncAction(token, payload) {
  try {
    var user = requireSession(token);
    return okResponse(sncExecuteAction(user, payload));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Subir evidencia en base64 a Google Drive.
 * @param {string} token
 * @param {Object} payload
 * @return {Object}
 */
function apiUploadEvidence(token, payload) {
  try {
    var user = requireSession(token);
    return okResponse(driveUploadEvidence(user, payload));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Dashboard del Módulo 2 (Auditorías 5S).
 */
function apiGetAuditDashboard(token) {
  try {
    var user = requireSession(token);
    return okResponse(audGetDashboardData(user));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Crear nueva auditoría 5S.
 */
function apiCreateAudit(token, payload) {
  try {
    var user = requireSession(token);
    return okResponse(audCreate(user, payload));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Obtener detalle de auditoría y criterios.
 */
function apiGetAuditDetail(token, auditoriaId) {
  try {
    var user = requireSession(token);
    return okResponse(audGetDetail(user, auditoriaId));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: Finalizar auditoría 5S y generar NC si aplica.
 */
function apiFinalizeAudit(token, payload) {
  try {
    var user = requireSession(token);
    return okResponse(audFinalize(user, payload));
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Endpoint RPC: KPIs consolidados de Calidad.
 */
function apiGetKpis(token) {
  try {
    var user = requireSession(token);
    return okResponse(kpiGetSummary(user));
  } catch (err) {
    return errorResponse(err);
  }
}
