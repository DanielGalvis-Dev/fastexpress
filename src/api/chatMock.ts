import { ChatError } from './chat.ts'
import type { RespuestaChat, SolicitudChat } from './chat.ts'

/**
 * Respuestas de DEMOSTRACIÓN que respetan el contrato del asistente. No usan datos reales:
 * las cifras son de ejemplo. Solo se carga con VITE_CHAT=mock.
 *
 * Para probar los estados del diseño, escribe en el chat:
 *   /limite  → error de límite de uso con cuenta regresiva
 *   /error   → asistente no disponible (con «Reintentar»)
 */

const CHISTES = [
  'De paquetes sé mucho, pero esa pregunta se perdió en el trayecto. 📦 Yo solo hablo de cotizaciones.',
  'Mi radio de acción es de 20 kg, y esa pregunta lo excede. Pregúntame por las cotizaciones. 😄',
  'Eso está fuera de mi ruta de entrega. Mi especialidad: estadísticas de cotizaciones. 🚚',
  'Intenté responderte, pero esa pregunta quedó “en tránsito”. Pregúntame sobre tus cotizaciones. 📍',
  'Soy rápido como un envío Express, pero solo para datos de cotizaciones. Esa no me la sé. ⚡',
  'Cobro el 25 % de recargo por contestar temas que no son cotizaciones… y aun así no sabría responder. 😅',
  'Esa pregunta es como un paquete de 21 kg: la rechazo. Con cotizaciones sí te ayudo. 🙃',
  'No tengo cobertura para esa zona. Mi territorio son las estadísticas de FastExpress. 🗺️',
]

const SALUDO =
  'Hola 👋 Soy el asistente de FastExpress. Puedo contarte datos de las cotizaciones registradas. Prueba con: “¿Cuántas cotizaciones hay?” o “¿Qué tipo de cliente cotiza más?”.'

const TARIFA =
  'Para calcular una tarifa usa el botón “Nueva cotización”. Yo solo analizo las cotizaciones ya registradas.'

const ESTADISTICA =
  'Dato de demostración: hay 70 cotizaciones registradas, 62 exitosas y 8 rechazadas (11,4 %). Los ingresos suman $2.845,70 y el ticket promedio es de $45,90.'

let ultimoChiste = -1

function elegirChiste(): string {
  let i = Math.floor(Math.random() * CHISTES.length)
  if (i === ultimoChiste) i = (i + 1) % CHISTES.length
  ultimoChiste = i
  return CHISTES[i]
}

function esperar(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolver, rechazar) => {
    if (signal?.aborted) return rechazar(new DOMException('Cancelado', 'AbortError'))
    const t = setTimeout(resolver, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        rechazar(new DOMException('Cancelado', 'AbortError'))
      },
      { once: true },
    )
  })
}

export async function responderMock(
  { mensaje }: SolicitudChat,
  signal?: AbortSignal,
): Promise<RespuestaChat> {
  await esperar(700 + Math.random() * 700, signal)
  const texto = mensaje.trim()

  if (/^\/limite/i.test(texto)) {
    throw new ChatError('Estás enviando muchos mensajes. Intenta de nuevo en unos segundos.', 'LIMITE_EXCEDIDO', 12)
  }
  if (/^\/error/i.test(texto)) {
    throw new ChatError('El asistente no está disponible en este momento. Inténtalo de nuevo.', 'IA_NO_DISPONIBLE')
  }
  if (/^(hola|buen[oa]s|hey|qu[eé] puedes)/i.test(texto)) {
    return { tipo: 'saludo', respuesta: SALUDO }
  }
  if (/(cu[aá]nto (cuesta|costar[ií]a|saldr[ií]a)|precio de enviar|calcula(r)? (la )?tarifa)/i.test(texto)) {
    return { tipo: 'calculo_tarifa', respuesta: TARIFA }
  }
  if (/(cotizaci|factur|ingres|promedio|cliente|vip|frecuente|express|est[aá]ndar|rechaz|peso|d[ií]a|semana|hoy|total)/i.test(texto)) {
    return { tipo: 'estadistica', respuesta: ESTADISTICA }
  }
  return { tipo: 'fuera_de_contexto', respuesta: elegirChiste() }
}
