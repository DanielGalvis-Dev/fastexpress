import type { EstadoCotizacion, TipoCliente, TipoEnvio } from '../types.ts'

export const moneda = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
export const fechaCorta = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short' })
export const horaCorta = new Intl.DateTimeFormat('es-EC', { timeStyle: 'short' })
export const fechaHora = new Intl.DateTimeFormat('es-EC', { dateStyle: 'short', timeStyle: 'short' })

export const ETIQUETA_CLIENTE: Record<TipoCliente, string> = {
  NUEVO: 'Nuevo',
  FRECUENTE: 'Frecuente',
  VIP: 'VIP',
}

export const ETIQUETA_ENVIO: Record<TipoEnvio, string> = {
  ESTANDAR: 'Estándar',
  EXPRESS: 'Express',
}

export const ETIQUETA_ESTADO: Record<EstadoCotizacion, string> = {
  EXITOSO: 'Exitoso',
  RECHAZADO: 'Rechazado',
}
