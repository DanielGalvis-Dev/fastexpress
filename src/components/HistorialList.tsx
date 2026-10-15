import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../api/cotizar.ts'
import { listarHistorial } from '../api/historial.ts'
import { avisar } from '../lib/alertas.ts'
import { filtrarRegistros } from '../lib/busqueda.ts'
import {
  ETIQUETA_CLIENTE,
  ETIQUETA_ENVIO,
  ETIQUETA_ESTADO,
  fechaCorta,
  horaCorta,
  moneda,
} from '../lib/formato.ts'
import { useEsPantallaAncha, useFilasPorPagina } from '../lib/useFilasPorPagina.ts'
import type { RegistroHistorial } from '../types.ts'

// Alturas fijas (px) para calcular cuántas filas caben sin scroll. Deben coincidir con las clases h-*.
const ALTO_FILA_ANCHA = 48 // h-12
const ALTO_FILA_ESTRECHA = 64 // h-16
const ALTO_CABECERA = 40 // h-10

type Estado =
  | { fase: 'cargando' }
  | { fase: 'ok'; registros: RegistroHistorial[] }
  | { fase: 'error'; mensaje: string }

interface Props {
  /** Cambiar este valor vuelve a consultar el historial en silencio (p. ej. tras una cotización). */
  version?: number
  /** Cambiar este valor consulta de nuevo y, al terminar, avisa cuántas cotizaciones nuevas hay. */
  refrescoManual?: number
  /** Se llama con `false` cuando termina una consulta (con éxito o con error). */
  onTerminoCarga?: () => void
}

const claveRegistro = (r: RegistroHistorial) =>
  `${r.fechaHora}|${r.peso}|${r.tipoCliente}|${r.tipoEnvio}|${r.totalUSD}|${r.estado}`

const botonPaginar =
  'rounded-lg border border-linea bg-tarjeta px-2.5 py-1.5 text-sm sm:px-3 font-medium hover:border-marca hover:text-marca disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-linea disabled:hover:text-inherit focus-visible:outline-2 focus-visible:outline-marca'

