import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ApiError, cotizar } from '../api/cotizar.ts'
import { confirmar } from '../lib/alertas.ts'
import { ETIQUETA_CLIENTE, ETIQUETA_ENVIO } from '../lib/formato.ts'
import {
  MAX_CARACTERES_PESO,
  sanitizarPeso,
  validarPeso,
  validarTipoCliente,
  validarTipoEnvio,
} from '../lib/validation.ts'
import { TIPOS_CLIENTE, TIPOS_ENVIO } from '../types.ts'
import type { ResultadoCotizacion } from '../types.ts'
import { ResultadoView } from './ResultadoView.tsx'

const DETALLE_ENVIO = {
  ESTANDAR: { titulo: 'Estándar', detalle: 'Sin recargo' },
  EXPRESS: { titulo: 'Express', detalle: '+25 % sobre el subtotal' },
} as const

interface Errores {
  peso?: string
  cliente?: string
  envio?: string
}

type Estado =
  | { fase: 'inicial' }
  | { fase: 'cargando' }
  | { fase: 'ok'; resultado: ResultadoCotizacion }
  | { fase: 'error'; mensaje: string }

const claseCampo = (conError: boolean) =>
  `mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-base text-tinta shadow-sm outline-none focus:ring-2 focus:ring-marca ${
    conError ? 'border-error' : 'border-linea'
  }`

const claseError = 'mt-1 text-sm font-medium text-error'

interface Props {
  /** Se llama al terminar una cotización (exitosa o rechazada) para refrescar el historial. */
  onCotizado?: () => void
  /** Si se indica, el resultado ofrece un botón «Cerrar». */
  onCerrar?: () => void
  /** Informa si hay datos ingresados que se perderían al cerrar. */
  onSucio?: (sucio: boolean) => void
}

