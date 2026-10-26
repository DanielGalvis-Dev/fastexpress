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

export type ResultadoTexto =
  | { ok: true; valor: string }
  | { ok: false; error: string }

/** PENDIENTE (Backend): el ejemplo de contraseña es «abc12»; la regla real no está confirmada. */
export const PASSWORD_MIN_CARACTERES = 5
export const MAX_CARACTERES_NOMBRE = 80
export const MAX_CARACTERES_EMAIL = 120
export const MAX_CARACTERES_PASSWORD = 128

export function validarNombre(entrada: string): ResultadoTexto {
  const valor = entrada.trim().replace(/\s+/g, ' ')
  if (valor === '') return { ok: false, error: 'Ingresa tu nombre.' }
  return { ok: true, valor }
}

/** Formato básico (algo@dominio.ext); la API es la que decide si el correo existe o está en uso. */
export function validarEmail(entrada: string): ResultadoTexto {
  const valor = entrada.trim().toLowerCase()
  if (valor === '') return { ok: false, error: 'Ingresa tu correo electrónico.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) {
    return { ok: false, error: 'Ingresa un correo válido (por ejemplo ana@correo.com).' }
  }
  return { ok: true, valor }
}

/** La contraseña no se recorta ni se modifica: los espacios cuentan. */
export function validarPassword(entrada: string): ResultadoTexto {
  if (entrada === '') return { ok: false, error: 'Ingresa la contraseña.' }
  if (entrada.length < PASSWORD_MIN_CARACTERES) {
    return {
      ok: false,
      error: `La contraseña debe tener al menos ${PASSWORD_MIN_CARACTERES} caracteres.`,
    }
  }
  return { ok: true, valor: entrada }
}

/** En el login solo se exige que haya algo escrito: la regla de largo es del alta, no del ingreso. */
export function validarPasswordIngreso(entrada: string): ResultadoTexto {
  if (entrada === '') return { ok: false, error: 'Ingresa tu contraseña.' }
  return { ok: true, valor: entrada }
}

export function validarConfirmacion(password: string, confirmacion: string): ResultadoTexto {
  if (confirmacion === '') return { ok: false, error: 'Repite la contraseña.' }
  if (confirmacion !== password) return { ok: false, error: 'Las contraseñas no coinciden.' }
  return { ok: true, valor: confirmacion }
}

export function validarCodigo(entrada: string): ResultadoTexto {
  const valor = entrada.trim()
  if (valor === '') return { ok: false, error: 'Ingresa el código que recibiste.' }
  return { ok: true, valor }
}

export function validarTipoCliente(valor: string): valor is TipoCliente {
  return (TIPOS_CLIENTE as readonly string[]).includes(valor)
}

export function validarTipoEnvio(valor: string): valor is TipoEnvio {
  return (TIPOS_ENVIO as readonly string[]).includes(valor)
}
