import Swal from 'sweetalert2'

/**
 * Único punto de uso de SweetAlert2. El resto de la app llama a estas funciones
 * (y en las pruebas se sustituyen por mocks).
 */
const colores = {
  confirmButtonColor: '#c2410c', // --color-marca
  cancelButtonColor: '#5b6272', // --color-tinta-suave
} as const

// heightAuto: false y scrollbarPadding: false evitan que SweetAlert2 toque el alto y el padding de
// <html>/<body>, lo que rompería el diseño sin scroll (h-dvh). `heightAuto` solo va en los diálogos:
// con toast SweetAlert2 lo rechaza («incompatible with toasts»).
// keydownListenerCapture: Escape funciona aunque el foco no esté dentro de la alerta, y como
// SweetAlert2 detiene la propagación, el Escape del modal de debajo no se dispara a la vez.
const dialogo = Swal.mixin({
  ...colores,
  heightAuto: false,
  scrollbarPadding: false,
  reverseButtons: true,
  keydownListenerCapture: true,
})

const aviso = Swal.mixin({
  ...colores,
  scrollbarPadding: false,
  toast: true,
  // Arriba al centro: en las esquinas taparía los botones de la cabecera y el del asistente.
  position: 'top',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
})

let abiertas = 0

/** true mientras hay un diálogo de confirmación abierto (los avisos tipo toast no cuentan). */
export function hayConfirmacionAbierta(): boolean {
  return abiertas > 0
}

interface OpcionesConfirmar {
  titulo: string
  texto?: string
  confirmar: string
  cancelar: string
  icono?: 'question' | 'warning'
}

/**
 * Devuelve true si la persona confirma; false si cancela o descarta el diálogo.
 *
 * No resuelve hasta que el diálogo terminó de cerrarse (`didClose`): mientras se cierra,
 * SweetAlert2 mantiene `aria-hidden` sobre el resto de la página, y si quien llama mueve el foco
 * a un elemento de esa página en ese instante, el navegador avisa «Blocked aria-hidden…».
 */
export async function confirmar({
  titulo,
  texto,
  confirmar: textoConfirmar,
  cancelar,
  icono = 'question',
}: OpcionesConfirmar): Promise<boolean> {
  abiertas++
  try {
    let terminoDeCerrar!: () => void
    const cerrado = new Promise<void>((resolver) => (terminoDeCerrar = resolver))

    const r = await dialogo.fire({
      title: titulo,
      text: texto,
      icon: icono,
      showCancelButton: true,
      confirmButtonText: textoConfirmar,
      cancelButtonText: cancelar,
      // En acciones destructivas el foco inicial va a la opción segura.
      focusCancel: icono === 'warning',
      didClose: terminoDeCerrar,
    })
    await cerrado
    return r.isConfirmed
  } finally {
    abiertas--
  }
}

export function avisar(icono: 'success' | 'info' | 'error', titulo: string): void {
  void aviso.fire({ icon: icono, title: titulo })
}
