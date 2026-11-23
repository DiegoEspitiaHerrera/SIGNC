/**
 * Servicio de Administración Global (exclusivo rol ADMIN).
 * Permite gestionar múltiples empresas, sus áreas, procesos y usuarios.
 */

/**
 * Retorna el panorama global de empresas, áreas, procesos y usuarios (sin hashes).
 * @return {Object}
 */
function adminGetOverview() {
  var empresas = repoGetAll(SHEETS.EMPRESAS);
  var areas = repoGetAll(SHEETS.AREAS);
  var procesos = repoGetAll(SHEETS.PROCESOS);
  var usuarios = repoGetAll(SHEETS.USUARIOS).map(function(u) {
    return {
      id: u.id,
      empresa_id: u.empresa_id,
      area_id: u.area_id,
      nombre: u.nombre,
      usuario: u.usuario,
      rol: u.rol,
      activo: u.activo
    };
  });

  return {
    empresas: empresas,
    areas: areas,
    procesos: procesos,
    usuarios: usuarios
  };
}

/**
 * Crea o actualiza una empresa en EMP_Empresas.
 * Si es nueva, crea por defecto las áreas base (Producción y Calidad).
 * @param {Object} payload { id?, nombre, nit, activa }
 * @return {Object}
 */
function adminSaveEmpresa(payload) {
  if (!payload || !payload.nombre) {
    throw new Error('El nombre de la empresa es obligatorio.');
  }
  return withScriptLock(function() {
    if (payload.id) {
      return repoUpdateById(SHEETS.EMPRESAS, payload.id, {
        nombre: String(payload.nombre).trim(),
        nit: String(payload.nit || '').trim(),
        activa: payload.activa !== false && String(payload.activa).toUpperCase() !== 'FALSE'
      });
    }

    var empId = generateId('EMP');
    var record = {
      id: empId,
      nombre: String(payload.nombre).trim(),
      nit: String(payload.nit || '').trim(),
      activa: true,
      creado_en: new Date().toISOString()
    };
    repoInsert(SHEETS.EMPRESAS, record);

    // Áreas base iniciales para la nueva empresa
    repoInsert(SHEETS.AREAS, {
      id: generateId('ARE'),
      empresa_id: empId,
      nombre: 'Producción',
      requiere_datos_tecnicos: true,
      activa: true
    });
    repoInsert(SHEETS.AREAS, {
      id: generateId('ARE'),
      empresa_id: empId,
      nombre: 'Calidad',
      requiere_datos_tecnicos: false,
      activa: true
    });

    return record;
  });
}

/**
 * Crea o actualiza un área en ARE_Areas.
 * @param {Object} payload { id?, empresa_id, nombre, requiere_datos_tecnicos, activa }
 * @return {Object}
 */
function adminSaveArea(payload) {
  if (!payload || !payload.empresa_id || !payload.nombre) {
    throw new Error('Empresa y nombre del área son obligatorios.');
  }
  return withScriptLock(function() {
    var reqTec = payload.requiere_datos_tecnicos === true || String(payload.requiere_datos_tecnicos).toUpperCase() === 'TRUE';
    var activa = payload.activa !== false && String(payload.activa).toUpperCase() !== 'FALSE';
    if (payload.id) {
      return repoUpdateById(SHEETS.AREAS, payload.id, {
        nombre: String(payload.nombre).trim(),
        requiere_datos_tecnicos: reqTec,
        activa: activa
      }, payload.empresa_id);
    }
    return repoInsert(SHEETS.AREAS, {
      id: generateId('ARE'),
      empresa_id: payload.empresa_id,
      nombre: String(payload.nombre).trim(),
      requiere_datos_tecnicos: reqTec,
      activa: true
    });
  });
}

/**
 * Crea o actualiza un proceso en PRO_Procesos.
 * @param {Object} payload { id?, empresa_id, area_id, nombre, activo }
 * @return {Object}
 */
function adminSaveProceso(payload) {
  if (!payload || !payload.empresa_id || !payload.area_id || !payload.nombre) {
    throw new Error('Empresa, área y nombre del proceso son obligatorios.');
  }
  return withScriptLock(function() {
    var activo = payload.activo !== false && String(payload.activo).toUpperCase() !== 'FALSE';
    if (payload.id) {
      return repoUpdateById(SHEETS.PROCESOS, payload.id, {
        area_id: payload.area_id,
        nombre: String(payload.nombre).trim(),
        activo: activo
      }, payload.empresa_id);
    }
    return repoInsert(SHEETS.PROCESOS, {
      id: generateId('PRO'),
      empresa_id: payload.empresa_id,
      area_id: payload.area_id,
      nombre: String(payload.nombre).trim(),
      activo: true
    });
  });
}

/**
 * Crea o actualiza un usuario en USR_Usuarios.
 * @param {Object} payload { id?, empresa_id, area_id, nombre, usuario, password?, rol, activo }
 * @return {Object}
 */
function adminSaveUsuario(payload) {
  if (!payload || !payload.empresa_id || !payload.nombre || !payload.usuario || !payload.rol) {
    throw new Error('Empresa, nombre, usuario y rol son obligatorios.');
  }
  var normUser = String(payload.usuario).trim().toLowerCase();
  return withScriptLock(function() {
    var allUsers = repoGetAll(SHEETS.USUARIOS);
    for (var i = 0; i < allUsers.length; i++) {
      if (String(allUsers[i].usuario).trim().toLowerCase() === normUser && allUsers[i].id !== payload.id) {
        throw new Error('El nombre de usuario "' + normUser + '" ya está en uso.');
      }
    }

    var activo = payload.activo !== false && String(payload.activo).toUpperCase() !== 'FALSE';
    if (payload.id) {
      var patch = {
        empresa_id: payload.empresa_id,
        area_id: payload.area_id || '',
        nombre: String(payload.nombre).trim(),
        usuario: normUser,
        rol: payload.rol,
        activo: activo
      };
      if (payload.password) {
        patch.password_hash = hashPassword(String(payload.password));
      }
      var updated = repoUpdateById(SHEETS.USUARIOS, payload.id, patch);
      delete updated.password_hash;
      return updated;
    }

    if (!payload.password) {
      throw new Error('Debes asignar una contraseña inicial para el nuevo usuario.');
    }
    var record = {
      id: generateId('USR'),
      empresa_id: payload.empresa_id,
      area_id: payload.area_id || '',
      nombre: String(payload.nombre).trim(),
      usuario: normUser,
      password_hash: hashPassword(String(payload.password)),
      rol: payload.rol,
      activo: true
    };
    repoInsert(SHEETS.USUARIOS, record);
    var safe = Object.assign({}, record);
    delete safe.password_hash;
    return safe;
  });
}
