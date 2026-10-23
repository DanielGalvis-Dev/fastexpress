import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESION_INVALIDA, guardarSesion } from '../lib/sesion.ts'
import { ApiError } from './cotizar.ts'
import { listarHistorial, normalizarHistorial } from './historial.ts'

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

describe('listarHistorial (token fijo del historial en la URL)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://api.test/exec')
    vi.stubEnv('VITE_HISTORIAL_TOKEN', 'token-historial-prueba')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('envía action=getHistorial y el token configurado en VITE_HISTORIAL_TOKEN', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ success: true, data: [] }) })

    await listarHistorial()

    const url = new URL(String(fetchMock.mock.calls[0][0]))
    expect(url.searchParams.get('action')).toBe('getHistorial')
    expect(url.searchParams.get('token')).toBe('token-historial-prueba')
  })

  it('no usa el token de sesión: el del historial es una clave aparte', async () => {
    guardarSesion({
      token: 'tok-de-sesion',
      expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
      usuario: { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
    })
    fetchMock.mockResolvedValue({ json: async () => ({ success: true, data: [] }) })

    await listarHistorial()
    localStorage.clear()

    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('token')).toBe('token-historial-prueba')
  })

  it('sin VITE_HISTORIAL_TOKEN falla con un mensaje claro y sin llamar a la red', async () => {
    vi.stubEnv('VITE_HISTORIAL_TOKEN', '')
    await expect(listarHistorial()).rejects.toThrow('VITE_HISTORIAL_TOKEN')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('SESION_INVALIDA avisa a la app y lanza el error', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    fetchMock.mockResolvedValue({
      json: async () => ({ success: false, codigo: 'SESION_INVALIDA', mensaje: 'Sesión inválida o expirada.' }),
    })

    await expect(listarHistorial()).rejects.toMatchObject({ codigo: 'SESION_INVALIDA' })
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).toHaveBeenCalledTimes(1)
  })

  it('NO_AUTORIZADO se muestra como error pero NO cierra la sesión (la API lo devuelve con token válido)', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    fetchMock.mockResolvedValue({
      json: async () => ({ success: false, codigo: 'NO_AUTORIZADO', mensaje: 'Acceso no autorizado.' }),
    })

    await expect(listarHistorial()).rejects.toMatchObject({
      message: 'Acceso no autorizado.',
      codigo: 'NO_AUTORIZADO',
    })
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).not.toHaveBeenCalled()
  })

  it('un fallo común del historial no se confunde con una sesión inválida', () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(() => normalizarHistorial({ success: false, mensaje: 'Error interno.' })).toThrow('Error interno.')
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).not.toHaveBeenCalled()
  })
})