export function HistorialList({ version = 0, refrescoManual = 0, onTerminoCarga }: Props) {
  const [estado, setEstado] = useState<Estado>({ fase: 'cargando' })
  const [consulta, setConsulta] = useState('')
  const [pagina, setPagina] = useState(1)

  const contenedor = useRef<HTMLDivElement>(null)
  const ancha = useEsPantallaAncha()
  const altoFila = ancha ? ALTO_FILA_ANCHA : ALTO_FILA_ESTRECHA
  const filasPorPagina = useFilasPorPagina(contenedor, altoFila, ALTO_CABECERA)

  // Claves de lo que ya se mostró, para contar cuántas son nuevas al pulsar «Actualizar».
  const conocidas = useRef<Set<string> | null>(null)
  const avisarNuevas = useRef(false)
  const ultimoManual = useRef(refrescoManual)

  useEffect(() => {
    if (refrescoManual !== ultimoManual.current) {
      ultimoManual.current = refrescoManual
      avisarNuevas.current = true
    }
    const control = new AbortController()
    // Al refrescar se conservan los datos anteriores hasta que llegue la respuesta nueva.
    listarHistorial(control.signal)
      .then((registros) => {
        const claves = registros.map(claveRegistro)
        if (avisarNuevas.current && conocidas.current) {
          const nuevas = claves.filter((c) => !conocidas.current!.has(c)).length
          if (nuevas > 0) {
            avisar('success', nuevas === 1 ? '1 cotización nueva' : `${nuevas} cotizaciones nuevas`)
          } else {
            avisar('info', 'No hay cotizaciones nuevas')
          }
        }
        avisarNuevas.current = false
        conocidas.current = new Set(claves)
        setEstado({ fase: 'ok', registros })
        onTerminoCarga?.()
      })
      .catch((error: unknown) => {
        if (control.signal.aborted) return
        avisarNuevas.current = false
        setEstado({
          fase: 'error',
          mensaje: error instanceof ApiError ? error.message : 'No se pudo cargar el historial.',
        })
        onTerminoCarga?.()
      })
    return () => control.abort()
  }, [version, refrescoManual, onTerminoCarga])

  const registros = useMemo(() => (estado.fase === 'ok' ? estado.registros : []), [estado])
  const filtrados = useMemo(() => filtrarRegistros(registros, consulta), [registros, consulta])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / filasPorPagina))
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicio = (paginaActual - 1) * filasPorPagina
  const visibles = filtrados.slice(inicio, inicio + filasPorPagina)

  const hayConsulta = consulta.trim() !== ''

  return (
    <section aria-label="Cotizaciones realizadas" className="flex min-h-0 flex-1 flex-col gap-3" data-testid="historial">
      <div>
        <div className="relative">
          <label htmlFor="busqueda" className="sr-only">
            Buscar cotizaciones
          </label>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta-suave"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="9" cy="9" r="6" />
            <path d="M14 14l4 4" />
          </svg>
          <input
            id="busqueda"
            type="search"
            value={consulta}
            disabled={estado.fase !== 'ok'}
            placeholder="Buscar cotizaciones…"
            data-testid="historial-busqueda"
            onChange={(e) => {
              setConsulta(e.target.value)
              setPagina(1)
            }}
            // 16 px en móvil: con menos, iOS hace zoom al enfocar el campo.
            className="block w-full rounded-lg border border-linea bg-white py-2 pl-9 pr-3 text-base shadow-sm outline-none focus:ring-2 focus:ring-marca disabled:opacity-60 sm:text-sm"
          />
        </div>
      </div>

      {/* Contenedor medido: define cuántas filas caben. No tiene scroll propio. */}
      <div
        ref={contenedor}
        aria-live="polite"
        className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-linea bg-tarjeta"
      >
        {estado.fase === 'cargando' && (
          <p data-testid="historial-cargando" className="p-6 text-sm text-tinta-suave">
            Cargando cotizaciones…
          </p>
        )}

        {estado.fase === 'error' && (
          <p
            role="alert"
            data-testid="historial-error"
            className="m-4 rounded-lg border border-error bg-error-fondo p-4 text-sm font-medium text-error"
          >
            {estado.mensaje}
          </p>
        )}

        {estado.fase === 'ok' && registros.length === 0 && (
          <p data-testid="historial-vacio" className="p-6 text-sm text-tinta-suave">
            Aún no hay cotizaciones registradas. Crea la primera con «Nueva cotización».
          </p>
        )}

        {estado.fase === 'ok' && registros.length > 0 && filtrados.length === 0 && (
          <p data-testid="historial-sin-resultados" className="p-6 text-sm text-tinta-suave">
            Ninguna cotización coincide con «{consulta.trim()}».
          </p>
        )}

        {visibles.length > 0 && (
          <table className="w-full table-fixed text-left text-sm" data-testid="historial-tabla">
            <caption className="sr-only">
              Cotizaciones realizadas, de la más reciente a la más antigua
            </caption>
            <thead className="h-10 border-b border-linea text-xs uppercase tracking-wide text-tinta-suave">
              <tr>
                <th scope="col" className="w-[26%] px-2 font-semibold sm:w-[22%] sm:px-4">Fecha</th>
                <th scope="col" className="w-[24%] px-2 text-right font-semibold sm:w-[12%]">Peso</th>
                <th scope="col" className="hidden px-4 font-semibold sm:table-cell sm:w-[16%]">Cliente</th>
                <th scope="col" className="hidden px-4 font-semibold sm:table-cell sm:w-[16%]">Envío</th>
                <th scope="col" className="w-[22%] px-2 text-right font-semibold sm:w-[14%]">Total</th>
                <th scope="col" className="px-1.5 font-semibold sm:px-4">Estado</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((r) => {
                const f = new Date(r.fechaHora)
                const exitoso = r.estado === 'EXITOSO'
                return (
                  <tr
                    key={`${r.fechaHora}-${r.peso}-${r.totalUSD}`}
                    data-testid="historial-fila"
                    className="h-16 border-b border-linea last:border-b-0 sm:h-12"
                  >
                    <td className="px-2 sm:px-4">
                      <span className="block sm:inline">{fechaCorta.format(f)}</span>
                      <span className="block text-xs text-tinta-suave sm:ml-1.5 sm:inline">
                        {horaCorta.format(f)}
                      </span>
                    </td>
                    <td className="truncate px-2 text-right tabular-nums">
                      {r.peso} kg
                      {/* Solo en pantallas angostas: cliente y envío en dos líneas cortas bajo el peso. */}
                      <span className="block truncate text-xs leading-4 text-tinta-suave sm:hidden">
                        {ETIQUETA_CLIENTE[r.tipoCliente]}
                      </span>
                      <span className="block truncate text-xs leading-4 text-tinta-suave sm:hidden">
                        {ETIQUETA_ENVIO[r.tipoEnvio]}
                      </span>
                    </td>
                    <td className="hidden truncate px-4 sm:table-cell">{ETIQUETA_CLIENTE[r.tipoCliente]}</td>
                    <td className="hidden truncate px-4 sm:table-cell">{ETIQUETA_ENVIO[r.tipoEnvio]}</td>
                    <td className="px-2 text-right tabular-nums">{exitoso ? moneda.format(r.totalUSD) : '—'}</td>
                    <td className="px-1.5 sm:px-4">
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold sm:px-2 sm:text-xs ${
                          exitoso ? 'bg-ok/10 text-ok' : 'bg-error-fondo text-error'
                        }`}
                      >
                        {ETIQUETA_ESTADO[r.estado]}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {estado.fase === 'ok' && filtrados.length > 0 && (
        // pr-[4.5rem]: deja libre la esquina donde flota el botón del asistente (56 px + margen);
        // solo hace falta cuando la ventana es más angosta que el contenido (max-w-5xl + márgenes).
        <nav aria-label="Paginación" className="flex items-center justify-between gap-3 pr-[4.5rem] text-sm text-tinta-suave min-[1180px]:pr-0">
          <span data-testid="historial-conteo" className="min-w-0 truncate">
            {inicio + 1}–{inicio + visibles.length} de {filtrados.length}
            {hayConsulta && filtrados.length !== registros.length && ` (${registros.length} en total)`}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {/* En pantallas angostas los botones son solo flechas; el nombre accesible no cambia. */}
            <button
              type="button"
              onClick={() => setPagina(paginaActual - 1)}
              disabled={paginaActual <= 1}
              aria-label="Página anterior"
              data-testid="historial-anterior"
              className={botonPaginar}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5l-5 5 5 5" />
              </svg>
              <span className="hidden sm:inline">Anterior</span>
            </button>
            <span data-testid="historial-pagina" className="whitespace-nowrap tabular-nums">
              {paginaActual} / {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina(paginaActual + 1)}
              disabled={paginaActual >= totalPaginas}
              aria-label="Página siguiente"
              data-testid="historial-siguiente"
              className={botonPaginar}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 5l5 5-5 5" />
              </svg>
              <span className="hidden sm:inline">Siguiente</span>
            </button>
          </div>
        </nav>
      )}
    </section>
  )
}
