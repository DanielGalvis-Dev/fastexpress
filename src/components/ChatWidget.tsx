import { useEffect, useId, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { MAX_CARACTERES_MENSAJE } from '../api/chat.ts'
import { useChat } from '../lib/useChat.ts'
import { useEsPantallaAncha } from '../lib/useFilasPorPagina.ts'
import type { MensajeChat } from '../lib/useChat.ts'

const EJEMPLOS = [
  '¿Cuántas cotizaciones hay?',
  '¿Qué tipo de cliente cotiza más?',
  '¿Cuánto se ha facturado?',
]

const AVISAR_DESDE = 450 // el contador de caracteres aparece al acercarse al límite

interface Props {
  /** Respuestas de ejemplo (VITE_CHAT=mock): se avisa en el panel para no confundirlas con datos reales. */
  demo?: boolean
  /** Si se indica, cuando el asistente remite a «Nueva cotización» se ofrece un botón para abrirla. */
  onNuevaCotizacion?: () => void
  /** Avisa cuando el chat pasa a ocupar toda la pantalla (móvil) y cuando deja de hacerlo. Debe ser estable (useCallback). */
  onPantallaCompleta?: (activa: boolean) => void
}

const iconoBase = { 'aria-hidden': true, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function IconoChat() {
  return (
    <svg {...iconoBase} viewBox="0 0 24 24" className="size-5">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" />
      <path d="M9 11h6M9 14h3" />
    </svg>
  )
}

function IconoCerrar({ clase = 'size-5' }: { clase?: string }) {
  return (
    <svg {...iconoBase} viewBox="0 0 20 20" className={clase}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  )
}

function IconoBajar() {
  return (
    <svg {...iconoBase} viewBox="0 0 20 20" className="size-5">
      <path d="M5 8l5 5 5-5" />
    </svg>
  )
}

function IconoEnviar() {
  return (
    <svg {...iconoBase} viewBox="0 0 20 20" className="size-5">
      <path d="M3 10l14-7-5 14-2.5-5.5L3 10Z" />
    </svg>
  )
}

function IconoNuevo() {
  return (
    <svg {...iconoBase} viewBox="0 0 20 20" className="size-4">
      <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" />
    </svg>
  )
}

function Escribiendo() {
  return (
    // w-fit: un `flex` es de bloque y se estiraría a todo el ancho; así mide solo lo que ocupan los tres puntos.
    <div className="flex w-fit items-center gap-1 rounded-2xl rounded-bl-md border border-linea bg-white px-4 py-3" data-testid="chat-escribiendo">
      <span className="sr-only">El asistente está escribiendo</span>
      {[0, 150, 300].map((retraso) => (
        <span
          key={retraso}
          aria-hidden="true"
          style={{ animationDelay: `${retraso}ms` }}
          className="size-1.5 rounded-full bg-tinta-suave motion-safe:animate-bounce"
        />
      ))}
    </div>
  )
}

interface BurbujaProps {
  mensaje: MensajeChat
  puedeReintentar: boolean
  bloqueado: boolean
  onReintentar: () => void
  onNuevaCotizacion?: () => void
}

function Burbuja({ mensaje, puedeReintentar, bloqueado, onReintentar, onNuevaCotizacion }: BurbujaProps) {
  if (mensaje.rol === 'usuario') {
    return (
      <div className="flex justify-end">
        <p
          data-testid="chat-mensaje-usuario"
          className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-marca px-3.5 py-2 text-sm text-white"
        >
          {mensaje.texto}
        </p>
      </div>
    )
  }

  if (mensaje.tipo === 'error') {
    return (
      <div className="flex">
        <div
          role="alert"
          data-testid="chat-error"
          className="max-w-[85%] rounded-2xl rounded-bl-md border border-error bg-error-fondo px-3.5 py-2 text-sm text-error"
        >
          <p className="break-words">{mensaje.texto}</p>
          {puedeReintentar && (
            <button
              type="button"
              onClick={onReintentar}
              disabled={bloqueado}
              data-testid="chat-reintentar"
              className="mt-1.5 text-xs font-semibold underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
            >
              Reintentar
            </button>
          )}
        </div>
      </div>
    )
  }

  if (mensaje.tipo === 'fuera_de_contexto') {
    return (
      <div className="flex">
        <div
          data-testid="chat-chiste"
          className="max-w-[85%] rounded-2xl rounded-bl-md border border-dashed border-aviso/50 bg-aviso-fondo px-3.5 py-2 text-sm text-tinta"
        >
          <p className="mb-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-aviso">
            Fuera de mi ruta
          </p>
          <p className="whitespace-pre-wrap break-words">{mensaje.texto}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md border border-linea bg-white px-3.5 py-2 text-sm text-tinta">
        <p data-testid="chat-mensaje-asistente" className="whitespace-pre-wrap break-words">
          {mensaje.texto}
        </p>
        {mensaje.tipo === 'calculo_tarifa' && onNuevaCotizacion && (
          <button
            type="button"
            onClick={onNuevaCotizacion}
            data-testid="chat-abrir-cotizacion"
            className="mt-2 rounded-lg bg-marca px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca"
          >
            Nueva cotización
          </button>
        )}
      </div>
    </div>
  )
}

export function ChatWidget({ demo = false, onNuevaCotizacion, onPantallaCompleta }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const chat = useChat()
  const panelId = useId()
  const lanzador = useRef<HTMLButtonElement>(null)
  const entrada = useRef<HTMLTextAreaElement>(null)
  const lista = useRef<HTMLDivElement>(null)

  const ancha = useEsPantallaAncha()
  const pantallaCompleta = abierto && !ancha

  // Al abrir, el foco va a la caja de texto; al cerrar, vuelve al botón. Se hace tras el render
  // porque en móvil el botón está oculto mientras el chat está abierto y no podría recibir foco antes.
  const huboApertura = useRef(false)
  useEffect(() => {
    if (abierto) {
      huboApertura.current = true
      entrada.current?.focus()
    } else if (huboApertura.current) {
      lanzador.current?.focus()
    }
  }, [abierto])

  // Avisa a la página para que deje inerte lo que queda tapado cuando el chat ocupa toda la pantalla.
  useEffect(() => {
    onPantallaCompleta?.(pantallaCompleta)
    return () => onPantallaCompleta?.(false)
  }, [pantallaCompleta, onPantallaCompleta])

  // Mantiene visible lo último de la conversación.
  useEffect(() => {
    const el = lista.current
    if (el) el.scrollTop = el.scrollHeight
  }, [chat.mensajes, chat.enviando, abierto])

  const bloqueada = chat.enviando || chat.espera > 0
  const ultimo = chat.mensajes.at(-1)
  const longitud = texto.length

  function cerrar() {
    setAbierto(false)
  }

  function enviar(contenido: string) {
    if (!contenido.trim() || bloqueada) return
    setTexto('')
    void chat.enviar(contenido)
    entrada.current?.focus()
  }

  function alEnviar(e: FormEvent) {
    e.preventDefault()
    enviar(texto)
  }

  function alPulsar(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envía; Shift+Enter hace salto de línea. No interferir con la composición (IME).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      enviar(texto)
    }
  }

  const placeholder =
    chat.espera > 0 ? `Podrás escribir de nuevo en ${chat.espera} s` : 'Escribe tu pregunta…'

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3">
      {abierto && (
        <section
          id={panelId}
          aria-label="Asistente de cotizaciones"
          data-testid="chat-panel"
          onKeyDown={(e) => {
            if (e.key === 'Escape') cerrar()
          }}
          // Móvil (<sm): pantalla completa. Escritorio: panel flotante sobre el botón.
          className="fixed inset-0 z-40 flex flex-col overflow-hidden bg-papel motion-safe:animate-panel-in sm:static sm:inset-auto sm:h-[min(34rem,calc(100dvh-6.5rem))] sm:w-96 sm:rounded-2xl sm:border sm:border-linea sm:shadow-xl"
        >
          <header className="flex items-center gap-3 border-b border-linea bg-tarjeta px-4 py-3">
            <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-marca text-white">
              <IconoChat />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-sm font-semibold leading-tight">Asistente de cotizaciones</h2>
              <p className="truncate text-xs text-tinta-suave">Estadísticas de lo ya registrado</p>
            </div>
            {chat.mensajes.length > 0 && (
              <button
                type="button"
                onClick={chat.limpiar}
                aria-label="Nueva conversación"
                title="Nueva conversación"
                data-testid="chat-limpiar"
                className="rounded-md p-2.5 text-tinta-suave hover:bg-linea/60 hover:text-tinta focus-visible:outline-2 focus-visible:outline-marca sm:p-1.5"
              >
                <IconoNuevo />
              </button>
            )}
            <button
              type="button"
              onClick={cerrar}
              aria-label="Cerrar asistente"
              data-testid="chat-cerrar"
              className="rounded-md p-2.5 text-tinta-suave hover:bg-linea/60 hover:text-tinta focus-visible:outline-2 focus-visible:outline-marca sm:p-1.5"
            >
              <IconoCerrar clase="size-5 sm:size-4" />
            </button>
          </header>

          {demo && (
            <p data-testid="chat-demo" className="border-b border-aviso/30 bg-aviso-fondo px-4 py-1.5 text-xs text-aviso">
              Modo demostración: respuestas de ejemplo, no son datos reales.
            </p>
          )}

          <div
            ref={lista}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversación"
            data-testid="chat-conversacion"
            className="flex-1 space-y-3 overflow-y-auto px-4 py-3"
          >
            <div className="flex">
              <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-linea bg-white px-3.5 py-2 text-sm">
                Hola 👋 Soy el asistente de FastExpress. Respondo preguntas estadísticas sobre las cotizaciones
                registradas.
              </p>
            </div>

            {chat.mensajes.length === 0 && (
              <div className="flex flex-wrap gap-2" data-testid="chat-ejemplos">
                {EJEMPLOS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => enviar(e)}
                    disabled={bloqueada}
                    className="rounded-full border border-linea bg-tarjeta px-3 py-1.5 text-left text-xs font-medium hover:border-marca hover:text-marca disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-marca"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            {chat.mensajes.map((m) => (
              <Burbuja
                key={m.id}
                mensaje={m}
                puedeReintentar={m.id === ultimo?.id && m.tipo === 'error'}
                bloqueado={bloqueada}
                onReintentar={chat.reintentar}
                onNuevaCotizacion={
                  onNuevaCotizacion
                    ? () => {
                        cerrar()
                        onNuevaCotizacion()
                      }
                    : undefined
                }
              />
            ))}

            {chat.enviando && <Escribiendo />}
          </div>

          <form onSubmit={alEnviar} className="border-t border-linea bg-tarjeta p-3">
            <div className="flex items-end gap-2">
              <label htmlFor={`${panelId}-entrada`} className="sr-only">
                Escribe tu pregunta
              </label>
              <textarea
                id={`${panelId}-entrada`}
                ref={entrada}
                rows={1}
                value={texto}
                maxLength={MAX_CARACTERES_MENSAJE}
                disabled={chat.espera > 0}
                placeholder={placeholder}
                data-testid="chat-entrada"
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={alPulsar}
                // 16 px en móvil: con menos, iOS hace zoom al enfocar el campo.
                className="field-sizing-content max-h-28 min-h-10 flex-1 resize-none rounded-lg border border-linea bg-white px-3 py-2 text-base outline-none focus:ring-2 focus:ring-marca disabled:opacity-60 sm:text-sm"
              />
              <button
                type="submit"
                disabled={bloqueada || texto.trim() === ''}
                aria-label="Enviar pregunta"
                data-testid="chat-enviar"
                className="grid size-10 shrink-0 place-items-center rounded-lg bg-marca text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca disabled:opacity-50"
              >
                <IconoEnviar />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.7rem] text-tinta-suave">
              <span>Solo respondo sobre estadísticas de cotizaciones.</span>
              {longitud >= AVISAR_DESDE && (
                <span
                  data-testid="chat-contador"
                  className={`tabular-nums ${longitud >= MAX_CARACTERES_MENSAJE ? 'font-semibold text-error' : ''}`}
                >
                  {longitud}/{MAX_CARACTERES_MENSAJE}
                </span>
              )}
            </div>
          </form>
        </section>
      )}

      <button
        ref={lanzador}
        type="button"
        onClick={() => (abierto ? cerrar() : setAbierto(true))}
        aria-expanded={abierto}
        aria-controls={abierto ? panelId : undefined}
        aria-label={abierto ? 'Cerrar asistente' : 'Abrir asistente de cotizaciones'}
        title={abierto ? 'Cerrar asistente' : 'Asistente de cotizaciones'}
        data-testid="chat-lanzador"
        // En móvil, con el chat abierto el botón desaparece: el panel ocupa toda la pantalla y se cierra con la X.
        className={`grid size-14 place-items-center rounded-full bg-marca text-white shadow-lg transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca ${
          abierto ? 'max-sm:hidden' : ''
        }`}
      >
        {abierto ? <IconoBajar /> : <IconoChat />}
      </button>
    </div>
  )
}
