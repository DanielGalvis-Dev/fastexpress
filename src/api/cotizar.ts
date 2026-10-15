import type { ResultadoCotizacion, SolicitudCotizacion } from '../types.ts'

/**
 * Cliente de la API de cotización (Google Apps Script).
 *
 * Contrato (tomado del index.html de prueba del equipo, que ya funciona contra la API):
 *  - POST a VITE_API_URL con el JSON como texto: { peso, tipoCliente, tipoEnvio }.
 *  - Éxito: { success: true, desglose: { tarifaBase, costoPeso, subtotal,
 *    descuentoAplicado, recargoAplicado, total } }.
 *  - Rechazo/error: { success: false, mensaje }.
 * Todo lo que depende del contrato está en `construirCuerpo` y `normalizarRespuesta`.
 */

export const TIMEOUT_MS = 20_000

export class ApiError extends Error {
  constructor(mensaje: string) {
    super(mensaje)
    this.name = 'ApiError'
  }
}

function construirCuerpo(solicitud: SolicitudCotizacion): string {
  return JSON.stringify(solicitud)
}

type Json = Record<string, unknown>

const esObjeto = (valor: unknown): valor is Json =>
  typeof valor === 'object' && valor !== null && !Array.isArray(valor)

const aNumero = (valor: unknown): number | undefined => {
  const n = typeof valor === 'string' ? Number(valor) : valor
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined
}

export function normalizarRespuesta(json: unknown): ResultadoCotizacion {
  if (!esObjeto(json)) {
    throw new ApiError('La API devolvió una respuesta inesperada.')
  }
  if (json.success === false) {
    const mensaje = typeof json.mensaje === 'string' ? json.mensaje : null
    throw new ApiError(mensaje ?? 'La API rechazó la cotización.')
  }

  const d = esObjeto(json.desglose) ? json.desglose : undefined
  const total = aNumero(d?.total)
  if (!d || total === undefined) {
    throw new ApiError('La respuesta de la API no incluye el total de la cotización.')
  }

  return {
    total,
    mensaje: typeof json.mensaje === 'string' ? json.mensaje : undefined,
    desglose: {
      tarifaBase: aNumero(d.tarifaBase),
      costoPeso: aNumero(d.costoPeso),
      subtotal: aNumero(d.subtotal),
      descuentoAplicado: aNumero(d.descuentoAplicado),
      recargoAplicado: aNumero(d.recargoAplicado),
    },
  }
}

export async function cotizar(
  solicitud: SolicitudCotizacion,
  signal?: AbortSignal,
): Promise<ResultadoCotizacion> {
  const url = import.meta.env.VITE_API_URL
  if (!url) {
    throw new ApiError('Falta configurar VITE_API_URL (ver .env.example).')
  }

  let respuesta: Response
  try {
    respuesta = await fetch(url, {
      method: 'POST',
      // text/plain evita el preflight CORS, que Apps Script no soporta.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: construirCuerpo(solicitud),
      signal: signal ?? AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ApiError('No se pudo conectar con el servicio. Revisa tu conexión e inténtalo de nuevo.')
  }

  // Apps Script responde casi siempre 200: el resultado real va en el cuerpo.
  let json: unknown
  try {
    json = await respuesta.json()
  } catch {
    throw new ApiError('La API devolvió una respuesta que no se pudo leer.')
  }
  return normalizarRespuesta(json)
}
