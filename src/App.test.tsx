import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'

const { listarMock, cotizarMock, confirmarMock, avisarMock } = vi.hoisted(() => ({
  listarMock: vi.fn(),
  cotizarMock: vi.fn(),
  confirmarMock: vi.fn(),
  avisarMock: vi.fn(),
}))

vi.mock('./api/historial.ts', () => ({ listarHistorial: listarMock }))
vi.mock('./api/cotizar.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api/cotizar.ts')>()),
  cotizar: cotizarMock,
}))
vi.mock('./lib/alertas.ts', () => ({
  confirmar: confirmarMock,
  avisar: avisarMock,
  hayConfirmacionAbierta: () => false,
}))

describe('App', () => {
  beforeEach(() => {
    listarMock.mockReset()
    cotizarMock.mockReset()
    confirmarMock.mockReset()
    avisarMock.mockReset()
    confirmarMock.mockResolvedValue(true)
    listarMock.mockResolvedValue([])
  })

  describe('botón «Actualizar» (ícono en la cabecera)', () => {
    const registro = (i: number) => ({
      fechaHora: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
      peso: i + 1,
      tipoCliente: 'NUEVO',
      tipoEnvio: 'ESTANDAR',
      totalUSD: 10 + i,
      estado: 'EXITOSO',
    })

    it('es un botón de ícono con nombre accesible, junto a «Nueva cotización»', async () => {
      render(<App />)
      await screen.findByTestId('historial-vacio')

      const boton = screen.getByRole('button', { name: 'Actualizar cotizaciones' })
      expect(boton).toHaveAttribute('title', 'Actualizar cotizaciones')
      expect(boton).toHaveTextContent('') // solo ícono, sin texto visible
      expect(boton.querySelector('svg')).not.toBeNull()
      expect(boton.parentElement).toContainElement(screen.getByTestId('nueva-cotizacion-btn'))
    })

    it('al pulsarlo consulta de nuevo, gira y se deshabilita mientras espera', async () => {
      let resolver: (v: unknown[]) => void = () => {}
      listarMock.mockResolvedValueOnce([registro(1)])
      listarMock.mockReturnValueOnce(new Promise((r) => (resolver = r)))
      const user = userEvent.setup()
      render(<App />)
      await screen.findAllByTestId('historial-fila')

      const boton = screen.getByTestId('historial-actualizar')
      expect(boton).toBeEnabled()
      await user.click(boton)

      expect(boton).toBeDisabled()
      expect(boton.querySelector('svg')).toHaveClass('motion-safe:animate-spin')
      expect(listarMock).toHaveBeenCalledTimes(2)

      resolver([registro(1), registro(2)])
      await waitFor(() => expect(boton).toBeEnabled())
      expect(boton.querySelector('svg')).not.toHaveClass('motion-safe:animate-spin')
      expect(avisarMock).toHaveBeenCalledWith('success', '1 cotización nueva')
    })

    it('avisa cuando no hay cotizaciones nuevas', async () => {
      listarMock.mockResolvedValue([registro(1)])
      const user = userEvent.setup()
      render(<App />)
      await screen.findAllByTestId('historial-fila')

      await user.click(screen.getByTestId('historial-actualizar'))
      await waitFor(() => expect(avisarMock).toHaveBeenCalledWith('info', 'No hay cotizaciones nuevas'))
      await waitFor(() => expect(screen.getByTestId('historial-actualizar')).toBeEnabled())
    })

    it('si la consulta falla, el botón se vuelve a habilitar', async () => {
      listarMock.mockResolvedValueOnce([registro(1)])
      listarMock.mockRejectedValueOnce(new Error('sin red'))
      const user = userEvent.setup()
      render(<App />)
      await screen.findAllByTestId('historial-fila')

      await user.click(screen.getByTestId('historial-actualizar'))
      await screen.findByTestId('historial-error')
      expect(screen.getByTestId('historial-actualizar')).toBeEnabled()
    })

    it('«Nueva cotización» conserva su nombre accesible completo aunque en móvil diga «Nueva»', async () => {
      render(<App />)
      await screen.findByTestId('historial-vacio')
      expect(screen.getByRole('button', { name: 'Nueva cotización' })).toBe(screen.getByTestId('nueva-cotizacion-btn'))
    })
  })

  describe('asistente de IA (VITE_CHAT)', () => {
    afterEach(() => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    })

    it('en móvil, con el chat a pantalla completa, la lista de debajo queda inerte', async () => {
      vi.stubEnv('VITE_CHAT', 'mock')
      vi.stubGlobal('matchMedia', (q: string) => ({
        matches: false,
        media: q,
        addEventListener: () => {},
        removeEventListener: () => {},
      }))
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')
      const principal = screen.getByRole('main')
      expect(principal).not.toHaveAttribute('inert')

      await user.click(screen.getByTestId('chat-lanzador'))
      expect(principal).toHaveAttribute('inert')

      await user.click(screen.getByTestId('chat-cerrar'))
      expect(principal).not.toHaveAttribute('inert')
    })

    it('en escritorio el chat flotante no deja inerte la lista', async () => {
      vi.stubEnv('VITE_CHAT', 'mock')
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')

      await user.click(screen.getByTestId('chat-lanzador'))
      expect(screen.getByRole('main')).not.toHaveAttribute('inert')
    })

    it('no se muestra si VITE_CHAT está vacío', async () => {
      vi.stubEnv('VITE_CHAT', '')
      render(<App />)
      await screen.findByTestId('historial-vacio')
      expect(screen.queryByTestId('chat-lanzador')).not.toBeInTheDocument()
    })

    it('en modo mock se muestra con el aviso de demostración', async () => {
      vi.stubEnv('VITE_CHAT', 'mock')
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')

      await user.click(screen.getByTestId('chat-lanzador'))
      expect(screen.getByTestId('chat-demo')).toBeInTheDocument()
    })

    it('queda inerte mientras el modal de cotización está abierto', async () => {
      vi.stubEnv('VITE_CHAT', 'mock')
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')
      expect(screen.getByTestId('chat-lanzador').closest('[inert]')).toBeNull()

      await user.click(screen.getByTestId('nueva-cotizacion-btn'))
      expect(screen.getByTestId('chat-lanzador').closest('[inert]')).not.toBeNull()
    })

    it('el botón «Nueva cotización» del chat cierra el panel y abre el modal', async () => {
      vi.stubEnv('VITE_CHAT', 'mock')
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')

      await user.click(screen.getByTestId('chat-lanzador'))
      await user.type(screen.getByTestId('chat-entrada'), 'cuanto cuesta enviar 8 kg{Enter}')
      // El mock de demostración tarda entre 0,7 y 1,4 s en responder.
      await user.click(await screen.findByTestId('chat-abrir-cotizacion', {}, { timeout: 4000 }))

      expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
      expect(screen.getByRole('dialog', { name: 'Nueva cotización' })).toBeInTheDocument()
    })
  })

  describe('cierre del modal con datos ingresados', () => {
    async function abrirConDatos() {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')
      await user.click(screen.getByTestId('nueva-cotizacion-btn'))
      await user.type(screen.getByTestId('peso-input'), '5')
      return user
    }

    it('empezar a arrastrar dentro del panel y soltar fuera no cierra el modal', async () => {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')
      await user.click(screen.getByTestId('nueva-cotizacion-btn'))

      fireEvent.mouseDown(screen.getByTestId('peso-input'))
      fireEvent.click(screen.getByTestId('modal-fondo'))

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('sin datos cierra directo, sin preguntar', async () => {
      const user = userEvent.setup()
      render(<App />)
      await screen.findByTestId('historial-vacio')
      await user.click(screen.getByTestId('nueva-cotizacion-btn'))
      await user.click(screen.getByTestId('modal-fondo'))

      expect(confirmarMock).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('clic fuera con datos pide confirmación y, si se cancela, el modal sigue abierto', async () => {
      confirmarMock.mockResolvedValue(false)
      const user = await abrirConDatos()
      await user.click(screen.getByTestId('modal-fondo'))

      await waitFor(() => expect(confirmarMock).toHaveBeenCalledTimes(1))
      expect(confirmarMock).toHaveBeenCalledWith(
        expect.objectContaining({ titulo: '¿Cerrar el formulario?', icono: 'warning' }),
      )
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByTestId('peso-input')).toHaveValue('5')
    })

    it('si se confirma, cierra y al reabrir el formulario está limpio', async () => {
      const user = await abrirConDatos()
      await user.click(screen.getByTestId('modal-fondo'))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

      await user.click(screen.getByTestId('nueva-cotizacion-btn'))
      expect(screen.getByTestId('peso-input')).toHaveValue('')
      // Reabierto y vacío: cerrar de nuevo no vuelve a preguntar.
      confirmarMock.mockClear()
      await user.click(screen.getByTestId('modal-cerrar'))
      expect(confirmarMock).not.toHaveBeenCalled()
    })

    it('la X y Escape también piden confirmación', async () => {
      confirmarMock.mockResolvedValue(false)
      const user = await abrirConDatos()

      await user.click(screen.getByTestId('modal-cerrar'))
      await waitFor(() => expect(confirmarMock).toHaveBeenCalledTimes(1))
      await user.keyboard('{Escape}')
      await waitFor(() => expect(confirmarMock).toHaveBeenCalledTimes(2))
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('tras cotizar, cerrar ya no pregunta', async () => {
      cotizarMock.mockResolvedValue({ total: 13.5 })
      const user = await abrirConDatos()
      await user.selectOptions(screen.getByTestId('cliente-select'), 'FRECUENTE')
      await user.click(screen.getByTestId('envio-estandar'))
      await user.click(screen.getByTestId('cotizar-btn'))
      await screen.findByTestId('resultado')

      confirmarMock.mockClear()
      await user.click(screen.getByTestId('modal-fondo'))
      expect(confirmarMock).not.toHaveBeenCalled()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('muestra la lista como vista principal y el formulario solo en el modal', async () => {
    render(<App />)

    expect(await screen.findByTestId('historial-vacio')).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByTestId('peso-input')).not.toBeInTheDocument()
  })

  it('abre el modal con el botón y lo cierra con Escape, devolviendo el foco', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('historial-vacio')

    const boton = screen.getByTestId('nueva-cotizacion-btn')
    await user.click(boton)
    expect(screen.getByRole('dialog', { name: 'Nueva cotización' })).toBeInTheDocument()
    expect(screen.getByTestId('peso-input')).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(boton).toHaveFocus()
  })

  it('cierra con la X y con clic en el fondo', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('historial-vacio')

    await user.click(screen.getByTestId('nueva-cotizacion-btn'))
    await user.click(screen.getByTestId('modal-cerrar'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByTestId('nueva-cotizacion-btn'))
    await user.click(screen.getByTestId('modal-fondo'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('tras cotizar muestra el resultado, refresca la lista y permite cerrar', async () => {
    cotizarMock.mockResolvedValue({ total: 13.5, desglose: { tarifaBase: 5 } })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('historial-vacio')

    await user.click(screen.getByTestId('nueva-cotizacion-btn'))
    await user.type(screen.getByTestId('peso-input'), '5')
    await user.selectOptions(screen.getByTestId('cliente-select'), 'FRECUENTE')
    await user.click(screen.getByTestId('envio-estandar'))
    await user.click(screen.getByTestId('cotizar-btn'))

    expect(await screen.findByTestId('resultado-total')).toHaveTextContent('13,50')
    expect(screen.queryByTestId('peso-input')).not.toBeInTheDocument()
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2))

    await user.click(screen.getByTestId('resultado-cerrar-btn'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('«Cotizar otro envío» vuelve a un formulario limpio', async () => {
    cotizarMock.mockResolvedValue({ total: 7 })
    const user = userEvent.setup()
    render(<App />)
    await screen.findByTestId('historial-vacio')

    await user.click(screen.getByTestId('nueva-cotizacion-btn'))
    await user.type(screen.getByTestId('peso-input'), '1')
    await user.selectOptions(screen.getByTestId('cliente-select'), 'NUEVO')
    await user.click(screen.getByTestId('envio-estandar'))
    await user.click(screen.getByTestId('cotizar-btn'))
    await user.click(await screen.findByTestId('otra-cotizacion-btn'))

    expect(screen.getByTestId('peso-input')).toHaveValue('')
  })
})
