import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { avisar, confirmar, hayConfirmacionAbierta } from './alertas.ts'

// SweetAlert2 se simula: `mixin` se llama dos veces al cargar el módulo (primero el diálogo, luego el toast).
const { mixinMock, fireDialogo, fireAviso } = vi.hoisted(() => {
  const fireDialogo = vi.fn()
  const fireAviso = vi.fn()
  const mixinMock = vi
    .fn()
    .mockReturnValueOnce({ fire: fireDialogo })
    .mockReturnValueOnce({ fire: fireAviso })
  return { mixinMock, fireDialogo, fireAviso }
})

vi.mock('sweetalert2', () => ({ default: { mixin: mixinMock } }))

const opcionesDialogo = mixinMock.mock.calls[0][0]
const opcionesToast = mixinMock.mock.calls[1][0]

describe('configuración de SweetAlert2', () => {
  it('el toast no recibe parámetros incompatibles (heightAuto daba un aviso en consola)', () => {
    expect(opcionesToast).toMatchObject({ toast: true, position: 'top' })
    expect(opcionesToast).not.toHaveProperty('heightAuto')
    expect(opcionesToast).not.toHaveProperty('keydownListenerCapture')
    expect(opcionesToast).not.toHaveProperty('returnFocus')
  })

  it('los diálogos no tocan el alto de la página (diseño sin scroll)', () => {
    expect(opcionesDialogo).toMatchObject({
      heightAuto: false,
      scrollbarPadding: false,
      keydownListenerCapture: true,
      reverseButtons: true,
    })
    expect(opcionesDialogo).not.toHaveProperty('toast')
  })
})

describe('confirmar', () => {
  beforeEach(() => {
    fireDialogo.mockReset()
    fireAviso.mockReset()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const opciones = { titulo: '¿Seguro?', texto: 'Detalle', confirmar: 'Sí', cancelar: 'No' }

  it('traduce las opciones y devuelve true si se confirma', async () => {
    fireDialogo.mockImplementation(async (o: { didClose: () => void }) => {
      o.didClose()
      return { isConfirmed: true }
    })

    await expect(confirmar({ ...opciones, icono: 'warning' })).resolves.toBe(true)
    expect(fireDialogo).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '¿Seguro?',
        text: 'Detalle',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí',
        cancelButtonText: 'No',
        focusCancel: true, // en acciones destructivas el foco inicial va a la opción segura
      }),
    )
  })

  it('por defecto es una pregunta y el foco inicial va a confirmar', async () => {
    fireDialogo.mockImplementation(async (o: { didClose: () => void }) => {
      o.didClose()
      return { isConfirmed: false }
    })

    await expect(confirmar(opciones)).resolves.toBe(false)
    expect(fireDialogo).toHaveBeenCalledWith(expect.objectContaining({ icon: 'question', focusCancel: false }))
  })

  it('no resuelve hasta que el diálogo termina de cerrarse (evita «Blocked aria-hidden»)', async () => {
    fireDialogo.mockImplementation(async (o: { didClose: () => void }) => {
      setTimeout(o.didClose, 300) // SweetAlert2 resuelve al empezar a cerrar y emite didClose al terminar
      return { isConfirmed: true }
    })

    let resuelto = false
    const promesa = confirmar(opciones).then((r) => {
      resuelto = true
      return r
    })

    await vi.advanceTimersByTimeAsync(100)
    expect(resuelto).toBe(false)
    expect(hayConfirmacionAbierta()).toBe(true)

    await vi.advanceTimersByTimeAsync(250)
    await expect(promesa).resolves.toBe(true)
    expect(hayConfirmacionAbierta()).toBe(false)
  })

  it('libera el estado de «confirmación abierta» aunque falle', async () => {
    fireDialogo.mockRejectedValue(new Error('boom'))
    await expect(confirmar(opciones)).rejects.toThrow('boom')
    expect(hayConfirmacionAbierta()).toBe(false)
  })
})

describe('avisar', () => {
  beforeEach(() => fireAviso.mockReset())

  it('lanza un toast con el icono y el título', () => {
    avisar('info', 'No hay cotizaciones nuevas')
    expect(fireAviso).toHaveBeenCalledWith({ icon: 'info', title: 'No hay cotizaciones nuevas' })
  })

  it('los avisos no cuentan como confirmaciones abiertas', () => {
    avisar('success', 'Listo')
    expect(hayConfirmacionAbierta()).toBe(false)
  })
})
