import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/cotizar.ts'
import { RecuperarForm } from './RecuperarForm.tsx'

const { solicitarCodigoMock, restablecerMock } = vi.hoisted(() => ({
  solicitarCodigoMock: vi.fn(),
  restablecerMock: vi.fn(),
}))

vi.mock('../api/auth.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth.ts')>()),
  solicitarCodigo: solicitarCodigoMock,
  restablecerPassword: restablecerMock,
}))

describe('RecuperarForm', () => {
  const onRestablecida = vi.fn()
  const onIrALogin = vi.fn()

  beforeEach(() => {
    solicitarCodigoMock.mockReset()
    restablecerMock.mockReset()
    onRestablecida.mockReset()
    onIrALogin.mockReset()
  })

  const renderForm = () => render(<RecuperarForm onRestablecida={onRestablecida} onIrALogin={onIrALogin} />)

  async function pasarAlPasoDelCodigo(user: ReturnType<typeof userEvent.setup>) {
    solicitarCodigoMock.mockResolvedValue('Te enviamos un código.')
    await user.type(screen.getByTestId('recuperar-email-input'), 'ana@correo.com')
    await user.click(screen.getByTestId('recuperar-enviar-btn'))
    await screen.findByTestId('recuperar-codigo-input')
  }

  it('paso 1: valida el correo antes de pedir el código', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('recuperar-enviar-btn'))
    expect(screen.getByTestId('recuperar-email-error')).toBeInTheDocument()

    await user.type(screen.getByTestId('recuperar-email-input'), 'no-es-correo')
    await user.click(screen.getByTestId('recuperar-enviar-btn'))
    expect(screen.getByTestId('recuperar-email-error')).toHaveTextContent('Ingresa un correo válido')
    expect(solicitarCodigoMock).not.toHaveBeenCalled()
  })

  it('paso 1: pide el código con el correo normalizado y pasa al paso 2 con el mensaje de la API', async () => {
    solicitarCodigoMock.mockResolvedValue('Te enviamos un código.')
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('recuperar-email-input'), ' ANA@correo.com ')
    await user.click(screen.getByTestId('recuperar-enviar-btn'))

    expect(await screen.findByTestId('recuperar-codigo-input')).toBeInTheDocument()
    expect(solicitarCodigoMock).toHaveBeenCalledWith('ana@correo.com')
    expect(screen.getByTestId('recuperar-info')).toHaveTextContent('Te enviamos un código.')
    expect(screen.getByTestId('recuperar-info')).toHaveTextContent('ANA@correo.com')
  })

  it('paso 1: si la API falla, muestra el error y se queda en el paso 1', async () => {
    solicitarCodigoMock.mockRejectedValue(new ApiError('No existe una cuenta con ese correo.'))
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('recuperar-email-input'), 'ana@correo.com')
    await user.click(screen.getByTestId('recuperar-enviar-btn'))

    expect(await screen.findByTestId('recuperar-api-error')).toHaveTextContent('No existe una cuenta')
    expect(screen.queryByTestId('recuperar-codigo-input')).not.toBeInTheDocument()
  })

  it('paso 2: valida código, contraseña nueva y confirmación', async () => {
    const user = userEvent.setup()
    renderForm()
    await pasarAlPasoDelCodigo(user)

    await user.click(screen.getByTestId('recuperar-btn'))
    expect(screen.getByTestId('recuperar-codigo-error')).toBeInTheDocument()
    expect(screen.getByTestId('recuperar-nueva-error')).toBeInTheDocument()
    expect(screen.getByTestId('recuperar-confirmacion-error')).toBeInTheDocument()

    await user.type(screen.getByTestId('recuperar-codigo-input'), '123456')
    await user.type(screen.getByTestId('recuperar-nueva-input'), 'nueva123')
    await user.type(screen.getByTestId('recuperar-confirmacion-input'), 'distinta')
    await user.click(screen.getByTestId('recuperar-btn'))
    expect(screen.getByTestId('recuperar-confirmacion-error')).toHaveTextContent('no coinciden')
    expect(restablecerMock).not.toHaveBeenCalled()
  })

  it('paso 2: restablece con correo, código y contraseña nueva, y avisa con el mensaje de la API', async () => {
    restablecerMock.mockResolvedValue('Contraseña restablecida. Ya puedes iniciar sesión.')
    const user = userEvent.setup()
    renderForm()
    await pasarAlPasoDelCodigo(user)

    await user.type(screen.getByTestId('recuperar-codigo-input'), ' 123456 ')
    await user.type(screen.getByTestId('recuperar-nueva-input'), 'nueva123')
    await user.type(screen.getByTestId('recuperar-confirmacion-input'), 'nueva123')
    await user.click(screen.getByTestId('recuperar-btn'))

    await waitFor(() =>
      expect(onRestablecida).toHaveBeenCalledWith(
        'ana@correo.com',
        'Contraseña restablecida. Ya puedes iniciar sesión.',
      ),
    )
    expect(restablecerMock).toHaveBeenCalledWith({
      email: 'ana@correo.com',
      codigo: '123456',
      nueva: 'nueva123',
    })
  })

  it('paso 2: un código incorrecto muestra el error de la API y permite corregir', async () => {
    restablecerMock.mockRejectedValue(new ApiError('Código inválido o vencido.'))
    const user = userEvent.setup()
    renderForm()
    await pasarAlPasoDelCodigo(user)

    await user.type(screen.getByTestId('recuperar-codigo-input'), '000000')
    await user.type(screen.getByTestId('recuperar-nueva-input'), 'nueva123')
    await user.type(screen.getByTestId('recuperar-confirmacion-input'), 'nueva123')
    await user.click(screen.getByTestId('recuperar-btn'))

    expect(await screen.findByTestId('recuperar-api-error')).toHaveTextContent('Código inválido o vencido.')
    expect(onRestablecida).not.toHaveBeenCalled()
    expect(screen.getByTestId('recuperar-btn')).toBeEnabled()
  })

  it('«Usar otro correo» vuelve al paso 1', async () => {
    const user = userEvent.setup()
    renderForm()
    await pasarAlPasoDelCodigo(user)

    await user.click(screen.getByTestId('recuperar-cambiar-correo'))

    expect(screen.getByTestId('recuperar-email-input')).toHaveValue('ana@correo.com')
    expect(screen.queryByTestId('recuperar-codigo-input')).not.toBeInTheDocument()
  })

  it('«Volver a ingresar» regresa al login', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByTestId('ir-a-login'))
    expect(onIrALogin).toHaveBeenCalledTimes(1)
  })
})
