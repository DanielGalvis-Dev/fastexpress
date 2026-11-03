/**
 * CAJA NEGRA — Particiones de equivalencia (E.P.), valores límite (BVA) y
 * tabla de decisión, aplicados a la función de cálculo de tarifa.
 *
 * Los valores esperados se calcularon A MANO desde las reglas BR-01 a BR-04
 * (no se copiaron de la salida del código):
 *   subtotal = 5.00 + peso × (2 si peso <= 5, 4 si no)
 *   total    = subtotal × (1 − descuento) × (1 + recargo)   (redondeo a 2 decimales)
 *
 * "Monto" se interpreta como el TOTAL cotizado en USD (ver la nota de
 * supuestos en docs/informe-tecnico/01-caja-negra.md).
 */
const { calcularTarifa } = require('../../src/Codigo.js');

const total = (peso, cliente, envio) => calcularTarifa(peso, cliente, envio).desglose.total;

describe('Peso — particiones de equivalencia', () => {
  // [id, partición, peso representativo, resultado esperado]
  test.each([
    ['EP-P1', 'inválida: no numérica (texto)', 'abc', 'PESO_INVALIDO'],
    ['EP-P2', 'inválida: vacío (undefined)', undefined, 'PESO_INVALIDO'],
    ['EP-P3', 'inválida: negativa', -3, 'PESO_INVALIDO'],
    ['EP-P4', 'inválida: cero', 0, 'PESO_INVALIDO'],
    ['EP-P5', 'inválida: entre 0 y 0.01', 0.005, 'PESO_INVALIDO'],
    ['EP-P8', 'inválida: excede el límite', 25, 'PESO_EXCEDIDO'],
  ])('%s — %s', (_id, _p, peso, codigo) => {
    const r = calcularTarifa(peso, 'NUEVO', 'ESTANDAR');
    expect(r.success).toBe(false);
    expect(r.codigo).toBe(codigo);
  });

  test('EP-P6 — válida 0.01–5.00 kg: $2.00 por kg (3 kg → costo 6.00, total 11.00)', () => {
    const r = calcularTarifa(3, 'NUEVO', 'ESTANDAR');
    expect(r.desglose.costoPeso).toBe(6.0);
    expect(r.desglose.total).toBe(11.0);
  });

  test('EP-P7 — válida 5.01–20.00 kg: $4.00 por kg (10 kg → costo 40.00, total 45.00)', () => {
    const r = calcularTarifa(10, 'NUEVO', 'ESTANDAR');
    expect(r.desglose.costoPeso).toBe(40.0);
    expect(r.desglose.total).toBe(45.0);
  });
});

describe('Peso — valores límite (BVA), cliente NUEVO + ESTANDAR', () => {
  test.each([
    ['BVA-01', 0.0, 'PESO_INVALIDO'],
    ['BVA-02', -1, 'PESO_INVALIDO'],
    ['BVA-10', 20.01, 'PESO_EXCEDIDO'],
    ['BVA-11', 25, 'PESO_EXCEDIDO'],
  ])('%s — peso %p se rechaza con %s', (_id, peso, codigo) => {
    const r = calcularTarifa(peso, 'NUEVO', 'ESTANDAR');
    expect(r.success).toBe(false);
    expect(r.codigo).toBe(codigo);
  });

  // [id, peso, costo por peso esperado, total esperado]
  test.each([
    ['BVA-03', 0.01, 0.02, 5.02],
    ['BVA-04', 0.02, 0.04, 5.04],
    ['BVA-05', 4.99, 9.98, 14.98],
    ['BVA-06', 5.0, 10.0, 15.0],
    ['BVA-07', 5.01, 20.04, 25.04],
    ['BVA-08', 5.02, 20.08, 25.08],
    ['BVA-09a', 19.99, 79.96, 84.96],
    ['BVA-09b', 20.0, 80.0, 85.0],
  ])('%s — peso %p kg → costo %p, total %p', (_id, peso, costo, esperado) => {
    const r = calcularTarifa(peso, 'NUEVO', 'ESTANDAR');
    expect(r.success).toBe(true);
    expect(r.desglose.costoPeso).toBe(costo);
    expect(r.desglose.total).toBe(esperado);
  });
});

