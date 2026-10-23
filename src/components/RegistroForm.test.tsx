import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/cotizar.ts'
import { RegistroForm } from './RegistroForm.tsx'

const { registrarMock } = vi.hoisted(() => ({ registrarMock: vi.fn() }))

vi.mock('../api/auth.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/auth.ts')>()),
  registrar: registrarMock,
}))

describe('RegistroForm', () => {
  const onRegistrado = vi.fn()
  const onIrALogin = vi.fn()

  beforeEach(() => {
    registrarMock.mockReset()
    onRegistrado.mockReset()
    onIrALogin.mockReset()
  })

  async function completar(
    user: ReturnType<typeof userEvent.setup>,
    datos: { nombre?: string; email?: string; password?: string; confirmacion?: string } = {},
  ) {
    const { nombre = 'Ana Pérez', email = 'ana@correo.com', password = 'abc12', confirmacion = password } = datos
    if (nombre) await user.type(screen.getByTestId('registro-nombre-input'), nombre)
    if (email) await user.type(screen.getByTestId('registro-email-input'), email)
    if (password) await user.type(screen.getByTestId('registro-password-input'), password)
    if (confirmacion) await user.type(screen.getByTestId('registro-confirmacion-input'), confirmacion)
  }

  const renderForm = () => render(<RegistroForm onRegistrado={onRegistrado} onIrALogin={onIrALogin} />)

  it('no envía vacío y muestra un error por campo', async () => {
    const user = userEvent.setup()
    renderForm()

    await user.click(screen.getByTestId('registro-btn'))

    expect(screen.getByTestId('registro-nombre-error')).toHaveTextContent('Ingresa tu nombre.')
    expect(screen.getByTestId('registro-email-error')).toBeInTheDocument()
    expect(screen.getByTestId('registro-password-error')).toBeInTheDocument()
    expect(screen.getByTestId('registro-confirmacion-error')).toBeInTheDocument()
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('rechaza una contraseña demasiado corta (límite: 4 caracteres) y acepta 5', async () => {
    const user = userEvent.setup()
    renderForm()

    await completar(user, { password: 'abcd' })
    await user.click(screen.getByTestId('registro-btn'))
    expect(screen.getByTestId('registro-password-error')).toHaveTextContent('al menos 5 caracteres')
    expect(registrarMock).not.toHaveBeenCalled()

    await user.type(screen.getByTestId('registro-password-input'), 'e')
    await user.clear(screen.getByTestId('registro-confirmacion-input'))
    await user.type(screen.getByTestId('registro-confirmacion-input'), 'abcde')
    registrarMock.mockResolvedValue({})
    await user.click(screen.getByTestId('registro-btn'))
    await waitFor(() => expect(registrarMock).toHaveBeenCalled())
  })

  it('exige que la confirmación coincida', async () => {
    const user = userEvent.setup()
    renderForm()

    await completar(user, { confirmacion: 'otra-cosa' })
    await user.click(screen.getByTestId('registro-btn'))

    expect(screen.getByTestId('registro-confirmacion-error')).toHaveTextContent('Las contraseñas no coinciden.')
    expect(registrarMock).not.toHaveBeenCalled()
  })

  it('con datos válidos envía nombre, correo normalizado y contraseña (sin la confirmación)', async () => {
    registrarMock.mockResolvedValue({ id: 'u1' })
    const user = userEvent.setup()
    renderForm()

    await completar(user, { nombre: '  Ana   Pérez ', email: 'ANA@correo.com' })
    await user.click(screen.getByTestId('registro-btn'))

    await waitFor(() => expect(onRegistrado).toHaveBeenCalledWith('ana@correo.com'))
    expect(registrarMock).toHaveBeenCalledWith({
      nombre: 'Ana Pérez',
      email: 'ana@correo.com',
      password: 'abc12',
    })
  })

  it('muestra el rechazo de la API (p. ej. correo ya registrado) y conserva lo escrito', async () => {
    registrarMock.mockRejectedValue(new ApiError('El correo ya está registrado.'))
    const user = userEvent.setup()
    renderForm()

    await completar(user)
    await user.click(screen.getByTestId('registro-btn'))

    expect(await screen.findByTestId('registro-api-error')).toHaveTextContent('El correo ya está registrado.')
    expect(onRegistrado).not.toHaveBeenCalled()
    expect(screen.getByTestId('registro-nombre-input')).toHaveValue('Ana Pérez')
    expect(screen.getByTestId('registro-btn')).toBeEnabled()
  })

  it('evita envíos duplicados mientras espera', async () => {
    let resolver: (v: unknown) => void = () => {}
    registrarMock.mockReturnValue(new Promise((r) => (resolver = r)))
    const user = userEvent.setup()
    renderForm()

    await completar(user)
    await user.click(screen.getByTestId('registro-btn'))
    await user.click(screen.getByTestId('registro-btn'))

    expect(registrarMock).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('registro-btn')).toBeDisabled()
    resolver({})
    await waitFor(() => expect(onRegistrado).toHaveBeenCalled())
  })

  it('el enlace «Ingresar» vuelve al login', async () => {
    const user = userEvent.setup()
    renderForm()
    await user.click(screen.getByTestId('ir-a-login'))
    expect(onIrALogin).toHaveBeenCalledTimes(1)
  })
})
