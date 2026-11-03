/**
 * CAJA BLANCA — calcularTarifa(peso, tipoCliente, tipoEnvio)
 *
 * Un caso por cada camino independiente del conjunto base (V(G) = 10).
 * Ver el CFG y el cálculo en docs/informe-tecnico/02-caja-blanca.md
 *
 * Nodos de decisión (cada condición atómica es un nodo):
 *   D1 typeof peso !== "number"      D4 peso <= 0              D7 peso <= 5 (ternario)
 *   D2 isNaN(peso)                   D5 peso < PESO_MIN_KG     D8 !cliente
 *   D3 !isFinite(peso)               D6 peso > PESO_MAX_KG     D9 !envio
 */
const { calcularTarifa } = require('../../src/Codigo.js');

describe('calcularTarifa — caminos independientes (caja blanca)', () => {
  // Cada fila: [id del camino, descripción, peso, cliente, envío, esperado]
  const casos = [
    ['C1', 'D1=V: el peso no es un número (cadena)', '5', 'NUEVO', 'ESTANDAR', { success: false, codigo: 'PESO_INVALIDO' }],
    ['C2', 'D1=F, D2=V: NaN', NaN, 'NUEVO', 'ESTANDAR', { success: false, codigo: 'PESO_INVALIDO' }],
    ['C3', 'D1=F, D2=F, D3=V: Infinity', Infinity, 'NUEVO', 'ESTANDAR', { success: false, codigo: 'PESO_INVALIDO' }],
    ['C4', 'D4=V: peso <= 0', 0, 'NUEVO', 'ESTANDAR', { success: false, codigo: 'PESO_INVALIDO' }],
    ['C5', 'D5=V: 0 < peso < 0.01', 0.005, 'NUEVO', 'ESTANDAR', { success: false, codigo: 'PESO_INVALIDO' }],
    ['C6', 'D6=V: peso > 20', 20.01, 'NUEVO', 'ESTANDAR', { success: false, codigo: 'PESO_EXCEDIDO' }],
    ['C7', 'D7=V: tramo liviano, cliente y envío válidos', 5, 'NUEVO', 'ESTANDAR', { success: true, total: 15.0 }],
    ['C8', 'D7=F: tramo pesado, cliente y envío válidos', 10, 'NUEVO', 'ESTANDAR', { success: true, total: 45.0 }],
    ['C9', 'D8=V: tipo de cliente inexistente', 5, 'XYZ', 'ESTANDAR', { success: false, codigo: 'CLIENTE_INVALIDO' }],
    ['C10', 'D9=V: tipo de envío inexistente', 5, 'NUEVO', 'AEREO', { success: false, codigo: 'ENVIO_INVALIDO' }],
  ];

  test.each(casos)('%s — %s', (_id, _desc, peso, cliente, envio, esperado) => {
    const r = calcularTarifa(peso, cliente, envio);
    expect(r.success).toBe(esperado.success);
    if (esperado.success) {
      expect(r.desglose.total).toBe(esperado.total);
    } else {
      expect(r.codigo).toBe(esperado.codigo);
      expect(typeof r.mensaje).toBe('string');
    }
  });

  test('hay exactamente V(G) = 10 caminos independientes probados', () => {
    expect(casos).toHaveLength(10);
  });

  test('el peso mínimo (0.01) NO es rechazado: D5 es peso < 0.01 estricto', () => {
    expect(calcularTarifa(0.01, 'NUEVO', 'ESTANDAR').success).toBe(true);
  });

  test('el peso máximo (20.00) NO es rechazado: D6 es peso > 20 estricto', () => {
    expect(calcularTarifa(20, 'NUEVO', 'ESTANDAR').success).toBe(true);
  });

  test('el límite del tramo liviano (5.00) usa $2/kg: D7 es peso <= 5', () => {
    expect(calcularTarifa(5, 'NUEVO', 'ESTANDAR').desglose.costoPeso).toBe(10);
  });

  test('el tipo de cliente y de envío se aceptan en minúsculas (toUpperCase)', () => {
    expect(calcularTarifa(10, 'vip', 'express').desglose.total).toBe(45.0);
  });
});
