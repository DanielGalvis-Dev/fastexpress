/**
 * Simula el entorno de Google Apps Script: servicios globales y las funciones
 * de otros archivos (Login.js, Supabase.js) de las que depende Codigo.js.
 * Cada test puede reconfigurar estos mocks con mockReturnValue / mockImplementation.
 */
function crearSalidaTexto(contenido) {
  return {
    contenido,
    mime: null,
    setMimeType(m) { this.mime = m; return this; },
    getContent() { return this.contenido; },
  };
}

global.ContentService = {
  createTextOutput: (c) => crearSalidaTexto(c),
  MimeType: { JSON: 'JSON' },
};
global.Logger = { log: jest.fn() };

// Funciones de otros archivos del proyecto (globales en Apps Script)
global.authEnrutar = jest.fn(() => null);
global.authExigirSesion = jest.fn(() => null);
global.obtenerHistorialCompleto = jest.fn(() => global.ContentService.createTextOutput('{"success":true,"data":[]}'));
global.registrarCotizacionEnSheet = jest.fn();
global.generarSnapshotEstadistico = jest.fn(() => ({}));
global.registrarEnBitacora = jest.fn();

// Servicios usados por el chat con IA (Gemini), el caché y los límites de uso
global.__props = {};
global.PropertiesService = {
  getScriptProperties: () => ({
    getProperty: (k) => (Object.prototype.hasOwnProperty.call(global.__props, k) ? global.__props[k] : null),
  }),
};

global.__cache = new Map();
global.CacheService = {
  getScriptCache: () => ({
    get: (k) => (global.__cache.has(k) ? global.__cache.get(k) : null),
    put: (k, v) => { global.__cache.set(k, v); },
  }),
};

global.__lock = { waitLock: jest.fn(), releaseLock: jest.fn() };
global.LockService = { getScriptLock: () => global.__lock };

global.UrlFetchApp = { fetch: jest.fn() };
global.Utilities = { sleep: jest.fn() };
