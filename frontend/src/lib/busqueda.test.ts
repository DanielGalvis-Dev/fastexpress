import { describe, expect, it } from 'vitest'
import type { RegistroHistorial } from '../types.ts'
import { filtrarRegistros, normalizarTexto } from './busqueda.ts'

const r = (extra: Partial<RegistroHistorial> = {}): RegistroHistorial => ({
  fechaHora: '2026-10-14T18:51:00.000Z',
  peso: 5,
  tipoCliente: 'FRECUENTE',
  tipoEnvio: 'ESTANDAR',
  totalUSD: 13.5,
  estado: 'EXITOSO',
  ...extra,
})

const datos = [
  r(),
  r({ peso: 12, tipoCliente: 'VIP', tipoEnvio: 'EXPRESS', totalUSD: 50 }),
  r({ peso: 201, tipoCliente: 'NUEVO', totalUSD: 0, estado: 'RECHAZADO' }),
]

describe('normalizarTexto', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizarTexto('Estándar')).toBe('estandar')
  })
})

describe('filtrarRegistros', () => {
  it('sin consulta devuelve todo', () => {
    expect(filtrarRegistros(datos, '')).toHaveLength(3)
    expect(filtrarRegistros(datos, '   ')).toHaveLength(3)
  })

  it('busca por cliente, ignorando mayúsculas', () => {
    expect(filtrarRegistros(datos, 'vip')).toEqual([datos[1]])
  })

  it('busca por envío sin tildes', () => {
    expect(filtrarRegistros(datos, 'estandar')).toEqual([datos[0], datos[2]])
  })

  it('busca por peso', () => {
    expect(filtrarRegistros(datos, '201 kg')).toEqual([datos[2]])
  })

  it('busca por total', () => {
    expect(filtrarRegistros(datos, '13,50')).toEqual([datos[0]])
    expect(filtrarRegistros(datos, '13.5')).toEqual([datos[0]])
  })

  it('busca por estado', () => {
    expect(filtrarRegistros(datos, 'rechazado')).toEqual([datos[2]])
  })

  it('exige que aparezcan todas las palabras', () => {
    expect(filtrarRegistros(datos, 'vip express')).toEqual([datos[1]])
    expect(filtrarRegistros(datos, 'vip estandar')).toEqual([])
  })

  it('no busca por total en los rechazados', () => {
    expect(filtrarRegistros([datos[2]], '0')).toEqual([datos[2]]) // coincide con "201", no con el total
    expect(filtrarRegistros([datos[2]], '$0')).toEqual([])
  })
})
