import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESION_INVALIDA, guardarSesion } from '../lib/sesion.ts'
import { ApiError, cotizar, normalizarRespuesta } from './cotizar.ts'

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

describe('cotizar con sesión (token en el cuerpo)', () => {
  const fetchMock = vi.fn()
  const solicitud = { peso: 2.5, tipoCliente: 'VIP', tipoEnvio: 'EXPRESS' } as const

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://api.test/exec')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('agrega el token a la solicitud cuando hay sesión', async () => {
    guardarSesion({
      token: 'tok-123',
      expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
      usuario: { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
    })
    fetchMock.mockResolvedValue({ json: async () => ({ success: true, desglose: { total: 7 } }) })

    await cotizar(solicitud)

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ...solicitud, token: 'tok-123' })
  })

  it('sin sesión el cuerpo queda como antes (sin token)', async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ success: true, desglose: { total: 7 } }) })
    await cotizar(solicitud)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(solicitud)
  })

  it('si la API rechaza la sesión, avisa a la app y lanza el error', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    fetchMock.mockResolvedValue({
      json: async () => ({ success: false, codigo: 'SESION_INVALIDA', mensaje: 'Sesión inválida o expirada.' }),
    })

    await expect(cotizar(solicitud)).rejects.toThrow('Sesión inválida o expirada.')
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).toHaveBeenCalledTimes(1)
  })

  it('un rechazo de negocio (peso > 20 kg) no cierra la sesión', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    fetchMock.mockResolvedValue({
      json: async () => ({ success: false, codigo: 'PESO_INVALIDO', mensaje: 'El peso excede el límite de 20 kg.' }),
    })

    await expect(cotizar(solicitud)).rejects.toMatchObject({ codigo: 'PESO_INVALIDO' })
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).not.toHaveBeenCalled()
  })
})
