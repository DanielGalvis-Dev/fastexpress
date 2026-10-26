import { useEffect, useState, useSyncExternalStore } from 'react'
import type { RefObject } from 'react'

const CONSULTA_ANCHA = '(min-width: 40rem)' // equivale al breakpoint `sm` de Tailwind

function suscribir(avisar: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {}
  const lista = window.matchMedia(CONSULTA_ANCHA)
  lista.addEventListener('change', avisar)
  return () => lista.removeEventListener('change', avisar)
}

const leer = () =>
  typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_ANCHA).matches : true

/** true en pantallas de 40rem o más. */
export function useEsPantallaAncha(): boolean {
  return useSyncExternalStore(suscribir, leer, () => true)
}

/**
 * Cuántas filas caben en la altura del contenedor, para paginar sin scroll vertical.
 * `reservado` es la altura fija que ocupa la cabecera dentro del contenedor.
 * Sin ResizeObserver (p. ej. en jsdom) devuelve `porDefecto`.
 */
export function useFilasPorPagina(
  contenedor: RefObject<HTMLElement | null>,
  altoFila: number,
  reservado: number,
  porDefecto = 8,
): number {
  const [filas, setFilas] = useState(porDefecto)

  useEffect(() => {
    const el = contenedor.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(() => {
      const util = el.clientHeight - reservado
      if (util > 0) setFilas(Math.max(1, Math.floor(util / altoFila)))
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [contenedor, altoFila, reservado])

  return filas
}
