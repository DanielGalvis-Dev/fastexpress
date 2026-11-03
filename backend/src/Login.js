/**
 * =====================================================================
 *  Login.gs  |  Autenticación para la API FastExpress (sin roles)
 * =====================================================================
 *  - NO define doGet/doPost: Codigo.gs sigue siendo el único punto de
 *    entrada, así la URL del web app NO cambia.
 *  - Reutiliza de Codigo.gs: responderJSON().  Los datos viven en Supabase (ver Supabase.gs).
 *  - Todos los nombres llevan prefijo "auth"/"AUTH" para no chocar con
 *    los de Codigo.gs.
 *
 *  ACCIONES (POST a la misma URL, body JSON con "action"):
 *    register        { nombre, email, password, codigoRegistro? }
 *    login           { email, password }          -> { token, expiraEn, usuario }
 *    logout          { token }
 *    validate        { token }                    -> { usuario }
 *    changePassword  { token, actual, nueva }
 *    forgot          { email }                    -> envía código por correo
 *    reset           { email, codigo, nueva }
 *
 *  PROPIEDADES DEL SCRIPT (opcionales):
 *    CODIGO_REGISTRO : si existe, register exige "codigoRegistro" igual a este valor
 *                      (evita que cualquiera se registre y vea tus datos).
 * =====================================================================
 */

const AUTH = {
  TABLA_USUARIOS: 'usuarios',
  TABLA_SESIONES: 'sesiones',
  TABLA_LOG: 'auth_log',
  SESION_HORAS: 8,          // duración de la sesión
  MAX_INTENTOS: 5,          // intentos fallidos antes de bloquear
  BLOQUEO_MINUTOS: 15,      // duración del bloqueo
  RESET_MINUTOS: 15,        // validez del código de recuperación
  HASH_ITERACIONES: 500,    // más = más seguro pero más lento
  PASSWORD_MIN: 5,
  PASSWORD_MAX: 72,
  NOMBRE_APP: 'FastExpress',
  // false = login "opcional" (tu API sigue funcionando igual que hoy)
  // true  = chat, cotizaciones e historial exigen un token de sesión válido
  PROTEGER_API: false
};

// Clave primaria de cada tabla (en camelCase)
const AUTH_PK = {
  [AUTH.TABLA_USUARIOS]: 'id',
  [AUTH.TABLA_SESIONES]: 'tokenHash'
};
const AUTH_CTX = { email: '' };
const AUTH_ACCIONES = {
  register: authRegister_,
  login: authLogin_,
  logout: authLogout_,
  validate: authValidate_,
  changePassword: authChangePassword_,
  forgot: authForgot_,
  reset: authReset_
};

class AuthError extends Error {
  constructor(codigo, mensaje) {
    super(mensaje);
    this.codigo = codigo;
    this.mensaje = mensaje;
  }
}

/* ===================================================================
 *  FUNCIONES QUE LLAMA Codigo.gs
 * =================================================================== */

/**
 * Si la acción es de autenticación la procesa y devuelve la respuesta JSON.
 * Si no lo es, devuelve null para que Codigo.gs continúe con su flujo normal.
 */
// function authEnrutar(data) {
//   const accion = String((data && data.action) || '');
//   if (!Object.prototype.hasOwnProperty.call(AUTH_ACCIONES, accion)) return null;

