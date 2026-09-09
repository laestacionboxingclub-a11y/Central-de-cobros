import { useEffect, useState } from 'react'
import { fetchCajas, fetchCierresCaja, type Caja, type CierreCaja, type Tenant } from '@cdc/shared'

export function Cierres({ tenant }: { tenant: Tenant }) {
  const [cierres, setCierres] = useState<CierreCaja[] | null>(null)
  const [cajas, setCajas] = useState<Caja[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([fetchCierresCaja(tenant.id), fetchCajas(tenant.id)])
      .then(([listaCierres, listaCajas]) => {
        setCierres(listaCierres)
        setCajas(listaCajas)
      })
      .catch(() => setError('No se pudieron cargar los cierres de caja.'))
  }, [tenant.id])

  function nombreCaja(cajaId: string) {
    return cajas.find((c) => c.id === cajaId)?.nombre ?? 'Caja'
  }

  return (
    <div>
      <h2>Cierres de caja</h2>
      <p className="app-status">
        Cada vez que un cajero cierra la caja, queda acá: cuánto efectivo esperaba el sistema contra lo que
        contaron de verdad.
      </p>

      {error && <p className="warn">{error}</p>}

      {cierres === null && !error && <p className="app-status">Cargando...</p>}
      {cierres !== null && cierres.length === 0 && (
        <p className="app-status">Todavía no se cerró ninguna caja.</p>
      )}

      {cierres !== null && cierres.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Caja</th>
              <th>Esperado</th>
              <th>Contado</th>
              <th>Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {cierres.map((c) => (
              <tr key={c.id}>
                <td>{new Date(c.creado_en).toLocaleString('es-AR')}</td>
                <td>{nombreCaja(c.caja_id)}</td>
                <td>${c.efectivo_esperado.toFixed(2)}</td>
                <td>${c.efectivo_contado.toFixed(2)}</td>
                <td className={c.diferencia !== 0 ? 'texto-alerta' : ''}>
                  {c.diferencia === 0
                    ? 'Coincide'
                    : c.diferencia > 0
                      ? `Sobran $${c.diferencia.toFixed(2)}`
                      : `Faltan $${Math.abs(c.diferencia).toFixed(2)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