export function CotizadorForm({ onCotizado, onCerrar, onSucio }: Props) {
  const id = useId()
  const [peso, setPeso] = useState('')
  const [cliente, setCliente] = useState('')
  const [envio, setEnvio] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [estado, setEstado] = useState<Estado>({ fase: 'inicial' })
  const enCurso = useRef(false)

  // Hay algo que perder mientras se edita; una vez mostrado el resultado ya quedó registrado.
  const sucio = estado.fase !== 'ok' && (peso.trim() !== '' || cliente !== '' || envio !== '')
  useEffect(() => {
    onSucio?.(sucio)
  }, [sucio, onSucio])

  const errorPeso = (valor: string) => {
    const r = validarPeso(valor)
    return r.ok ? undefined : r.error
  }
  const errorCliente = (valor: string) =>
    validarTipoCliente(valor) ? undefined : 'Selecciona el tipo de cliente.'
  const errorEnvio = (valor: string) =>
    validarTipoEnvio(valor) ? undefined : 'Selecciona el tipo de envío.'

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (enCurso.current) return

    setErrores({ peso: errorPeso(peso), cliente: errorCliente(cliente), envio: errorEnvio(envio) })

    const pesoValido = validarPeso(peso)
    if (!pesoValido.ok || !validarTipoCliente(cliente) || !validarTipoEnvio(envio)) {
      setEstado({ fase: 'inicial' })
      return
    }

    enCurso.current = true // también bloquea reenvíos mientras se espera la confirmación
    const acepta = await confirmar({
      titulo: '¿Registrar esta cotización?',
      texto: `${pesoValido.valor} kg · ${ETIQUETA_CLIENTE[cliente]} · ${ETIQUETA_ENVIO[envio]}`,
      confirmar: 'Sí, cotizar',
      cancelar: 'Revisar',
    })
    if (!acepta) {
      enCurso.current = false
      return
    }

    setEstado({ fase: 'cargando' })
    try {
      const resultado = await cotizar({
        peso: pesoValido.valor,
        tipoCliente: cliente,
        tipoEnvio: envio,
      })
      setEstado({ fase: 'ok', resultado })
      onCotizado?.()
    } catch (error) {
      const mensaje =
        error instanceof ApiError ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.'
      setEstado({ fase: 'error', mensaje })
      // La API también registra los rechazos en el historial.
      onCotizado?.()
    } finally {
      enCurso.current = false
    }
  }

  function nuevaCotizacion() {
    setPeso('')
    setCliente('')
    setEnvio('')
    setErrores({})
    setEstado({ fase: 'inicial' })
  }

  if (estado.fase === 'ok') {
    return (
      <div aria-live="polite">
        <ResultadoView resultado={estado.resultado} />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={nuevaCotizacion}
            data-testid="otra-cotizacion-btn"
            className="flex-1 rounded-lg border border-linea bg-tarjeta px-4 py-2.5 text-sm font-semibold hover:border-marca hover:text-marca focus-visible:outline-2 focus-visible:outline-marca"
          >
            Cotizar otro envío
          </button>
          {onCerrar && (
            <button
              type="button"
              onClick={onCerrar}
              data-testid="resultado-cerrar-btn"
              className="flex-1 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    )
  }

  const cargando = estado.fase === 'cargando'

  return (
    <form onSubmit={enviar} noValidate className="space-y-4" aria-busy={cargando}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-peso`} className="text-sm font-medium">
            Peso del envío (kg)
          </label>
          <input
            id={`${id}-peso`}
            name="peso"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="Ej. 2.5"
            value={peso}
            data-testid="peso-input"
            aria-invalid={errores.peso ? true : undefined}
            aria-describedby={`${id}-peso-ayuda${errores.peso ? ` ${id}-peso-error` : ''}`}
            maxLength={MAX_CARACTERES_PESO}
            onChange={(e) => setPeso(sanitizarPeso(e.target.value))}
            onBlur={() => setErrores((p) => ({ ...p, peso: errorPeso(peso) }))}
            className={claseCampo(Boolean(errores.peso))}
          />
          <p id={`${id}-peso-ayuda`} className="mt-1 text-xs text-tinta-suave">
            Entre 0.01 y 20.00 kg.
          </p>
          {errores.peso && (
            <p id={`${id}-peso-error`} role="alert" data-testid="peso-error" className={claseError}>
              {errores.peso}
            </p>
          )}
        </div>

        <div>
          <label htmlFor={`${id}-cliente`} className="text-sm font-medium">
            Tipo de cliente
          </label>
          <select
            id={`${id}-cliente`}
            name="tipoCliente"
            value={cliente}
            data-testid="cliente-select"
            aria-invalid={errores.cliente ? true : undefined}
            aria-describedby={errores.cliente ? `${id}-cliente-error` : undefined}
            onChange={(e) => {
              setCliente(e.target.value)
              setErrores((p) => ({ ...p, cliente: errorCliente(e.target.value) }))
            }}
            className={claseCampo(Boolean(errores.cliente))}
          >
            <option value="">Selecciona…</option>
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>
                {ETIQUETA_CLIENTE[t]}
              </option>
            ))}
          </select>
          {errores.cliente && (
            <p id={`${id}-cliente-error`} role="alert" data-testid="cliente-error" className={claseError}>
              {errores.cliente}
            </p>
          )}
        </div>
      </div>

      <fieldset aria-describedby={errores.envio ? `${id}-envio-error` : undefined} className="border-0 p-0">
        <legend className="text-sm font-medium">Tipo de envío</legend>
        {/* Dos columnas también en móvil: ahorra altura para que el modal no necesite scroll. */}
        <div className="mt-1 grid grid-cols-2 gap-2 sm:gap-3">
          {TIPOS_ENVIO.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border bg-white p-2.5 has-[:checked]:border-marca has-[:checked]:ring-1 has-[:checked]:ring-marca sm:gap-3 sm:p-3 ${
                errores.envio ? 'border-error' : 'border-linea'
              }`}
            >
              <input
                type="radio"
                name="tipoEnvio"
                value={t}
                checked={envio === t}
                data-testid={`envio-${t.toLowerCase()}`}
                onChange={() => {
                  setEnvio(t)
                  setErrores((p) => ({ ...p, envio: undefined }))
                }}
                className="mt-1 accent-marca"
              />
              <span>
                <span className="block text-sm font-medium">{DETALLE_ENVIO[t].titulo}</span>
                <span className="block text-xs text-tinta-suave">{DETALLE_ENVIO[t].detalle}</span>
              </span>
            </label>
          ))}
        </div>
        {errores.envio && (
          <p id={`${id}-envio-error`} role="alert" data-testid="envio-error" className={claseError}>
            {errores.envio}
          </p>
        )}
      </fieldset>

      {estado.fase === 'error' && (
        <p
          role="alert"
          data-testid="api-error"
          className="rounded-lg border border-error bg-error-fondo p-3 text-sm font-medium text-error"
        >
          {estado.mensaje}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        data-testid="cotizar-btn"
        className="w-full rounded-lg bg-marca px-4 py-2.5 text-base font-semibold text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:cursor-wait disabled:opacity-60"
      >
        {cargando ? 'Calculando…' : 'Cotizar envío'}
      </button>
    </form>
  )
}
