/**
 * =====================================================================
 *  Supabase.gs  |  Cliente REST + capa de datos (reemplaza a Google Sheets)
 * =====================================================================
 *  PROPIEDADES DEL SCRIPT (Configuración del proyecto > Propiedades):
 *    SUPABASE_URL         https://TU-PROYECTO.supabase.co
 *    SUPABASE_SECRET_KEY  sb_secret_...   (NUNCA en el front)
 *
 *  Este archivo define las MISMAS funciones que tenías en Codigo.gs
 *  (generarSnapshotEstadistico, registrarEnBitacora, registrarCotizacionEnSheet,
 *  obtenerHistorialCompleto). Por eso debes BORRAR las versiones viejas de
 *  Codigo.gs; si quedan duplicadas, Apps Script no garantiza cuál se usa.
 * =====================================================================
 */

const SB_SNAPSHOT_KEY = 'snapshot:v4';

/* ===================================================================
 *  CLIENTE REST
 * =================================================================== */

function sbConfig_() {
  const p = PropertiesService.getScriptProperties();
  const url = String(p.getProperty('SUPABASE_URL') || '').trim().replace(/\/+$/, '');
  const key = String(p.getProperty('SUPABASE_SECRET_KEY') || '').trim();
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en las propiedades del script.');
  }
  return { url: url, key: key };
}

/**
 * Llamada a PostgREST.  metodo: 'get' | 'post' | 'patch' | 'delete'
 * ruta: lo que va después de /rest/v1/  (ej. "usuarios?email=eq.a@b.com&limit=1")
 * Devuelve { status, data, headers }. Lanza Error con .status si falla.
 * Con claves sb_secret_ solo se envía el header "apikey" (no es un JWT).
 */
function sbFetch_(metodo, ruta, body, extraHeaders) {
  const c = sbConfig_();
  const opciones = {
    method: metodo,
    contentType: 'application/json',
    headers: Object.assign({ apikey: c.key }, extraHeaders || {}),
    muteHttpExceptions: true
  };
  if (body !== undefined) opciones.payload = JSON.stringify(body);

  let res, code;
  // Reintentos solo en lecturas (los POST no son idempotentes)
  const maxIntentos = metodo === 'get' ? 3 : 1;
  for (let i = 0; i < maxIntentos; i++) {
    res = UrlFetchApp.fetch(c.url + '/rest/v1/' + ruta, opciones);
    code = res.getResponseCode();
    if ((code === 502 || code === 503 || code === 504) && i < maxIntentos - 1) {
      Utilities.sleep(500 * (i + 1));
      continue;
    }
    break;
  }

  const texto = res.getContentText();
  if (code >= 200 && code < 300) {
    return { status: code, data: texto ? JSON.parse(texto) : null, headers: res.getHeaders() };
  }
  const err = new Error('Supabase HTTP ' + code + ': ' + texto.substring(0, 300));
  err.status = code;
  err.body = texto;
  throw err;
}

/* camelCase (código) <-> snake_case (base de datos) */
function sbSnake_(s) { return String(s).replace(/[A-Z]/g, m => '_' + m.toLowerCase()); }
function sbCamel_(s) { return String(s).replace(/_([a-z])/g, (m, c) => c.toUpperCase()); }

/** Objeto JS -> fila de BD. '' se guarda como NULL; claves que empiezan con "_" se ignoran. */
function sbAFila_(obj) {
  const o = {};
  Object.keys(obj).forEach(k => {
    if (k.charAt(0) === '_' || obj[k] === undefined) return;
    o[sbSnake_(k)] = obj[k] === '' ? null : obj[k];
  });
  return o;
}

/** Fila de BD -> objeto JS */
function sbDeFila_(fila) {
  const o = {};
  Object.keys(fila).forEach(k => (o[sbCamel_(k)] = fila[k]));
  return o;
}

/** Ejecuta esta función desde el editor para comprobar la conexión. */
function supabaseProbarConexion() {
  const r = sbFetch_('get', 'usuarios?select=id&limit=1');
  Logger.log('✅ Conexión OK. Filas leídas de "usuarios": ' + r.data.length);
  const s = sbFetch_('post', 'rpc/snapshot_estadistico', { p_tz: 'America/Bogota' });
  Logger.log('✅ Función snapshot_estadistico OK: ' + JSON.stringify(s.data).substring(0, 200));
}

/* ===================================================================
 *  COTIZACIONES
 * =================================================================== */

