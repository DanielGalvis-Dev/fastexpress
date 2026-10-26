import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/cotizar.ts'
import { SesionContext } from '../lib/SesionContext.ts'
import type { Sesion } from '../types.ts'
import { CambiarPasswordForm } from './CambiarPasswordForm.tsx'

const { cambiarPasswordMock, avisarMock } = vi.hoisted(() => ({
  cambiarPasswordMock: vi.fn(),
  avisarMock: vi.fn(),
}))

vi.mock('../api/auth.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth.ts')>()),
  cambiarPassword: cambiarPasswordMock,
}))
vi.mock('../lib/alertas.ts', () => ({ avisar: avisarMock }))

const SESION: Sesion = {
  token: 'tok-123',
  expiraEn: '2026-10-22T09:32:52.530Z',
  usuario: { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
}

describe('CambiarPasswordForm', () => {
  const onCambiada = vi.fn()
  const onSucio = vi.fn()

  const renderForm = (sesion: Sesion | null = SESION) =>
    render(
      <SesionContext.Provider value={{ sesion, iniciar: vi.fn(), salir: vi.fn() }}>
        <CambiarPasswordForm onCambiada={onCambiada} onSucio={onSucio} />
      </SesionContext.Provider>,
    )

  beforeEach(() => {
    cambiarPasswordMock.mockReset()
    avisarMock.mockReset()
    onCambiada.mockReset()
    onSucio.mockReset()
  })

  async function completar(
    user: ReturnType<typeof userEvent.setup>,
    datos: { actual?: string; nueva?: string; confirmacion?: string } = {},
  ) {
    const { actual = 'abc12', nueva = 'nueva123', confirmacion = nueva } = datos
    await user.type(screen.getByTestId('cambiar-password-actual-input'), actual)
    await user.type(screen.getByTestId('cambiar-password-nueva-input'), nueva)
    await user.type(screen.getByTestId('cambiar-password-confirmacion-input'), confirmacion)
  }

  it('no envía vacío y muestra errores por campo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('cambiar-password-btn'))

    expect(screen.getByTestId('cambiar-password-actual-error')).toBeInTheDocument()
    expect(screen.getByTestId('cambiar-password-nueva-error')).toBeInTheDocument()
    expect(screen.getByTestId('cambiar-password-confirmacion-error')).toBeInTheDocument()
    expect(cambiarPasswordMock).not.toHaveBeenCalled()
  })

  it('exige que la nueva sea distinta de la actual', async () => {
    const user = userEvent.setup()
    renderForm()

    await completar(user, { actual: 'abc12', nueva: 'abc12' })
    await user.click(screen.getByTestId('cambiar-password-btn'))

    expect(screen.getByTestId('cambiar-password-nueva-error')).toHaveTextContent('distinta de la actual')
    expect(cambiarPasswordMock).not.toHaveBeenCalled()
  })

  it('envía el token de la sesión, la actual y la nueva; avisa con el mensaje de la API y se cierra', async () => {
    cambiarPasswordMock.mockResolvedValue('Contraseña actualizada.')
    const user = userEvent.setup()
    renderForm()

    await completar(user)
    await user.click(screen.getByTestId('cambiar-password-btn'))

    await waitFor(() => expect(onCambiada).toHaveBeenCalledTimes(1))
    expect(cambiarPasswordMock).toHaveBeenCalledWith({ token: 'tok-123', actual: 'abc12', nueva: 'nueva123' })
    expect(avisarMock).toHaveBeenCalledWith('success', 'Contraseña actualizada.')
  })

  it('muestra «contraseña actual incorrecta» de la API y conserva lo escrito', async () => {
    cambiarPasswordMock.mockRejectedValue(new ApiError('La contraseña actual es incorrecta.'))
    const user = userEvent.setup()
    renderForm()

    await completar(user)
    await user.click(screen.getByTestId('cambiar-password-btn'))

    expect(await screen.findByTestId('cambiar-password-api-error')).toHaveTextContent('contraseña actual es incorrecta')
    expect(onCambiada).not.toHaveBeenCalled()
    expect(screen.getByTestId('cambiar-password-nueva-input')).toHaveValue('nueva123')
  })

  it('sin sesión no llama a la API y pide ingresar de nuevo', async () => {
    const user = userEvent.setup()
    renderForm(null)

    await completar(user)
    await user.click(screen.getByTestId('cambiar-password-btn'))

    expect(await screen.findByTestId('cambiar-password-api-error')).toHaveTextContent('Vuelve a ingresar')
    expect(cambiarPasswordMock).not.toHaveBeenCalled()
  })

  it('informa si hay datos sin guardar', async () => {
    const user = userEvent.setup()
    renderForm()
    expect(onSucio).toHaveBeenLastCalledWith(false)

    await user.type(screen.getByTestId('cambiar-password-actual-input'), 'a')
    expect(onSucio).toHaveBeenLastCalledWith(true)
  })
})
