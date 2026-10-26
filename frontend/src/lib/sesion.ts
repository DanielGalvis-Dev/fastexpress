import type { Sesion } from '../types.ts'

/**
 * Persistencia de la sesión en localStorage. Todo va en try/catch: el almacenamiento puede estar
 * bloqueado (modo privado, política del navegador) y la app debe seguir funcionando sin él.
 */

const CLAVE = 'fastexpress.sesion'

/** Evento que lanzan los clientes de API cuando la API dice que el token ya no sirve. */
export const EVENTO_SESION_INVALIDA = 'fastexpress:sesion-invalida'

const esObjeto = (valor: unknown): valor is Record<string, unknown> =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

const esTexto = (valor: unknown): valor is string => typeof valor === 'string' && valor !== ''

function aSesion(valor: unknown): Sesion | null {
  if (!esObjeto(valor) || !esObjeto(valor.usuario)) return null
  const { token, expiraEn, usuario } = valor
  if (!esTexto(token) || !esTexto(expiraEn) || !Number.isFinite(Date.parse(expiraEn))) return null
  if (!esTexto(usuario.id) || typeof usuario.nombre !== 'string' || !esTexto(usuario.email)) return null
  return {
    token,
    expiraEn,
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      creadoEn: typeof usuario.creadoEn === 'string' ? usuario.creadoEn : '',
      ultimoLogin: typeof usuario.ultimoLogin === 'string' ? usuario.ultimoLogin : '',
    },
  }
}

export function haExpirado(sesion: Sesion, ahora = Date.now()): boolean {
  return Date.parse(sesion.expiraEn) <= ahora
}

export function guardarSesion(sesion: Sesion): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(sesion))
  } catch {
    // Sin almacenamiento, la sesión dura lo que dure la pestaña.
  }
}

export function borrarSesion(): void {
  try {
    localStorage.removeItem(CLAVE)
  } catch {
    // Nada que borrar.
  }
}

/** Devuelve la sesión guardada si es válida y no venció; si no, la descarta. */
export function leerSesion(): Sesion | null {
  let crudo: string | null
  try {
    crudo = localStorage.getItem(CLAVE)
  } catch {
    return null
  }
  if (crudo === null) return null

  let sesion: Sesion | null = null
  try {
    sesion = aSesion(JSON.parse(crudo))
  } catch {
    sesion = null
  }
  if (!sesion || haExpirado(sesion)) {
    borrarSesion()
    return null
  }
  return sesion
}

/** Token de la sesión guardada, para los clientes de API. `undefined` si no hay sesión. */
export function obtenerToken(): string | undefined {
  return leerSesion()?.token
}

/** Avisa a la app de que la API rechazó el token (venció o ya no existe). */
export function notificarSesionInvalida(): void {
  window.dispatchEvent(new Event(EVENTO_SESION_INVALIDA))
}

/**
 * Código con el que la API (verificado en changePassword) dice que el token venció o no existe.
 * `NO_AUTORIZADO` (getHistorial) NO se incluye a propósito: hoy la API lo devuelve también con un
 * token válido, y tratarlo como sesión inválida expulsaría a la persona al login en bucle.
 * PENDIENTE (Backend): ver PENDIENTES.md.
 */
const CODIGOS_SESION_INVALIDA: readonly string[] = ['SESION_INVALIDA']

export function esCodigoSesionInvalida(codigo: unknown): boolean {
  return typeof codigo === 'string' && CODIGOS_SESION_INVALIDA.includes(codigo)
}
