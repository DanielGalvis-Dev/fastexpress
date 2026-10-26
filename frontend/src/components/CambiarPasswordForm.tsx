import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { cambiarPassword } from '../api/auth.ts'
import { ApiError } from '../api/cotizar.ts'
import { avisar } from '../lib/alertas.ts'
import { useSesion } from '../lib/useSesion.ts'
import {
  MAX_CARACTERES_PASSWORD,
  PASSWORD_MIN_CARACTERES,
  validarConfirmacion,
  validarPassword,
  validarPasswordIngreso,
} from '../lib/validation.ts'
import { CampoTexto } from './CampoTexto.tsx'

interface Props {
  /** Se llama tras cambiar la contraseña con éxito (la ventana se cierra). */
  onCambiada: () => void
  /** Informa si hay datos ingresados que se perderían al cerrar. */
  onSucio?: (sucio: boolean) => void
}

interface Errores {
  actual?: string
  nueva?: string
  confirmacion?: string
}

export function CambiarPasswordForm({ onCambiada, onSucio }: Props) {
  const { sesion } = useSesion()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [cargando, setCargando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const enCurso = useRef(false)

  const sucio = actual !== '' || nueva !== '' || confirmacion !== ''
  useEffect(() => {
    onSucio?.(sucio)
  }, [sucio, onSucio])

  const mensaje = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error)

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enCurso.current) return

    const actualValida = validarPasswordIngreso(actual)
    const nuevaValida = validarPassword(nueva)
    const confirmacionValida = validarConfirmacion(nueva, confirmacion)
    setErrores({
      actual: mensaje(actualValida),
      nueva: mensaje(nuevaValida),
      confirmacion: mensaje(confirmacionValida),
    })
    if (!actualValida.ok || !nuevaValida.ok || !confirmacionValida.ok) return

    if (!sesion) {
      setErrorApi('Tu sesión venció. Vuelve a ingresar.')
      return
    }
    if (actual === nueva) {
      setErrores((p) => ({ ...p, nueva: 'La contraseña nueva debe ser distinta de la actual.' }))
      return
    }

    enCurso.current = true
    setCargando(true)
    setErrorApi(null)
    try {
      const respuesta = await cambiarPassword({ token: sesion.token, actual, nueva })
      avisar('success', respuesta)
      onCambiada()
    } catch (error) {
      setErrorApi(
        error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      )
    } finally {
      enCurso.current = false
      setCargando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" aria-busy={cargando}>
      <CampoTexto
        etiqueta="Contraseña actual"
        name="actual"
        type="password"
        autoComplete="current-password"
        value={actual}
        onChange={setActual}
        onBlur={() => setErrores((p) => ({ ...p, actual: mensaje(validarPasswordIngreso(actual)) }))}
        error={errores.actual}
        maxLength={MAX_CARACTERES_PASSWORD}
        testid="cambiar-password-actual"
        disabled={cargando}
      />
      <CampoTexto
        etiqueta="Contraseña nueva"
        name="nueva"
        type="password"
        autoComplete="new-password"
        value={nueva}
        onChange={setNueva}
        onBlur={() => setErrores((p) => ({ ...p, nueva: mensaje(validarPassword(nueva)) }))}
        error={errores.nueva}
        ayuda={`Mínimo ${PASSWORD_MIN_CARACTERES} caracteres.`}
        maxLength={MAX_CARACTERES_PASSWORD}
        testid="cambiar-password-nueva"
        disabled={cargando}
      />
      <CampoTexto
        etiqueta="Repite la contraseña nueva"
        name="confirmacion"
        type="password"
        autoComplete="new-password"
        value={confirmacion}
        onChange={setConfirmacion}
        onBlur={() => setErrores((p) => ({ ...p, confirmacion: mensaje(validarConfirmacion(nueva, confirmacion)) }))}
        error={errores.confirmacion}
        maxLength={MAX_CARACTERES_PASSWORD}
        testid="cambiar-password-confirmacion"
        disabled={cargando}
      />

      {errorApi && (
        <p
          role="alert"
          data-testid="cambiar-password-api-error"
          className="rounded-lg border border-error bg-error-fondo p-3 text-sm font-medium text-error"
        >
          {errorApi}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        data-testid="cambiar-password-btn"
        className="w-full rounded-lg bg-marca px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-wait disabled:opacity-60"
      >
        {cargando ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
