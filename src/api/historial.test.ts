import { describe, expect, it } from 'vitest'
import { ApiError } from './cotizar.ts'
import { normalizarHistorial } from './historial.ts'

const fila = (extra: object = {}) => ({
  fechaHora: '2026-10-01T02:10:15.131Z',
  peso: 20,
  tipoCliente: 'NUEVO',
  tipoEnvio: 'ESTANDAR',
  totalUSD: 85,
  estado: 'EXITOSO',
  ...extra,
})

describe('normalizarHistorial (formato verificado de getHistorial)', () => {
  it('ordena del más reciente al más antiguo', () => {
    const r = normalizarHistorial({
      success: true,
      totalRegistros: 2,
      data: [fila({ fechaHora: '2026-10-01T02:00:00Z' }), fila({ fechaHora: '2026-10-06T13:39:08Z' })],
    })
    expect(r.map((x) => x.fechaHora)).toEqual(['2026-10-06T13:39:08Z', '2026-10-01T02:00:00Z'])
  })

  it('conserva los rechazados con total 0', () => {
    const r = normalizarHistorial({
      success: true,
      data: [fila({ peso: 201, totalUSD: 0, estado: 'RECHAZADO' })],
    })
    expect(r[0]).toMatchObject({ peso: 201, totalUSD: 0, estado: 'RECHAZADO' })
  })

  it('ignora filas mal formadas', () => {
    const r = normalizarHistorial({
      success: true,
      data: [fila(), { peso: 'x' }, null, fila({ tipoCliente: 'OTRO' }), fila({ estado: 'RARO' })],
    })
    expect(r).toHaveLength(1)
  })

  it('acepta un historial vacío', () => {
    expect(normalizarHistorial({ success: true, data: [] })).toEqual([])
  })

  it('falla con success:false o sin data', () => {
    expect(() => normalizarHistorial({ success: false, mensaje: 'Sin acceso' })).toThrow(
      new ApiError('Sin acceso'),
    )
    expect(() => normalizarHistorial({ success: true })).toThrow(ApiError)
    expect(() => normalizarHistorial(null)).toThrow(ApiError)
  })
})
