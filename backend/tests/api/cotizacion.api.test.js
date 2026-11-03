/**
 * Pruebas de la API (doGet, doPost, procesarCotizacion) con el entorno de
 * Apps Script simulado. Verifican el contrato que consume el Frontend.
 */
const codigo = require('../../src/Codigo.js');
const { leer } = require('../helpers/utilidades');

const post = (cuerpo) =>
  codigo.doPost({ postData: { contents: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo) } });

beforeEach(() => {
  jest.clearAllMocks();
  global.authEnrutar.mockReset().mockReturnValue(null);
  global.authExigirSesion.mockReset().mockReturnValue(null);
  global.registrarCotizacionEnSheet.mockReset();
});

describe('doGet', () => {
  test('sin parámetros responde el estado de la API con la versión', () => {
    const r = leer(codigo.doGet({ parameter: {} }));
    expect(r.success).toBe(true);
    expect(r.mensaje).toContain('API FastExpress en funcionamiento');
    expect(r.mensaje).toContain(codigo.CONFIG.VERSION);
  });

  test('sin evento (undefined) también responde el estado', () => {
    expect(leer(codigo.doGet()).success).toBe(true);
  });

  test('getConfig devuelve tarifa base, límite y las listas de clientes y envíos', () => {
    const r = leer(codigo.doGet({ parameter: { action: 'getConfig' } }));
    expect(r.tarifaBase).toBe(5);
    expect(r.limitePesoMaximoKg).toBe(20);
    expect(r.tiposCliente.map((c) => c.id)).toEqual(['NUEVO', 'FRECUENTE', 'VIP']);
    expect(r.tiposCliente.map((c) => c.descuento)).toEqual([0, 0.1, 0.2]);
    expect(r.tiposEnvio.map((e) => e.id)).toEqual(['ESTANDAR', 'EXPRESS']);
    expect(r.tiposEnvio.map((e) => e.recargo)).toEqual([0, 0.25]);
  });

  test('getHistorial exige sesión: si no la hay devuelve el bloqueo', () => {
    const bloqueo = { bloqueado: true };
    global.authExigirSesion.mockReturnValue(bloqueo);
    expect(codigo.doGet({ parameter: { action: 'getHistorial' } })).toBe(bloqueo);
    expect(global.obtenerHistorialCompleto).not.toHaveBeenCalled();
  });

  test('getHistorial con sesión válida delega en obtenerHistorialCompleto', () => {
    const params = { action: 'getHistorial', sesion: 'abc' };
    codigo.doGet({ parameter: params });
    expect(global.obtenerHistorialCompleto).toHaveBeenCalledWith(params);
  });

  test('un error interno no filtra detalles al cliente', () => {
    global.authExigirSesion.mockImplementation(() => {
      throw new Error('detalle secreto');
    });
    const r = leer(codigo.doGet({ parameter: { action: 'getHistorial' } }));
    expect(r).toEqual({ success: false, codigo: 'ERROR_INTERNO', mensaje: 'Error interno del servidor.' });
    expect(JSON.stringify(r)).not.toContain('secreto');
  });
});

describe('doPost — validación del cuerpo y enrutamiento', () => {
  test.each([
    ['sin evento', undefined],
    ['sin postData', {}],
    ['cuerpo vacío', { postData: { contents: '' } }],
  ])('%s → MENSAJE_INVALIDO', (_n, e) => {
    expect(leer(codigo.doPost(e)).codigo).toBe('MENSAJE_INVALIDO');
  });

  test('JSON malformado → MENSAJE_INVALIDO', () => {
    const r = leer(post('{peso: 5'));
    expect(r.codigo).toBe('MENSAJE_INVALIDO');
    expect(r.mensaje).toBe('El cuerpo no es un JSON válido.');
  });

  test('si la acción es de autenticación, responde authEnrutar', () => {
    const resp = { auth: true };
    global.authEnrutar.mockReturnValue(resp);
    expect(post({ action: 'login' })).toBe(resp);
  });

  test('si no hay sesión válida, devuelve el bloqueo y no cotiza', () => {
    const bloqueo = { bloqueado: true };
    global.authExigirSesion.mockReturnValue(bloqueo);
    expect(post({ peso: 5, tipoCliente: 'NUEVO', tipoEnvio: 'ESTANDAR' })).toBe(bloqueo);
    expect(global.registrarCotizacionEnSheet).not.toHaveBeenCalled();
  });

  test('action "chat" se enruta al asistente (mensaje vacío → MENSAJE_INVALIDO)', () => {
    expect(leer(post({ action: 'chat', mensaje: '' })).codigo).toBe('MENSAJE_INVALIDO');
  });

  test('un error inesperado devuelve ERROR_INTERNO sin detalles', () => {
    const r = leer(post('null')); // data = null → data.token lanza TypeError
    expect(r.codigo).toBe('ERROR_INTERNO');
    expect(r.mensaje).toBe('Error interno procesando la solicitud.');
  });
});

