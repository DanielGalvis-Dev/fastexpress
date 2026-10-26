import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cambiarPassword,
  cerrarSesion,
  iniciarSesion,
  normalizarLogin,
  normalizarMensaje,
  normalizarRegistro,
  registrar,
  restablecerPassword,
  solicitarCodigo,
} from './auth.ts'
import { EVENTO_SESION_INVALIDA } from '../lib/sesion.ts'
import { ApiError } from './cotizar.ts'

const USUARIO = {
  id: '52396f8e-db9a-42a4-8d74-c267d4c9a05b',
  nombre: 'Ana Pérez',
  email: 'ana@correo.com',
  creadoEn: '2026-10-22T01:29:31.974Z',
  ultimoLogin: '2026-10-22T01:32:53.116Z',
}

const LOGIN_OK = {
  success: true,
  token: '8fb8dfbd077c0786023b9255b543c9dbeeb16702cdb80f03dc2c1325f3ecd154',
  expiraEn: '2026-10-22T09:32:52.530Z',
  usuario: USUARIO,
}

describe('normalizarLogin', () => {
  it('devuelve la sesión con token, vencimiento y usuario', () => {
    expect(normalizarLogin(LOGIN_OK)).toEqual({
      token: LOGIN_OK.token,
      expiraEn: LOGIN_OK.expiraEn,
      usuario: USUARIO,
    })
  })

  it('convierte success:false en ApiError con el mensaje de la API', () => {
    expect(() => normalizarLogin({ success: false, mensaje: 'Credenciales inválidas.' })).toThrow(
      new ApiError('Credenciales inválidas.'),
    )
  })

  it('usa un mensaje por defecto si el rechazo no trae mensaje', () => {
    expect(() => normalizarLogin({ success: false })).toThrow('No se pudo iniciar sesión.')
  })

  it.each([
    ['no es un objeto', 'hola'],
    ['sin token', { ...LOGIN_OK, token: undefined }],
    ['token vacío', { ...LOGIN_OK, token: '' }],
    ['sin expiraEn', { ...LOGIN_OK, expiraEn: undefined }],
    ['expiraEn que no es fecha', { ...LOGIN_OK, expiraEn: 'mañana' }],
    ['sin usuario', { ...LOGIN_OK, usuario: undefined }],
    ['usuario sin id', { ...LOGIN_OK, usuario: { ...USUARIO, id: '' } }],
  ])('rechaza una respuesta inválida (%s)', (_nombre, json) => {
    expect(() => normalizarLogin(json)).toThrow(ApiError)
  })

  it('tolera un usuario sin fechas', () => {
    const sesion = normalizarLogin({ ...LOGIN_OK, usuario: { id: 'u', nombre: 'Ana', email: 'a@b.co' } })
    expect(sesion.usuario).toMatchObject({ creadoEn: '', ultimoLogin: '' })
  })
})

describe('normalizarRegistro', () => {
  it('devuelve el usuario creado', () => {
    expect(normalizarRegistro({ success: true, mensaje: 'Usuario registrado correctamente.', usuario: USUARIO })).toEqual(
      USUARIO,
    )
  })

  it('propaga el rechazo de la API (p. ej. correo ya registrado)', () => {
    expect(() => normalizarRegistro({ success: false, mensaje: 'El correo ya está registrado.' })).toThrow(
      'El correo ya está registrado.',
    )
  })

  it('rechaza una respuesta sin usuario', () => {
    expect(() => normalizarRegistro({ success: true })).toThrow(ApiError)
  })
})

describe('códigos de error de la API (verificados)', () => {
  it('conserva el código en el ApiError', () => {
    try {
      normalizarLogin({ success: false, codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Correo o contraseña incorrectos.' })
      expect.unreachable()
    } catch (e) {
      expect(e).toMatchObject({ codigo: 'CREDENCIALES_INVALIDAS', message: 'Correo o contraseña incorrectos.' })
    }
  })

  it('SESION_INVALIDA avisa a la app (token vencido al cambiar la contraseña)', () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(() =>
      normalizarMensaje({ success: false, codigo: 'SESION_INVALIDA', mensaje: 'Sesión inválida o expirada.' }, 'x'),
    ).toThrow('Sesión inválida o expirada.')
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).toHaveBeenCalledTimes(1)
  })

  it('credenciales incorrectas en el login NO cierran ninguna sesión', () => {
    const escucha = vi.fn()
    window.addEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(() => normalizarLogin({ success: false, codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'x' })).toThrow()
    window.removeEventListener(EVENTO_SESION_INVALIDA, escucha)
    expect(escucha).not.toHaveBeenCalled()
  })
})

