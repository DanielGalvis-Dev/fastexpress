import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { restablecerPassword, solicitarCodigo } from '../api/auth.ts'
import { ApiError } from '../api/cotizar.ts'
import {
  MAX_CARACTERES_EMAIL,
  MAX_CARACTERES_PASSWORD,
  PASSWORD_MIN_CARACTERES,
  validarCodigo,
  validarConfirmacion,
  validarEmail,
  validarPassword,
} from '../lib/validation.ts'
import { CampoTexto } from './CampoTexto.tsx'

interface Props {
  /** Contraseña restablecida: la pantalla vuelve al login con el correo y el mensaje de la API. */
  onRestablecida: (email: string, mensaje: string) => void
  onIrALogin: () => void
}

interface Errores {
  email?: string
  codigo?: string
  nueva?: string
  confirmacion?: string
}

const claseBoton =
  'w-full rounded-lg bg-marca px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-wait disabled:opacity-60'

const claseEnlace =
  'font-medium text-marca underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-marca'

/** Recuperación en dos pasos: 1) correo → la API envía un código; 2) código + contraseña nueva. */
export function RecuperarForm({ onRestablecida, onIrALogin }: Props) {
  const [paso, setPaso] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [cargando, setCargando] = useState(false)
  const [errorApi, setErrorApi] = useState<string | null>(null)
  const [infoCodigo, setInfoCodigo] = useState<string | null>(null)
  const enCurso = useRef(false)

  const mensaje = (r: { ok: boolean; error?: string }) => (r.ok ? undefined : r.error)

  /** Ejecuta una llamada a la API con candado anti doble envío, carga y error unificados. */
  async function ejecutar(accion: () => Promise<void>) {
    if (enCurso.current) return
    enCurso.current = true
    setCargando(true)
    setErrorApi(null)
    try {
      await accion()
    } catch (error) {
      setErrorApi(
        error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.',
      )
    } finally {
      enCurso.current = false
      setCargando(false)
    }
  }

  function pedirCodigo(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const emailValido = validarEmail(email)
    setErrores({ email: mensaje(emailValido) })
    if (!emailValido.ok) return

    void ejecutar(async () => {
      const respuesta = await solicitarCodigo(emailValido.valor)
      setInfoCodigo(respuesta)
      setPaso('codigo')
    })
  }

  function restablecer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const codigoValido = validarCodigo(codigo)
    const nuevaValida = validarPassword(nueva)
    const confirmacionValida = validarConfirmacion(nueva, confirmacion)
    setErrores({
      codigo: mensaje(codigoValido),
      nueva: mensaje(nuevaValida),
      confirmacion: mensaje(confirmacionValida),
    })
    const emailValido = validarEmail(email)
    if (!emailValido.ok || !codigoValido.ok || !nuevaValida.ok || !confirmacionValida.ok) return

    void ejecutar(async () => {
      const respuesta = await restablecerPassword({
        email: emailValido.valor,
        codigo: codigoValido.valor,
        nueva,
      })
      onRestablecida(emailValido.valor, respuesta)
    })
  }

  const errorApiVista = errorApi && (
    <p
      role="alert"
      data-testid="recuperar-api-error"
      className="rounded-lg border border-error bg-error-fondo p-3 text-sm font-medium text-error"
    >
      {errorApi}
    </p>
  )

  if (paso === 'email') {
    return (
      <form onSubmit={pedirCodigo} noValidate className="space-y-4" aria-busy={cargando}>
        <p className="text-sm text-tinta-suave">
          Ingresa tu correo y te enviaremos un código para crear una contraseña nueva.
        </p>
        <CampoTexto
          etiqueta="Correo electrónico"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          onBlur={() => setErrores((p) => ({ ...p, email: mensaje(validarEmail(email)) }))}
          error={errores.email}
          maxLength={MAX_CARACTERES_EMAIL}
          testid="recuperar-email"
          disabled={cargando}
        />
        {errorApiVista}
        <button type="submit" disabled={cargando} data-testid="recuperar-enviar-btn" className={claseBoton}>
          {cargando ? 'Enviando…' : 'Enviar código'}
        </button>
        <p className="text-center text-sm">
          <button type="button" onClick={onIrALogin} data-testid="ir-a-login" className={claseEnlace}>
            Volver a ingresar
          </button>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={restablecer} noValidate className="space-y-4" aria-busy={cargando}>
      <p role="status" data-testid="recuperar-info" className="text-sm text-tinta-suave">
        {infoCodigo} Escribe el código que recibiste en <strong className="text-tinta">{email.trim()}</strong> y
        elige tu contraseña nueva.
      </p>
      <CampoTexto
        etiqueta="Código de recuperación"
        name="codigo"
        autoComplete="one-time-code"
        value={codigo}
        onChange={setCodigo}
        onBlur={() => setErrores((p) => ({ ...p, codigo: mensaje(validarCodigo(codigo)) }))}
        error={errores.codigo}
        testid="recuperar-codigo"
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
        testid="recuperar-nueva"
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
        testid="recuperar-confirmacion"
        disabled={cargando}
      />
      {errorApiVista}
      <button type="submit" disabled={cargando} data-testid="recuperar-btn" className={claseBoton}>
        {cargando ? 'Guardando…' : 'Restablecer contraseña'}
      </button>
      <p className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <button
          type="button"
          onClick={() => {
            setPaso('email')
            setErrores({})
            setErrorApi(null)
          }}
          data-testid="recuperar-cambiar-correo"
          className={claseEnlace}
        >
          Usar otro correo
        </button>
        <button type="button" onClick={onIrALogin} data-testid="ir-a-login" className={claseEnlace}>
          Volver a ingresar
        </button>
      </p>
    </form>
  )
}
