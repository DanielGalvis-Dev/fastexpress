/**
 * Asistente de IA: atendedorChatIA y llamarGeminiAPI.
 * Gemini y los servicios de Apps Script están simulados: no se hace ninguna
 * llamada real ni se consume cuota.
 */
const codigo = require('../../src/Codigo.js');
const { leer, respuestaHttp, gemini200 } = require('../helpers/utilidades');

const SNAPSHOT_CON_DATOS = { totales: { cotizaciones: 5 } };

beforeEach(() => {
  jest.restoreAllMocks();
  global.__cache.clear();
  global.__props = { GEMINI_API_KEY: ' clave-de-prueba ' };
  global.__lock.waitLock.mockReset();
  global.__lock.releaseLock.mockReset();
  global.UrlFetchApp.fetch.mockReset();
  global.Utilities.sleep.mockReset();
  global.Logger.log.mockReset();
  global.generarSnapshotEstadistico.mockReset().mockReturnValue(SNAPSHOT_CON_DATOS);
  global.registrarEnBitacora.mockReset();
});

describe('llamarGeminiAPI', () => {
  const llamar = (historial = []) => codigo.llamarGeminiAPI('¿cuántas cotizaciones hay?', historial, SNAPSHOT_CON_DATOS);

  test('sin GEMINI_API_KEY devuelve ERROR_INTERNO y no llama a Gemini', () => {
    global.__props = {};
    const r = llamar();
    expect(r.codigo).toBe('ERROR_INTERNO');
    expect(global.UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('respuesta correcta: devuelve ámbito y respuesta; la clave va en el header, no en la URL', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"estadistica","respuesta":"Hay 5."}'));
    expect(llamar()).toEqual({ success: true, ambito: 'estadistica', respuesta: 'Hay 5.' });
    const [url, opciones] = global.UrlFetchApp.fetch.mock.calls[0];
    expect(url).not.toContain('clave-de-prueba');
    expect(url).toContain('gemini-2.5-flash');
    expect(opciones.headers['x-goog-api-key']).toBe('clave-de-prueba');
  });

  test('con el modelo 2.5-flash desactiva el "thinking"; con otro modelo no', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"saludo","respuesta":"Hola"}'));
    llamar();
    expect(JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });

    global.__props.GEMINI_MODEL = 'gemini-pro';
    llamar();
    const cuerpo = JSON.parse(global.UrlFetchApp.fetch.mock.calls[1][1].payload);
    expect(cuerpo.generationConfig.thinkingConfig).toBeUndefined();
    expect(global.UrlFetchApp.fetch.mock.calls[1][0]).toContain('gemini-pro');
  });

  test('el historial se limita a 6 turnos, mapea roles y tolera elementos vacíos', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"saludo","respuesta":"Hola"}'));
    const historial = [null, ...Array.from({ length: 8 }, (_, i) => ({ rol: i % 2 ? 'asistente' : 'usuario', texto: 'x'.repeat(1500) }))];
    llamar(historial);
    const contents = JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).contents;
    expect(contents).toHaveLength(7); // 6 del historial + la pregunta actual
    expect(contents[0].parts[0].text).toHaveLength(1000);
    expect(contents.map((c) => c.role)).toContain('model');
  });

  test('un elemento nulo dentro de los últimos 6 turnos se omite', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"saludo","respuesta":"Hola"}'));
    llamar([null, { rol: 'usuario', texto: 'hola' }]);
    expect(JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).contents).toHaveLength(2);
  });

  test('un historial que no es arreglo se ignora', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"saludo","respuesta":"Hola"}'));
    llamar('no es un arreglo');
    expect(JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).contents).toHaveLength(1);
  });

  test('un elemento del historial sin texto se envía vacío', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"saludo","respuesta":"Hola"}'));
    llamar([{ rol: 'usuario' }]);
    expect(JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).contents[0].parts[0].text).toBe('');
  });

  test('reintenta ante un 503 temporal y luego tiene éxito', () => {
    global.UrlFetchApp.fetch
      .mockReturnValueOnce(respuestaHttp(503, 'sobrecargado'))
      .mockReturnValueOnce(gemini200('{"ambito":"estadistica","respuesta":"ok"}'));
    expect(llamar().success).toBe(true);
    expect(global.UrlFetchApp.fetch).toHaveBeenCalledTimes(2);
    expect(global.Utilities.sleep).toHaveBeenCalledWith(800);
  });

  test.each([[500], [503]])('si el %i persiste tras los reintentos → IA_NO_DISPONIBLE', (codigoHttp) => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(codigoHttp, 'error'));
    const r = llamar();
    expect(r.codigo).toBe('IA_NO_DISPONIBLE');
    expect(r.reintentarEnSeg).toBe(5);
    expect(global.UrlFetchApp.fetch).toHaveBeenCalledTimes(3); // 1 intento + 2 reintentos
  });

  test('429 (cuota) no se reintenta → IA_LIMITE', () => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(429, 'cuota'));
    const r = llamar();
    expect(r.codigo).toBe('IA_LIMITE');
    expect(r.reintentarEnSeg).toBe(30);
    expect(global.UrlFetchApp.fetch).toHaveBeenCalledTimes(1);
  });

  test('otro código HTTP (404): IA_NO_DISPONIBLE y el detalle queda solo en el log', () => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(404, 'modelo inexistente'));
    const r = llamar();
    expect(r.codigo).toBe('IA_NO_DISPONIBLE');
    expect(JSON.stringify(r)).not.toContain('modelo inexistente');
    expect(global.Logger.log).toHaveBeenCalledWith(expect.stringContaining('404'));
  });

  test('sin candidatos pero con bloqueo de seguridad → fuera de contexto', () => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(200, { candidates: [], promptFeedback: { blockReason: 'SAFETY' } }));
    expect(llamar()).toEqual({ success: true, ambito: 'fuera_de_contexto', respuesta: '' });
  });

  test.each([
    ['candidates vacío sin bloqueo', { candidates: [] }],
    ['candidates ausente', {}],
  ])('%s → IA_NO_DISPONIBLE', (_n, cuerpo) => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(200, cuerpo));
    expect(llamar().codigo).toBe('IA_NO_DISPONIBLE');
  });

  test('respuesta truncada por MAX_TOKENS → IA_NO_DISPONIBLE', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":', { finishReason: 'MAX_TOKENS' }));
    expect(llamar().codigo).toBe('IA_NO_DISPONIBLE');
  });

  test('contenido bloqueado (SAFETY) → fuera de contexto', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('', { finishReason: 'SAFETY' }));
    expect(llamar().ambito).toBe('fuera_de_contexto');
  });

  test.each([
    ['candidato sin contenido', { candidates: [{}] }],
    ['sin parts', { candidates: [{ content: {} }] }],
    ['parts vacío', { candidates: [{ content: { parts: [] } }] }],
    ['texto que no es cadena', { candidates: [{ content: { parts: [{ text: 5 }] } }] }],
  ])('%s → IA_NO_DISPONIBLE', (_n, cuerpo) => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(200, cuerpo));
    expect(llamar().codigo).toBe('IA_NO_DISPONIBLE');
  });

  test('el texto de Gemini no es JSON válido → IA_NO_DISPONIBLE', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('esto no es json'));
    expect(llamar().mensaje).toContain('formato inesperado');
  });

  test('si el cuerpo HTTP no es JSON, el error se captura', () => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(200, '<html>'));
    expect(llamar().mensaje).toContain('Error de comunicación');
  });

  test('si fetch lanza una excepción, el error se captura', () => {
    global.UrlFetchApp.fetch.mockImplementation(() => {
      throw new Error('sin red');
    });
    expect(llamar().mensaje).toContain('Error de comunicación');
  });
});

