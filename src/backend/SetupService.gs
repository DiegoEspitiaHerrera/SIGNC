/**
 * Inicialización automática de la base de datos en Google Sheets, carpeta en Drive y datos semilla.
 * Ejecutar setupInicial() una sola vez desde el editor de Apps Script (o menú de despliegue).
 */

var SHEET_SCHEMAS = {
  EMP_Empresas: ['id', 'nombre', 'nit', 'activa', 'creado_en'],
  ARE_Areas: ['id', 'empresa_id', 'nombre', 'requiere_datos_tecnicos', 'activa'],
  PRO_Procesos: ['id', 'empresa_id', 'area_id', 'nombre', 'activo'],
  USR_Usuarios: ['id', 'empresa_id', 'area_id', 'nombre', 'usuario', 'password_hash', 'rol', 'activo'],
  CFG_Catalogos: ['id', 'empresa_id', 'modulo', 'grupo', 'valor', 'activo'],
  EVI_Evidencias: ['id', 'empresa_id', 'modulo', 'entidad_tipo', 'entidad_id', 'nombre_archivo', 'drive_file_id', 'url', 'subido_por_id', 'creado_en'],
  HIS_Historial: ['id', 'empresa_id', 'modulo', 'entidad_id', 'evento', 'fase_anterior', 'fase_nueva', 'estado_anterior', 'estado_nuevo', 'usuario_id', 'motivo', 'creado_en'],
  SNC_Hallazgos: [
    'id', 'empresa_id', 'consecutivo', 'tipo_hallazgo', 'origen_modulo', 'origen_referencia_id',
    'fase_actual', 'estado_actual', 'solicitante_id', 'area_identifica_id', 'proceso_identifica_id',
    'area_asignada_id', 'responsable_actual_id', 'involucrado_area_id', 'involucrado_usuario_id',
    'resumen_solicitud', 'descripcion_detalle', 'origen_snc', 'fuente_deteccion',
    'datos_tecnicos_json', 'beneficios_oportunidad', 'resultado_cierre',
    'fecha_deteccion', 'fecha_cierre', 'tiempo_pausado_min'
  ],
  SNC_Correcciones: ['id', 'hallazgo_id', 'tipo_correccion', 'descripcion', 'autorizado_por_id', 'responsable_id', 'fecha_ejecucion'],
  SNC_Asignaciones: ['id', 'hallazgo_id', 'de_usuario_id', 'a_area_id', 'a_usuario_id', 'fase', 'tipo', 'motivo', 'aceptada', 'fecha_asignacion', 'fecha_aceptacion'],
  SNC_Analisis: ['id', 'hallazgo_id', 'metodo', 'responsable_id', 'causa_raiz', 'detalle_json', 'fecha_analisis'],
  SNC_Planes: ['id', 'hallazgo_id', 'consecutivo', 'tipo', 'responsable_id', 'estado'],
  SNC_Actividades: ['id', 'plan_id', 'descripcion', 'responsable_id', 'fecha_limite', 'fecha_real', 'estado', 'resultado_seguimiento'],
  SNC_Costos: ['id', 'hallazgo_id', 'categoria', 'descripcion', 'valor', 'fecha'],
  AUD_Plantillas: ['id', 'empresa_id', 'nombre', 'tipo', 'version', 'activa'],
  AUD_Criterios: ['id', 'plantilla_id', 'categoria', 'pregunta', 'puntaje_max', 'orden'],
  AUD_Auditorias: ['id', 'empresa_id', 'consecutivo', 'plantilla_id', 'area_id', 'proceso_id', 'auditor_id', 'responsable_area_id', 'fecha_programada', 'fecha_ejecucion', 'puntaje_obtenido', 'puntaje_maximo', 'porcentaje', 'estado'],
  AUD_Respuestas: ['id', 'auditoria_id', 'criterio_id', 'cumple', 'puntaje', 'observacion', 'hallazgo_snc_id']
};

/**
 * Crea el Spreadsheet, todas las pestañas con encabezados, la carpeta raíz de Drive y datos iniciales.
 * Es idempotente: si ya existen IDs en ScriptProperties, solo asegura las pestañas faltantes.
 * @return {Object} resumen de recursos creados
 */
