import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { iniciarSesion } from '../api/auth.ts'
import { ApiError } from '../api/cotizar.ts'
import { avisar } from '../lib/alertas.ts'
import { useSesion } from '../lib/useSesion.ts'
import {
  MAX_CARACTERES_EMAIL,
  MAX_CARACTERES_PASSWORD,
  validarEmail,
  validarPasswordIngreso,
} from '../lib/validation.ts'
import { CampoTexto } from './CampoTexto.tsx'

interface Props {
  /** Correo con el que arranca el campo (p. ej. tras registrarse). */
  emailInicial?: string
  /** Mensaje de éxito de un paso anterior (registro, restablecer contraseña). */
  aviso?: string
  onIrARegistro: () => void
  onIrARecuperar: () => void
}

export function LoginForm({ emailInicial = '', aviso, onIrARegistro, onIrARecuperar }: Props) {
  const { iniciar } = useSesion()
  const [email, setEmail] = useState(emailInicial)
  const [password, setPassword] = useState('')
  const [errores, setErrores] = useState<{ email?: string; password?: string }>({})
  const [cargando, setCargando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const enCurso = useRef(false)

  const errorEmail = (v: string) => {
    const r = validarEmail(v)
    return r.ok ? undefined : r.error
  }
  const errorPassword = (v: string) => {
    const r = validarPasswordIngreso(v)
    return r.ok ? undefined : r.error
  }

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enCurso.current) return

    setErrores({ email: errorEmail(email), password: errorPassword(password) })
    const emailValido = validarEmail(email)
    if (!emailValido.ok || !validarPasswordIngreso(password).ok) return

    enCurso.current = true
    setCargando(true)
    setErrorApi(null)
    try {
      const sesion = await iniciarSesion({ email: emailValido.valor, password })
      iniciar(sesion)
      avisar('success', 'Sesión iniciada')
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
      {aviso && (
        <p
          role="status"
          data-testid="login-aviso"
          className="rounded-lg border border-ok bg-white p-3 text-sm font-medium text-ok"
        >
          {aviso}
        </p>
      )}

      <CampoTexto
        etiqueta="Correo electrónico"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        onBlur={() => setErrores((p) => ({ ...p, email: errorEmail(email) }))}
        error={errores.email}
        maxLength={MAX_CARACTERES_EMAIL}
        testid="login-email"
        disabled={cargando}
      />
      <CampoTexto
        etiqueta="Contraseña"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        onBlur={() => setErrores((p) => ({ ...p, password: errorPassword(password) }))}
        error={errores.password}
        maxLength={MAX_CARACTERES_PASSWORD}
        testid="login-password"
        disabled={cargando}
      />

      {errorApi && (
        <p
          role="alert"
          data-testid="login-api-error"
          className="rounded-lg border border-error bg-error-fondo p-3 text-sm font-medium text-error"
        >
          {errorApi}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        data-testid="login-btn"
        className="w-full rounded-lg bg-marca px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-wait disabled:opacity-60"
      >
        {cargando ? 'Ingresando…' : 'Ingresar'}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={onIrARecuperar}
          data-testid="ir-a-recuperar"
          className="font-medium text-marca underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-marca"
        >
          Olvidé mi contraseña
        </button>
        <button
          type="button"
          onClick={onIrARegistro}
          data-testid="ir-a-registro"
          className="font-medium text-marca underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-marca"
        >
          Crear cuenta
        </button>
      </div>
    </form>
  )
}
