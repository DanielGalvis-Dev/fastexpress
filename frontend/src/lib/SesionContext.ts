import { createContext } from 'react'
import type { Sesion } from '../types.ts'

export interface ValorSesion {
  /** `null` si no hay sesión activa. */
  sesion: Sesion | null
  /** Guarda la sesión recién obtenida con `login`. */
  iniciar: (sesion: Sesion) => void
  /** Borra la sesión local (el cierre en la API lo hace quien llama). */
  salir: () => void
}

// Por defecto no hay sesión: así los componentes sueltos se pueden renderizar sin provider.
export const SesionContext = createContext<ValorSesion>({
  sesion: null,
  iniciar: () => {},
  salir: () => {},
})