function setupInicial() {
  var props = PropertiesService.getScriptProperties();
  var ssId = props.getProperty(PROP_KEYS.SPREADSHEET_ID);
  var ss;

  if (!ssId) {
    ss = SpreadsheetApp.create('SIGNC_DB_v1');
    ssId = ss.getId();
    props.setProperty(PROP_KEYS.SPREADSHEET_ID, ssId);
  } else {
    ss = SpreadsheetApp.openById(ssId);
  }

  var driveId = props.getProperty(PROP_KEYS.DRIVE_FOLDER_ID);
  var rootFolder;
  if (!driveId) {
    rootFolder = DriveApp.createFolder('SIGNC_Evidencias');
    driveId = rootFolder.getId();
    props.setProperty(PROP_KEYS.DRIVE_FOLDER_ID, driveId);
  }

  var sheetNames = Object.keys(SHEET_SCHEMAS);
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var headers = SHEET_SCHEMAS[name];
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
  }

  var defaultSheet = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  seedInitialData_();
  ensureGlobalAdmin_();

  return {
    spreadsheetId: ssId,
    spreadsheetUrl: ss.getUrl(),
    driveFolderId: driveId
  };
}

/**
 * Garantiza que exista al menos un usuario Administrador Global (rol ADMIN).
 * Puede ejecutarse de forma segura incluso si ya hay datos en el Sheet.
 */
function ensureGlobalAdmin_() {
  var users = repoGetAll(SHEETS.USUARIOS);
  var hasAdmin = users.some(function(u) { return u.rol === ROLES.ADMIN; });
  if (hasAdmin) return;

  var empresas = repoGetAll(SHEETS.EMPRESAS);
  var defaultEmpId = empresas.length > 0 ? empresas[0].id : 'EMP-01';
  repoInsert(SHEETS.USUARIOS, {
    id: 'USR-ADMIN',
    empresa_id: defaultEmpId,
    area_id: '',
    nombre: 'Administrador Global',
    usuario: 'superadmin',
    password_hash: hashPassword('Signc2026*'),
    rol: ROLES.ADMIN,
    activo: true
  });
}

/**
 * Inserta datos semilla iniciales únicamente si EMP_Empresas está vacía.
 */
