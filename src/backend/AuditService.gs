/**
 * Lógica de negocio del Módulo 2: Auditorías 5S e ISO 9001 + cálculo de KPIs.
 */

/**
 * Genera el siguiente consecutivo anual de auditoría (AUD-2026-001).
 * @param {string} empresaId
 * @return {string}
 */
function nextAuditConsecutivo_(empresaId) {
  var year = new Date().getFullYear();
  var tag = 'AUD-' + year + '-';
  var existing = repoGetByEmpresa(SHEETS.AUD_AUDITORIAS, empresaId);
  var maxNum = 0;
  existing.forEach(function(a) {
    var c = String(a.consecutivo || '');
    if (c.indexOf(tag) === 0) {
      var n = parseInt(c.replace(tag, ''), 10);
      if (!isNaN(n) && n > maxNum) maxNum = n;
    }
  });
  var next = String(maxNum + 1);
  while (next.length < 3) next = '0' + next;
  return tag + next;
}

/**
 * Retorna plantillas activas, auditorías de la empresa y promedio 5S.
 * @param {Object} user
 * @return {Object}
 */
function audGetDashboardData(user) {
  var plantillas = repoGetByEmpresa(SHEETS.AUD_PLANTILLAS, user.empresa_id)
    .filter(function(p) { return p.activa !== false && String(p.activa).toUpperCase() !== 'FALSE'; });
  var auditorias = repoGetByEmpresa(SHEETS.AUD_AUDITORIAS, user.empresa_id);
  auditorias.sort(function(a, b) {
    return String(b.consecutivo || '').localeCompare(String(a.consecutivo || ''));
  });
  return { plantillas: plantillas, auditorias: auditorias };
}

/**
 * Crea una nueva auditoría 5S en estado EN_CURSO.
 * @param {Object} user
 * @param {Object} payload { plantilla_id, area_id, proceso_id, responsable_area_id }
 * @return {Object}
 */
function audCreate(user, payload) {
  if (!payload || !payload.plantilla_id || !payload.area_id) {
    throw new Error('Selecciona la plantilla y el área a auditar.');
  }
  return withScriptLock(function() {
    var now = new Date().toISOString();
    var record = {
      id: generateId('AUD'),
      empresa_id: user.empresa_id,
      consecutivo: nextAuditConsecutivo_(user.empresa_id),
      plantilla_id: payload.plantilla_id,
      area_id: payload.area_id,
      proceso_id: payload.proceso_id || '',
      auditor_id: user.id,
      responsable_area_id: payload.responsable_area_id || '',
      fecha_programada: now.substring(0, 10),
      fecha_ejecucion: '',
      puntaje_obtenido: 0,
      puntaje_maximo: 0,
      porcentaje: 0,
      estado: 'EN_CURSO'
    };
    repoInsert(SHEETS.AUD_AUDITORIAS, record);
    repoLogHistorial({
      empresa_id: user.empresa_id,
      modulo: 'AUD',
      entidad_id: record.id,
      evento: 'CREACION',
      estado_nuevo: 'EN_CURSO',
      usuario_id: user.id,
      motivo: 'Inicio de auditoría ' + record.consecutivo
    });
    return record;
  });
}

/**
 * Obtiene el detalle de una auditoría con criterios de su plantilla y respuestas.
 * @param {Object} user
 * @param {string} auditoriaId
 * @return {Object}
 */
function audGetDetail(user, auditoriaId) {
  var all = repoGetByEmpresa(SHEETS.AUD_AUDITORIAS, user.empresa_id);
  var aud = all.filter(function(a) { return a.id === auditoriaId; })[0];
  if (!aud) throw new Error('Auditoría no encontrada.');

  var criterios = repoGetAll(SHEETS.AUD_CRITERIOS)
    .filter(function(c) { return c.plantilla_id === aud.plantilla_id; })
    .sort(function(a, b) { return Number(a.orden) - Number(b.orden); });

  var respuestas = repoGetAll(SHEETS.AUD_RESPUESTAS)
    .filter(function(r) { return r.auditoria_id === auditoriaId; });

  return { auditoria: aud, criterios: criterios, respuestas: respuestas };
}

/**
 * Finaliza una auditoría, calcula puntaje y crea NC automáticas para ítems marcados.
 * @param {Object} user
 * @param {Object} payload { auditoria_id, respuestas: [...] }
 * @return {Object}
 */
