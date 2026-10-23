import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PantallaAuth } from './PantallaAuth.tsx'

const { registrarMock, solicitarCodigoMock, restablecerMock } = vi.hoisted(() => ({
  registrarMock: vi.fn(),
  solicitarCodigoMock: vi.fn(),
  restablecerMock: vi.fn(),
}))

vi.mock('../api/auth.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth.ts')>()),
  registrar: registrarMock,
  solicitarCodigo: solicitarCodigoMock,
  restablecerPassword: restablecerMock,
}))
vi.mock('../lib/alertas.ts', () => ({ avisar: vi.fn() }))

describe('PantallaAuth', () => {
  beforeEach(() => {
    registrarMock.mockReset()
    solicitarCodigoMock.mockReset()
    restablecerMock.mockReset()
  })

  it('arranca en el ingreso', () => {
    render(<PantallaAuth />)
    expect(screen.getByTestId('auth-titulo')).toHaveTextContent('Ingresar')
    expect(screen.getByTestId('login-btn')).toBeInTheDocument()
  })

  it('navega entre ingreso, registro y recuperación', async () => {
    const user = userEvent.setup()
    render(<PantallaAuth />)

    await user.click(screen.getByTestId('ir-a-registro'))
    expect(screen.getByTestId('auth-titulo')).toHaveTextContent('Crear cuenta')
    expect(screen.getByTestId('registro-btn')).toBeInTheDocument()

    await user.click(screen.getByTestId('ir-a-login'))
    await user.click(screen.getByTestId('ir-a-recuperar'))
    expect(screen.getByTestId('auth-titulo')).toHaveTextContent('Recuperar contraseña')
    expect(screen.getByTestId('recuperar-enviar-btn')).toBeInTheDocument()

    await user.click(screen.getByTestId('ir-a-login'))
    expect(screen.getByTestId('login-btn')).toBeInTheDocument()
  })

  it('tras registrarse vuelve al ingreso con el correo precargado y un aviso', async () => {
    registrarMock.mockResolvedValue({ id: 'u1' })
    const user = userEvent.setup()
    render(<PantallaAuth />)

    await user.click(screen.getByTestId('ir-a-registro'))
    await user.type(screen.getByTestId('registro-nombre-input'), 'Ana Pérez')
    await user.type(screen.getByTestId('registro-email-input'), 'ana@correo.com')
    await user.type(screen.getByTestId('registro-password-input'), 'abc12')
    await user.type(screen.getByTestId('registro-confirmacion-input'), 'abc12')
    await user.click(screen.getByTestId('registro-btn'))

    expect(await screen.findByTestId('login-btn')).toBeInTheDocument()
    expect(screen.getByTestId('login-email-input')).toHaveValue('ana@correo.com')
    expect(screen.getByTestId('login-aviso')).toHaveTextContent('Cuenta creada')
  })

  it('tras restablecer la contraseña vuelve al ingreso con el mensaje de la API', async () => {
    solicitarCodigoMock.mockResolvedValue('Te enviamos un código.')
    restablecerMock.mockResolvedValue('Contraseña restablecida. Ya puedes iniciar sesión.')
    const user = userEvent.setup()
    render(<PantallaAuth />)

    await user.click(screen.getByTestId('ir-a-recuperar'))
    await user.type(screen.getByTestId('recuperar-email-input'), 'ana@correo.com')
    await user.click(screen.getByTestId('recuperar-enviar-btn'))
    await user.type(await screen.findByTestId('recuperar-codigo-input'), '123456')
    await user.type(screen.getByTestId('recuperar-nueva-input'), 'nueva123')
    await user.type(screen.getByTestId('recuperar-confirmacion-input'), 'nueva123')
    await user.click(screen.getByTestId('recuperar-btn'))

    await waitFor(() => expect(screen.getByTestId('login-aviso')).toHaveTextContent('Contraseña restablecida'))
    expect(screen.getByTestId('login-email-input')).toHaveValue('ana@correo.com')
  })
})