function seedInitialData_() {
  var empresas = repoGetAll(SHEETS.EMPRESAS);
  if (empresas.length > 0) return;

  var now = new Date().toISOString();
  var empId = 'EMP-01';
  repoInsert(SHEETS.EMPRESAS, {
    id: empId,
    nombre: 'Acermetalicas S.A.S.',
    nit: '900000000-1',
    activa: true,
    creado_en: now
  });

  var areas = [
    { id: 'ARE-PROD', empresa_id: empId, nombre: 'Producción', requiere_datos_tecnicos: true, activa: true },
    { id: 'ARE-COM', empresa_id: empId, nombre: 'Comercial', requiere_datos_tecnicos: false, activa: true },
    { id: 'ARE-DIS', empresa_id: empId, nombre: 'Diseño', requiere_datos_tecnicos: false, activa: true },
    { id: 'ARE-CAL', empresa_id: empId, nombre: 'Calidad', requiere_datos_tecnicos: false, activa: true }
  ];
  areas.forEach(function(a) { repoInsert(SHEETS.AREAS, a); });

  var procesos = [
    { id: 'PRO-01', empresa_id: empId, area_id: 'ARE-PROD', nombre: 'Corte', activo: true },
    { id: 'PRO-02', empresa_id: empId, area_id: 'ARE-PROD', nombre: 'Doblez', activo: true },
    { id: 'PRO-03', empresa_id: empId, area_id: 'ARE-PROD', nombre: 'Soldadura', activo: true },
    { id: 'PRO-04', empresa_id: empId, area_id: 'ARE-COM', nombre: 'Cotización y Ventas', activo: true },
    { id: 'PRO-05', empresa_id: empId, area_id: 'ARE-DIS', nombre: 'Planos y Desarrollo', activo: true },
    { id: 'PRO-06', empresa_id: empId, area_id: 'ARE-CAL', nombre: 'Control de Calidad', activo: true }
  ];
  procesos.forEach(function(p) { repoInsert(SHEETS.PROCESOS, p); });

  // Usuarios iniciales (contraseña temporal: Signc2026* - cambiar tras primer ingreso)
  var defaultHash = hashPassword('Signc2026*');
  var usuarios = [
    { id: 'USR-01', empresa_id: empId, area_id: 'ARE-CAL', nombre: 'Gerencia General', usuario: 'gerencia', password_hash: defaultHash, rol: ROLES.GERENCIA, activo: true },
    { id: 'USR-02', empresa_id: empId, area_id: 'ARE-PROD', nombre: 'Coordinador Producción', usuario: 'coord.prod', password_hash: defaultHash, rol: ROLES.COORDINADOR, activo: true },
    { id: 'USR-03', empresa_id: empId, area_id: 'ARE-CAL', nombre: 'Coordinador Calidad', usuario: 'coord.cal', password_hash: defaultHash, rol: ROLES.COORDINADOR, activo: true },
    { id: 'USR-04', empresa_id: empId, area_id: 'ARE-PROD', nombre: 'Líder Planta', usuario: 'lider.prod', password_hash: defaultHash, rol: ROLES.LIDER, activo: true }
  ];
  usuarios.forEach(function(u) { repoInsert(SHEETS.USUARIOS, u); });

  var catalogos = [
    ['ORIGEN', 'Auditoría'], ['ORIGEN', 'PQRS'], ['ORIGEN', 'Seguimiento de procesos'],
    ['ORIGEN', 'Supervisión'], ['ORIGEN', 'Producto/Salida no conforme'], ['ORIGEN', 'Medición indicadores'],
    ['FUENTE_DETECCION', 'Materia Prima'], ['FUENTE_DETECCION', 'Producto en Proceso'],
    ['FUENTE_DETECCION', 'Producto Terminado'], ['FUENTE_DETECCION', 'Producto entregado al cliente'],
    ['FUENTE_DETECCION', 'Ejecución del proceso'],
    ['METODO_ANALISIS', '5 Porqués'], ['METODO_ANALISIS', 'Espina de Pescado (Ishikawa)'], ['METODO_ANALISIS', '8D'],
    ['TIPO_CORRECCION', 'REPROCESO'], ['TIPO_CORRECCION', 'CONCESION'], ['TIPO_CORRECCION', 'RETRABAJO'],
    ['CAT_COSTO', 'Material / Scrap'], ['CAT_COSTO', 'Mano de Obra / Reproceso'], ['CAT_COSTO', 'Garantía / Flete']
  ];
  catalogos.forEach(function(c, idx) {
    repoInsert(SHEETS.CATALOGOS, {
      id: 'CFG-' + (idx + 1),
      empresa_id: 'GLOBAL',
      modulo: 'SNC',
      grupo: c[0],
      valor: c[1],
      activo: true
    });
  });

  // Plantilla inicial 5S
  var pltId = 'PLT-5S-01';
  repoInsert(SHEETS.AUD_PLANTILLAS, {
    id: pltId,
    empresa_id: empId,
    nombre: 'Auditoría 5S Estándar Planta',
    tipo: '5S',
    version: '1.0',
    activa: true
  });
  var criterios5S = [
    ['SEIRI', '¿El área está libre de materiales, herramientas o sobrantes innecesarios?', 10],
    ['SEITON', '¿Herramientas, insumos y materiales en proceso están ubicados e identificados en su lugar?', 10],
    ['SEISO', '¿Pisos, máquinas y mesas de trabajo se encuentran limpios y sin derrames?', 10],
    ['SEIKETSU', '¿Se respetan señalizaciones, demarcaciones y estándares visuales del área?', 10],
    ['SHITSUKE', '¿El personal cumple con EPP, orden y rutinas de limpieza al finalizar turno?', 10]
  ];
  criterios5S.forEach(function(cr, idx) {
    repoInsert(SHEETS.AUD_CRITERIOS, {
      id: 'CRI-5S-' + (idx + 1),
      plantilla_id: pltId,
      categoria: cr[0],
      pregunta: cr[1],
      puntaje_max: cr[2],
      orden: idx + 1
    });
  });
}
