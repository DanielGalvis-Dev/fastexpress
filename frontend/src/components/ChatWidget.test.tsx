import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ChatError } from '../api/chat.ts'
import { ChatWidget } from './ChatWidget.tsx'

const enviarMock = vi.hoisted(() => vi.fn())

vi.mock('../api/chat.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/chat.ts')>()),
  enviarMensaje: enviarMock,
}))

const respuesta = (tipo: string, texto: string) => ({ tipo, respuesta: texto })

async function abrir(props: Parameters<typeof ChatWidget>[0] = {}) {
  const user = userEvent.setup()
  render(<ChatWidget {...props} />)
  await user.click(screen.getByTestId('chat-lanzador'))
  return user
}

async function preguntar(user: ReturnType<typeof userEvent.setup>, texto: string) {
  await user.type(screen.getByTestId('chat-entrada'), texto)
  await user.keyboard('{Enter}')
}

describe('ChatWidget', () => {
  beforeEach(() => {
    enviarMock.mockReset()
  })

  it('arranca cerrado y se abre con el lanzador, con el foco en la caja de texto', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()

    const lanzador = screen.getByTestId('chat-lanzador')
    expect(lanzador).toHaveAttribute('aria-expanded', 'false')
    await user.click(lanzador)

    expect(screen.getByRole('region', { name: 'Asistente de cotizaciones' })).toBeInTheDocument()
    expect(lanzador).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('chat-entrada')).toHaveFocus()
  })

  it('se cierra con Escape y devuelve el foco al lanzador', async () => {
    const user = await abrir()
    await user.keyboard('{Escape}')
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-lanzador')).toHaveFocus()
  })

  it('conserva la conversación al cerrar y volver a abrir', async () => {
    enviarMock.mockResolvedValue(respuesta('estadistica', 'Hay 70.'))
    const user = await abrir()
    await preguntar(user, 'cuántas hay')
    await screen.findByText('Hay 70.')

    await user.click(screen.getByTestId('chat-cerrar'))
    await user.click(screen.getByTestId('chat-lanzador'))
    expect(screen.getByText('Hay 70.')).toBeInTheDocument()
  })

  it('muestra el aviso de modo demostración solo cuando se pide', async () => {
    const { unmount } = render(<ChatWidget demo />)
    await userEvent.click(screen.getByTestId('chat-lanzador'))
    expect(screen.getByTestId('chat-demo')).toHaveTextContent('no son datos reales')
    unmount()

    await abrir()
    expect(screen.queryByTestId('chat-demo')).not.toBeInTheDocument()
  })

  it('envía con Enter, muestra «escribiendo…» y luego la respuesta', async () => {
    let resolver: (v: unknown) => void = () => {}
    enviarMock.mockReturnValue(new Promise((r) => (resolver = r)))
    const user = await abrir()
    await preguntar(user, '¿Cuántas cotizaciones hay?')

    expect(screen.getByTestId('chat-mensaje-usuario')).toHaveTextContent('¿Cuántas cotizaciones hay?')
    expect(screen.getByTestId('chat-escribiendo')).toBeInTheDocument()
    expect(screen.getByTestId('chat-enviar')).toBeDisabled()
    expect(screen.getByTestId('chat-entrada')).toHaveValue('')

    await act(async () => resolver(respuesta('estadistica', 'Hay 70 cotizaciones.')))
    expect(await screen.findByTestId('chat-mensaje-asistente')).toHaveTextContent('Hay 70 cotizaciones.')
    expect(screen.queryByTestId('chat-escribiendo')).not.toBeInTheDocument()
  })

  it('el indicador «escribiendo…» se ajusta a su contenido y no ocupa todo el ancho', async () => {
    enviarMock.mockReturnValue(new Promise(() => {}))
    const user = await abrir()
    await preguntar(user, 'hola')

    expect(screen.getByTestId('chat-escribiendo')).toHaveClass('w-fit')
  })

  it('Shift+Enter no envía', async () => {
    const user = await abrir()
    await user.type(screen.getByTestId('chat-entrada'), 'línea 1{Shift>}{Enter}{/Shift}línea 2')
    expect(enviarMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('chat-entrada')).toHaveValue('línea 1\nlínea 2')
  })

  it('no envía mensajes vacíos', async () => {
    const user = await abrir()
    expect(screen.getByTestId('chat-enviar')).toBeDisabled()
    await user.type(screen.getByTestId('chat-entrada'), '   ')
    expect(screen.getByTestId('chat-enviar')).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(enviarMock).not.toHaveBeenCalled()
  })

  it('los ejemplos envían la pregunta y desaparecen al empezar', async () => {
    enviarMock.mockResolvedValue(respuesta('estadistica', 'ok'))
    const user = await abrir()
    await user.click(screen.getByRole('button', { name: '¿Qué tipo de cliente cotiza más?' }))

    expect(enviarMock).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: '¿Qué tipo de cliente cotiza más?', historial: [] }),
      expect.anything(),
    )
    await screen.findByTestId('chat-mensaje-asistente')
    expect(screen.queryByTestId('chat-ejemplos')).not.toBeInTheDocument()
  })

  it('el chiste de «fuera de contexto» tiene su propio estilo', async () => {
    enviarMock.mockResolvedValue(respuesta('fuera_de_contexto', 'Esa pregunta se perdió en el trayecto. 📦'))
    const user = await abrir()
    await preguntar(user, 'capital de francia')

    const chiste = await screen.findByTestId('chat-chiste')
    expect(chiste).toHaveTextContent('Fuera de mi ruta')
    expect(chiste).toHaveTextContent('se perdió en el trayecto')
  })

  it('en «calculo_tarifa» ofrece abrir Nueva cotización y cierra el chat', async () => {
    enviarMock.mockResolvedValue(respuesta('calculo_tarifa', 'Usa el botón “Nueva cotización”.'))
    const onNueva = vi.fn()
    const user = await abrir({ onNuevaCotizacion: onNueva })
    await preguntar(user, 'cuánto cuesta enviar 8 kg')

    await user.click(await screen.findByTestId('chat-abrir-cotizacion'))
    expect(onNueva).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('sin onNuevaCotizacion no muestra ese botón', async () => {
    enviarMock.mockResolvedValue(respuesta('calculo_tarifa', 'Usa el botón.'))
    const user = await abrir()
    await preguntar(user, 'cuánto cuesta')
    await screen.findByTestId('chat-mensaje-asistente')
    expect(screen.queryByTestId('chat-abrir-cotizacion')).not.toBeInTheDocument()
  })

  it('en un error muestra el mensaje y «Reintentar» repite sin duplicar la pregunta', async () => {
    enviarMock.mockRejectedValueOnce(new ChatError('El asistente no está disponible.', 'IA_NO_DISPONIBLE'))
    enviarMock.mockResolvedValueOnce(respuesta('estadistica', 'Ahora sí: 70.'))
    const user = await abrir()
    await preguntar(user, '¿cuántas hay?')

    expect(await screen.findByTestId('chat-error')).toHaveTextContent('no está disponible')
    await user.click(screen.getByTestId('chat-reintentar'))

    expect(await screen.findByText('Ahora sí: 70.')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-error')).not.toBeInTheDocument()
    expect(screen.getAllByTestId('chat-mensaje-usuario')).toHaveLength(1)
    expect(enviarMock).toHaveBeenCalledTimes(2)
    // El reintento no incluye la pregunta fallida en el historial.
    expect(enviarMock.mock.calls[1][0].historial).toEqual([])
  })

  it('un error inesperado muestra un mensaje genérico', async () => {
    enviarMock.mockRejectedValue(new Error('boom'))
    const user = await abrir()
    await preguntar(user, 'hola')
    expect(await screen.findByTestId('chat-error')).toHaveTextContent('No se pudo obtener respuesta')
  })

  it('envía los turnos previos como historial (máximo 6 mensajes)', async () => {
    enviarMock.mockImplementation(async ({ mensaje }: { mensaje: string }) => respuesta('estadistica', `r:${mensaje}`))
    const user = await abrir()
    for (const p of ['p1', 'p2', 'p3', 'p4']) {
      await preguntar(user, p)
      await screen.findByText(`r:${p}`)
    }

    const ultima = enviarMock.mock.calls.at(-1)![0]
    expect(ultima.mensaje).toBe('p4')
    expect(ultima.historial).toHaveLength(6)
    expect(ultima.historial[0]).toEqual({ rol: 'usuario', texto: 'p1' })
    expect(ultima.historial.at(-1)).toEqual({ rol: 'asistente', texto: 'r:p3' })
    expect(ultima.sesionId).toMatch(/\S{8,}/)
  })

  it('muestra el contador de caracteres al acercarse al límite de 500', async () => {
    await abrir()
    const entrada = screen.getByTestId('chat-entrada')
    expect(entrada).toHaveAttribute('maxLength', '500')
    expect(screen.queryByTestId('chat-contador')).not.toBeInTheDocument()

    fireEvent.change(entrada, { target: { value: 'a'.repeat(460) } })
    expect(screen.getByTestId('chat-contador')).toHaveTextContent('460/500')
  })

  it('«Nueva conversación» borra los mensajes', async () => {
    enviarMock.mockResolvedValue(respuesta('estadistica', 'Hay 70.'))
    const user = await abrir()
    expect(screen.queryByTestId('chat-limpiar')).not.toBeInTheDocument()
    await preguntar(user, 'cuántas')
    await screen.findByText('Hay 70.')

    await user.click(screen.getByTestId('chat-limpiar'))
    expect(screen.queryByText('Hay 70.')).not.toBeInTheDocument()
    expect(screen.getByTestId('chat-ejemplos')).toBeInTheDocument()
  })
})

describe('ChatWidget: pantalla completa en móvil', () => {
  const simularPantalla = (ancha: boolean) =>
    vi.stubGlobal('matchMedia', (consulta: string) => ({
      matches: ancha,
      media: consulta,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))

  beforeEach(() => {
    enviarMock.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('en móvil avisa que el chat ocupa toda la pantalla al abrir y deja de avisarlo al cerrar', async () => {
    simularPantalla(false)
    const onPantallaCompleta = vi.fn()
    const user = userEvent.setup()
    render(<ChatWidget onPantallaCompleta={onPantallaCompleta} />)
    expect(onPantallaCompleta).toHaveBeenLastCalledWith(false)

    await user.click(screen.getByTestId('chat-lanzador'))
    expect(onPantallaCompleta).toHaveBeenLastCalledWith(true)

    await user.click(screen.getByTestId('chat-cerrar'))
    expect(onPantallaCompleta).toHaveBeenLastCalledWith(false)
  })

  it('en escritorio nunca lo pide', async () => {
    simularPantalla(true)
    const onPantallaCompleta = vi.fn()
    const user = userEvent.setup()
    render(<ChatWidget onPantallaCompleta={onPantallaCompleta} />)
    await user.click(screen.getByTestId('chat-lanzador'))
    expect(onPantallaCompleta).not.toHaveBeenCalledWith(true)
  })

  it('el botón se oculta (solo en móvil) mientras el chat está abierto', async () => {
    const user = userEvent.setup()
    render(<ChatWidget />)
    const lanzador = screen.getByTestId('chat-lanzador')
    expect(lanzador).not.toHaveClass('max-sm:hidden')

    await user.click(lanzador)
    expect(lanzador).toHaveClass('max-sm:hidden')
    expect(screen.getByTestId('chat-panel')).toHaveClass('fixed', 'inset-0', 'sm:static')

    await user.click(screen.getByTestId('chat-cerrar'))
    expect(lanzador).not.toHaveClass('max-sm:hidden')
  })

  it('al cerrar con la X el foco vuelve al botón del asistente', async () => {
    simularPantalla(false)
    const user = userEvent.setup()
    render(<ChatWidget />)
    await user.click(screen.getByTestId('chat-lanzador'))
    await user.click(screen.getByTestId('chat-cerrar'))
    expect(screen.getByTestId('chat-lanzador')).toHaveFocus()
  })
})

describe('ChatWidget: límite de uso', () => {
  beforeEach(() => {
    enviarMock.mockReset()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('bloquea la escritura con cuenta regresiva y la libera al terminar', async () => {
    enviarMock.mockRejectedValue(new ChatError('Muchos mensajes.', 'LIMITE_EXCEDIDO', 3))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ChatWidget />)
    await user.click(screen.getByTestId('chat-lanzador'))
    await preguntar(user, 'hola')

    await screen.findByTestId('chat-error')
    const entrada = screen.getByTestId('chat-entrada')
    expect(entrada).toBeDisabled()
    expect(entrada).toHaveAttribute('placeholder', 'Podrás escribir de nuevo en 3 s')
    expect(screen.getByTestId('chat-reintentar')).toBeDisabled()

    // Un segundo por vez: cada tick necesita que React re-renderice antes de programar el siguiente.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(entrada).toHaveAttribute('placeholder', 'Podrás escribir de nuevo en 2 s')

    for (let i = 0; i < 2; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000)
      })
    }
    await waitFor(() => expect(entrada).toBeEnabled())
    expect(screen.getByTestId('chat-reintentar')).toBeEnabled()
  })
})