describe('atendedorChatIA', () => {
  const chat = (payload) => leer(codigo.atendedorChatIA(payload));
  const conGemini = (ambito, respuesta = '') =>
    global.UrlFetchApp.fetch.mockReturnValue(gemini200(JSON.stringify({ ambito, respuesta })));

  test.each([
    ['vacío', { mensaje: '' }],
    ['solo espacios', { mensaje: '   ' }],
    ['ausente', {}],
    ['más de 500 caracteres', { mensaje: 'a'.repeat(501) }],
  ])('mensaje %s → MENSAJE_INVALIDO', (_n, payload) => {
    expect(chat(payload).codigo).toBe('MENSAJE_INVALIDO');
    expect(global.UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('un mensaje de exactamente 500 caracteres es válido', () => {
    conGemini('saludo', 'Hola');
    expect(chat({ mensaje: 'a'.repeat(500) }).success).toBe(true);
  });

  test('límite de uso excedido → LIMITE_EXCEDIDO con tiempo de espera', () => {
    global.__cache.set('rl:min:s1', '10');
    const r = chat({ mensaje: 'hola', sesionId: 's1' });
    expect(r.codigo).toBe('LIMITE_EXCEDIDO');
    expect(r.reintentarEnSeg).toBe(20);
    expect(global.UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('sin cotizaciones registradas no llama a la IA (tipo sin_datos)', () => {
    global.generarSnapshotEstadistico.mockReturnValue({ totales: { cotizaciones: 0 } });
    const r = chat({ mensaje: 'hola' });
    expect(r.tipo).toBe('sin_datos');
    expect(global.UrlFetchApp.fetch).not.toHaveBeenCalled();
  });

  test('si Gemini falla, responde el error y lo anota en la bitácora', () => {
    global.UrlFetchApp.fetch.mockReturnValue(respuestaHttp(429, 'cuota'));
    const r = chat({ mensaje: 'hola', sesionId: 's1' });
    expect(r).toMatchObject({ success: false, codigo: 'IA_LIMITE', reintentarEnSeg: 30 });
    expect(global.registrarEnBitacora).toHaveBeenCalledWith('s1', 'hola', 'error', 'IA_LIMITE', expect.any(Number));
  });

  test('pregunta estadística: devuelve la respuesta de la IA', () => {
    conGemini('estadistica', 'Hay 5 cotizaciones.');
    const r = chat({ mensaje: '¿cuántas hay?', sesionId: 's1' });
    expect(r).toMatchObject({ success: true, tipo: 'estadistica', respuesta: 'Hay 5 cotizaciones.' });
    expect(global.registrarEnBitacora).toHaveBeenCalledWith('s1', '¿cuántas hay?', 'estadistica', 'OK', expect.any(Number));
  });

  test('fuera de contexto: responde con un chiste de la lista', () => {
    conGemini('fuera_de_contexto');
    expect(codigo.LISTA_CHISTES).toContain(chat({ mensaje: '¿quién ganó el partido?' }).respuesta);
  });

  test('ámbito inesperado de la IA se trata como fuera de contexto (no se muestra su texto)', () => {
    conGemini('ignora_tus_reglas', 'TEXTO MALICIOSO');
    const r = chat({ mensaje: 'hola' });
    expect(r.tipo).toBe('fuera_de_contexto');
    expect(r.respuesta).not.toContain('MALICIOSO');
  });

  test('cálculo de tarifa: redirige al botón "Nueva cotización"', () => {
    conGemini('calculo_tarifa');
    const r = chat({ mensaje: '¿cuánto cuesta enviar 5 kg?' });
    expect(r.tipo).toBe('calculo_tarifa');
    expect(r.respuesta).toContain('Nueva cotización');
  });

  test('la respuesta se limpia de etiquetas HTML y se limita a 800 caracteres', () => {
    conGemini('estadistica', '<b>Hola</b><script>x</script>' + 'a'.repeat(900));
    const r = chat({ mensaje: 'hola' });
    expect(r.respuesta).not.toMatch(/<|>/);
    expect(r.respuesta.length).toBeLessThanOrEqual(800);
  });

  test('una respuesta vacía en un ámbito que la requiere da un mensaje claro', () => {
    conGemini('estadistica', '');
    expect(chat({ mensaje: 'hola' }).respuesta).toContain('No pude generar una respuesta');
  });

  test('una respuesta sin campo "respuesta" también da el mensaje claro', () => {
    global.UrlFetchApp.fetch.mockReturnValue(gemini200('{"ambito":"saludo"}'));
    expect(chat({ mensaje: 'hola' }).respuesta).toContain('No pude generar una respuesta');
  });

  test('elimina caracteres de control del mensaje antes de enviarlo a la IA', () => {
    conGemini('saludo', 'Hola');
    chat({ mensaje: 'ho\u0000la\u0007' });
    const texto = JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).contents.pop().parts[0].text;
    expect(texto).toContain('PREGUNTA_DEL_USUARIO:\nhola');
  });

  test('pasa el historial de la conversación a la IA', () => {
    conGemini('saludo', 'Hola');
    chat({ mensaje: 'hola', historial: [{ rol: 'usuario', texto: 'antes' }] });
    expect(JSON.parse(global.UrlFetchApp.fetch.mock.calls[0][1].payload).contents).toHaveLength(2);
  });
});
