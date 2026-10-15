import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  abierto: boolean
  titulo: string
  onCerrar: () => void
  children: ReactNode
}

const ENFOCABLES = 'input:not([disabled]), select:not([disabled]), button:not([disabled]), [href], textarea:not([disabled])'

/**
 * Modal accesible: role="dialog", se cierra con Escape o al pulsar el fondo, mueve el foco
 * al primer campo y lo devuelve al botón que lo abrió. El contenido se desmonta al cerrar,
 * así que el formulario siempre arranca limpio.
 */
export function Modal({ abierto, titulo, onCerrar, children }: Props) {
  const tituloId = useId()
  const contenido = useRef<HTMLDivElement>(null)
  const empezoEnFondo = useRef(false)
  const cerrar = useRef(onCerrar)

  useEffect(() => {
    cerrar.current = onCerrar
  })

  useEffect(() => {
    if (!abierto) return
    const previo = document.activeElement as HTMLElement | null
    // El foco inicial va al primer campo del contenido, no al botón de cerrar del encabezado.
    contenido.current?.querySelector<HTMLElement>(ENFOCABLES)?.focus()

    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current()
    }
    document.addEventListener('keydown', alPulsar)
    return () => {
      document.removeEventListener('keydown', alPulsar)
      previo?.focus()
    }
  }, [abierto])

  if (!abierto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 p-4"
      // El cierre va en `click` (no en `mousedown`): si se abre una alerta en mousedown, la acción
      // por defecto del clic le quita el foco. Se exige que el clic también empiece en el fondo,
      // para que arrastrar desde un campo hasta fuera del panel no cierre el modal.
      onMouseDown={(e) => {
        empezoEnFondo.current = e.target === e.currentTarget
        // Pulsar el fondo no debe quitar el foco al campo que lo tenía; así, tras una alerta de
        // confirmación, el foco vuelve a donde estaba.
        if (empezoEnFondo.current) e.preventDefault()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && empezoEnFondo.current) onCerrar()
        empezoEnFondo.current = false
      }}
      data-testid="modal-fondo"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="flex max-h-full w-full max-w-lg flex-col rounded-2xl bg-papel shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-linea px-5 py-3">
          <h2 id={tituloId} className="text-lg font-semibold tracking-tight">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            data-testid="modal-cerrar"
            className="rounded-md p-1 text-tinta-suave hover:bg-linea/60 hover:text-tinta focus-visible:outline-2 focus-visible:outline-marca"
          >
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 5l10 10M15 5L5 15" />
            </svg>
          </button>
        </div>
        {/* Si la pantalla es muy baja, el scroll queda dentro del modal y no en la página. */}
        <div ref={contenido} className="overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
