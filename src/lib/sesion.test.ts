import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sesion } from '../types.ts'
import {
  borrarSesion,
  esCodigoSesionInvalida,
  EVENTO_SESION_INVALIDA,
  guardarSesion,
  haExpirado,
  leerSesion,
  notificarSesionInvalida,
  obtenerToken,
} from './sesion.ts'

const enUnaHora = () => new Date(Date.now() + 3_600_000).toISOString()

const sesion = (extra: Partial<Sesion> = {}): Sesion => ({
  token: 'tok-123',
  expiraEn: enUnaHora(),
  usuario: { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
  ...extra,
})

describe('sesión en localStorage', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => vi.restoreAllMocks())

  it('guarda y vuelve a leer la sesión', () => {
    const s = sesion()
    guardarSesion(s)
    expect(leerSesion()).toEqual(s)
    expect(obtenerToken()).toBe('tok-123')
  })

  it('sin sesión guardada no hay token', () => {
    expect(leerSesion()).toBeNull()
    expect(obtenerToken()).toBeUndefined()
  })

  it('borrarSesion la elimina', () => {
    guardarSesion(sesion())
    borrarSesion()
    expect(leerSesion()).toBeNull()
  })

  it('descarta y borra una sesión vencida', () => {
    guardarSesion(sesion({ expiraEn: new Date(Date.now() - 1000).toISOString() }))
    expect(leerSesion()).toBeNull()
    expect(localStorage.getItem('fastexpress.sesion')).toBeNull()
  })

  it.each([
    ['JSON dañado', '{no es json'],
    ['no es un objeto', '"hola"'],
    ['sin token', JSON.stringify({ expiraEn: enUnaHora(), usuario: { id: 'u', nombre: 'A', email: 'a@b.co' } })],
    ['expiraEn inválido', JSON.stringify({ token: 't', expiraEn: 'x', usuario: { id: 'u', nombre: 'A', email: 'a@b.co' } })],
    ['sin usuario', JSON.stringify({ token: 't', expiraEn: enUnaHora() })],
  ])('descarta una sesión guardada inválida (%s)', (_nombre, crudo) => {
    localStorage.setItem('fastexpress.sesion', crudo)
    expect(leerSesion()).toBeNull()
    expect(localStorage.getItem('fastexpress.sesion')).toBeNull()
  })

  it('si localStorage lanza, no rompe: leer devuelve null y guardar/borrar no fallan', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado', 'SecurityError')
    })

    expect(leerSesion()).toBeNull()
    expect(() => guardarSesion(sesion())).not.toThrow()
    expect(() => borrarSesion()).not.toThrow()
  })
})

describe('haExpirado', () => {
  it('compara contra la fecha actual (vencer justo ahora cuenta como vencida)', () => {
    const ahora = Date.parse('2026-10-22T09:00:00Z')
    expect(haExpirado(sesion({ expiraEn: '2026-10-22T09:00:01Z' }), ahora)).toBe(false)
    expect(haExpirado(sesion({ expiraEn: '2026-10-22T09:00:00Z' }), ahora)).toBe(true)
    expect(haExpirado(sesion({ expiraEn: '2026-10-22T08:59:59Z' }), ahora)).toBe(true)
  })
})

describe('sesión inválida', () => {
  it('notificarSesionInvalida lanza el evento en window', () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    notificarSesionInvalida()
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['SESION_INVALIDA', true],
    ['NO_AUTORIZADO', false], // la API lo devuelve también con token válido: no debe expulsar
    ['CREDENCIALES_INVALIDAS', false],
    ['PESO_INVALIDO', false],
    ['', false],
    [undefined, false],
    [403, false],
  ])('esCodigoSesionInvalida(%j) → %s', (codigo, esperado) => {
    expect(esCodigoSesionInvalida(codigo)).toBe(esperado)
  })
})
