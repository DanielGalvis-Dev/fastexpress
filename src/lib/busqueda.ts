import type { RegistroHistorial } from '../types.ts'
import {
  ETIQUETA_CLIENTE,
  ETIQUETA_ENVIO,
  ETIQUETA_ESTADO,
  fechaHora,
  moneda,
} from './formato.ts'

/** Minúsculas y sin tildes, para que "estandar" encuentre "Estándar". */
export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Texto en el que se busca: lo mismo que ve la persona en la fila. */
export function textoBusqueda(r: RegistroHistorial): string {
  const partes = [
    fechaHora.format(new Date(r.fechaHora)),
    `${r.peso} kg`,
    ETIQUETA_CLIENTE[r.tipoCliente],
    ETIQUETA_ENVIO[r.tipoEnvio],
    ETIQUETA_ESTADO[r.estado],
  ]
  // Los rechazados no muestran total, así que no se busca por él.
  if (r.estado === 'EXITOSO') partes.push(moneda.format(r.totalUSD), String(r.totalUSD))
  return normalizarTexto(partes.join(' '))
}

/** Cada palabra de la consulta debe aparecer en la fila (Y lógico). */
export function filtrarRegistros(registros: RegistroHistorial[], consulta: string): RegistroHistorial[] {
  const terminos = normalizarTexto(consulta).split(/\s+/).filter(Boolean)
  if (terminos.length === 0) return registros
  return registros.filter((r) => {
    const texto = textoBusqueda(r)
    return terminos.every((t) => texto.includes(t))
  })
}