describe('normalizarMensaje', () => {
  it('devuelve el mensaje de la API', () => {
    expect(normalizarMensaje({ success: true, mensaje: 'Sesión cerrada.' }, 'x')).toBe('Sesión cerrada.')
  })

  it('usa el mensaje por defecto si no hay uno', () => {
    expect(normalizarMensaje({ success: true }, 'Listo.')).toBe('Listo.')
    expect(normalizarMensaje({ success: true, mensaje: '  ' }, 'Listo.')).toBe('Listo.')
  })

  it('lanza ApiError si success es false', () => {
    expect(() => normalizarMensaje({ success: false, mensaje: 'Código inválido.' }, 'x')).toThrow('Código inválido.')
  })
})

describe('llamadas a la API (fetch simulado)', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'https://api.test/exec')
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  const responder = (json: unknown) => fetchMock.mockResolvedValue({ json: async () => json })

  /** Devuelve el cuerpo JSON de la primera llamada y comprueba método, URL y cabecera. */
  function cuerpoEnviado() {
    const [url, opciones] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.test/exec')
    expect(opciones.method).toBe('POST')
    // Sin preflight CORS: solo text/plain, sin cabeceras personalizadas.
    expect(opciones.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' })
    return JSON.parse(opciones.body)
  }

  it('registrar envía action:"register" con nombre, email y password', async () => {
    responder({ success: true, usuario: USUARIO })
    const usuario = await registrar({ nombre: 'Ana Pérez', email: 'ana@correo.com', password: 'abc12' })

    expect(cuerpoEnviado()).toEqual({
      action: 'register',
      nombre: 'Ana Pérez',
      email: 'ana@correo.com',
      password: 'abc12',
    })
    expect(usuario).toEqual(USUARIO)
  })

  it('iniciarSesion envía action:"login" y devuelve la sesión', async () => {
    responder(LOGIN_OK)
    const sesion = await iniciarSesion({ email: 'ana@correo.com', password: 'abc12' })

    expect(cuerpoEnviado()).toEqual({ action: 'login', email: 'ana@correo.com', password: 'abc12' })
    expect(sesion.token).toBe(LOGIN_OK.token)
  })

  it('cerrarSesion envía action:"logout" con el token', async () => {
    responder({ success: true, mensaje: 'Sesión cerrada.' })
    await expect(cerrarSesion('tok')).resolves.toBe('Sesión cerrada.')
    expect(cuerpoEnviado()).toEqual({ action: 'logout', token: 'tok' })
  })

  it('cambiarPassword envía action:"changePassword" con token, actual y nueva', async () => {
    responder({ success: true, mensaje: 'Contraseña actualizada.' })
    await cambiarPassword({ token: 'tok', actual: 'abc12', nueva: 'nueva123' })
    expect(cuerpoEnviado()).toEqual({
      action: 'changePassword',
      token: 'tok',
      actual: 'abc12',
      nueva: 'nueva123',
    })
  })

  it('solicitarCodigo envía action:"forgot" con el email', async () => {
    responder({ success: true, mensaje: 'Te enviamos un código.' })
    await expect(solicitarCodigo('ana@correo.com')).resolves.toBe('Te enviamos un código.')
    expect(cuerpoEnviado()).toEqual({ action: 'forgot', email: 'ana@correo.com' })
  })

  it('restablecerPassword envía action:"reset" con email, código y nueva', async () => {
    responder({ success: true, mensaje: 'Contraseña restablecida. Ya puedes iniciar sesión.' })
    await expect(
      restablecerPassword({ email: 'ana@correo.com', codigo: '123456', nueva: 'nueva123' }),
    ).resolves.toBe('Contraseña restablecida. Ya puedes iniciar sesión.')
    expect(cuerpoEnviado()).toEqual({
      action: 'reset',
      email: 'ana@correo.com',
      codigo: '123456',
      nueva: 'nueva123',
    })
  })

  it('una caída de red se traduce a un ApiError legible', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(iniciarSesion({ email: 'a@b.co', password: 'x' })).rejects.toThrow(
      'No se pudo conectar con el servicio',
    )
  })

  it('un cuerpo que no es JSON se traduce a un ApiError legible', async () => {
    fetchMock.mockResolvedValue({
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })
    await expect(iniciarSesion({ email: 'a@b.co', password: 'x' })).rejects.toThrow('no se pudo leer')
  })

  it('sin VITE_API_URL falla antes de llamar a la red', async () => {
    vi.stubEnv('VITE_API_URL', '')
    await expect(iniciarSesion({ email: 'a@b.co', password: 'x' })).rejects.toThrow('VITE_API_URL')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('el rechazo de la API llega como ApiError con su mensaje', async () => {
    responder({ success: false, mensaje: 'Correo o contraseña incorrectos.' })
    await expect(iniciarSesion({ email: 'a@b.co', password: 'x' })).rejects.toThrow(
      'Correo o contraseña incorrectos.',
    )
  })
})
