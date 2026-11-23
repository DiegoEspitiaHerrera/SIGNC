/**
 * Lógica de negocio del Módulo 1: Salidas No Conformes, Acciones Correctivas y Oportunidades de Mejora.
 * Implementa la máquina de estados, permisos por rol y validaciones de docs/DDS-004_Maquina_Estados_Permisos.md.
 */

/**
 * Determina si un usuario puede ver un hallazgo según su rol y área.
 * @param {Object} user
 * @param {Object} h
 * @return {boolean}
 */
function canUserViewHallazgo_(user, h) {
  if (user.rol === ROLES.ADMIN || user.rol === ROLES.GERENCIA) return true;
  if (user.rol === ROLES.COORDINADOR) {
    return h.area_asignada_id === user.area_id ||
           h.area_identifica_id === user.area_id ||
           h.solicitante_id === user.id;
  }
  return h.responsable_actual_id === user.id || h.solicitante_id === user.id;
}

/**
 * Obtiene el resumen de tarjetas por rol y la lista de hallazgos visibles para el usuario.
 * @param {Object} user
 * @return {Object}
 */
function sncGetDashboardData(user) {
  var all = repoGetByEmpresa(SHEETS.SNC_HALLAZGOS, user.empresa_id);
  var visible = all.filter(function(h) { return canUserViewHallazgo_(user, h); });

  visible.sort(function(a, b) {
    return String(b.consecutivo || '').localeCompare(String(a.consecutivo || ''));
  });

  var counts = {
    porAsignar: 0,
    porAceptar: 0,
    activas: 0,
    porRevisar: 0,
    pausadas: 0,
    misSolicitadas: 0,
    cerradas: 0
  };

  visible.forEach(function(h) {
    if (h.solicitante_id === user.id) counts.misSolicitadas++;
    if (h.estado_actual === ESTADOS.CERRADA) { counts.cerradas++; return; }
    if (h.estado_actual === ESTADOS.ANULADA) return;
    if (h.estado_actual === ESTADOS.PAUSADA) counts.pausadas++;
    if (h.fase_actual === FASES.SOLICITUD) counts.porAsignar++;
    if (h.fase_actual === FASES.ASIGNACION) counts.porAceptar++;
    if (h.fase_actual === FASES.REVISION) counts.porRevisar++;
    if (h.estado_actual === ESTADOS.ACTIVA) counts.activas++;
  });

  return { counts: counts, hallazgos: visible };
}

/**
 * Retorna el expediente completo de un hallazgo (relaciones 1:N, evidencias e historial).
 * @param {Object} user
 * @param {string} hallazgoId
 * @return {Object}
 */
function sncGetDetail(user, hallazgoId) {
  var all = repoGetByEmpresa(SHEETS.SNC_HALLAZGOS, user.empresa_id);
  var hallazgo = null;
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === hallazgoId) { hallazgo = all[i]; break; }
  }
  if (!hallazgo) throw new Error('Expediente no encontrado.');
  if (!canUserViewHallazgo_(user, hallazgo)) throw new Error('No tienes acceso a este expediente.');

  var correcciones = repoGetAll(SHEETS.SNC_CORRECCIONES).filter(function(r) { return r.hallazgo_id === hallazgoId; });
  var asignaciones = repoGetAll(SHEETS.SNC_ASIGNACIONES).filter(function(r) { return r.hallazgo_id === hallazgoId; });
  var analisis = repoGetAll(SHEETS.SNC_ANALISIS).filter(function(r) { return r.hallazgo_id === hallazgoId; });
  var planes = repoGetAll(SHEETS.SNC_PLANES).filter(function(r) { return r.hallazgo_id === hallazgoId; });
  var planIds = planes.map(function(p) { return p.id; });
  var actividades = repoGetAll(SHEETS.SNC_ACTIVIDADES).filter(function(a) { return planIds.indexOf(a.plan_id) !== -1; });
  var costos = repoGetAll(SHEETS.SNC_COSTOS).filter(function(r) { return r.hallazgo_id === hallazgoId; });
  var evidencias = repoGetByEmpresa(SHEETS.EVIDENCIAS, user.empresa_id).filter(function(e) {
    return e.modulo === 'SNC' && e.entidad_id === hallazgoId;
  });
  var historial = repoGetByEmpresa(SHEETS.HISTORIAL, user.empresa_id).filter(function(h) {
    return h.modulo === 'SNC' && h.entidad_id === hallazgoId;
  });

  return {
    hallazgo: hallazgo,
    correcciones: correcciones,
    asignaciones: asignaciones,
    analisis: analisis,
    planes: planes,
    actividades: actividades,
    costos: costos,
    evidencias: evidencias,
    historial: historial
  };
}