/** (El nombre se conserva para no tocar procesarCotizacion en Codigo.gs.) */
function registrarCotizacionEnSheet(peso, tipoCliente, tipoEnvio, total, fueExitoso) {
  sbFetch_('post', 'cotizaciones', {
    peso_kg: peso,
    tipo_cliente: tipoCliente,
    tipo_envio: tipoEnvio,
    total_usd: total,
    estado: fueExitoso ? 'EXITOSO' : 'RECHAZADO'
  }, { Prefer: 'return=minimal' });
  CacheService.getScriptCache().remove(SB_SNAPSHOT_KEY);   // las estadísticas cambiaron
}

/**
 * Historial paginado. Uso: ?action=getHistorial&limit=50&offset=0&token=XXXX
 * (misma respuesta que antes; "fechaHora" ahora es una fecha ISO 8601).
 */
function obtenerHistorialCompleto(params) {
  try {
    params = params || {};

    const tokenEsperado = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
    if (tokenEsperado && params.token !== tokenEsperado) {
      return responderJSON({ success: false, codigo: 'NO_AUTORIZADO', mensaje: 'Acceso no autorizado.' });
    }

    const limit = Math.min(Math.max(parseInt(params.limit, 10) || 50, 1), CONFIG.HISTORIAL_PAGINA_MAX);
    const offset = Math.max(parseInt(params.offset, 10) || 0, 0);

    let r;
    try {
      r = sbFetch_('get',
        'cotizaciones?select=fecha,peso_kg,tipo_cliente,tipo_envio,total_usd,estado' +
        '&order=fecha.asc,id.asc&limit=' + limit + '&offset=' + offset,
        undefined, { Prefer: 'count=exact' });
    } catch (e) {
      if (e.status === 416) {   // offset fuera de rango
        return responderJSON({ success: true, totalRegistros: 0, limit: limit, offset: offset, data: [] });
      }
      throw e;
    }

    const rango = r.headers['Content-Range'] || r.headers['content-range'] || '';
    const total = parseInt(String(rango).split('/')[1], 10) || 0;

    const registros = (r.data || []).map(f => ({
      fechaHora: f.fecha,
      peso: f.peso_kg,
      tipoCliente: f.tipo_cliente,
      tipoEnvio: f.tipo_envio,
      totalUSD: f.total_usd,
      estado: f.estado
    }));

    return responderJSON({ success: true, totalRegistros: total, limit: limit, offset: offset, data: registros });
  } catch (err) {
    Logger.log('Error en historial: ' + (err && err.stack));
    return responderJSON({ success: false, codigo: 'ERROR_INTERNO', mensaje: 'No se pudo obtener el historial.' });
  }
}

/* ===================================================================
 *  ESTADÍSTICAS PARA LA IA
 * =================================================================== */

/** Ahora las cuentas las hace PostgreSQL (función snapshot_estadistico). */
function generarSnapshotEstadistico() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(SB_SNAPSHOT_KEY);
  if (cached) return JSON.parse(cached);

  const tz = PropertiesService.getScriptProperties().getProperty('ZONA_HORARIA') || 'America/Bogota';
  const snap = sbFetch_('post', 'rpc/snapshot_estadistico', { p_tz: tz }).data;

  if (!snap || !snap.totales || Number(snap.totales.cotizaciones) === 0) {
    return { totales: { cotizaciones: 0 } };
  }

  // Las reglas de negocio siguen saliendo de CONFIG (Codigo.gs)
  snap.reglasNegocio = {
    tarifaBaseUSD: CONFIG.TARIFA_BASE,
    pesoMaximoKg: CONFIG.PESO_MAX_KG,
    descuentoPorCliente: CLIENTES_VALIDOS.reduce((acc, k) => { acc[k] = CONFIG.CLIENTES[k].descuento * 100; return acc; }, {}),
    recargoPorEnvioPct: ENVIOS_VALIDOS.reduce((acc, k) => { acc[k] = CONFIG.ENVIOS[k].recargo * 100; return acc; }, {})
  };

  try {
    cache.put(SB_SNAPSHOT_KEY, JSON.stringify(snap), 300);
  } catch (e) {
    Logger.log('No se pudo cachear el snapshot: ' + e.message);
  }
  return snap;
}

/* ===================================================================
 *  BITÁCORA DEL CHAT
 * =================================================================== */

function registrarEnBitacora(sesionId, mensaje, tipo, errorCod, latencia) {
  try {
    sbFetch_('post', 'chat_log', {
      sesion_id: String(sesionId).substring(0, 64),
      mensaje: String(mensaje).substring(0, 200),
      tipo: tipo,
      codigo_error: errorCod || null,
      latencia_ms: Math.round(Number(latencia) || 0)
    }, { Prefer: 'return=minimal' });
  } catch (e) {
    Logger.log('Error registrando bitácora: ' + e.message);   // la bitácora nunca debe romper el chat
  }
}