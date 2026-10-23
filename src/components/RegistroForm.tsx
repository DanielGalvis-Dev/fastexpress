import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { registrar } from '../api/auth.ts'
import { ApiError } from '../api/cotizar.ts'
import {
  MAX_CARACTERES_EMAIL,
  MAX_CARACTERES_NOMBRE,
  MAX_CARACTERES_PASSWORD,
  PASSWORD_MIN_CARACTERES,
  validarConfirmacion,
  validarEmail,
  validarNombre,
  validarPassword,
} from '../lib/validation.ts'
import { CampoTexto } from './CampoTexto.tsx'

interface Props {
  /** Cuenta creada: la pantalla vuelve al login con el correo precargado. */
  onRegistrado: (email: string) => void
  onIrALogin: () => void
}

interface Errores {
  nombre?: string
  email?: string
  password?: string
  confirmacion?: string
}

export function RegistroForm({ onRegistrado, onIrALogin }: Props) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [cargando, setCargando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const enCurso = useRef(false)

  const mensaje = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error)
  const errorNombre = (v: string) => mensaje(validarNombre(v))
  const errorEmail = (v: string) => mensaje(validarEmail(v))
  const errorPassword = (v: string) => mensaje(validarPassword(v))
  const errorConfirmacion = (pass: string, conf: string) => mensaje(validarConfirmacion(pass, conf))

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enCurso.current) return

    const nuevos: Errores = {
      nombre: errorNombre(nombre),
      email: errorEmail(email),
      password: errorPassword(password),
      confirmacion: errorConfirmacion(password, confirmacion),
    }
    setErrores(nuevos)
    const nombreValido = validarNombre(nombre)
    const emailValido = validarEmail(email)
    if (
      !nombreValido.ok ||
      !emailValido.ok ||
      !validarPassword(password).ok ||
      !validarConfirmacion(password, confirmacion).ok
    ) {
      return
    }

    enCurso.current = true
    setCargando(true)
    setErrorApi(null)
    try {
      await registrar({ nombre: nombreValido.valor, email: emailValido.valor, password })
      onRegistrado(emailValido.valor)
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
        etiqueta="Nombre"
        name="nombre"
        autoComplete="name"
        value={nombre}
        onChange={setNombre}
        onBlur={() => setErrores((p) => ({ ...p, nombre: errorNombre(nombre) }))}
        error={errores.nombre}
        maxLength={MAX_CARACTERES_NOMBRE}
        testid="registro-nombre"
        disabled={cargando}
      />
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
        testid="registro-email"
        disabled={cargando}
      />
      <CampoTexto
        etiqueta="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
        onBlur={() =>
          setErrores((p) => ({
            ...p,
            password: errorPassword(password),
            confirmacion: confirmacion ? errorConfirmacion(password, confirmacion) : p.confirmacion,
          }))
        }
        error={errores.password}
        ayuda={`Mínimo ${PASSWORD_MIN_CARACTERES} caracteres.`}
        maxLength={MAX_CARACTERES_PASSWORD}
        testid="registro-password"
        disabled={cargando}
      />
      <CampoTexto
        etiqueta="Repite la contraseña"
        name="confirmacion"
        type="password"
        autoComplete="new-password"
        value={confirmacion}
        onChange={setConfirmacion}
        onBlur={() => setErrores((p) => ({ ...p, confirmacion: errorConfirmacion(password, confirmacion) }))}
        error={errores.confirmacion}
        maxLength={MAX_CARACTERES_PASSWORD}
        testid="registro-confirmacion"
        disabled={cargando}
      />

      {errorApi && (
        <p
          role="alert"
          data-testid="registro-api-error"
          className="rounded-lg border border-error bg-error-fondo p-3 text-sm font-medium text-error"
        >
          {errorApi}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        data-testid="registro-btn"
        className="w-full rounded-lg bg-marca px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-wait disabled:opacity-60"
      >
        {cargando ? 'Creando cuenta…' : 'Crear cuenta'}
      </button>

      <p className="text-center text-sm">
        ¿Ya tienes cuenta?{' '}
        <button
          type="button"
          onClick={onIrALogin}
          data-testid="ir-a-login"
          className="font-medium text-marca underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-marca"
        >
          Ingresar
        </button>
      </p>
    </form>
  )
}
