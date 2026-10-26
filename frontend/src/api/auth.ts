import type { Sesion, Usuario } from '../types.ts'
import { ApiError, codigoDeError, TIMEOUT_MS } from './cotizar.ts'

/**
 * Cliente de autenticación (misma URL base que el resto de la API).
 *
 * Todas las acciones son POST a VITE_API_URL con `Content-Type: text/plain` y el JSON como texto,
 * con un campo `action`:
 *   register        { nombre, email, password }       → { success, mensaje, usuario }
 *   login           { email, password }               → { success, token, expiraEn, usuario }
 *   logout          { token }                         → { success, mensaje }
 *   changePassword  { token, actual, nueva }          → { success, mensaje }   (por confirmar)
 *   forgot          { email }                         → { success, mensaje }   (por confirmar)
 *   reset           { email, codigo, nueva }          → { success, mensaje }
 * Error: { success: false, codigo, mensaje } (códigos verificados: CREDENCIALES_INVALIDAS, SESION_INVALIDA,
 * NOMBRE_INVALIDO, CODIGO_INVALIDO…). El HTTP casi siempre es 200: manda el cuerpo.
 */

type Json = Record<string, unknown>

const esObjeto = (valor: unknown): valor is Json =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor !== ''

/** Lanza `ApiError` si la respuesta no es un objeto o trae `success: false`. */
function verificarExito(json: unknown, mensajePorDefecto: string): Json {
  if (!esObjeto(json)) throw new ApiError('La API devolvió una respuesta inesperada.')
  if (json.success === false) {
    const mensaje = typeof json.mensaje === 'string' && json.mensaje.trim() !== '' ? json.mensaje : null
    throw new ApiError(mensaje ?? mensajePorDefecto, codigoDeError(json))
  }
  return json
}

function aUsuario(valor: unknown): Usuario | null {
  if (!esObjeto(valor)) return null
  const { id, nombre, email, creadoEn, ultimoLogin } = valor
  if (!esTexto(id) || typeof nombre !== 'string' || !esTexto(email)) return null
  return {
    id,
    nombre,
    email,
    creadoEn: typeof creadoEn === 'string' ? creadoEn : '',
    ultimoLogin: typeof ultimoLogin === 'string' ? ultimoLogin : '',
  }
}

export function normalizarLogin(json: unknown): Sesion {
  const cuerpo = verificarExito(json, 'No se pudo iniciar sesión.')
  const usuario = aUsuario(cuerpo.usuario)
  const { token, expiraEn } = cuerpo
  if (!esTexto(token) || !esTexto(expiraEn) || !Number.isFinite(Date.parse(expiraEn)) || !usuario) {
    throw new ApiError('La respuesta de la API no incluye una sesión válida.')
  }
  return { token, expiraEn, usuario }
}

export function normalizarRegistro(json: unknown): Usuario {
  const cuerpo = verificarExito(json, 'No se pudo crear la cuenta.')
  const usuario = aUsuario(cuerpo.usuario)
  if (!usuario) throw new ApiError('La respuesta de la API no incluye los datos del usuario.')
  return usuario
}

/** Respuestas que solo informan: devuelve el `mensaje` de la API o uno por defecto. */
export function normalizarMensaje(json: unknown, mensajePorDefecto: string): string {
  const cuerpo = verificarExito(json, mensajePorDefecto)
  return typeof cuerpo.mensaje === 'string' && cuerpo.mensaje.trim() !== ''
    ? cuerpo.mensaje
    : mensajePorDefecto
}

async function enviarAccion(action: string, cuerpo: Json, signal?: AbortSignal): Promise<unknown> {
  const url = import.meta.env.VITE_API_URL
  if (!url) throw new ApiError('Falta configurar VITE_API_URL (ver .env.example).')

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      // text/plain evita el preflight CORS, que Apps Script no soporta.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...cuerpo }),
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.')
  }

  try {
    return await respuesta.json()
  } catch {
    throw new ApiError('La API devolvió una respuesta que no se pudo leer.')
  }
}

export async function registrar(
  datos: { nombre: string; email: string; password: string },
  signal?: AbortSignal,
): Promise<Usuario> {
  return normalizarRegistro(await enviarAccion('register', datos, signal))
}

export async function iniciarSesion(
  datos: { email: string; password: string },
  signal?: AbortSignal,
): Promise<Sesion> {
  return normalizarLogin(await enviarAccion('login', datos, signal))
}

export async function cerrarSesion(token: string, signal?: AbortSignal): Promise<string> {
  const json = await enviarAccion('logout', { token }, signal)
  return normalizarMensaje(json, 'Sesión cerrada.')
}

export async function cambiarPassword(
  datos: { token: string; actual: string; nueva: string },
  signal?: AbortSignal,
): Promise<string> {
  const json = await enviarAccion('changePassword', datos, signal)
  return normalizarMensaje(json, 'Contraseña actualizada.')
}

/** Pide el código de recuperación para `email`. */
export async function solicitarCodigo(email: string, signal?: AbortSignal): Promise<string> {
  const json = await enviarAccion('forgot', { email }, signal)
  return normalizarMensaje(json, 'Si el correo existe, recibirás un código de recuperación.')
}

export async function restablecerPassword(
  datos: { email: string; codigo: string; nueva: string },
  signal?: AbortSignal,
): Promise<string> {
  const json = await enviarAccion('reset', datos, signal)
  return normalizarMensaje(json, 'Contraseña restablecida. Ya puedes iniciar sesión.')
}
