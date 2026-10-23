import { describe, expect, it } from 'vitest'
import {
  PASSWORD_MIN_CARACTERES,
  sanitizarPeso,
  validarCodigo,
  validarConfirmacion,
  validarEmail,
  validarNombre,
  validarPassword,
  validarPasswordIngreso,
  validarPeso,
  validarTipoCliente,
  validarTipoEnvio,
} from './validation.ts'

describe('validarNombre', () => {
  it('recorta y colapsa espacios', () => {
    expect(validarNombre('  Ana   Pérez ')).toEqual({ ok: true, valor: 'Ana Pérez' })
  })
  it.each(['', '   '])('rechaza un nombre vacío (%j)', (entrada) => {
    expect(validarNombre(entrada)).toEqual({ ok: false, error: 'Ingresa tu nombre.' })
  })
})

describe('validarEmail', () => {
  it('acepta un correo válido y lo normaliza a minúsculas sin espacios', () => {
    expect(validarEmail('  Ana@Correo.COM ')).toEqual({ ok: true, valor: 'ana@correo.com' })
  })
  it('exige algo escrito', () => {
    expect(validarEmail('')).toMatchObject({ ok: false, error: 'Ingresa tu correo electrónico.' })
  })
  it.each(['ana', 'ana@', '@correo.com', 'ana@correo', 'ana @correo.com', 'a@b@c.com'])(
    'rechaza un formato inválido (%j)',
    (entrada) => {
      expect(validarEmail(entrada)).toMatchObject({ ok: false })
    },
  )
})

describe('validarPassword — alta y cambio (largo mínimo)', () => {
  it('exige algo escrito', () => {
    expect(validarPassword('')).toMatchObject({ ok: false, error: 'Ingresa la contraseña.' })
  })
  it('rechaza una contraseña más corta que el mínimo y acepta justo el mínimo (BVA)', () => {
    expect(validarPassword('a'.repeat(PASSWORD_MIN_CARACTERES - 1)).ok).toBe(false)
    expect(validarPassword('a'.repeat(PASSWORD_MIN_CARACTERES)).ok).toBe(true)
    expect(validarPassword('a'.repeat(PASSWORD_MIN_CARACTERES + 1)).ok).toBe(true)
  })
  it('no recorta la contraseña: los espacios cuentan', () => {
    expect(validarPassword('  abc  ')).toEqual({ ok: true, valor: '  abc  ' })
  })
})

describe('validarPasswordIngreso — login', () => {
  it('solo exige que haya algo escrito (no aplica el largo mínimo)', () => {
    expect(validarPasswordIngreso('')).toMatchObject({ ok: false })
    expect(validarPasswordIngreso('a')).toEqual({ ok: true, valor: 'a' })
  })
})

describe('validarConfirmacion', () => {
  it('exige repetir la contraseña', () => {
    expect(validarConfirmacion('abc12', '')).toMatchObject({ ok: false, error: 'Repite la contraseña.' })
  })
  it('rechaza si no coincide', () => {
    expect(validarConfirmacion('abc12', 'abc13')).toMatchObject({ ok: false, error: 'Las contraseñas no coinciden.' })
  })
  it('acepta si coincide', () => {
    expect(validarConfirmacion('abc12', 'abc12').ok).toBe(true)
  })
})

describe('validarCodigo', () => {
  it('recorta el código', () => {
    expect(validarCodigo(' 123456 ')).toEqual({ ok: true, valor: '123456' })
  })
  it('rechaza un código vacío', () => {
    expect(validarCodigo('  ')).toMatchObject({ ok: false })
  })
})

describe('sanitizarPeso (solo números y un separador decimal)', () => {
  it.each([
    ['', ''],
    ['12', '12'],
    ['2.5', '2.5'],
    ['2,5', '2,5'],
    ['abc', ''], // las letras no pasan
    ['1a2b', '12'],
    ['5kg', '5'],
    ['1e3', '13'], // la «e» de notación científica tampoco
    ['-3', '3'], // sin signo negativo
    ['+3', '3'],
    ['$ 12', '12'],
    ['1.2.3', '1.23'], // un solo separador
    ['1,2.3', '1,23'],
    ['..', '0.'],
    ['.5', '0.5'], // un separador inicial se completa con 0
    [',5', '0,5'],
    ['5.', '5.'], // decimal a medias
  ])('«%s» → «%s»', (entrada, esperado) => {
    expect(sanitizarPeso(entrada)).toBe(esperado)
  })

  it('lo que sale de sanitizarPeso nunca contiene letras ni símbolos', () => {
    const basura = 'a1b2.c3,d4-e5+f6 g7!h8@i9#j0'
    expect(sanitizarPeso(basura)).toMatch(/^\d*[.,]?\d*$/)
  })
})

describe('validarPeso — particiones y valores límite (BR-02)', () => {
  const validos: [string, number][] = [
    ['0.01', 0.01], // límite inferior de la partición 1
    ['0.02', 0.02],
    ['4.99', 4.99],
    ['5.00', 5], // límite superior de la partición 1
    ['5.01', 5.01], // límite inferior de la partición 2
    ['5.02', 5.02],
    ['19.99', 19.99],
    ['20.00', 20], // límite superior permitido
    ['2,5', 2.5], // coma decimal
    ['5.', 5], // decimal a medias mientras se escribe
    ['  7 ', 7], // espacios
  ]
  it.each(validos)('acepta %s', (entrada, esperado) => {
    expect(validarPeso(entrada)).toEqual({ ok: true, valor: esperado })
  })

  const invalidos: [string, string][] = [
    ['', 'Ingresa el peso'],
    ['   ', 'Ingresa el peso'],
    ['abc', 'debe ser un número'],
    ['5kg', 'debe ser un número'],
    ['1e3', 'debe ser un número'],
    ['0', 'mayor que 0'],
    ['0.00', 'mayor que 0'],
    ['-1', 'mayor que 0'],
    ['20.01', 'máximo permitido'],
    ['150', 'máximo permitido'],
  ]
  it.each(invalidos)('rechaza "%s"', (entrada, fragmento) => {
    const r = validarPeso(entrada)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain(fragmento)
  })
})

describe('validación de selects', () => {
  it('acepta solo los tipos de cliente definidos', () => {
    expect(['NUEVO', 'FRECUENTE', 'VIP'].every(validarTipoCliente)).toBe(true)
    expect(validarTipoCliente('')).toBe(false)
    expect(validarTipoCliente('vip')).toBe(false)
  })
  it('acepta solo los tipos de envío definidos', () => {
    expect(['ESTANDAR', 'EXPRESS'].every(validarTipoEnvio)).toBe(true)
    expect(validarTipoEnvio('')).toBe(false)
    expect(validarTipoEnvio('PRIORITARIO')).toBe(false)
  })
})
