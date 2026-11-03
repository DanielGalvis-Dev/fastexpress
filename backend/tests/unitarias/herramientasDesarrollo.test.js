/**
 * Herramientas que se ejecutan a mano desde el editor de Apps Script
 * (verMiSnapshot, probarCalcularTarifa, probarHistorial).
 */
const codigo = require('../../src/Codigo.js');

beforeEach(() => {
  global.Logger.log.mockReset();
  global.__props = {};
});

test('probarCalcularTarifa: los 12 casos incorporados en el propio script pasan', () => {
  codigo.probarCalcularTarifa();
  const mensajes = global.Logger.log.mock.calls.map((c) => c[0]);
  expect(mensajes.filter((m) => m.startsWith('✅'))).toHaveLength(12);
  expect(mensajes.filter((m) => m.startsWith('❌'))).toHaveLength(0);
  expect(mensajes[mensajes.length - 1]).toBe('TODAS LAS PRUEBAS PASARON');
});

test('verMiSnapshot imprime el snapshot actual en el registro', () => {
  global.generarSnapshotEstadistico.mockReturnValue({ totales: { cotizaciones: 3 } });
  codigo.verMiSnapshot();
  expect(global.Logger.log).toHaveBeenCalledWith(expect.stringContaining('"cotizaciones": 3'));
});

test('probarHistorial consulta el historial con el token de la propiedad API_TOKEN', () => {
  global.__props = { API_TOKEN: 'tok' };
  global.obtenerHistorialCompleto.mockClear();
  codigo.probarHistorial();
  expect(global.obtenerHistorialCompleto).toHaveBeenCalledWith({ action: 'getHistorial', token: 'tok' });
  expect(global.Logger.log).toHaveBeenCalledTimes(1);
});
