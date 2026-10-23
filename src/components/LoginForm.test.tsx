import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/cotizar.ts'
import { SesionContext } from '../lib/SesionContext.ts'
import type { Sesion } from '../types.ts'
import { LoginForm } from './LoginForm.tsx'

const { iniciarSesionMock, avisarMock } = vi.hoisted(() => ({
  iniciarSesionMock: vi.fn(),
  avisarMock: vi.fn(),
}))

vi.mock('../api/auth.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth.ts')>()),
  iniciarSesion: iniciarSesionMock,
}))
vi.mock('../lib/alertas.ts', () => ({ avisar: avisarMock }))

const SESION: Sesion = {
  token: 'tok-123',
  expiraEn: '2026-10-22T09:32:52.530Z',
  usuario: { id: 'u1', nombre: 'Ana Pérez', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
}

describe('LoginForm', () => {
  const iniciarMock = vi.fn()
  const irARegistro = vi.fn()
  const irARecuperar = vi.fn()

  const renderForm = (props: Partial<React.ComponentProps<typeof LoginForm>> = {}) =>
    render(
      <SesionContext.Provider value={{ sesion: null, iniciar: iniciarMock, salir: vi.fn() }}>
        <LoginForm onIrARegistro={irARegistro} onIrARecuperar={irARecuperar} {...props} />
      </SesionContext.Provider>,
    )

  beforeEach(() => {
    iniciarSesionMock.mockReset()
    avisarMock.mockReset()
    iniciarMock.mockReset()
    irARegistro.mockReset()
    irARecuperar.mockReset()
  })

  it('no envía con los campos vacíos y muestra un error junto a cada campo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('login-btn'))

    expect(screen.getByTestId('login-email-error')).toHaveTextContent('Ingresa tu correo electrónico.')
    expect(screen.getByTestId('login-password-error')).toHaveTextContent('Ingresa tu contraseña.')
    expect(screen.getByTestId('login-email-input')).toHaveAttribute('aria-invalid', 'true')
    expect(iniciarSesionMock).not.toHaveBeenCalled()
  })

  it('valida el formato del correo al salir del campo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('login-email-input'), 'ana-sin-arroba')
    await user.tab()

    expect(screen.getByTestId('login-email-error')).toHaveTextContent('Ingresa un correo válido')
  })

  it('con datos válidos llama a la API (correo normalizado), guarda la sesión y avisa', async () => {
    iniciarSesionMock.mockResolvedValue(SESION)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('login-email-input'), '  Ana@Correo.com ')
    await user.type(screen.getByTestId('login-password-input'), 'abc12')
    await user.click(screen.getByTestId('login-btn'))

    await waitFor(() => expect(iniciarMock).toHaveBeenCalledWith(SESION))
    expect(iniciarSesionMock).toHaveBeenCalledWith({ email: 'ana@correo.com', password: 'abc12' })
    expect(avisarMock).toHaveBeenCalledWith('success', 'Sesión iniciada')
  })

  it('muestra el error de la API sin romper el formulario y deja reintentar', async () => {
    iniciarSesionMock.mockRejectedValueOnce(new ApiError('Correo o contraseña incorrectos.'))
    iniciarSesionMock.mockResolvedValueOnce(SESION)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('login-email-input'), 'ana@correo.com')
    await user.type(screen.getByTestId('login-password-input'), 'mala')
    await user.click(screen.getByTestId('login-btn'))

    expect(await screen.findByTestId('login-api-error')).toHaveTextContent('Correo o contraseña incorrectos.')
    expect(iniciarMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('login-btn')).toBeEnabled()
    expect(screen.getByTestId('login-password-input')).toHaveValue('mala')

    await user.click(screen.getByTestId('login-btn'))
    await waitFor(() => expect(iniciarMock).toHaveBeenCalledWith(SESION))
    expect(screen.queryByTestId('login-api-error')).not.toBeInTheDocument()
  })

  it('un error inesperado (no ApiError) muestra un mensaje genérico', async () => {
    iniciarSesionMock.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('login-email-input'), 'ana@correo.com')
    await user.type(screen.getByTestId('login-password-input'), 'abc12')
    await user.click(screen.getByTestId('login-btn'))

    expect(await screen.findByTestId('login-api-error')).toHaveTextContent('Ocurrió un error inesperado')
  })

  it('mientras espera deshabilita el botón y evita envíos duplicados', async () => {
    let resolver: (s: Sesion) => void = () => {}
    iniciarSesionMock.mockReturnValue(new Promise<Sesion>((r) => (resolver = r)))
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('login-email-input'), 'ana@correo.com')
    await user.type(screen.getByTestId('login-password-input'), 'abc12')
    await user.click(screen.getByTestId('login-btn'))
    await user.click(screen.getByTestId('login-btn'))

    expect(screen.getByTestId('login-btn')).toBeDisabled()
    expect(screen.getByTestId('login-btn')).toHaveTextContent('Ingresando…')
    expect(iniciarSesionMock).toHaveBeenCalledTimes(1)

    resolver(SESION)
    await waitFor(() => expect(screen.getByTestId('login-btn')).toBeEnabled())
  })

  it('no recorta la contraseña: se envía tal cual la escribió la persona', async () => {
    iniciarSesionMock.mockResolvedValue(SESION)
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByTestId('login-email-input'), 'ana@correo.com')
    await user.type(screen.getByTestId('login-password-input'), ' abc12 ')
    await user.click(screen.getByTestId('login-btn'))

    await waitFor(() => expect(iniciarSesionMock).toHaveBeenCalled())
    expect(iniciarSesionMock.mock.calls[0][0].password).toBe(' abc12 ')
  })

  it('precarga el correo y muestra el aviso del paso anterior', () => {
    renderForm({ emailInicial: 'ana@correo.com', aviso: 'Cuenta creada. Ya puedes iniciar sesión.' })

    expect(screen.getByTestId('login-email-input')).toHaveValue('ana@correo.com')
    expect(screen.getByTestId('login-aviso')).toHaveTextContent('Cuenta creada')
  })

  it('los enlaces llevan a registro y a recuperación', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('ir-a-registro'))
    await user.click(screen.getByTestId('ir-a-recuperar'))

    expect(irARegistro).toHaveBeenCalledTimes(1)
    expect(irARecuperar).toHaveBeenCalledTimes(1)
  })

  it('la contraseña se oculta (type="password") y el correo sugiere autocompletado', () => {
    renderForm()
    expect(screen.getByTestId('login-password-input')).toHaveAttribute('type', 'password')
    expect(screen.getByTestId('login-password-input')).toHaveAttribute('autocomplete', 'current-password')
    expect(screen.getByTestId('login-email-input')).toHaveAttribute('autocomplete', 'email')
  })
})