function audFinalize(user, payload) {
  if (!payload || !payload.auditoria_id || !Array.isArray(payload.respuestas)) {
    throw new Error('Datos de auditoría incompletos.');
  }

  var detail = audGetDetail(user, payload.auditoria_id);
  var aud = detail.auditoria;
  if (aud.estado === 'FINALIZADA') {
    throw new Error('Esta auditoría ya fue finalizada.');
  }

  var criteriosMap = {};
  detail.criterios.forEach(function(c) { criteriosMap[c.id] = c; });

  var obtenido = 0;
  var maximo = 0;
  var generatedSncs = [];

  payload.respuestas.forEach(function(r) {
    var crit = criteriosMap[r.criterio_id];
    if (!crit) return;
    var ptsMax = Number(crit.puntaje_max) || 0;
    var pts = 0;
    if (r.cumple === 'SI') {
      pts = ptsMax;
      obtenido += pts;
      maximo += ptsMax;
    } else if (r.cumple === 'NO') {
      maximo += ptsMax;
    }

    var sncId = '';
    if (r.cumple === 'NO' && r.generar_snc) {
      var snc = sncCreate(user, {
        tipo_hallazgo: 'SNC_REAL',
        origen_modulo: 'AUDITORIA',
        origen_referencia_id: aud.id,
        area_identifica_id: aud.area_id,
        proceso_identifica_id: aud.proceso_id,
        area_asignada_id: aud.area_id,
        responsable_actual_id: aud.responsable_area_id || '',
        resumen_solicitud: '[5S ' + crit.categoria + '] ' + (r.observacion || crit.pregunta),
        origen_snc: 'Auditoría',
        fuente_deteccion: 'Ejecución del proceso'
      });
      sncId = snc.id;
      generatedSncs.push(snc.consecutivo);
    }

    repoInsert(SHEETS.AUD_RESPUESTAS, {
      id: generateId('RES'),
      auditoria_id: aud.id,
      criterio_id: crit.id,
      cumple: r.cumple,
      puntaje: pts,
      observacion: r.observacion || '',
      hallazgo_snc_id: sncId
    });
  });

  var porcentaje = maximo > 0 ? Math.round((obtenido / maximo) * 100) : 0;
  var updated = withScriptLock(function() {
    var upd = repoUpdateById(SHEETS.AUD_AUDITORIAS, aud.id, {
      fecha_ejecucion: new Date().toISOString().substring(0, 10),
      puntaje_obtenido: obtenido,
      puntaje_maximo: maximo,
      porcentaje: porcentaje,
      estado: 'FINALIZADA'
    }, user.empresa_id);

    repoLogHistorial({
      empresa_id: user.empresa_id,
      modulo: 'AUD',
      entidad_id: aud.id,
      evento: 'CIERRE',
      estado_anterior: 'EN_CURSO',
      estado_nuevo: 'FINALIZADA',
      usuario_id: user.id,
      motivo: 'Puntaje 5S: ' + porcentaje + '%'
    });
    return upd;
  });

  return { auditoria: updated, generatedSncs: generatedSncs };
}

/**
 * Calcula KPIs consolidados de Calidad (M1 SNC + M2 Auditorías 5S) para la empresa.
 * @param {Object} user
 * @return {Object}
 */
function kpiGetSummary(user) {
  var hallazgos = repoGetByEmpresa(SHEETS.SNC_HALLAZGOS, user.empresa_id);
  var costos = repoGetAll(SHEETS.SNC_COSTOS);
  var hallazgoIds = {};
  hallazgos.forEach(function(h) { hallazgoIds[h.id] = true; });

  var totalCosto = 0;
  costos.forEach(function(c) {
    if (hallazgoIds[c.hallazgo_id]) {
      totalCosto += Number(c.valor) || 0;
    }
  });

  var cerradas = hallazgos.filter(function(h) { return h.estado_actual === ESTADOS.CERRADA; });
  var eficaces = cerradas.filter(function(h) { return h.resultado_cierre === 'IMPLEMENTADA_EFICAZ'; });
  var eficaciaPct = cerradas.length > 0 ? Math.round((eficaces.length / cerradas.length) * 100) : 0;

  var sncPorArea = {};
  hallazgos.forEach(function(h) {
    if (h.estado_actual === ESTADOS.ANULADA) return;
    var aId = h.involucrado_area_id || h.area_asignada_id || 'SIN_AREA';
    sncPorArea[aId] = (sncPorArea[aId] || 0) + 1;
  });

  var auditorias = repoGetByEmpresa(SHEETS.AUD_AUDITORIAS, user.empresa_id)
    .filter(function(a) { return a.estado === 'FINALIZADA'; });
  var sum5s = 0;
  var prom5sPorArea = {};
  auditorias.forEach(function(a) {
    var pct = Number(a.porcentaje) || 0;
    sum5s += pct;
    if (!prom5sPorArea[a.area_id]) prom5sPorArea[a.area_id] = { sum: 0, count: 0 };
    prom5sPorArea[a.area_id].sum += pct;
    prom5sPorArea[a.area_id].count++;
  });
  var promedio5s = auditorias.length > 0 ? Math.round(sum5s / auditorias.length) : 0;

  return {
    totalHallazgos: hallazgos.length,
    cerradas: cerradas.length,
    eficaciaPct: eficaciaPct,
    totalCosto: totalCosto,
    promedio5s: promedio5s,
    totalAuditorias: auditorias.length,
    sncPorArea: sncPorArea,
    prom5sPorArea: prom5sPorArea
  };
}
