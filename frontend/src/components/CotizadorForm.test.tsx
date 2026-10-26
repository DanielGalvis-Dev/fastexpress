import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/cotizar.ts'
import { CotizadorForm } from './CotizadorForm.tsx'

const { cotizarMock, confirmarMock } = vi.hoisted(() => ({ cotizarMock: vi.fn(), confirmarMock: vi.fn() }))

vi.mock('../api/cotizar.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/cotizar.ts')>()),
  cotizar: cotizarMock,
}))
vi.mock('../lib/alertas.ts', () => ({ confirmar: confirmarMock }))

async function llenar(peso: string, cliente = 'VIP', envio = 'express') {
  const user = userEvent.setup()
  if (peso) await user.type(screen.getByTestId('peso-input'), peso)
  if (cliente) await user.selectOptions(screen.getByTestId('cliente-select'), cliente)
  if (envio) await user.click(screen.getByTestId(`envio-${envio}`))
  return user
}

describe('CotizadorForm', () => {
  beforeEach(() => {
    cotizarMock.mockReset()
    confirmarMock.mockReset()
    confirmarMock.mockResolvedValue(true)
  })

  it('el campo de peso no deja escribir letras ni símbolos', async () => {
    const user = userEvent.setup()
    render(<CotizadorForm />)
    const peso = screen.getByTestId('peso-input')

    await user.type(peso, 'abc')
    expect(peso).toHaveValue('')

    await user.type(peso, 'a1b.2c,3-4')
    expect(peso).toHaveValue('1.234') // letras, símbolos y el segundo separador se descartan
  })

  it('al pegar texto en el peso solo queda lo numérico', async () => {
    const user = userEvent.setup()
    render(<CotizadorForm />)
    const peso = screen.getByTestId('peso-input')

    await user.click(peso)
    await user.paste('12,5 kg')
    expect(peso).toHaveValue('12,5')
  })

  it('el campo de peso limita su longitud y pide teclado numérico', () => {
    render(<CotizadorForm />)
    const peso = screen.getByTestId('peso-input')
    expect(peso).toHaveAttribute('maxLength', '10')
    expect(peso).toHaveAttribute('inputMode', 'decimal')
  })

  it('pide confirmación con el resumen antes de registrar', async () => {
    cotizarMock.mockResolvedValue({ total: 13.5 })
    render(<CotizadorForm />)
    const user = await llenar('5', 'FRECUENTE', 'estandar')
    await user.click(screen.getByTestId('cotizar-btn'))

    await waitFor(() => expect(cotizarMock).toHaveBeenCalledTimes(1))
    expect(confirmarMock).toHaveBeenCalledWith(
      expect.objectContaining({ texto: '5 kg · Frecuente · Estándar' }),
    )
  })

  it('no registra si la persona cancela la confirmación y conserva los datos', async () => {
    confirmarMock.mockResolvedValue(false)
    render(<CotizadorForm />)
    const user = await llenar('5', 'VIP', 'express')
    await user.click(screen.getByTestId('cotizar-btn'))

    await waitFor(() => expect(confirmarMock).toHaveBeenCalled())
    expect(cotizarMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('peso-input')).toHaveValue('5')
    expect(screen.getByTestId('cotizar-btn')).toBeEnabled()
  })

  it('no pide confirmación si la validación falla', async () => {
    const user = userEvent.setup()
    render(<CotizadorForm />)
    await user.click(screen.getByTestId('cotizar-btn'))
    expect(confirmarMock).not.toHaveBeenCalled()
  })

  it('informa si hay datos sin registrar y deja de informarlo tras cotizar', async () => {
    cotizarMock.mockResolvedValue({ total: 7 })
    const onSucio = vi.fn()
    render(<CotizadorForm onSucio={onSucio} />)
    expect(onSucio).toHaveBeenLastCalledWith(false)

    const user = await llenar('1', 'NUEVO', 'estandar')
    expect(onSucio).toHaveBeenLastCalledWith(true)

    await user.click(screen.getByTestId('cotizar-btn'))
    await screen.findByTestId('resultado')
    expect(onSucio).toHaveBeenLastCalledWith(false)
  })

  it('no envía y muestra errores con el formulario vacío', async () => {
    const user = userEvent.setup()
    render(<CotizadorForm />)
    await user.click(screen.getByTestId('cotizar-btn'))

    expect(screen.getByTestId('peso-error')).toHaveTextContent('Ingresa el peso')
    expect(screen.getByTestId('cliente-error')).toBeInTheDocument()
    expect(screen.getByTestId('envio-error')).toBeInTheDocument()
    expect(cotizarMock).not.toHaveBeenCalled()
  })

  it('bloquea un peso mayor a 20 kg', async () => {
    render(<CotizadorForm />)
    const user = await llenar('20.01')
    await user.click(screen.getByTestId('cotizar-btn'))

    expect(screen.getByTestId('peso-error')).toHaveTextContent('máximo permitido')
    expect(cotizarMock).not.toHaveBeenCalled()
  })

  it('envía los valores correctos a la API y muestra el total', async () => {
    cotizarMock.mockResolvedValue({ total: 31.5, desglose: { tarifaBase: 5, costoPeso: 40 } })
    render(<CotizadorForm />)
    const user = await llenar('10', 'FRECUENTE', 'estandar')
    await user.click(screen.getByTestId('cotizar-btn'))

    await waitFor(() => expect(screen.getByTestId('resultado')).toBeInTheDocument())
    expect(cotizarMock).toHaveBeenCalledWith({
      peso: 10,
      tipoCliente: 'FRECUENTE',
      tipoEnvio: 'ESTANDAR',
    })
    expect(screen.getByTestId('resultado-total')).toHaveTextContent('31,50')
    expect(screen.getByTestId('desglose-tarifaBase')).toBeInTheDocument()
  })

  it('muestra el rechazo de la API sin romper el formulario', async () => {
    cotizarMock.mockRejectedValue(new ApiError('Límite de peso excedido'))
    render(<CotizadorForm />)
    const user = await llenar('5', 'NUEVO', 'estandar')
    await user.click(screen.getByTestId('cotizar-btn'))

    expect(await screen.findByTestId('api-error')).toHaveTextContent('Límite de peso excedido')
    expect(screen.getByTestId('peso-input')).toHaveValue('5')
  })

  it('evita envíos duplicados mientras espera la respuesta', async () => {
    let resolver: (v: { total: number }) => void = () => {}
    cotizarMock.mockReturnValue(new Promise((r) => (resolver = r)))
    render(<CotizadorForm />)
    const user = await llenar('3')
    await user.click(screen.getByTestId('cotizar-btn'))

    expect(screen.getByTestId('cotizar-btn')).toBeDisabled()
    await user.click(screen.getByTestId('cotizar-btn'))
    expect(cotizarMock).toHaveBeenCalledTimes(1)

    resolver({ total: 1 })
    await waitFor(() => expect(screen.getByTestId('resultado')).toBeInTheDocument())
  })
})
