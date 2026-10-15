import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/cotizar.ts'
import type { RegistroHistorial } from '../types.ts'
import { HistorialList } from './HistorialList.tsx'

const { listarMock, avisarMock } = vi.hoisted(() => ({ listarMock: vi.fn(), avisarMock: vi.fn() }))

vi.mock('../api/historial.ts', () => ({ listarHistorial: listarMock }))
vi.mock('../lib/alertas.ts', () => ({ avisar: avisarMock }))

const registro = (i: number, extra: Partial<RegistroHistorial> = {}): RegistroHistorial => ({
  fechaHora: new Date(Date.UTC(2026, 9, 1, 0, i)).toISOString(),
  peso: i + 1,
  tipoCliente: 'NUEVO',
  tipoEnvio: 'ESTANDAR',
  totalUSD: 10 + i,
  estado: 'EXITOSO',
  ...extra,
})

// Sin ResizeObserver (jsdom) la lista usa 8 filas por página.
const FILAS = 8

describe('HistorialList', () => {
  beforeEach(() => {
    listarMock.mockReset()
    avisarMock.mockReset()
  })

  // El botón «Actualizar» vive en la cabecera de App: aquí se simula subiendo `refrescoManual`.

  it('al actualizar avisa cuántas cotizaciones nuevas hay', async () => {
    listarMock.mockResolvedValueOnce([registro(1), registro(2)])
    listarMock.mockResolvedValueOnce([registro(1), registro(2), registro(3), registro(4)])
    const { rerender } = render(<HistorialList refrescoManual={0} />)
    await screen.findAllByTestId('historial-fila')
    expect(avisarMock).not.toHaveBeenCalled() // la carga inicial no avisa

    rerender(<HistorialList refrescoManual={1} />)
    await waitFor(() => expect(avisarMock).toHaveBeenCalledWith('success', '2 cotizaciones nuevas'))
  })

  it('al actualizar usa el singular con una sola nueva', async () => {
    listarMock.mockResolvedValueOnce([registro(1)])
    listarMock.mockResolvedValueOnce([registro(1), registro(2)])
    const { rerender } = render(<HistorialList refrescoManual={0} />)
    await screen.findAllByTestId('historial-fila')

    rerender(<HistorialList refrescoManual={1} />)
    await waitFor(() => expect(avisarMock).toHaveBeenCalledWith('success', '1 cotización nueva'))
  })

  it('al actualizar avisa si no hay cotizaciones nuevas', async () => {
    listarMock.mockResolvedValue([registro(1), registro(2)])
    const { rerender } = render(<HistorialList refrescoManual={0} />)
    await screen.findAllByTestId('historial-fila')

    rerender(<HistorialList refrescoManual={1} />)
    await waitFor(() => expect(avisarMock).toHaveBeenCalledWith('info', 'No hay cotizaciones nuevas'))
  })

  it('avisa con onTerminoCarga al terminar cada consulta, con éxito o con error', async () => {
    listarMock.mockResolvedValueOnce([registro(1)])
    listarMock.mockRejectedValueOnce(new ApiError('Sin conexión'))
    const onTermino = vi.fn()
    const { rerender } = render(<HistorialList refrescoManual={0} onTerminoCarga={onTermino} />)
    await screen.findAllByTestId('historial-fila')
    expect(onTermino).toHaveBeenCalledTimes(1)

    rerender(<HistorialList refrescoManual={1} onTerminoCarga={onTermino} />)
    await screen.findByTestId('historial-error')
    expect(onTermino).toHaveBeenCalledTimes(2)
    expect(avisarMock).not.toHaveBeenCalled() // un error no muestra «sin novedades»
  })

  it('el refresco automático tras cotizar no muestra aviso', async () => {
    listarMock.mockResolvedValueOnce([registro(1)])
    listarMock.mockResolvedValueOnce([registro(1), registro(2)])
    const { rerender } = render(<HistorialList version={0} />)
    await screen.findAllByTestId('historial-fila')

    rerender(<HistorialList version={1} />)
    await waitFor(() => expect(screen.getAllByTestId('historial-fila')).toHaveLength(2))
    expect(avisarMock).not.toHaveBeenCalled()
  })

  it('lo agregado por el refresco automático no cuenta como nuevo en el siguiente «Actualizar»', async () => {
    listarMock.mockResolvedValueOnce([registro(1)])
    listarMock.mockResolvedValue([registro(1), registro(2)])
    const { rerender } = render(<HistorialList version={0} refrescoManual={0} />)
    await screen.findAllByTestId('historial-fila')
    rerender(<HistorialList version={1} refrescoManual={0} />)
    await waitFor(() => expect(screen.getAllByTestId('historial-fila')).toHaveLength(2))

    rerender(<HistorialList version={1} refrescoManual={1} />)
    await waitFor(() => expect(avisarMock).toHaveBeenCalledWith('info', 'No hay cotizaciones nuevas'))
  })

  it('muestra el estado de carga y luego las filas', async () => {
    listarMock.mockResolvedValue([registro(1), registro(2)])
    render(<HistorialList />)

    expect(screen.getByTestId('historial-cargando')).toBeInTheDocument()
    expect(await screen.findAllByTestId('historial-fila')).toHaveLength(2)
    expect(screen.getByTestId('historial-conteo')).toHaveTextContent('1–2 de 2')
  })

  it('pagina y navega entre páginas', async () => {
    listarMock.mockResolvedValue(Array.from({ length: 20 }, (_, i) => registro(i)))
    const user = userEvent.setup()
    render(<HistorialList />)

    expect(await screen.findAllByTestId('historial-fila')).toHaveLength(FILAS)
    expect(screen.getByTestId('historial-pagina')).toHaveTextContent('1 / 3')
    expect(screen.getByTestId('historial-anterior')).toBeDisabled()

    await user.click(screen.getByTestId('historial-siguiente'))
    expect(screen.getByTestId('historial-pagina')).toHaveTextContent('2 / 3')
    expect(screen.getByTestId('historial-conteo')).toHaveTextContent('9–16 de 20')

    await user.click(screen.getByTestId('historial-siguiente'))
    expect(screen.getAllByTestId('historial-fila')).toHaveLength(4)
    expect(screen.getByTestId('historial-siguiente')).toBeDisabled()

    await user.click(screen.getByTestId('historial-anterior'))
    expect(screen.getByTestId('historial-pagina')).toHaveTextContent('2 / 3')
  })

  it('filtra con la búsqueda y vuelve a la primera página', async () => {
    const datos = [
      ...Array.from({ length: 12 }, (_, i) => registro(i)),
      registro(20, { tipoCliente: 'VIP', tipoEnvio: 'EXPRESS', totalUSD: 99.5 }),
    ]
    listarMock.mockResolvedValue(datos)
    const user = userEvent.setup()
    render(<HistorialList />)
    await screen.findAllByTestId('historial-fila')

    await user.click(screen.getByTestId('historial-siguiente'))
    expect(screen.getByTestId('historial-pagina')).toHaveTextContent('2 / 2')

    await user.type(screen.getByTestId('historial-busqueda'), 'vip express')
    expect(screen.getAllByTestId('historial-fila')).toHaveLength(1)
    expect(screen.getByTestId('historial-conteo')).toHaveTextContent('1–1 de 1 (13 en total)')
    expect(screen.getByTestId('historial-pagina')).toHaveTextContent('1 / 1')
  })

  it('avisa cuando la búsqueda no encuentra nada', async () => {
    listarMock.mockResolvedValue([registro(1)])
    const user = userEvent.setup()
    render(<HistorialList />)
    await screen.findAllByTestId('historial-fila')

    await user.type(screen.getByTestId('historial-busqueda'), 'zzz')
    expect(screen.getByTestId('historial-sin-resultados')).toHaveTextContent('zzz')
    expect(screen.queryByTestId('historial-fila')).not.toBeInTheDocument()
  })

  it('no muestra total en los rechazados', async () => {
    listarMock.mockResolvedValue([registro(1, { estado: 'RECHAZADO', totalUSD: 0, peso: 201 })])
    render(<HistorialList />)

    const fila = await screen.findByTestId('historial-fila')
    expect(fila).toHaveTextContent('Rechazado')
    expect(fila).toHaveTextContent('—')
  })

  it('muestra un mensaje si no hay registros', async () => {
    listarMock.mockResolvedValue([])
    render(<HistorialList />)
    expect(await screen.findByTestId('historial-vacio')).toBeInTheDocument()
  })

  it('muestra el error y se recupera al volver a consultar', async () => {
    listarMock.mockRejectedValueOnce(new ApiError('No se pudo conectar'))
    listarMock.mockResolvedValueOnce([registro(1)])
    const { rerender } = render(<HistorialList refrescoManual={0} />)

    expect(await screen.findByTestId('historial-error')).toHaveTextContent('No se pudo conectar')
    rerender(<HistorialList refrescoManual={1} />)
    await waitFor(() => expect(screen.getAllByTestId('historial-fila')).toHaveLength(1))
  })

  it('vuelve a consultar cuando cambia la versión', async () => {
    listarMock.mockResolvedValue([registro(1)])
    const { rerender } = render(<HistorialList version={0} />)
    await screen.findAllByTestId('historial-fila')

    rerender(<HistorialList version={1} />)
    await waitFor(() => expect(listarMock).toHaveBeenCalledTimes(2))
  })
})
