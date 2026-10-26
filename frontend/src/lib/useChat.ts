import { useEffect, useRef, useState } from 'react'
import { ChatError, MAX_CARACTERES_MENSAJE, MAX_TURNOS_HISTORIAL, enviarMensaje } from '../api/chat.ts'
import type { TipoRespuestaChat, TurnoChat } from '../api/chat.ts'

export interface MensajeChat {
  id: number
  rol: 'usuario' | 'asistente'
  texto: string
  /** Tipo de respuesta del asistente, o `error` si no se pudo obtener. */
  tipo?: TipoRespuestaChat | 'error'
}

/**
 * Historial que se envía al Backend: los últimos turnos completos. Un mensaje del usuario sin
 * respuesta (porque falló) se omite, y los errores nunca se incluyen, para que los roles alternen.
 */
export function construirHistorial(mensajes: MensajeChat[]): TurnoChat[] {
  const turnos: TurnoChat[] = []
  for (let i = 0; i < mensajes.length; i++) {
    const m = mensajes[i]
    if (m.rol === 'usuario') {
      const siguiente = mensajes[i + 1]
      if (siguiente && siguiente.rol === 'asistente' && siguiente.tipo !== 'error') {
        turnos.push({ rol: 'usuario', texto: m.texto }, { rol: 'asistente', texto: siguiente.texto })
        i++
      }
    }
  }
  return turnos.slice(-MAX_TURNOS_HISTORIAL)
}

const CLAVE_SESION = 'fastexpress.chat.sesionId'

/** Identificador anónimo por pestaña; solo sirve al Backend para limitar el uso. */
export function obtenerSesionId(): string {
  try {
    const guardado = sessionStorage.getItem(CLAVE_SESION)
    if (guardado) return guardado
    const nuevo = crypto.randomUUID()
    sessionStorage.setItem(CLAVE_SESION, nuevo)
    return nuevo
  } catch {
    return crypto.randomUUID()
  }
}

export function useChat() {
  const [mensajes, setMensajes] = useState<MensajeChat[]>([])
  const [enviando, setEnviando] = useState(false)
  const [espera, setEspera] = useState(0) // segundos de bloqueo por límite de uso
  const sesionId = useRef<string | null>(null)
  const control = useRef<AbortController | null>(null)
  const siguienteId = useRef(1)

  useEffect(() => () => control.current?.abort(), [])

  useEffect(() => {
    if (espera <= 0) return
    const t = setTimeout(() => setEspera((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [espera])

  /** `reintento`: repite el último mensaje del usuario sin duplicarlo en pantalla. */
  async function enviar(texto: string, reintento = false) {
    const limpio = texto.trim()
    if (!limpio || limpio.length > MAX_CARACTERES_MENSAJE || enviando || espera > 0) return

    const sinErrores = mensajes.filter((m) => m.tipo !== 'error')
    const previos = reintento && sinErrores.at(-1)?.rol === 'usuario' ? sinErrores.slice(0, -1) : sinErrores
    const historial = construirHistorial(previos)

    setMensajes(
      reintento
        ? sinErrores
        : [...sinErrores, { id: siguienteId.current++, rol: 'usuario', texto: limpio }],
    )
    setEnviando(true)

    control.current?.abort()
    const actual = new AbortController()
    control.current = actual
    sesionId.current ??= obtenerSesionId()

    try {
      const r = await enviarMensaje({ sesionId: sesionId.current, mensaje: limpio, historial }, actual.signal)
      setMensajes((m) => [...m, { id: siguienteId.current++, rol: 'asistente', texto: r.respuesta, tipo: r.tipo }])
    } catch (error) {
      if (actual.signal.aborted) return
      const chatError = error instanceof ChatError ? error : null
      setMensajes((m) => [
        ...m,
        {
          id: siguienteId.current++,
          rol: 'asistente',
          texto: chatError?.message ?? 'No se pudo obtener respuesta. Inténtalo de nuevo.',
          tipo: 'error',
        },
      ])
      if (chatError?.reintentarEnSeg) setEspera(Math.ceil(chatError.reintentarEnSeg))
    } finally {
      if (control.current === actual) setEnviando(false)
    }
  }

  /** Repite el último mensaje del usuario (tras un error). */
  function reintentar() {
    const ultimo = mensajes.filter((m) => m.tipo !== 'error').at(-1)
    if (ultimo?.rol === 'usuario') void enviar(ultimo.texto, true)
  }

  function limpiar() {
    control.current?.abort()
    setMensajes([])
    setEnviando(false)
    setEspera(0)
  }

  return { mensajes, enviando, espera, enviar, reintentar, limpiar }
}
