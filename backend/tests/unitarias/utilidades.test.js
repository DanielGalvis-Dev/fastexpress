/** Funciones auxiliares de Codigo.js: redondeo, sesión, respuesta JSON, límites y chistes. */
const codigo = require('../../src/Codigo.js');

beforeEach(() => {
  jest.restoreAllMocks();
  global.__cache.clear();
  global.__lock.waitLock.mockReset();
  global.__lock.releaseLock.mockReset();
});

describe('redondear2', () => {
  test.each([
    [0.1 + 0.2, 0.3],
    [1.005, 1.01],
    [10.125, 10.13],
    [2.5, 2.5],
    [0, 0],
  ])('redondear2(%p) = %p', (entrada, esperado) => {
    expect(codigo.redondear2(entrada)).toBe(esperado);
  });
});

describe('normalizarSesionId', () => {
  test('conserva letras, números, guion y guion bajo', () => {
    expect(codigo.normalizarSesionId('abc-123_X')).toBe('abc-123_X');
  });
  test('elimina caracteres peligrosos', () => {
    expect(codigo.normalizarSesionId('a b/c;d<e>')).toBe('abcde');
  });
  test('limita a 64 caracteres', () => {
    expect(codigo.normalizarSesionId('a'.repeat(100))).toHaveLength(64);
  });
  test.each([[undefined], [''], ['***']])('valor %p → "anonimo"', (v) => {
    expect(codigo.normalizarSesionId(v)).toBe('anonimo');
  });
});

describe('responderJSON', () => {
  test('serializa el objeto y marca el tipo MIME JSON', () => {
    const salida = codigo.responderJSON({ a: 1 });
    expect(salida.getContent()).toBe('{"a":1}');
    expect(salida.mime).toBe('JSON');
  });
});

describe('verificarRateLimit', () => {
  test('permite la primera solicitud, suma los contadores y libera el lock', () => {
    expect(codigo.verificarRateLimit('s1')).toEqual({ permitido: true });
    expect(global.__cache.get('rl:min:s1')).toBe('1');
    expect(global.__cache.get('rl:min:global')).toBe('1');
    expect(global.__lock.releaseLock).toHaveBeenCalled();
  });

  test('bloquea la sesión al llegar al límite por minuto (10)', () => {
    global.__cache.set('rl:min:s1', '10');
    expect(codigo.verificarRateLimit('s1')).toEqual({ permitido: false, esperaSeg: 20 });
    expect(global.__lock.releaseLock).toHaveBeenCalled();
  });

  test('las primeras 10 solicitudes pasan y la 11.ª se bloquea', () => {
    for (let i = 0; i < 10; i++) expect(codigo.verificarRateLimit('s2').permitido).toBe(true);
    expect(codigo.verificarRateLimit('s2').permitido).toBe(false);
  });

  test('bloquea a todos al llegar al límite global (60)', () => {
    global.__cache.set('rl:min:global', '60');
    expect(codigo.verificarRateLimit('otra')).toEqual({ permitido: false, esperaSeg: 30 });
  });

  test('si no obtiene el lock, rechaza de forma segura (fail-closed)', () => {
    global.__lock.waitLock.mockImplementation(() => {
      throw new Error('timeout');
    });
    expect(codigo.verificarRateLimit('s1')).toEqual({ permitido: false, esperaSeg: 5 });
  });
});

describe('seleccionarChisteUnico', () => {
  test('devuelve un chiste de la lista y lo recuerda para la sesión', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    expect(codigo.seleccionarChisteUnico('s1')).toBe(codigo.LISTA_CHISTES[0]);
    expect(global.__cache.get('chiste:s1')).toBe('0');
  });

  test('nunca repite el chiste anterior de la misma sesión', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    codigo.seleccionarChisteUnico('s1');
    expect(codigo.seleccionarChisteUnico('s1')).toBe(codigo.LISTA_CHISTES[1]);
  });

  test('si el último índice se repite, avanza circularmente al primero', () => {
    const ultimo = codigo.LISTA_CHISTES.length - 1;
    global.__cache.set('chiste:s1', String(ultimo));
    jest.spyOn(Math, 'random').mockReturnValue(0.9999);
    expect(codigo.seleccionarChisteUnico('s1')).toBe(codigo.LISTA_CHISTES[0]);
  });

  test('la lista tiene 10 chistes (Regla §7)', () => {
    expect(codigo.LISTA_CHISTES).toHaveLength(10);
  });
});
