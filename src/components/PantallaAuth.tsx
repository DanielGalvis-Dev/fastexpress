import { useState } from 'react'
import { LoginForm } from './LoginForm.tsx'
import { RecuperarForm } from './RecuperarForm.tsx'
import { RegistroForm } from './RegistroForm.tsx'

type Vista =
  | { nombre: 'login'; email?: string; aviso?: string }
  | { nombre: 'registro' }
  | { nombre: 'recuperar' }

const TITULOS = {
  login: 'Ingresar',
  registro: 'Crear cuenta',
  recuperar: 'Recuperar contraseña',
} as const

/** Pantalla completa para quien no tiene sesión: ingreso, registro y recuperación de contraseña. */
export function PantallaAuth() {
  const [vista, setVista] = useState<Vista>({ nombre: 'login' })
  const irALogin = () => setVista({ nombre: 'login' })

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-8">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-marca">FastExpress</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight" data-testid="auth-titulo">
          {TITULOS[vista.nombre]}
        </h1>

        <div className="mt-5 rounded-2xl border border-linea bg-tarjeta p-5 shadow-sm">
          {vista.nombre === 'login' && (
            <LoginForm
              key={`login-${vista.email ?? ''}-${vista.aviso ?? ''}`}
              emailInicial={vista.email}
              aviso={vista.aviso}
              onIrARegistro={() => setVista({ nombre: 'registro' })}
              onIrARecuperar={() => setVista({ nombre: 'recuperar' })}
            />
          )}
          {vista.nombre === 'registro' && (
            <RegistroForm
              onRegistrado={(email) =>
                setVista({ nombre: 'login', email, aviso: 'Cuenta creada. Ya puedes iniciar sesión.' })
              }
              onIrALogin={irALogin}
            />
          )}
          {vista.nombre === 'recuperar' && (
            <RecuperarForm
              onRestablecida={(email, aviso) => setVista({ nombre: 'login', email, aviso })}
              onIrALogin={irALogin}
            />
          )}
        </div>
      </div>
    </main>
  )
}
