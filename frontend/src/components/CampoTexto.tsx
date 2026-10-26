import { useId } from 'react'
import type { HTMLInputAutoCompleteAttribute } from 'react'

interface Props {
  etiqueta: string
  name: string
  type?: 'text' | 'email' | 'password'
  value: string
  onChange: (valor: string) => void
  onBlur?: () => void
  error?: string
  /** Prefijo de los `data-testid`: `<prefijo>-input` y `<prefijo>-error`. */
  testid: string
  autoComplete?: HTMLInputAutoCompleteAttribute
  maxLength?: number
  ayuda?: string
  disabled?: boolean
}

const claseCampo = (conError: boolean) =>
  `mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-base text-tinta shadow-sm outline-none focus:ring-2 focus:ring-marca disabled:opacity-60 ${
    conError ? 'border-error' : 'border-linea'
  }`

/** Campo de texto con etiqueta, ayuda y error asociados (aria-describedby), como el resto de formularios. */
export function CampoTexto({
  etiqueta,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  error,
  testid,
  autoComplete,
  maxLength,
  ayuda,
  disabled,
}: Props) {
  const id = useId()
  const describedby = [ayuda ? `${id}-ayuda` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        disabled={disabled}
        autoComplete={autoComplete}
        maxLength={maxLength}
        // Sin corrección ni mayúsculas automáticas en correos, códigos y contraseñas.
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        data-testid={`${testid}-input`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedby || undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={claseCampo(Boolean(error))}
      />
      {ayuda && (
        <p id={`${id}-ayuda`} className="mt-1 text-xs text-tinta-suave">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" data-testid={`${testid}-error`} className="mt-1 text-sm font-medium text-error">
          {error}
        </p>
      )}
    </div>
  )
}