//   const email = authEmail_(data.email);
//   try {
//     const resultado = AUTH_ACCIONES[accion](data);
//     authLog_(accion, email, true, '');
//     return responderJSON(Object.assign({ success: true }, resultado));
//   } catch (err) {
//     if (err instanceof AuthError) {
//       authLog_(accion, email, false, err.codigo);
//       return responderJSON({ success: false, codigo: err.codigo, mensaje: err.mensaje });
//     }
//     Logger.log('Error en auth (' + accion + '): ' + (err && err.stack));
//     authLog_(accion, email, false, 'ERROR_INTERNO');
//     return responderJSON({ success: false, codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor.' });
//   }
// }
function authEnrutar(data) {
  const accion = String((data && data.action) || '');
  if (!Object.prototype.hasOwnProperty.call(AUTH_ACCIONES, accion)) return null;

  AUTH_CTX.email = authEmail_(data.email);
  try {
    const resultado = AUTH_ACCIONES[accion](data);
    authLog_(accion, AUTH_CTX.email, true, '');
    return responderJSON(Object.assign({ success: true }, resultado));
  } catch (err) {
    if (err instanceof AuthError) {
      authLog_(accion, AUTH_CTX.email, false, err.codigo);
      return responderJSON({ success: false, codigo: err.codigo, mensaje: err.mensaje });
    }
    Logger.log('Error en auth (' + accion + '): ' + (err && err.stack));
    authLog_(accion, AUTH_CTX.email, false, 'ERROR_INTERNO');
    return responderJSON({ success: false, codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor.' });
  }
}
/**
 * Para proteger endpoints existentes. Devuelve null si se puede continuar,
 * o una respuesta JSON de error si falta/expiró la sesión.
 * Solo actúa cuando AUTH.PROTEGER_API === true.
 */
function authExigirSesion(token) {
  if (!AUTH.PROTEGER_API) return null;
  try {
    authSesionValida_(token);
    return null;
  } catch (err) {
    if (err instanceof AuthError) {
      return responderJSON({ success: false, codigo: err.codigo, mensaje: err.mensaje });
    }
    Logger.log('Error validando sesión: ' + (err && err.stack));
    return responderJSON({ success: false, codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor.' });
  }
}

/* ===================================================================
 *  ACCIONES
 * =================================================================== */

function authRegister_(b) {
  const codigoReq = PropertiesService.getScriptProperties().getProperty('CODIGO_REGISTRO');
  if (codigoReq && !authIgualesSeguro_(String(b.codigoRegistro || ''), codigoReq.trim())) {
    throw new AuthError('CODIGO_REGISTRO_INVALIDO', 'Código de registro incorrecto.');
  }

  const nombre = authLimpiarTexto_(b.nombre, 80);
  const email = authEmail_(b.email);
  if (!nombre) throw new AuthError('NOMBRE_INVALIDO', 'El nombre es obligatorio.');
  if (!/^[A-Za-z0-9][^\s@]*@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new AuthError('EMAIL_INVALIDO', 'Correo electrónico inválido.');
  }
  authValidarPassword_(b.password);
  if (authBuscar_(AUTH.TABLA_USUARIOS, 'email', email)) {
    throw new AuthError('EMAIL_EXISTENTE', 'Ese correo ya está registrado.');
  }

  const salt = authSalt_();
  const user = {
    id: Utilities.getUuid(), nombre: nombre, email: email,
    passwordHash: authHash_(String(b.password), salt), salt: salt,
    estado: 'activo', intentosFallidos: 0, bloqueadoHasta: '',
    resetHash: '', resetExpira: '', creadoEn: new Date(), ultimoLogin: ''
  };
  authAgregar_(AUTH.TABLA_USUARIOS, user);
  return { mensaje: 'Usuario registrado correctamente.', usuario: authPublico_(user) };
}

function authLogin_(b) {
  const email = authEmail_(b.email);
  const password = String(b.password || '');
  const user = authBuscar_(AUTH.TABLA_USUARIOS, 'email', email);

  // Hash "falso" para que el tiempo de respuesta no revele si el correo existe
  if (!user) {
    authHash_(password, 'salt-falso');
    throw new AuthError('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
  }

  const ahora = Date.now();
  if (user.bloqueadoHasta && authMs_(user.bloqueadoHasta) > ahora) {
    const min = Math.ceil((authMs_(user.bloqueadoHasta) - ahora) / 60000);
    throw new AuthError('CUENTA_BLOQUEADA', 'Cuenta bloqueada. Intenta de nuevo en ' + min + ' min.');
  }
  if (user.estado !== 'activo') throw new AuthError('CUENTA_INACTIVA', 'Cuenta inactiva.');

  if (!authIgualesSeguro_(authHash_(password, user.salt), user.passwordHash)) {
    authRegistrarFallo_(user);
    throw new AuthError('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
  }

  authGuardar_(AUTH.TABLA_USUARIOS, user, { intentosFallidos: 0, bloqueadoHasta: '', ultimoLogin: new Date() });

  const token = authToken_();
  const expira = new Date(ahora + AUTH.SESION_HORAS * 3600 * 1000);
  authAgregar_(AUTH.TABLA_SESIONES, {
    tokenHash: authSha256_(token), userId: user.id, email: user.email,
    creadoEn: new Date(), expiraEn: expira, activa: true
  });
  return { token: token, expiraEn: expira.toISOString(), usuario: authPublico_(user) };
}

// function authLogout_(b) {
//   if (b.token) {
//     const s = authBuscar_(AUTH.TABLA_SESIONES, 'tokenHash', authSha256_(String(b.token)));
//     if (s) authGuardar_(AUTH.TABLA_SESIONES, s, { activa: false });
//   }
//   return { mensaje: 'Sesión cerrada.' };
// }
function authLogout_(b) {
  if (b.token) {
    const s = authBuscar_(AUTH.TABLA_SESIONES, 'tokenHash', authSha256_(String(b.token)));
    if (s) {
      AUTH_CTX.email = s.email;
      authGuardar_(AUTH.TABLA_SESIONES, s, { activa: false });
    }
  }
  return { mensaje: 'Sesión cerrada.' };
}

function authValidate_(b) {
  const auth = authSesionValida_(b.token);
  return { usuario: authPublico_(auth.user), expiraEn: new Date(authMs_(auth.sesion.expiraEn)).toISOString() };
}

function authChangePassword_(b) {
  const auth = authSesionValida_(b.token);
  if (!authIgualesSeguro_(authHash_(String(b.actual || ''), auth.user.salt), auth.user.passwordHash)) {
    throw new AuthError('PASSWORD_ACTUAL_INCORRECTA', 'La contraseña actual es incorrecta.');
  }
  authValidarPassword_(b.nueva);
  const salt = authSalt_();
  authGuardar_(AUTH.TABLA_USUARIOS, auth.user, { salt: salt, passwordHash: authHash_(String(b.nueva), salt) });
  authCerrarSesionesDe_(auth.user.id, auth.sesion.tokenHash);
  return { mensaje: 'Contraseña actualizada.' };
}

function authForgot_(b) {
  const generica = { mensaje: 'Si el correo existe, recibirás un código de recuperación.' };
  const user = authBuscar_(AUTH.TABLA_USUARIOS, 'email', authEmail_(b.email));
  if (!user || user.estado !== 'activo') return generica;

  const codigo = authCodigo_();
  authGuardar_(AUTH.TABLA_USUARIOS, user, {
    resetHash: authSha256_(codigo + user.salt),
    resetExpira: new Date(Date.now() + AUTH.RESET_MINUTOS * 60000)
  });
  try {
    MailApp.sendEmail({
      to: user.email,
      subject: 'Recuperación de contraseña - ' + AUTH.NOMBRE_APP,
      body: 'Hola ' + user.nombre + ',\n\nTu código de recuperación es: ' + codigo +
            '\nVence en ' + AUTH.RESET_MINUTOS + ' minutos.\n\nSi no lo solicitaste, ignora este mensaje.'
    });
  } catch (e) {
    Logger.log('No se pudo enviar el correo: ' + e.message);
  }
  return generica;
}

function authReset_(b) {
  const invalido = new AuthError('CODIGO_INVALIDO', 'Código inválido o vencido.');
  const user = authBuscar_(AUTH.TABLA_USUARIOS, 'email', authEmail_(b.email));
  if (!user || !user.resetHash || authMs_(user.resetExpira) < Date.now()) throw invalido;
  if (user.bloqueadoHasta && authMs_(user.bloqueadoHasta) > Date.now()) {
    throw new AuthError('CUENTA_BLOQUEADA', 'Cuenta bloqueada temporalmente.');
  }
  if (!authIgualesSeguro_(authSha256_(String(b.codigo || '') + user.salt), user.resetHash)) {
    authRegistrarFallo_(user);
    throw invalido;
  }
  authValidarPassword_(b.nueva);
  const salt = authSalt_();
  authGuardar_(AUTH.TABLA_USUARIOS, user, {
    salt: salt, passwordHash: authHash_(String(b.nueva), salt),
    resetHash: '', resetExpira: '', intentosFallidos: 0, bloqueadoHasta: ''
  });
  authCerrarSesionesDe_(user.id, '');
  return { mensaje: 'Contraseña restablecida. Ya puedes iniciar sesión.' };
}

/* ===================================================================
 *  LÓGICA INTERNA
 * =================================================================== */

function authSesionValida_(token) {
  if (!token) throw new AuthError('SESION_INVALIDA', 'Sesión inválida o expirada.');
  const sesion = authBuscar_(AUTH.TABLA_SESIONES, 'tokenHash', authSha256_(String(token)));
  if (sesion) AUTH_CTX.email = sesion.email;   // para la bitácora
  if (!sesion || String(sesion.activa) !== 'true' || authMs_(sesion.expiraEn) < Date.now()) {
    throw new AuthError('SESION_INVALIDA', 'Sesión inválida o expirada.');
  }
  const user = authBuscar_(AUTH.TABLA_USUARIOS, 'id', sesion.userId);
  if (!user || user.estado !== 'activo') throw new AuthError('CUENTA_INACTIVA', 'Cuenta inactiva.');
  return { user: user, sesion: sesion };
}

function authRegistrarFallo_(user) {
  const intentos = (Number(user.intentosFallidos) || 0) + 1;
  if (intentos >= AUTH.MAX_INTENTOS) {
    authGuardar_(AUTH.TABLA_USUARIOS, user, {
      intentosFallidos: 0,
      bloqueadoHasta: new Date(Date.now() + AUTH.BLOQUEO_MINUTOS * 60000)
    });
  } else {
    authGuardar_(AUTH.TABLA_USUARIOS, user, { intentosFallidos: intentos });
  }
}

function authCerrarSesionesDe_(userId, tokenHashAMantener) {
  let q = AUTH.TABLA_SESIONES + '?user_id=eq.' + encodeURIComponent(userId) + '&activa=eq.true';
  if (tokenHashAMantener) q += '&token_hash=neq.' + encodeURIComponent(tokenHashAMantener);
  sbFetch_('patch', q, { activa: false }, { Prefer: 'return=minimal' });
}

function authValidarPassword_(p) {
  p = String(p == null ? '' : p);
  if (p.length < AUTH.PASSWORD_MIN) {
    throw new AuthError('PASSWORD_DEBIL', 'La contraseña debe tener al menos ' + AUTH.PASSWORD_MIN + ' caracteres.');
  }
  if (p.length > AUTH.PASSWORD_MAX) {
    throw new AuthError('PASSWORD_LARGA', 'La contraseña no puede superar ' + AUTH.PASSWORD_MAX + ' caracteres.');
  }
}

function authPublico_(u) {
  const f = v => (v instanceof Date ? v.toISOString() : (v || ''));
  return { id: u.id, nombre: u.nombre, email: u.email, creadoEn: f(u.creadoEn), ultimoLogin: f(u.ultimoLogin) };
}

/* ===================================================================
 *  CRIPTOGRAFÍA Y UTILIDADES
 * =================================================================== */

function authSha256_(texto) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8);
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/** Hash con sal e iteraciones (Apps Script no tiene bcrypt/argon2). */
function authHash_(password, salt) {
  let h = authSha256_(salt + password);
  for (let i = 0; i < AUTH.HASH_ITERACIONES; i++) h = authSha256_(h + salt + password);
  return h;
}

function authSalt_() { return authSha256_(Utilities.getUuid() + Date.now()).slice(0, 32); }
function authToken_() { return authSha256_(Utilities.getUuid() + Utilities.getUuid() + Date.now()); }

function authCodigo_() {
  const n = parseInt(authSha256_(Utilities.getUuid()).slice(0, 8), 16) % 1000000;
  return ('000000' + n).slice(-6);
}

/** Comparación en tiempo constante. */
function authIgualesSeguro_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function authEmail_(e) { return String(e || '').trim().toLowerCase().slice(0, 120); }

function authLimpiarTexto_(t, max) {
  return String(t || '').replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim().slice(0, max || 100).replace(/^[=+\-@]+/, '');
}

function authMs_(v) {
  if (v instanceof Date) return v.getTime();
  const n = new Date(v).getTime();
  return isNaN(n) ? 0 : n;
}

/* ===================================================================
 *  ACCESO A DATOS (Supabase, vía sbFetch_ de Supabase.gs)
 * =================================================================== */

/** Busca UNA fila por valor exacto de una columna (camelCase). Devuelve objeto camelCase o null. */
function authBuscar_(tabla, columna, valor) {
  valor = String(valor || '');
  if (!valor) return null;
  const r = sbFetch_('get', tabla + '?select=*&' + sbSnake_(columna) + '=eq.' + encodeURIComponent(valor) + '&limit=1');
  return r.data && r.data.length ? sbDeFila_(r.data[0]) : null;
}

function authAgregar_(tabla, obj) {
  try {
    sbFetch_('post', tabla, sbAFila_(obj), { Prefer: 'return=minimal' });
  } catch (e) {
    // 409 = violación de unicidad (correo repetido, incluso con dos registros simultáneos)
    if (e.status === 409 && tabla === AUTH.TABLA_USUARIOS) {
      throw new AuthError('EMAIL_EXISTENTE', 'Ese correo ya está registrado.');
    }
    throw e;
  }
}

/** Actualiza solo los campos indicados y refleja el cambio en el objeto. */
function authGuardar_(tabla, obj, cambios) {
  const pk = AUTH_PK[tabla];
  sbFetch_('patch', tabla + '?' + sbSnake_(pk) + '=eq.' + encodeURIComponent(obj[pk]),
           sbAFila_(cambios), { Prefer: 'return=minimal' });
  Object.assign(obj, cambios);
}

function authLog_(accion, email, ok, detalle) {
  try {
    authAgregar_(AUTH.TABLA_LOG, { fecha: new Date(), accion: accion, email: email, ok: ok, detalle: detalle });
  } catch (e) {
    Logger.log('No se pudo escribir auth_log: ' + e.message);
  }
}

/* ===================================================================
 *  MANTENIMIENTO (ejecutar manualmente desde el editor)
 * =================================================================== */

/** Elimina sesiones vencidas. Se programa con authInstalarTrigger(). */
function authLimpiarSesiones() {
  sbFetch_('delete', AUTH.TABLA_SESIONES + '?expira_en=lt.' + encodeURIComponent(new Date().toISOString()),
           undefined, { Prefer: 'return=minimal' });
}

/** Ejecutar una vez: limpia sesiones vencidas cada día a las 3 a. m. */
function authInstalarTrigger() {
  ScriptApp.newTrigger('authLimpiarSesiones').timeBased().everyDays(1).atHour(3).create();
}

/** Desbloquea manualmente una cuenta: cambia el correo y ejecuta. */
function authDesbloquear() {
  const email = 'usuario@correo.com';
  const u = authBuscar_(AUTH.TABLA_USUARIOS, 'email', authEmail_(email));
  if (!u) { Logger.log('No existe ese usuario'); return; }
  authGuardar_(AUTH.TABLA_USUARIOS, u, { intentosFallidos: 0, bloqueadoHasta: '' });
  Logger.log('Usuario desbloqueado: ' + email);
}