describe('Monto (total cotizado) — particiones de equivalencia y BVA', () => {
  test('EP-M1 — Monto de un envío rechazado: no se genera total (success=false, sin desglose)', () => {
    const r = calcularTarifa(20.01, 'VIP', 'EXPRESS');
    expect(r.success).toBe(false);
    expect(r.desglose).toBeUndefined();
  });

  test('EP-M2 — Monto válido: siempre es un valor positivo con 2 decimales', () => {
    const pesos = [0.01, 1, 5, 5.01, 12.345, 20];
    for (const cliente of ['NUEVO', 'FRECUENTE', 'VIP']) {
      for (const envio of ['ESTANDAR', 'EXPRESS']) {
        for (const peso of pesos) {
          const t = total(peso, cliente, envio);
          expect(t).toBeGreaterThan(0);
          expect(Math.round(t * 100) / 100).toBe(t);
        }
      }
    }
  });

  test('BVA-M1 — Monto mínimo posible: VIP + ESTANDAR + 0.01 kg → 4.02', () => {
    expect(total(0.01, 'VIP', 'ESTANDAR')).toBe(4.02);
  });

  test('BVA-M2 — Monto máximo posible: NUEVO + EXPRESS + 20 kg → 106.25', () => {
    expect(total(20, 'NUEVO', 'EXPRESS')).toBe(106.25);
  });

  test('BVA-M3 — Salto de tramo en el Monto: 5.00 kg → 15.00 y 5.01 kg → 25.04', () => {
    expect(total(5, 'NUEVO', 'ESTANDAR')).toBe(15.0);
    expect(total(5.01, 'NUEVO', 'ESTANDAR')).toBe(25.04);
  });

  test('BVA-M4 — Ningún Monto válido supera el máximo ni baja del mínimo (barrido de todo el rango)', () => {
    for (let centesimas = 1; centesimas <= 2000; centesimas++) {
      const peso = centesimas / 100;
      for (const cliente of ['NUEVO', 'FRECUENTE', 'VIP']) {
        for (const envio of ['ESTANDAR', 'EXPRESS']) {
          const t = total(peso, cliente, envio);
          expect(t).toBeGreaterThanOrEqual(4.02);
          expect(t).toBeLessThanOrEqual(106.25);
        }
      }
    }
  });

  test('BVA-M5 — El Monto crece con el peso dentro de cada tramo', () => {
    for (let c = 1; c < 500; c++) {
      expect(total((c + 1) / 100, 'NUEVO', 'ESTANDAR')).toBeGreaterThan(total(c / 100, 'NUEVO', 'ESTANDAR'));
    }
  });
});

describe('Tabla de decisión — Tipo de Cliente × Tipo de Envío (6 reglas)', () => {
  // Peso 10 kg → costo 40.00, subtotal 45.00
  // [regla, cliente, envío, descuento, recargo, total esperado]
  test.each([
    ['R1', 'NUEVO', 'ESTANDAR', 0.0, 0.0, 45.0],
    ['R2', 'NUEVO', 'EXPRESS', 0.0, 11.25, 56.25],
    ['R3', 'FRECUENTE', 'ESTANDAR', 4.5, 0.0, 40.5],
    ['R4', 'FRECUENTE', 'EXPRESS', 4.5, 10.13, 50.63],
    ['R5', 'VIP', 'ESTANDAR', 9.0, 0.0, 36.0],
    ['R6', 'VIP', 'EXPRESS', 9.0, 9.0, 45.0],
  ])('%s — %s + %s a 10 kg', (_r, cliente, envio, descuento, recargo, esperado) => {
    const d = calcularTarifa(10, cliente, envio).desglose;
    expect(d.tarifaBase).toBe(5.0);
    expect(d.costoPeso).toBe(40.0);
    expect(d.subtotal).toBe(45.0);
    expect(d.descuentoAplicado).toBe(descuento);
    expect(d.recargoAplicado).toBe(recargo);
    expect(d.total).toBe(esperado);
  });

  test('las 6 reglas también se cumplen en el tramo liviano (3 kg, subtotal 11.00)', () => {
    expect(total(3, 'NUEVO', 'ESTANDAR')).toBe(11.0);
    expect(total(3, 'NUEVO', 'EXPRESS')).toBe(13.75);
    expect(total(3, 'FRECUENTE', 'ESTANDAR')).toBe(9.9);
    expect(total(3, 'FRECUENTE', 'EXPRESS')).toBe(12.38);
    expect(total(3, 'VIP', 'ESTANDAR')).toBe(8.8);
    expect(total(3, 'VIP', 'EXPRESS')).toBe(11.0);
  });
});
