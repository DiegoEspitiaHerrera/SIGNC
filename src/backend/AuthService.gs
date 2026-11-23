/**
 * Servicio de autenticación propia (desacoplado de la cuenta Google del dispositivo).
 * Contraseñas almacenadas como salt:sha256_hex. Sesiones en CacheService.
 */

var SESSION_TTL_SECONDS = 21600; // 6 horas

/**
 * Genera hash SHA-256 con salt aleatorio.
 * @param {string} plainPassword
 * @return {string} formato "salt:hashHex"
 */
function hashPassword(plainPassword) {
  var salt = Utilities.getUuid().replace(/-/g, '').substring(0, 16);
  var digest = computeSha256Hex(salt + ':' + plainPassword);
  return salt + ':' + digest;
}

/**
 * Verifica una contraseña contra el formato "salt:hashHex".
 * @param {string} plainPassword
 * @param {string} storedHash
 * @return {boolean}
 */
function verifyPassword(plainPassword, storedHash) {
  if (!storedHash || storedHash.indexOf(':') === -1) return false;
  var parts = storedHash.split(':');
  var salt = parts[0];
  var expected = parts[1];
  var actual = computeSha256Hex(salt + ':' + plainPassword);
  return actual === expected;
}

/**
 * Calcula SHA-256 en hexadecimal.
 * @param {string} input
 * @return {string}
 */
function computeSha256Hex(input) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, input, Utilities.Charset.UTF_8);
  return raw.map(function(b) {
    var v = (b < 0 ? b + 256 : b).toString(16);
    return v.length === 1 ? '0' + v : v;
  }).join('');
}

/**
 * Inicia sesión validando usuario y contraseña en USR_Usuarios.
 * @param {string} usuario
 * @param {string} password
 * @return {Object} { token, user }
 */
function authLogin(usuario, password) {
  if (!usuario || !password) {
    throw new Error('Debes ingresar usuario y contraseña.');
  }
  var normalizedUser = String(usuario).trim().toLowerCase();
  var users = repoGetAll(SHEETS.USUARIOS);
  var found = null;
  for (var i = 0; i < users.length; i++) {
    if (String(users[i].usuario).trim().toLowerCase() === normalizedUser) {
      found = users[i];
      break;
    }
  }
  if (!found || found.activo === false || String(found.activo).toUpperCase() === 'FALSE') {
    throw new Error('Usuario inválido o inactivo.');
  }
  if (!verifyPassword(String(password), String(found.password_hash))) {
    throw new Error('Contraseña incorrecta.');
  }

  var token = Utilities.getUuid();
  var sessionUser = {
    id: found.id,
    empresa_id: found.empresa_id,
    area_id: found.area_id,
    nombre: found.nombre,
    usuario: found.usuario,
    rol: found.rol
  };

  CacheService.getScriptCache().put('SES_' + token, JSON.stringify(sessionUser), SESSION_TTL_SECONDS);
  return { token: token, user: sessionUser };
}

/**
 * Valida token de sesión y opcionalmente los roles permitidos.
 * Renueva el TTL de la sesión activa.
 * @param {string} token
 * @param {Array<string>=} allowedRoles
 * @return {Object} sessionUser
 */
function requireSession(token, allowedRoles) {
  if (!token) {
    throw new Error('Sesión no iniciada o expirada. Inicia sesión nuevamente.');
  }
  var cache = CacheService.getScriptCache();
  var raw = cache.get('SES_' + token);
  if (!raw) {
    throw new Error('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
  }
  var user = JSON.parse(raw);
  cache.put('SES_' + token, raw, SESSION_TTL_SECONDS);

  if (allowedRoles && allowedRoles.length > 0) {
    if (allowedRoles.indexOf(user.rol) === -1 && user.rol !== ROLES.ADMIN) {
      throw new Error('No tienes permisos para realizar esta acción.');
    }
  }
  return user;
}

/**
 * Cierra la sesión actual eliminando el token del caché.
 * @param {string} token
 */
function authLogout(token) {
  if (token) {
    CacheService.getScriptCache().remove('SES_' + token);
  }
  return true;
}
