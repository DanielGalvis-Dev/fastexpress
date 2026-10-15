import { PESO_MAX_KG, TIPOS_CLIENTE, TIPOS_ENVIO } from '../types.ts'
import type { TipoCliente, TipoEnvio } from '../types.ts'

export type ResultadoPeso =
  | { ok: true; valor: number }
  | { ok: false; error: string }

export const MAX_CARACTERES_PESO = 10

/**
 * Deja pasar solo lo que se puede escribir en el campo Peso: dígitos y UN separador decimal
 * (punto o coma). Se usa al escribir y al pegar, así las letras ni siquiera aparecen.
 *   "1a2" → "12" · "1.2.3" → "1.23" · ".5" → "0.5" · "-3" → "3"
 */
export function sanitizarPeso(entrada: string): string {
  const limpio = entrada.replace(/[^\d.,]/g, '')
  const i = limpio.search(/[.,]/)
  if (i === -1) return limpio
  const entero = limpio.slice(0, i) || '0'
  const decimales = limpio.slice(i + 1).replace(/[.,]/g, '')
  return `${entero}${limpio[i]}${decimales}`
}

/**
 * Valida el campo Peso (kg) según BR-02. Acepta coma o punto decimal.
 * Es una ayuda de usabilidad: la API sigue siendo la autoridad.
 * PENDIENTE (Backend/QA): precisión y redondeo de decimales (p. ej. 5.005).
 */
export function validarPeso(entrada: string): ResultadoPeso {
  const texto = entrada.trim().replace(',', '.')
  if (texto === '') return { ok: false, error: 'Ingresa el peso del envío.' }

  // Se acepta «5.» (decimal a medias): Number("5.") es 5.
  if (!/^-?\d+(\.\d*)?$/.test(texto)) {
    return { ok: false, error: 'El peso debe ser un número (por ejemplo 2.5).' }
  }

  const valor = Number(texto)
  if (valor <= 0) {
    return { ok: false, error: 'El peso debe ser mayor que 0 kg.' }
  }
  if (valor > PESO_MAX_KG) {
    return {
      ok: false,
      error: `El peso máximo permitido es ${PESO_MAX_KG.toFixed(2)} kg.`,
    }
  }
  return { ok: true, valor }
}

export function validarTipoCliente(valor: string): valor is TipoCliente {
  return (TIPOS_CLIENTE as readonly string[]).includes(valor)
}

export function validarTipoEnvio(valor: string): valor is TipoEnvio {
  return (TIPOS_ENVIO as readonly string[]).includes(valor)
}
