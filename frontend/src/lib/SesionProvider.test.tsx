import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sesion } from '../types.ts'
import { SesionProvider } from './SesionProvider.tsx'
import { guardarSesion, leerSesion, notificarSesionInvalida } from './sesion.ts'
import { useSesion } from './useSesion.ts'

const { avisarMock } = vi.hoisted(() => ({ avisarMock: vi.fn() }))
vi.mock('./alertas.ts', () => ({ avisar: avisarMock }))

const sesionQueVence = (enMs: number): Sesion => ({
  token: 'tok-123',
  expiraEn: new Date(Date.now() + enMs).toISOString(),
  usuario: { id: 'u1', nombre: 'Ana', email: 'ana@correo.com', creadoEn: '', ultimoLogin: '' },
})

function Sonda() {
  const { sesion, iniciar, salir } = useSesion()
  return (
    <div>
      <p data-testid="estado">{sesion ? sesion.usuario.nombre : 'sin sesión'}</p>
      <button onClick={() => iniciar(sesionQueVence(3_600_000))}>iniciar</button>
      <button onClick={salir}>salir</button>
    </div>
  )
}

describe('SesionProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    avisarMock.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
    localStorage.clear()
  })

  it('arranca con la sesión guardada', () => {
    guardarSesion(sesionQueVence(3_600_000))
    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    )
    expect(screen.getByTestId('estado')).toHaveTextContent('Ana')
  })

  it('iniciar guarda la sesión y salir la borra', () => {
    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    )
    expect(screen.getByTestId('estado')).toHaveTextContent('sin sesión')

    act(() => screen.getByText('iniciar').click())
    expect(screen.getByTestId('estado')).toHaveTextContent('Ana')
    expect(leerSesion()?.token).toBe('tok-123')

    act(() => screen.getByText('salir').click())
    expect(screen.getByTestId('estado')).toHaveTextContent('sin sesión')
    expect(leerSesion()).toBeNull()
  })

  it('la sesión se cierra sola al llegar a expiraEn y avisa', () => {
    vi.useFakeTimers()
    guardarSesion(sesionQueVence(60_000))
    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    )
    expect(screen.getByTestId('estado')).toHaveTextContent('Ana')

    act(() => {
      vi.advanceTimersByTime(60_001)
    })

    expect(screen.getByTestId('estado')).toHaveTextContent('sin sesión')
    expect(avisarMock).toHaveBeenCalledWith('info', 'Tu sesión venció. Vuelve a ingresar.')
    expect(leerSesion()).toBeNull()
  })

  it('un token rechazado por la API (evento) cierra la sesión y avisa', () => {
    guardarSesion(sesionQueVence(3_600_000))
    render(
      <SesionProvider>
        <Sonda />
      </SesionProvider>,
    )

    act(() => notificarSesionInvalida())

    expect(screen.getByTestId('estado')).toHaveTextContent('sin sesión')
    expect(avisarMock).toHaveBeenCalledWith('info', 'Tu sesión venció. Vuelve a ingresar.')
  })

  it('sin provider, el hook devuelve «sin sesión» y funciones inertes', () => {
    render(<Sonda />)
    expect(screen.getByTestId('estado')).toHaveTextContent('sin sesión')
  })
})
