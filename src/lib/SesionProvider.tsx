import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Sesion } from '../types.ts'
import { avisar } from './alertas.ts'
import { SesionContext } from './SesionContext.ts'
import {
  borrarSesion,
  EVENTO_SESION_INVALIDA,
  guardarSesion,
  haExpirado,
  leerSesion,
} from './sesion.ts'

// setTimeout no admite esperas mayores a ~24.8 días; una sesión dura horas, pero se acota igual.
const ESPERA_MAXIMA_MS = 2_147_483_647

export function SesionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(() => leerSesion())

  const iniciar = useCallback((nueva: Sesion) => {
    guardarSesion(nueva)
    setSesion(nueva)
  }, [])

  const salir = useCallback(() => {
    borrarSesion()
    setSesion(null)
  }, [])

  // La sesión vence sola en `expiraEn`.
  useEffect(() => {
    if (!sesion) return
    const espera = Math.min(Math.max(Date.parse(sesion.expiraEn) - Date.now(), 0), ESPERA_MAXIMA_MS)
    const temporizador = setTimeout(() => {
      if (haExpirado(sesion)) {
        salir()
        avisar('info', 'Tu sesión venció. Vuelve a ingresar.')
      }
    }, espera)
    return () => clearTimeout(temporizador)
  }, [sesion, salir])

  // Un cliente de API recibió «token inválido».
  useEffect(() => {
    const alInvalidarse = () => {
      salir()
      avisar('info', 'Tu sesión venció. Vuelve a ingresar.')
    }
    window.addEventListener(EVENTO_SESION_INVALIDA, alInvalidarse)
    return () => window.removeEventListener(EVENTO_SESION_INVALIDA, alInvalidarse)
  }, [salir])

  const valor = useMemo(() => ({ sesion, iniciar, salir }), [sesion, iniciar, salir])
  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>
}
