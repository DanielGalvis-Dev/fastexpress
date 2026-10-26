import { useEffect, useId, useRef, useState } from 'react'
import type { Usuario } from '../types.ts'

interface Props {
  usuario: Usuario
  onCambiarPassword: () => void
  onCerrarSesion: () => void
}

const claseItem =
  'block w-full rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-linea/60 focus-visible:outline-2 focus-visible:outline-marca'

/** Botón con la inicial de la persona que abre un menú: cuenta, cambiar contraseña y cerrar sesión. */
export function MenuUsuario({ usuario, onCambiarPassword, onCerrarSesion }: Props) {
  const menuId = useId()
  const [abierto, setAbierto] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!abierto) return
    const alPulsarFuera = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false)
        boton.current?.focus()
      }
    }
    document.addEventListener('mousedown', alPulsarFuera)
    document.addEventListener('keydown', alPulsarTecla)
    return () => {
      document.removeEventListener('mousedown', alPulsarFuera)
      document.removeEventListener('keydown', alPulsarTecla)
    }
  }, [abierto])

  const nombre = usuario.nombre.trim() || usuario.email
  const inicial = nombre.charAt(0).toUpperCase()

  const elegir = (accion: () => void) => () => {
    setAbierto(false)
    accion()
  }

  return (
    <div ref={contenedor} className="relative">
      <button
        ref={boton}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="true"
        aria-expanded={abierto}
        aria-controls={menuId}
        aria-label={`Cuenta de ${nombre}`}
        title={nombre}
        data-testid="usuario-menu-btn"
        className="grid size-10 place-items-center rounded-full border border-linea bg-tarjeta text-sm font-semibold text-marca transition-colors hover:border-marca focus-visible:outline-2 focus-visible:outline-marca"
      >
        {inicial}
      </button>

      {abierto && (
        <div
          id={menuId}
          className="absolute right-0 top-12 z-40 w-64 rounded-xl border border-linea bg-tarjeta p-2 shadow-lg"
        >
          <div className="border-b border-linea px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold" data-testid="usuario-nombre">
              {nombre}
            </p>
            <p className="truncate text-xs text-tinta-suave" data-testid="usuario-email">
              {usuario.email}
            </p>
          </div>
          <div className="mt-1">
            <button
              type="button"
              onClick={elegir(onCambiarPassword)}
              data-testid="cambiar-password-abrir"
              className={claseItem}
            >
              Cambiar contraseña
            </button>
            <button
              type="button"
              onClick={elegir(onCerrarSesion)}
              data-testid="cerrar-sesion-btn"
              className={`${claseItem} text-error`}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
