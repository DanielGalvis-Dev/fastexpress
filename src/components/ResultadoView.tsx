import { moneda } from '../lib/formato.ts'
import type { DesgloseCotizacion, ResultadoCotizacion } from '../types.ts'

const FILAS: { clave: keyof DesgloseCotizacion; etiqueta: string; signo: string }[] = [
  { clave: 'tarifaBase', etiqueta: 'Tarifa base', signo: '' },
  { clave: 'costoPeso', etiqueta: 'Costo por peso', signo: '' },
  { clave: 'subtotal', etiqueta: 'Subtotal', signo: '' },
  { clave: 'descuentoAplicado', etiqueta: 'Descuento por cliente', signo: '−' },
  { clave: 'recargoAplicado', etiqueta: 'Recargo por envío', signo: '+' },
]

export function ResultadoView({ resultado }: { resultado: ResultadoCotizacion }) {
  const filas = FILAS.filter(({ clave }) => resultado.desglose?.[clave] !== undefined)

  return (
    <section
      aria-labelledby="titulo-resultado"
      data-testid="resultado"
      className="rounded-2xl border border-linea bg-tarjeta p-5"
    >
      <h3 id="titulo-resultado" className="text-sm font-semibold uppercase tracking-wide text-tinta-suave">
        Tu cotización
      </h3>
      <p className="mt-1 text-4xl font-semibold tabular-nums text-tinta" data-testid="resultado-total">
        {moneda.format(resultado.total)}
      </p>

      {filas.length > 0 && (
        <dl className="mt-4 divide-y divide-linea border-t border-linea text-sm">
          {filas.map(({ clave, etiqueta, signo }) => (
            <div key={clave} className="flex justify-between py-1.5">
              <dt className="text-tinta-suave">{etiqueta}</dt>
              <dd className="tabular-nums" data-testid={`desglose-${clave}`}>
                {signo}
                {moneda.format(resultado.desglose![clave]!)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
