import { esCodigoSesionInvalida, notificarSesionInvalida, obtenerToken } from '../lib/sesion.ts'
import { TIMEOUT_CHAT_MS } from './config.ts'

/**
 * Cliente del asistente de IA. Contrato: docs/ESPECIFICACION_BACKEND_ASISTENTE_IA.md (§3).
 *
 * POST <VITE_API_URL> con `Content-Type: text/plain` y el JSON como texto:
 *   { action: "chat", sesionId, mensaje, historial: [{ rol, texto }], token }
 * → { success: true, tipo, respuesta }  |  { success: false, codigo, mensaje, reintentarEnSeg? }
 *
 * Modo de uso (variable VITE_CHAT): "mock" (respuestas de demostración, sin backend),
 * "on" (API real) o vacío (el chat no se muestra).
 */

export const TIPOS_RESPUESTA_CHAT = [
  'estadistica',
  'saludo',
  'sin_datos',
  'calculo_tarifa',
  'fuera_de_contexto',
] as const
export type TipoRespuestaChat = (typeof TIPOS_RESPUESTA_CHAT)[number]

export type CodigoErrorChat =
  | 'MENSAJE_INVALIDO'
  | 'LIMITE_EXCEDIDO'
  | 'IA_LIMITE'
  | 'IA_NO_DISPONIBLE'
  | 'ERROR_INTERNO'

export interface TurnoChat {
  rol: 'usuario' | 'asistente'
  texto: string
}

export interface SolicitudChat {
  sesionId: string
  mensaje: string
  historial: TurnoChat[]
}

export interface RespuestaChat {
  tipo: TipoRespuestaChat
  respuesta: string
}

export const MAX_CARACTERES_MENSAJE = 500
export const MAX_TURNOS_HISTORIAL = 6

export class ChatError extends Error {
  codigo?: CodigoErrorChat
  reintentarEnSeg?: number

  constructor(mensaje: string, codigo?: CodigoErrorChat, reintentarEnSeg?: number) {
    super(mensaje)
    this.name = 'ChatError'
    this.codigo = codigo
    this.reintentarEnSeg = reintentarEnSeg
  }
}

export type ModoChat = 'mock' | 'on' | 'off'

/** Se lee en cada llamada (no al cargar el módulo) para poder simularlo en las pruebas. */
export function modoChat(): ModoChat {
  const valor = import.meta.env.VITE_CHAT
  return valor === 'mock' || valor === 'on' ? valor : 'off'
}

type Json = Record<string, unknown>

const esObjeto = (valor: unknown): valor is Json =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

const CODIGOS: readonly string[] = [
  'MENSAJE_INVALIDO',
  'LIMITE_EXCEDIDO',
  'IA_LIMITE',
  'IA_NO_DISPONIBLE',
  'ERROR_INTERNO',
]

export function normalizarRespuestaChat(json: unknown): RespuestaChat {
  if (!esObjeto(json)) throw new ChatError('El asistente devolvió una respuesta inesperada.')

  if (json.success === false) {
    const mensaje =
      typeof json.mensaje === 'string' && json.mensaje.trim() !== ''
        ? json.mensaje
        : 'El asistente no pudo responder. Inténtalo de nuevo.'
    const codigo =
      typeof json.codigo === 'string' && CODIGOS.includes(json.codigo)
        ? (json.codigo as CodigoErrorChat)
        : undefined
    if (esCodigoSesionInvalida(json.codigo)) notificarSesionInvalida()
    const espera =
      typeof json.reintentarEnSeg === 'number' && json.reintentarEnSeg > 0
        ? json.reintentarEnSeg
        : undefined
    throw new ChatError(mensaje, codigo, espera)
  }

  const { tipo, respuesta } = json
  if (
    typeof tipo !== 'string' ||
    !(TIPOS_RESPUESTA_CHAT as readonly string[]).includes(tipo) ||
    typeof respuesta !== 'string' ||
    respuesta.trim() === ''
  ) {
    throw new ChatError('La respuesta del asistente no es válida.')
  }
  return { tipo: tipo as TipoRespuestaChat, respuesta: respuesta.trim() }
}

export async function enviarMensaje(
  solicitud: SolicitudChat,
  signal?: AbortSignal,
): Promise<RespuestaChat> {
  if (modoChat() === 'mock') {
    const { responderMock } = await import('./chatMock.ts')
    return responderMock(solicitud, signal)
  }

  const url = import.meta.env.VITE_API_URL
  if (!url) throw new ChatError('Falta configurar VITE_API_URL (ver .env.example).')

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      // text/plain evita el preflight CORS, que Apps Script no soporta.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'chat', ...solicitud, token: obtenerToken() }),
      signal: signal ?? AbortSignal.timeout(TIMEOUT_CHAT_MS),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ChatError('No se pudo conectar con el asistente. Revisa tu conexión e inténtalo de nuevo.')
  }

  let json: unknown
  try {
    json = await respuesta.json()
  } catch {
    throw new ChatError('El asistente devolvió una respuesta que no se pudo leer.')
  }
  return normalizarRespuestaChat(json)
}
