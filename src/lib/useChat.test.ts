import { describe, expect, it } from 'vitest'
import { construirHistorial } from './useChat.ts'
import type { MensajeChat } from './useChat.ts'

let id = 0
const u = (texto: string): MensajeChat => ({ id: ++id, rol: 'usuario', texto })
const a = (texto: string, tipo: MensajeChat['tipo'] = 'estadistica'): MensajeChat => ({
  id: ++id,
  rol: 'asistente',
  texto,
  tipo,
})

describe('construirHistorial', () => {
  it('devuelve los turnos completos alternando usuario y asistente', () => {
    expect(construirHistorial([u('p1'), a('r1'), u('p2'), a('r2')])).toEqual([
      { rol: 'usuario', texto: 'p1' },
      { rol: 'asistente', texto: 'r1' },
      { rol: 'usuario', texto: 'p2' },
      { rol: 'asistente', texto: 'r2' },
    ])
  })

  it('omite los errores y el mensaje del usuario que quedó sin respuesta', () => {
    const h = construirHistorial([u('p1'), a('r1'), u('p2'), a('falló', 'error'), u('p3'), a('r3')])
    expect(h.map((t) => t.texto)).toEqual(['p1', 'r1', 'p3', 'r3'])
  })

  it('omite un último mensaje del usuario aún sin responder', () => {
    expect(construirHistorial([u('p1'), a('r1'), u('p2')]).map((t) => t.texto)).toEqual(['p1', 'r1'])
  })

  it('incluye los chistes para mantener la alternancia', () => {
    const h = construirHistorial([u('capital'), a('chiste', 'fuera_de_contexto')])
    expect(h).toHaveLength(2)
  })

  it('conserva como máximo los 6 mensajes más recientes', () => {
    const mensajes = Array.from({ length: 5 }, (_, i) => [u(`p${i}`), a(`r${i}`)]).flat()
    const h = construirHistorial(mensajes)
    expect(h).toHaveLength(6)
    expect(h[0].texto).toBe('p2')
    expect(h.at(-1)?.texto).toBe('r4')
  })

  it('con una conversación vacía devuelve []', () => {
    expect(construirHistorial([])).toEqual([])
  })
})
