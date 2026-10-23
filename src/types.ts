// Enums como `const` + tipo unión (el proyecto usa `erasableSyntaxOnly`, sin `enum`).
// Los valores se envían a la API tal cual, en MAYÚSCULAS (BR-03 y BR-04).

export const TIPOS_CLIENTE = ['NUEVO', 'FRECUENTE', 'VIP'] as const
export type TipoCliente = (typeof TIPOS_CLIENTE)[number]

export const TIPOS_ENVIO = ['ESTANDAR', 'EXPRESS'] as const
export type TipoEnvio = (typeof TIPOS_ENVIO)[number]

export const PESO_MIN_KG = 0.01
export const PESO_MAX_KG = 20

export interface SolicitudCotizacion {
  peso: number
  tipoCliente: TipoCliente
  tipoEnvio: TipoEnvio
}

export type EstadoCotizacion = 'EXITOSO' | 'RECHAZADO'

/** Registro devuelto por `?action=getHistorial`. */
export interface RegistroHistorial {
  fechaHora: string
  peso: number
  tipoCliente: TipoCliente
  tipoEnvio: TipoEnvio
  totalUSD: number
  estado: EstadoCotizacion
}

/** Persona autenticada, tal como la devuelve la API en `register` y `login`. */
export interface Usuario {
  id: string
  nombre: string
  email: string
  creadoEn: string
  ultimoLogin: string
}

/** Sesión devuelta por `login`; `expiraEn` es una fecha ISO. */
export interface Sesion {
  token: string
  expiraEn: string
  usuario: Usuario
}

export interface DesgloseCotizacion {
  tarifaBase?: number
  costoPeso?: number
  subtotal?: number
  descuentoAplicado?: number
  recargoAplicado?: number
}

export interface ResultadoCotizacion {
  total: number
  desglose?: DesgloseCotizacion
  mensaje?: string
}
