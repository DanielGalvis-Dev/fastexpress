import { TIPOS_CLIENTE, TIPOS_ENVIO } from '../types.ts'
import type { RegistroHistorial } from '../types.ts'
import { ApiError, TIMEOUT_MS } from './cotizar.ts'

/**
 * Historial de cotizaciones: GET <VITE_API_URL>?action=getHistorial
 * Respuesta verificada: { success, totalRegistros, data: [{ fechaHora, peso, tipoCliente,
 * tipoEnvio, totalUSD, estado }] } con `estado` EXITOSO | RECHAZADO.
 */

type Json = Record<string, unknown>

const esObjeto = (valor: unknown): valor is Json =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

function aRegistro(fila: unknown): RegistroHistorial | null {
  if (!esObjeto(fila)) return null
  const { fechaHora, peso, tipoCliente, tipoEnvio, totalUSD, estado } = fila
  const valido =
    typeof fechaHora === 'string' &&
    typeof peso === 'number' &&
    typeof totalUSD === 'number' &&
    typeof tipoCliente === 'string' &&
    (TIPOS_CLIENTE as readonly string[]).includes(tipoCliente) &&
    typeof tipoEnvio === 'string' &&
    (TIPOS_ENVIO as readonly string[]).includes(tipoEnvio) &&
    (estado === 'EXITOSO' || estado === 'RECHAZADO')
  if (!valido) return null
  return { fechaHora, peso, tipoCliente, tipoEnvio, totalUSD, estado } as RegistroHistorial
}

/** Devuelve los registros ordenados del más reciente al más antiguo; ignora filas mal formadas. */
export function normalizarHistorial(json: unknown): RegistroHistorial[] {
  if (!esObjeto(json)) throw new ApiError('La API devolvió una respuesta inesperada.')
  if (json.success === false) {
    const mensaje = typeof json.mensaje === 'string' ? json.mensaje : null
    throw new ApiError(mensaje ?? 'No se pudo obtener el historial.')
  }
  if (!Array.isArray(json.data)) {
    throw new ApiError('La respuesta de la API no incluye el historial.')
  }
  return json.data
    .map(aRegistro)
    .filter((r): r is RegistroHistorial => r !== null)
    .sort((a, b) => Date.parse(b.fechaHora) - Date.parse(a.fechaHora))
}

export async function listarHistorial(signal?: AbortSignal): Promise<RegistroHistorial[]> {
  const base = import.meta.env.VITE_API_URL
  if (!base) throw new ApiError('Falta configurar VITE_API_URL (ver .env.example).')

  let respuesta: Response
  try {
    const url = new URL(base)
    url.searchParams.set('action', 'getHistorial')
    respuesta = await fetch(url, { signal: signal ?? AbortSignal.timeout(TIMEOUT_MS) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError('No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.')
  }

  let json: unknown
  try {
    json = await respuesta.json()
  } catch {
    throw new ApiError('La API devolvió una respuesta que no se pudo leer.')
  }
  return normalizarHistorial(json)
}