/**
 * Genera el siguiente consecutivo anual (SNC-2026-001 o OM-2026-001).
 * Debe ejecutarse dentro de withScriptLock.
 * @param {string} empresaId
 * @param {string} tipoHallazgo
 * @return {string}
 */
function nextHallazgoConsecutivo_(empresaId, tipoHallazgo) {
  var prefix = tipoHallazgo === 'OPORTUNIDAD_MEJORA' ? 'OM' : 'SNC';
  var year = new Date().getFullYear();
  var tag = prefix + '-' + year + '-';
  var existing = repoGetByEmpresa(SHEETS.SNC_HALLAZGOS, empresaId);
  var maxNum = 0;
  existing.forEach(function(h) {
    var c = String(h.consecutivo || '');
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
 * Crea una nueva solicitud de NC u Oportunidad de Mejora.
 * @param {Object} user
 * @param {Object} payload
 * @return {Object}
 */
function sncCreate(user, payload) {
  if (!payload || !payload.tipo_hallazgo || !payload.area_identifica_id || !payload.resumen_solicitud) {
    throw new Error('Debes indicar tipo de hallazgo, área donde se identifica y un resumen breve.');
  }

  return withScriptLock(function() {
    var now = new Date().toISOString();
    var consecutivo = nextHallazgoConsecutivo_(user.empresa_id, payload.tipo_hallazgo);
    var hasAsignacion = Boolean(payload.area_asignada_id);
    var faseInicial = hasAsignacion ? FASES.ASIGNACION : FASES.SOLICITUD;

    var record = {
      id: generateId('SNC'),
      empresa_id: user.empresa_id,
      consecutivo: consecutivo,
      tipo_hallazgo: payload.tipo_hallazgo,
      origen_modulo: payload.origen_modulo || 'MANUAL',
      origen_referencia_id: payload.origen_referencia_id || '',
      fase_actual: faseInicial,
      estado_actual: ESTADOS.PENDIENTE,
      solicitante_id: user.id,
      area_identifica_id: payload.area_identifica_id,
      proceso_identifica_id: payload.proceso_identifica_id || '',
      area_asignada_id: payload.area_asignada_id || '',
      responsable_actual_id: payload.responsable_actual_id || '',
      involucrado_area_id: '',
      involucrado_usuario_id: '',
      resumen_solicitud: String(payload.resumen_solicitud).trim(),
      descripcion_detalle: payload.descripcion_detalle || '',
      origen_snc: payload.origen_snc || '',
      fuente_deteccion: payload.fuente_deteccion || '',
      datos_tecnicos_json: '',
      beneficios_oportunidad: '',
      resultado_cierre: '',
      fecha_deteccion: payload.fecha_deteccion || now.substring(0, 10),
      fecha_cierre: '',
      tiempo_pausado_min: 0
    };

    repoInsert(SHEETS.SNC_HALLAZGOS, record);
    repoLogHistorial({
      empresa_id: user.empresa_id,
      modulo: 'SNC',
      entidad_id: record.id,
      evento: 'CREACION',
      fase_anterior: '',
      fase_nueva: faseInicial,
      estado_anterior: '',
      estado_nuevo: ESTADOS.PENDIENTE,
      usuario_id: user.id,
      motivo: record.resumen_solicitud
    });

    if (hasAsignacion) {
      repoInsert(SHEETS.SNC_ASIGNACIONES, {
        id: generateId('ASG'),
        hallazgo_id: record.id,
        de_usuario_id: user.id,
        a_area_id: payload.area_asignada_id,
        a_usuario_id: payload.responsable_actual_id || '',
        fase: FASES.ASIGNACION,
        tipo: 'INICIAL',
        motivo: 'Asignación en solicitud',
        aceptada: false,
        fecha_asignacion: now,
        fecha_aceptacion: ''
      });
    }

    return record;
  });
}

/**
 * Ejecuta acciones y transiciones de la máquina de estados (DDS-004).
 * @param {Object} user
 * @param {Object} payload { hallazgo_id, action, ... }
 * @return {Object} hallazgo actualizado
 */
function sncExecuteAction(user, payload) {
  if (!payload || !payload.hallazgo_id || !payload.action) {
    throw new Error('Solicitud de acción incompleta.');
  }

  return withScriptLock(function() {
    var all = repoGetByEmpresa(SHEETS.SNC_HALLAZGOS, user.empresa_id);
    var h = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === payload.hallazgo_id) { h = all[i]; break; }
    }
    if (!h) throw new Error('Hallazgo no encontrado.');
    if (h.estado_actual === ESTADOS.CERRADA || h.estado_actual === ESTADOS.ANULADA) {
      throw new Error('Este expediente ya está cerrado o anulado y no admite modificaciones.');
    }

    var now = new Date().toISOString();
    var action = payload.action;
    var patch = {};
    var evento = action;
    var motivo = payload.motivo || '';

    if (action === 'ASIGNAR' || action === 'REASIGNAR') {
      if (user.rol !== ROLES.GERENCIA && user.rol !== ROLES.COORDINADOR && user.rol !== ROLES.ADMIN) {
        if (action === 'ASIGNAR' && h.solicitante_id !== user.id) {
          throw new Error('Solo Gerencia, Coordinadores o el solicitante inicial pueden asignar.');
        }
      }
      if (!payload.area_asignada_id) throw new Error('Selecciona el área destino.');
      patch.area_asignada_id = payload.area_asignada_id;
      patch.responsable_actual_id = payload.responsable_actual_id || '';
      if (h.fase_actual === FASES.SOLICITUD) {
        patch.fase_actual = FASES.ASIGNACION;
        patch.estado_actual = ESTADOS.PENDIENTE;
      }
      repoInsert(SHEETS.SNC_ASIGNACIONES, {
        id: generateId('ASG'),
        hallazgo_id: h.id,
        de_usuario_id: user.id,
        a_area_id: payload.area_asignada_id,
        a_usuario_id: payload.responsable_actual_id || '',
        fase: patch.fase_actual || h.fase_actual,
        tipo: action === 'ASIGNAR' ? 'INICIAL' : 'REASIGNACION',
        motivo: motivo,
        aceptada: false,
        fecha_asignacion: now,
        fecha_aceptacion: ''
      });
    } else if (action === 'ACEPTAR') {
      if (h.fase_actual !== FASES.ASIGNACION) throw new Error('Solo se aceptan hallazgos en fase de Asignación.');
      patch.fase_actual = FASES.DESARROLLO;
      patch.estado_actual = ESTADOS.ACTIVA;
      patch.responsable_actual_id = payload.responsable_actual_id || user.id;
      evento = 'ACEPTACION';
    } else if (action === 'GUARDAR_DESARROLLO' || action === 'AVANZAR_ANALISIS') {
      patch.descripcion_detalle = payload.descripcion_detalle !== undefined ? payload.descripcion_detalle : h.descripcion_detalle;
      patch.origen_snc = payload.origen_snc !== undefined ? payload.origen_snc : h.origen_snc;
      patch.fuente_deteccion = payload.fuente_deteccion !== undefined ? payload.fuente_deteccion : h.fuente_deteccion;
      patch.fecha_deteccion = payload.fecha_deteccion !== undefined ? payload.fecha_deteccion : h.fecha_deteccion;
      patch.involucrado_area_id = payload.involucrado_area_id !== undefined ? payload.involucrado_area_id : h.involucrado_area_id;
      patch.involucrado_usuario_id = payload.involucrado_usuario_id !== undefined ? payload.involucrado_usuario_id : h.involucrado_usuario_id;
      if (payload.datos_tecnicos_json !== undefined) {
        patch.datos_tecnicos_json = typeof payload.datos_tecnicos_json === 'string'
          ? payload.datos_tecnicos_json
          : JSON.stringify(payload.datos_tecnicos_json);
      }

      if (payload.correccion && payload.correccion.descripcion) {
        repoInsert(SHEETS.SNC_CORRECCIONES, {
          id: generateId('COR'),
          hallazgo_id: h.id,
          tipo_correccion: payload.correccion.tipo_correccion || 'OTRA',
          descripcion: payload.correccion.descripcion,
          autorizado_por_id: payload.correccion.autorizado_por_id || user.id,
          responsable_id: payload.correccion.responsable_id || user.id,
          fecha_ejecucion: payload.correccion.fecha_ejecucion || now.substring(0, 10)
        });
      }

      if (action === 'AVANZAR_ANALISIS') {
        if (!patch.descripcion_detalle || !patch.origen_snc || !patch.fuente_deteccion || !patch.involucrado_area_id) {
          throw new Error('Completa descripción detallada, origen, fuente de detección y área involucrada antes de pasar a Análisis.');
        }
        var areas = repoGetByEmpresa(SHEETS.AREAS, user.empresa_id);
        var areaObj = areas.filter(function(a) { return a.id === h.area_asignada_id; })[0];
        if (areaObj && (areaObj.requiere_datos_tecnicos === true || String(areaObj.requiere_datos_tecnicos).toUpperCase() === 'TRUE')) {
          var tec = {};
          try { tec = JSON.parse(patch.datos_tecnicos_json || '{}'); } catch (_) {}
          if (!tec.calibre && !tec.longitud && !tec.peso && !tec.maquinaria) {
            throw new Error('Producción requiere al menos un dato técnico (calibre, longitud, peso o maquinaria).');
          }
        }
        patch.fase_actual = FASES.ANALISIS;
        patch.estado_actual = ESTADOS.ACTIVA;
        evento = 'CAMBIO_FASE';
      }
    } else if (action === 'AGREGAR_ANALISIS') {
      if (!payload.metodo || !payload.causa_raiz) throw new Error('Indica método y causa raíz.');
      repoInsert(SHEETS.SNC_ANALISIS, {
        id: generateId('ANA'),
        hallazgo_id: h.id,
        metodo: payload.metodo,
        responsable_id: user.id,
        causa_raiz: payload.causa_raiz,
        detalle_json: payload.detalle_json || '',
        fecha_analisis: now.substring(0, 10)
      });
    } else if (action === 'AGREGAR_PLAN') {
      if (!payload.actividad_descripcion) throw new Error('Describe la actividad del plan de acción.');
      var planId = generateId('PLN');
      var prefix = h.tipo_hallazgo === 'OPORTUNIDAD_MEJORA' ? 'AM' : 'AC';
      repoInsert(SHEETS.SNC_PLANES, {
        id: planId,
        hallazgo_id: h.id,
        consecutivo: prefix + '-' + h.consecutivo,
        tipo: h.tipo_hallazgo === 'OPORTUNIDAD_MEJORA' ? 'MEJORA' : 'CORRECTIVA',
        responsable_id: payload.responsable_id || user.id,
        estado: 'ACTIVO'
      });
      repoInsert(SHEETS.SNC_ACTIVIDADES, {
        id: generateId('ACT'),
        plan_id: planId,
        descripcion: payload.actividad_descripcion,
        responsable_id: payload.responsable_id || user.id,
        fecha_limite: payload.fecha_limite || '',
        fecha_real: '',
        estado: 'PENDIENTE',
        resultado_seguimiento: ''
      });
    } else if (action === 'AGREGAR_COSTO') {
      if (!payload.categoria || payload.valor === undefined) throw new Error('Indica categoría y valor del costo.');
      repoInsert(SHEETS.SNC_COSTOS, {
        id: generateId('CST'),
        hallazgo_id: h.id,
        categoria: payload.categoria,
        descripcion: payload.descripcion || '',
        valor: Number(payload.valor) || 0,
        fecha: now.substring(0, 10)
      });
    } else if (action === 'AVANZAR_REVISION') {
      if (h.tipo_hallazgo === 'OPORTUNIDAD_MEJORA') {
        if (!payload.beneficios_oportunidad && !h.beneficios_oportunidad) {
          throw new Error('Registra los beneficios de la oportunidad antes de enviar a Revisión.');
        }
        if (payload.beneficios_oportunidad) patch.beneficios_oportunidad = payload.beneficios_oportunidad;
      } else {
        var existingAna = repoGetAll(SHEETS.SNC_ANALISIS).filter(function(a) { return a.hallazgo_id === h.id; });
        if (existingAna.length === 0) throw new Error('Registra al menos un análisis de causa raíz antes de enviar a Revisión.');
      }
      patch.fase_actual = FASES.REVISION;
      patch.estado_actual = ESTADOS.ACTIVA;
      evento = 'CAMBIO_FASE';
    } else if (action === 'PAUSAR') {
      if (user.rol !== ROLES.GERENCIA && user.rol !== ROLES.COORDINADOR && user.rol !== ROLES.ADMIN) {
        throw new Error('Solo Gerencia o Coordinadores pueden pausar una NC.');
      }
      if (!motivo) throw new Error('Debes indicar el motivo de la pausa.');
      patch.estado_actual = ESTADOS.PAUSADA;
      evento = 'PAUSA';
    } else if (action === 'REANUDAR') {
      if (h.estado_actual !== ESTADOS.PAUSADA) throw new Error('El hallazgo no está pausado.');
      var hist = repoGetByEmpresa(SHEETS.HISTORIAL, user.empresa_id).filter(function(x) {
        return x.modulo === 'SNC' && x.entidad_id === h.id && x.evento === 'PAUSA';
      });
      var pausedMins = Number(h.tiempo_pausado_min) || 0;
      if (hist.length > 0) {
        var lastPause = new Date(hist[hist.length - 1].creado_en).getTime();
        var diffMin = Math.max(0, Math.round((Date.now() - lastPause) / 60000));
        pausedMins += diffMin;
      }
      patch.tiempo_pausado_min = pausedMins;
      patch.estado_actual = ESTADOS.ACTIVA;
      evento = 'REANUDACION';
    } else if (action === 'DEVOLVER') {
      if (user.rol !== ROLES.GERENCIA && user.rol !== ROLES.COORDINADOR && user.rol !== ROLES.ADMIN) {
        throw new Error('Solo Gerencia o Coordinadores pueden devolver un hallazgo.');
      }
      if (!motivo || !payload.fase_destino) throw new Error('Indica la fase destino y el motivo de devolución.');
      patch.fase_actual = payload.fase_destino;
      patch.estado_actual = ESTADOS.ACTIVA;
      evento = 'DEVOLUCION';
    } else if (action === 'APROBAR_CIERRE') {
      if (user.rol !== ROLES.GERENCIA && user.rol !== ROLES.ADMIN) {
        throw new Error('Solo Gerencia puede aprobar el cierre definitivo.');
      }
      if (!payload.resultado_cierre) throw new Error('Selecciona el resultado de eficacia del cierre.');
      patch.resultado_cierre = payload.resultado_cierre;
      patch.fase_actual = FASES.FINALIZACION;
      patch.estado_actual = ESTADOS.CERRADA;
      patch.fecha_cierre = now;
      evento = 'CIERRE';
    } else if (action === 'ANULAR') {
      if (user.rol !== ROLES.GERENCIA && user.rol !== ROLES.ADMIN && h.solicitante_id !== user.id) {
        throw new Error('Solo Gerencia o el solicitante original pueden anular esta NC.');
      }
      if (!motivo) throw new Error('Debes indicar el motivo de anulación.');
      patch.estado_actual = ESTADOS.ANULADA;
      evento = 'ANULACION';
    } else {
      throw new Error('Acción no reconocida: ' + action);
    }

    var updated = repoUpdateById(SHEETS.SNC_HALLAZGOS, h.id, patch, user.empresa_id);
    repoLogHistorial({
      empresa_id: user.empresa_id,
      modulo: 'SNC',
      entidad_id: h.id,
      evento: evento,
      fase_anterior: h.fase_actual,
      fase_nueva: updated.fase_actual,
      estado_anterior: h.estado_actual,
      estado_nuevo: updated.estado_actual,
      usuario_id: user.id,
      motivo: motivo
    });

    return updated;
  });
}