describe('doPost — cotización (procesarCotizacion)', () => {
  test('cotización exitosa: devuelve el desglose y la registra como exitosa', () => {
    const r = leer(post({ peso: 5, tipoCliente: 'FRECUENTE', tipoEnvio: 'ESTANDAR' }));
    expect(r).toEqual({
      success: true,
      desglose: { tarifaBase: 5, costoPeso: 10, subtotal: 15, descuentoAplicado: 1.5, recargoAplicado: 0, total: 13.5 },
    });
    expect(global.registrarCotizacionEnSheet).toHaveBeenCalledWith(5, 'FRECUENTE', 'ESTANDAR', 13.5, true);
  });

  test('acepta coma decimal ("5,5") y tipos en minúsculas con espacios', () => {
    const r = leer(post({ peso: '5,5', tipoCliente: ' vip ', tipoEnvio: 'express' }));
    expect(r.success).toBe(true);
    expect(r.desglose.costoPeso).toBe(22);
    expect(global.registrarCotizacionEnSheet).toHaveBeenCalledWith(5.5, 'VIP', 'EXPRESS', r.desglose.total, true);
  });

  test('acepta el peso como texto con punto ("12.5")', () => {
    expect(leer(post({ peso: '12.5', tipoCliente: 'NUEVO', tipoEnvio: 'ESTANDAR' })).success).toBe(true);
  });

  test('peso mayor a 20 kg: rechazo PESO_EXCEDIDO, se registra con total 0 y estado rechazado', () => {
    const r = leer(post({ peso: 20.01, tipoCliente: 'NUEVO', tipoEnvio: 'ESTANDAR' }));
    expect(r.success).toBe(false);
    expect(r.codigo).toBe('PESO_EXCEDIDO');
    expect(global.registrarCotizacionEnSheet).toHaveBeenCalledWith(20.01, 'NUEVO', 'ESTANDAR', 0, false);
  });

  test.each([
    ['texto', 'abc'],
    ['cero', 0],
    ['negativo', -4],
    ['bajo el mínimo', 0.001],
    ['vacío', undefined],
  ])('peso inválido (%s): PESO_INVALIDO y NO se registra (no contamina estadísticas)', (_n, peso) => {
    const r = leer(post({ peso, tipoCliente: 'NUEVO', tipoEnvio: 'ESTANDAR' }));
    expect(r.codigo).toBe('PESO_INVALIDO');
    expect(global.registrarCotizacionEnSheet).not.toHaveBeenCalled();
  });

  test.each([
    ['inexistente', 'XYZ'],
    ['vacío', ''],
    ['ausente', undefined],
  ])('tipo de cliente %s → CLIENTE_INVALIDO', (_n, tipoCliente) => {
    const r = leer(post({ peso: 5, tipoCliente, tipoEnvio: 'ESTANDAR' }));
    expect(r.codigo).toBe('CLIENTE_INVALIDO');
    expect(global.registrarCotizacionEnSheet).not.toHaveBeenCalled();
  });

  test.each([
    ['inexistente', 'AEREO'],
    ['ausente', undefined],
  ])('tipo de envío %s → ENVIO_INVALIDO', (_n, tipoEnvio) => {
    const r = leer(post({ peso: 5, tipoCliente: 'NUEVO', tipoEnvio }));
    expect(r.codigo).toBe('ENVIO_INVALIDO');
  });

  test('una fórmula de hoja como tipo de cliente es rechazada por la lista blanca', () => {
    const r = leer(post({ peso: 5, tipoCliente: '=HYPERLINK("http://x")', tipoEnvio: 'ESTANDAR' }));
    expect(r.codigo).toBe('CLIENTE_INVALIDO');
  });

  test('si falla el registro, la respuesta al usuario NO se rompe y el error queda en el log', () => {
    global.registrarCotizacionEnSheet.mockImplementation(() => {
      throw new Error('Supabase caído');
    });
    const r = leer(post({ peso: 5, tipoCliente: 'NUEVO', tipoEnvio: 'ESTANDAR' }));
    expect(r.success).toBe(true);
    expect(global.Logger.log).toHaveBeenCalledWith(expect.stringContaining('Supabase caído'));
  });
});
