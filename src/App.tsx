import { useCallback, useRef, useState } from 'react'
import { cerrarSesion } from './api/auth.ts'
import { modoChat } from './api/chat.ts'
import { CambiarPasswordForm } from './components/CambiarPasswordForm.tsx'
import { ChatWidget } from './components/ChatWidget.tsx'
import { CotizadorForm } from './components/CotizadorForm.tsx'
import { HistorialList } from './components/HistorialList.tsx'
import { MenuUsuario } from './components/MenuUsuario.tsx'
import { Modal } from './components/Modal.tsx'
import { PantallaAuth } from './components/PantallaAuth.tsx'
import { avisar, confirmar, hayConfirmacionAbierta } from './lib/alertas.ts'
import { useSesion } from './lib/useSesion.ts'
import type { Sesion } from './types.ts'

/** Sin sesión solo se ve el ingreso; con sesión, la lista de cotizaciones. */
export default function App() {
  const { sesion } = useSesion()
  return sesion ? <Principal sesion={sesion} /> : <PantallaAuth />
}

function Principal({ sesion }: { sesion: Sesion }) {
  const { salir } = useSesion()
  const chat = modoChat()
  const [modalAbierto, setModalAbierto] = useState(false)
  const [passwordAbierto, setPasswordAbierto] = useState(false)
  const passwordSucio = useRef(false)
  const [versionHistorial, setVersionHistorial] = useState(0)
  // En móvil el chat ocupa toda la pantalla: lo que queda debajo no debe recibir foco ni lectura.
  const [chatTapaTodo, setChatTapaTodo] = useState(false)
  const formularioSucio = useRef(false)

  // «Actualizar»: la lista consulta de nuevo y avisa cuántas cotizaciones nuevas hay.
  const [refrescoManual, setRefrescoManual] = useState(0)
  const [actualizando, setActualizando] = useState(false)
  const actualizar = () => {
    setActualizando(true)
    setRefrescoManual((n) => n + 1)
  }
  const alTerminarCarga = useCallback(() => setActualizando(false), [])

  const abrirModal = () => {
    formularioSucio.current = false
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    formularioSucio.current = false
    setModalAbierto(false)
  }

  /** Cierre pedido por la persona (X, Escape o clic fuera): pregunta solo si hay datos sin registrar. */
  async function solicitarCierre() {
    if (!formularioSucio.current) return cerrarModal()
    // Evita abrir una segunda confirmación (p. ej. Escape mientras ya hay una abierta).
    if (hayConfirmacionAbierta()) return

    const cerrar = await confirmar({
      titulo: '¿Cerrar el formulario?',
      texto: 'Se perderán los datos que ingresaste.',
      confirmar: 'Sí, cerrar',
      cancelar: 'Seguir editando',
      icono: 'warning',
    })
    if (cerrar) cerrarModal()
  }

  const alCambiarSucio = useCallback((sucio: boolean) => {
    formularioSucio.current = sucio
  }, [])

  const abrirPassword = () => {
    passwordSucio.current = false
    setPasswordAbierto(true)
  }

  const cerrarPassword = () => {
    passwordSucio.current = false
    setPasswordAbierto(false)
  }

  async function solicitarCierrePassword() {
    if (!passwordSucio.current) return cerrarPassword()
    if (hayConfirmacionAbierta()) return

    const cerrar = await confirmar({
      titulo: '¿Cerrar sin guardar?',
      texto: 'No se cambiará tu contraseña.',
      confirmar: 'Sí, cerrar',
      cancelar: 'Seguir editando',
      icono: 'warning',
    })
    if (cerrar) cerrarPassword()
  }

  const alCambiarSuciaPassword = useCallback((sucio: boolean) => {
    passwordSucio.current = sucio
  }, [])

  /** Cierra la sesión en la API y, pase lo que pase con la red, en este navegador. */
  async function pedirCierreSesion() {
    if (hayConfirmacionAbierta()) return
    const cerrar = await confirmar({
      titulo: '¿Cerrar sesión?',
      confirmar: 'Sí, cerrar sesión',
      cancelar: 'Cancelar',
    })
    if (!cerrar) return

    try {
      await cerrarSesion(sesion.token)
    } catch {
      // Si la API no responde, igual se descarta la sesión local: el token vence solo.
    }
    salir()
    avisar('info', 'Sesión cerrada')
  }

  return (
    <>
      {/* h-dvh + overflow-hidden: la página nunca hace scroll; la lista se pagina para caber. */}
      <div inert={modalAbierto || passwordAbierto} className="h-dvh overflow-hidden">
        <main inert={chatTapaTodo} className="mx-auto flex h-full max-w-5xl flex-col gap-4 px-4 py-4 sm:py-6">
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-marca">FastExpress</p>
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Cotizaciones</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={actualizar}
                disabled={actualizando}
                aria-label="Actualizar cotizaciones"
                title="Actualizar cotizaciones"
                data-testid="historial-actualizar"
                className="grid size-10 place-items-center rounded-lg border border-linea bg-tarjeta text-tinta-suave transition-colors hover:border-marca hover:text-marca focus-visible:outline-2 focus-visible:outline-marca disabled:opacity-60 disabled:hover:border-linea disabled:hover:text-tinta-suave"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className={`size-5 ${actualizando ? 'motion-safe:animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                  <path d="M16 16h5v5" />
                </svg>
              </button>
              {/* En móvil el texto se acorta a «Nueva» para que quepa junto al título; el nombre accesible no cambia. */}
              <button
                type="button"
                onClick={abrirModal}
                aria-label="Nueva cotización"
                data-testid="nueva-cotizacion-btn"
                className="flex h-10 items-center gap-1.5 rounded-lg bg-marca px-3 text-sm font-semibold text-white transition-colors hover:bg-marca-oscuro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca sm:px-4"
              >
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M10 4v12M4 10h12" />
                </svg>
                <span className="sm:hidden">Nueva</span>
                <span className="hidden sm:inline">Nueva cotización</span>
              </button>
              <MenuUsuario
                usuario={sesion.usuario}
                onCambiarPassword={abrirPassword}
                onCerrarSesion={pedirCierreSesion}
              />
            </div>
          </header>

          <HistorialList version={versionHistorial} refrescoManual={refrescoManual} onTerminoCarga={alTerminarCarga} />
        </main>

        {/* Dentro del bloque inerte: mientras el modal está abierto, el chat tampoco recibe foco. */}
        {chat !== 'off' && (
          <ChatWidget demo={chat === 'mock'} onNuevaCotizacion={abrirModal} onPantallaCompleta={setChatTapaTodo} />
        )}
      </div>

      <Modal abierto={modalAbierto} titulo="Nueva cotización" onCerrar={solicitarCierre}>
        <CotizadorForm
          onCotizado={() => setVersionHistorial((v) => v + 1)}
          onCerrar={cerrarModal}
          onSucio={alCambiarSucio}
        />
      </Modal>

      <Modal abierto={passwordAbierto} titulo="Cambiar contraseña" onCerrar={solicitarCierrePassword}>
        <CambiarPasswordForm onCambiada={cerrarPassword} onSucio={alCambiarSuciaPassword} />
      </Modal>
    </>
  )
}
