import { useEffect, useMemo, useState } from 'react'
import { fetchGastos, fetchVentasEntre, type Gasto, type MetodoPago, type Tenant, type Venta } from '@cdc/shared'

type Periodo = 'hoy' | 'semana' | 'mes'

const ETIQUETA_PERIODO: Record<Periodo, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes'
}

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  posnet: 'Posnet',
  transferencia: 'Transferencia'
}

// YYYY-MM-DD en el huso horario local (no toISOString: eso convierte a UTC
// y puede correr la fecha un día, justo lo que rompía el filtro de gastos).
function fechaLocalYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function rangoDe(periodo: Periodo): { desde: Date; hasta: Date; desdeYMD: string; hastaYMD: string } {
  const hasta = new Date()
  const desde = new Date()
  if (periodo === 'hoy') {
    desde.setHours(0, 0, 0, 0)
  } else if (periodo === 'semana') {
    const diaSemana = (desde.getDay() + 6) % 7 // lunes = 0
    desde.setDate(desde.getDate() - diaSemana)
    desde.setHours(0, 0, 0, 0)
  } else {
    desde.setDate(1)
    desde.setHours(0, 0, 0, 0)
  }
  return { desde, hasta, desdeYMD: fechaLocalYMD(desde), hastaYMD: fechaLocalYMD(hasta) }
}

export function Reportes({ tenant }: { tenant: Tenant }) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [ventas, setVentas] = useState<Venta[] | null>(null)
  const [gastos, setGastos] = useState<Gasto[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const { desde, hasta, desdeYMD, hastaYMD } = rangoDe(periodo)
    setVentas(null)
    setError(null)
    Promise.all([fetchVentasEntre(tenant.id, desde.toISOString(), hasta.toISOString()), fetchGastos(tenant.id)])
      .then(([listaVentas, listaGastos]) => {
        setVentas(listaVentas.filter((v) => v.estado === 'completada'))
        setGastos(listaGastos.filter((g) => g.fecha >= desdeYMD && g.fecha <= hastaYMD))
      })
      .catch(() => setError('No se pudieron cargar los datos del reporte.'))
  }, [tenant.id, periodo])

  const totales = useMemo(() => {
    const totalVentas = (ventas ?? []).reduce((acc, v) => acc + v.total, 0)
    const totalGastos = (gastos ?? []).reduce((acc, g) => acc + g.monto, 0)
    const porMetodo: Record<MetodoPago, number> = { efectivo: 0, posnet: 0, transferencia: 0 }
    for (const v of ventas ?? []) {
      porMetodo[v.metodo_pago] += v.total
    }
    return { totalVentas, totalGastos, porMetodo, resultado: totalVentas - totalGastos }
  }, [ventas, gastos])

  return (
    <div>
      <h2>Reportes</h2>

      <div className="panel-tabs panel-tabs-secundarias">
        {(Object.keys(ETIQUETA_PERIODO) as Periodo[]).map((p) => (
          <button
            key={p}
            className={`panel-tab ${periodo === p ? 'activo' : ''}`}
            onClick={() => setPeriodo(p)}
          >
            {ETIQUETA_PERIODO[p]}
          </button>
        ))}
      </div>

      {error && <p className="warn">{error}</p>}
      {ventas === null && !error && <p className="app-status">Cargando...</p>}

      {ventas !== null && (
        <>
          <div className="panel-stats">
            <div className="panel-stat">
              <span className="panel-stat-etiqueta">Total vendido</span>
              <span className="panel-stat-valor">${totales.totalVentas.toFixed(2)}</span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-etiqueta">Ventas</span>
              <span className="panel-stat-valor">{ventas.length}</span>
            </div>
            <div className="panel-stat">
              <span className="panel-stat-etiqueta">Gastos</span>
              <span className="panel-stat-valor">${totales.totalGastos.toFixed(2)}</span>
            </div>
            <div className={`panel-stat ${totales.resultado < 0 ? 'panel-stat-negativo' : ''}`}>
              <span className="panel-stat-etiqueta">Resultado</span>
              <span className="panel-stat-valor">${totales.resultado.toFixed(2)}</span>
            </div>
          </div>

          <h3>Por método de pago</h3>
          <table className="panel-tabla">
            <tbody>
              {(Object.keys(ETIQUETA_METODO) as MetodoPago[]).map((m) => (
                <tr key={m}>
                  <td>{ETIQUETA_METODO[m]}</td>
                  <td>${totales.porMetodo[m].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
