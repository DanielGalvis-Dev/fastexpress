import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EVENTO_SESION_INVALIDA, guardarSesion } from '../lib/sesion.ts'
import { ChatError, enviarMensaje, modoChat, normalizarRespuestaChat } from './chat.ts'
import { responderMock } from './chatMock.ts'

describe('normalizarRespuestaChat (contrato §3.2 y §3.3)', () => {
  it('acepta cada tipo de respuesta válido', () => {
    for (const tipo of ['estadistica', 'saludo', 'sin_datos', 'calculo_tarifa', 'fuera_de_contexto']) {
      expect(normalizarRespuestaChat({ success: true, tipo, respuesta: ' Hola ' })).toEqual({
        tipo,
        respuesta: 'Hola',
      })
    }
  })

  it('convierte success:false en ChatError con código y espera', () => {
    try {
      normalizarRespuestaChat({
        success: false,
        codigo: 'LIMITE_EXCEDIDO',
        mensaje: 'Muchos mensajes',
        reintentarEnSeg: 20,
      })
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ChatError)
      expect(e).toMatchObject({ message: 'Muchos mensajes', codigo: 'LIMITE_EXCEDIDO', reintentarEnSeg: 20 })
    }
  })

  it('ignora códigos desconocidos y esperas inválidas', () => {
    try {
      normalizarRespuestaChat({ success: false, codigo: 'RARO', reintentarEnSeg: -3 })
      expect.unreachable()
    } catch (e) {
      expect(e).toMatchObject({ codigo: undefined, reintentarEnSeg: undefined })
      expect((e as Error).message).toContain('no pudo responder')
    }
  })

  it.each([
    ['no es un objeto', 'hola'],
    ['tipo desconocido', { success: true, tipo: 'otro', respuesta: 'x' }],
    ['respuesta vacía', { success: true, tipo: 'estadistica', respuesta: '  ' }],
    ['sin respuesta', { success: true, tipo: 'estadistica' }],
  ])('rechaza una respuesta inválida (%s)', (_nombre, json) => {
    expect(() => normalizarRespuestaChat(json)).toThrow(ChatError)
  })
})

describe('modoChat', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each([
    ['mock', 'mock'],
    ['on', 'on'],
    ['', 'off'],
    ['cualquier-cosa', 'off'],
  ])('VITE_CHAT=%j → %s', (valor, esperado) => {
    vi.stubEnv('VITE_CHAT', valor)
    expect(modoChat()).toBe(esperado)
  })
})

describe('enviarMensaje con la API real', () => {
  const solicitud = {
    sesionId: 'sesion-1',
    mensaje: '¿Cuántas cotizaciones hay?',
    historial: [{ rol: 'usuario' as const, texto: 'Hola' }, { rol: 'asistente' as const, texto: 'Hola 👋' }],
  }

  beforeEach(() => {
    vi.stubEnv('VITE_CHAT', 'on')
    vi.stubEnv('VITE_API_URL', 'https://api.test/exec')
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('envía POST text/plain con action "chat" y devuelve la respuesta', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, tipo: 'estadistica', respuesta: 'Hay 70.' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(enviarMensaje(solicitud)).resolves.toEqual({ tipo: 'estadistica', respuesta: 'Hay 70.' })

    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/exec')
    expect(opciones.method).toBe('POST')
    expect(opciones.headers['Content-Type']).toBe('text/plain;charset=utf-8')
    expect(JSON.parse(opciones.body)).toEqual({ action: 'chat', ...solicitud })
  })

  it('con sesión iniciada, agrega el token al cuerpo', async () => {
    guardarSesion({
      token: 'tok-123',
      expiraEn: new Date(Date.now() + 3_600_000).toISOString(),
      usuario: { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
    })
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ success: true, tipo: 'saludo', respuesta: 'Hola' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await enviarMensaje(solicitud)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ action: 'chat', ...solicitud, token: 'tok-123' })
    localStorage.clear()
  })

  it('un rechazo SESION_INVALIDA avisa a la app', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: false, codigo: 'SESION_INVALIDA', mensaje: 'Sesión inválida o expirada.' }),
      }),
    )

    await expect(enviarMensaje(solicitud)).rejects.toThrow('Sesión inválida o expirada.')
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).toHaveBeenCalledTimes(1)
  })

  it('un error del asistente (aunque su texto diga «token») no se confunde con una sesión inválida', async () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: false, codigo: 'IA_NO_DISPONIBLE', mensaje: 'Token de IA agotado' }),
      }),
    )

    await expect(enviarMensaje(solicitud)).rejects.toMatchObject({ codigo: 'IA_NO_DISPONIBLE' })
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).not.toHaveBeenCalled()
  })

  it('traduce un fallo de red a un mensaje claro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(enviarMensaje(solicitud)).rejects.toThrow('No se pudo conectar')
  })

  it('propaga el error de la API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: async () => ({ success: false, codigo: 'IA_LIMITE', mensaje: 'Cuota agotada', reintentarEnSeg: 30 }),
      }),
    )
    await expect(enviarMensaje(solicitud)).rejects.toMatchObject({ codigo: 'IA_LIMITE', reintentarEnSeg: 30 })
  })

  it('avisa si falta la URL de la API', async () => {
    vi.stubEnv('VITE_API_URL', '')
    await expect(enviarMensaje(solicitud)).rejects.toThrow('VITE_API_URL')
  })
})

describe('chatMock (solo demostración)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  async function responder(mensaje: string) {
    const promesa = responderMock({ sesionId: 's', mensaje, historial: [] })
    const resultado = promesa.then(
      (r) => ({ r }),
      (e: unknown) => ({ e }),
    )
    await vi.advanceTimersByTimeAsync(1500)
    return resultado
  }

  it.each([
    ['hola', 'saludo'],
    ['¿Cuántas cotizaciones hay?', 'estadistica'],
    ['cuanto cuesta enviar 8 kg', 'calculo_tarifa'],
    ['cual es la capital de francia', 'fuera_de_contexto'],
  ])('«%s» → %s', async (mensaje, tipo) => {
    const res = await responder(mensaje)
    expect(res).toMatchObject({ r: { tipo } })
  })

  it('/limite y /error simulan los errores del contrato', async () => {
    expect(await responder('/limite')).toMatchObject({ e: { codigo: 'LIMITE_EXCEDIDO', reintentarEnSeg: 12 } })
    expect(await responder('/error')).toMatchObject({ e: { codigo: 'IA_NO_DISPONIBLE' } })
  })

  it('se puede cancelar', async () => {
    const control = new AbortController()
    const promesa = responderMock({ sesionId: 's', mensaje: 'hola', historial: [] }, control.signal)
    const asercion = expect(promesa).rejects.toMatchObject({ name: 'AbortError' })
    control.abort()
    await asercion
  })
})
