import { describe, expect, it } from 'vitest'
import { ApiError, normalizarRespuesta } from './cotizar.ts'

describe('normalizarRespuesta (contrato del index.html de prueba)', () => {
  const exito = {
    success: true,
    desglose: {
      tarifaBase: 5,
      costoPeso: 48,
      subtotal: 53,
      descuentoAplicado: 10.6,
      recargoAplicado: 0,
      total: 42.4,
    },
  }

  it('lee el total y el desglose completo', () => {
    expect(normalizarRespuesta(exito)).toEqual({
      total: 42.4,
      mensaje: undefined,
      desglose: {
        tarifaBase: 5,
        costoPeso: 48,
        subtotal: 53,
        descuentoAplicado: 10.6,
        recargoAplicado: 0,
        total: undefined,
      },
    })
  })

  it('acepta números en texto', () => {
    const r = normalizarRespuesta({ success: true, desglose: { total: '12.5' } })
    expect(r.total).toBe(12.5)
  })

  it('convierte success:false en ApiError con el mensaje de la API', () => {
    expect(() => normalizarRespuesta({ success: false, mensaje: 'Límite excedido' })).toThrow(
      new ApiError('Límite excedido'),
    )
  })

  it('usa un mensaje por defecto si el rechazo no trae mensaje', () => {
    expect(() => normalizarRespuesta({ success: false })).toThrow('rechazó')
  })

  it('falla si no hay desglose o total', () => {
    expect(() => normalizarRespuesta({ success: true })).toThrow(ApiError)
    expect(() => normalizarRespuesta({ success: true, desglose: { subtotal: 1 } })).toThrow(ApiError)
  })

  it('falla con una respuesta que no es un objeto', () => {
    expect(() => normalizarRespuesta('hola')).toThrow(ApiError)
  })
})
