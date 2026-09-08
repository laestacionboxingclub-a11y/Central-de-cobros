import { useEffect, useMemo, useState } from 'react'
import {
  fetchCajas,
  fetchGastos,
  fetchItemsDeVentas,
  fetchPerfilesDeTenant,
  fetchTodosLosProductos,
  fetchVentasEntre,
  type Caja,
  type Gasto,
  type MetodoPago,
  type Perfil,
  type Producto,
  type Tenant,
  type Venta,
  type VentaItem
} from '@cdc/shared'

type Periodo = 'hoy' | 'semana' | 'mes' | 'personalizado'

const ETIQUETA_PERIODO: Record<Periodo, string> = {
  hoy: 'Hoy',
  semana: 'Esta semana',
  mes: 'Este mes',
  personalizado: 'Personalizado'
}

const METODOS: MetodoPago[] = ['efectivo', 'posnet', 'transferencia', 'cuenta_corriente']

const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  posnet: 'Posnet',
  transferencia: 'Transferencia',
  cuenta_corriente: 'Cuenta corriente'
}

// YYYY-MM-DD en el huso horario local (no toISOString: eso convierte a UTC
// y puede correr la fecha un día).
function fechaLocalYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

function rangoPreset(periodo: Exclude<Periodo, 'personalizado'>): { desde: Date; hasta: Date } {
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
  return { desde, hasta }
}

function csv(valor: string | number): string {
  if (typeof valor === 'number') return String(valor)
  return `"${valor.replace(/"/g, '""')}"`
}

export function Reportes({ tenant }: { tenant: Tenant }) {
  const [periodo, setPeriodo] = useState<Periodo>('hoy')
  const [desdeInput, setDesdeInput] = useState(fechaLocalYMD(new Date()))
  const [hastaInput, setHastaInput] = useState(fechaLocalYMD(new Date()))

  const [ventas, setVentas] = useState<Venta[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [cajas, setCajas] = useState<Caja[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [items, setItems] = useState<VentaItem[]>([])
  const [totalAnterior, setTotalAnterior] = useState<number | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cajaSeleccionada, setCajaSeleccionada] = useState<string | null>(null)

  const { desde, hasta, desdeYMD, hastaYMD } = useMemo(() => {
    if (periodo === 'personalizado') {
      return {
        desde: new Date(`${desdeInput}T00:00:00`),
        hasta: new Date(`${hastaInput}T23:59:59.999`),
        desdeYMD: desdeInput,
        hastaYMD: hastaInput
      }
    }
    const { desde, hasta } = rangoPreset(periodo)
    return { desde, hasta, desdeYMD: fechaLocalYMD(desde), hastaYMD: fechaLocalYMD(hasta) }
  }, [periodo, desdeInput, hastaInput])

  // Mismo largo de período, inmediatamente antes, para poder comparar
  // ("vendiste 12% más que el período anterior").
  const { desdeAnterior, hastaAnterior } = useMemo(() => {
    const duracion = hasta.getTime() - desde.getTime()
    const hastaAnt = new Date(desde.getTime() - 1)
    const desdeAnt = new Date(hastaAnt.getTime() - duracion)
    return { desdeAnterior: desdeAnt, hastaAnterior: hastaAnt }
  }, [desde, hasta])

  useEffect(() => {
    let cancelado = false
    setCargando(true)
    setError(null)
    Promise.all([
      fetchVentasEntre(tenant.id, desde.toISOString(), hasta.toISOString()),
      fetchVentasEntre(tenant.id, desdeAnterior.toISOString(), hastaAnterior.toISOString()),
      fetchGastos(tenant.id),
      fetchCajas(tenant.id),
      fetchTodosLosProductos(tenant.id),
      fetchPerfilesDeTenant(tenant.id)
    ])
      .then(async ([listaVentas, ventasAnteriores, listaGastos, listaCajas, listaProductos, listaPerfiles]) => {
        const completadas = listaVentas.filter((v) => v.estado === 'completada')
        const listaItems = await fetchItemsDeVentas(completadas.map((v) => v.id))
        if (cancelado) return
        setVentas(completadas)
        setTotalAnterior(ventasAnteriores.filter((v) => v.estado === 'completada').reduce((acc, v) => acc + v.total, 0))
        setGastos(listaGastos.filter((g) => g.fecha >= desdeYMD && g.fecha <= hastaYMD))
        setCajas(listaCajas)
        setProductos(listaProductos)
        setPerfiles(listaPerfiles)
        setItems(listaItems)
      })
      .catch(() => {
        if (!cancelado) setError('No se pudieron cargar los datos del reporte.')
      })
      .finally(() => {
        if (!cancelado) setCargando(false)
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id, desdeYMD, hastaYMD])

  const totales = useMemo(() => {
    const totalVentas = ventas.reduce((acc, v) => acc + v.total, 0)
    const totalGastos = gastos.reduce((acc, g) => acc + g.monto, 0)
    const porMetodo: Record<MetodoPago, number> = { efectivo: 0, posnet: 0, transferencia: 0, cuenta_corriente: 0 }
    for (const v of ventas) porMetodo[v.metodo_pago] += v.total
    return { totalVentas, totalGastos, porMetodo, resultado: totalVentas - totalGastos }
  }, [ventas, gastos])

  const porCaja = useMemo(() => {
    const mapa = new Map<string, { ventas: number; total: number; efectivo: number }>()
    for (const v of ventas) {
      const actual = mapa.get(v.caja_id) ?? { ventas: 0, total: 0, efectivo: 0 }
      actual.ventas += 1
      actual.total += v.total
      if (v.metodo_pago === 'efectivo') actual.efectivo += v.total
      mapa.set(v.caja_id, actual)
    }
    return cajas
      .map((c) => ({ caja: c, ...(mapa.get(c.id) ?? { ventas: 0, total: 0, efectivo: 0 }) }))
      .filter((f) => f.ventas > 0)
      .sort((a, b) => b.total - a.total)
  }, [ventas, cajas])

  // Detalle completo de UNA caja elegida: sus propias ventas, método de pago,
  // ventas por día y productos más vendidos — no solo la fila resumen.
  const detalleCaja = useMemo(() => {
    if (!cajaSeleccionada) return null
    const caja = cajas.find((c) => c.id === cajaSeleccionada)
    if (!caja) return null

    const ventasCaja = ventas.filter((v) => v.caja_id === cajaSeleccionada)
    const total = ventasCaja.reduce((acc, v) => acc + v.total, 0)
    const porMetodo: Record<MetodoPago, number> = { efectivo: 0, posnet: 0, transferencia: 0, cuenta_corriente: 0 }
    for (const v of ventasCaja) porMetodo[v.metodo_pago] += v.total

    const idsVenta = new Set(ventasCaja.map((v) => v.id))
    const itemsCaja = items.filter((i) => idsVenta.has(i.venta_id))
    const mapaProd = new Map<string, { cantidad: number; monto: number }>()
    for (const item of itemsCaja) {
      const actual = mapaProd.get(item.producto_id) ?? { cantidad: 0, monto: 0 }
      actual.cantidad += item.cantidad
      actual.monto += item.subtotal
      mapaProd.set(item.producto_id, actual)
    }
    const masVendidosCaja = [...mapaProd.entries()]
      .map(([productoId, datos]) => ({ producto: productos.find((p) => p.id === productoId), ...datos }))
      .filter((f): f is { producto: Producto; cantidad: number; monto: number } => Boolean(f.producto))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 5)

    const mapaDia = new Map<string, number>()
    for (const v of ventasCaja) {
      const clave = fechaLocalYMD(new Date(v.creada_en))
      mapaDia.set(clave, (mapaDia.get(clave) ?? 0) + v.total)
    }

    return {
      caja,
      cantidadVentas: ventasCaja.length,
      total,
      efectivo: porMetodo.efectivo,
      porMetodo,
      masVendidos: masVendidosCaja,
      porDia: [...mapaDia.entries()].sort(([a], [b]) => a.localeCompare(b))
    }
  }, [cajaSeleccionada, cajas, ventas, items, productos])

  const masVendidos = useMemo(() => {
    const mapa = new Map<string, { cantidad: number; monto: number }>()
    for (const item of items) {
      const actual = mapa.get(item.producto_id) ?? { cantidad: 0, monto: 0 }
      actual.cantidad += item.cantidad
      actual.monto += item.subtotal
      mapa.set(item.producto_id, actual)
    }
    return [...mapa.entries()]
      .map(([productoId, datos]) => ({ producto: productos.find((p) => p.id === productoId), ...datos }))
      .filter((f): f is { producto: Producto; cantidad: number; monto: number } => Boolean(f.producto))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 10)
  }, [items, productos])

  const variacion = useMemo(() => {
    if (totalAnterior === null || totalAnterior === 0) return null
    return ((totales.totalVentas - totalAnterior) / totalAnterior) * 100
  }, [totales.totalVentas, totalAnterior])

  const porDia = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const v of ventas) {
      const clave = fechaLocalYMD(new Date(v.creada_en))
      mapa.set(clave, (mapa.get(clave) ?? 0) + v.total)
    }
    return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [ventas])

  const porCajero = useMemo(() => {
    const mapa = new Map<string, { ventas: number; total: number }>()
    for (const v of ventas) {
      const actual = mapa.get(v.cajero_id) ?? { ventas: 0, total: 0 }
      actual.ventas += 1
      actual.total += v.total
      mapa.set(v.cajero_id, actual)
    }
    return [...mapa.entries()]
      .map(([cajeroId, datos]) => ({
        id: cajeroId,
        nombre: perfiles.find((p) => p.id === cajeroId)?.nombre ?? 'Cajero eliminado',
        ...datos
      }))
      .sort((a, b) => b.total - a.total)
  }, [ventas, perfiles])

  function descargarCSV() {
    const filas: string[] = []
    filas.push(csv('Central de Cobros - Reporte'))
    filas.push(`${csv('Verdulería')},${csv(tenant.nombre)}`)
    filas.push(`${csv('Período')},${csv(desdeYMD)},${csv('a')},${csv(hastaYMD)}`)
    filas.push('')
    filas.push([csv('Total vendido'), csv('Ventas'), csv('Gastos'), csv('Resultado')].join(','))
    filas.push(
      [totales.totalVentas.toFixed(2), ventas.length, totales.totalGastos.toFixed(2), totales.resultado.toFixed(2)].join(
        ','
      )
    )
    filas.push('')
    filas.push([csv('Método de pago'), csv('Monto')].join(','))
    for (const m of METODOS) filas.push([csv(ETIQUETA_METODO[m]), totales.porMetodo[m].toFixed(2)].join(','))
    filas.push('')
    filas.push([csv('Caja'), csv('Ventas'), csv('Total vendido'), csv('Efectivo acumulado')].join(','))
    for (const f of porCaja) {
      filas.push([csv(f.caja.nombre), f.ventas, f.total.toFixed(2), f.efectivo.toFixed(2)].join(','))
    }
    filas.push('')
    filas.push([csv('Producto'), csv('Cantidad vendida'), csv('Monto')].join(','))
    for (const f of masVendidos) {
      filas.push([csv(f.producto.nombre), f.cantidad, f.monto.toFixed(2)].join(','))
    }
    filas.push('')
    filas.push([csv('Cajero'), csv('Ventas'), csv('Total vendido')].join(','))
    for (const f of porCajero) {
      filas.push([csv(f.nombre), f.ventas, f.total.toFixed(2)].join(','))
    }
    filas.push('')
    filas.push([csv('Fecha'), csv('Total vendido')].join(','))
    for (const [fecha, total] of porDia) {
      filas.push([csv(fecha), total.toFixed(2)].join(','))
    }
    if (variacion !== null) {
      filas.push('')
      filas.push([csv('Variación vs. período anterior'), `${variacion.toFixed(1)}%`].join(','))
    }

    const blob = new Blob([filas.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte_${desdeYMD}_a_${hastaYMD}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="panel-seccion-header">
        <h2>Reportes</h2>
        <button className="btn-secundario" onClick={descargarCSV} disabled={cargando || ventas.length === 0}>
          Descargar CSV
        </button>
      </div>

      <div className="panel-tabs panel-tabs-secundarias">
        {(Object.keys(ETIQUETA_PERIODO) as Periodo[]).map((p) => (
          <button key={p} className={`panel-tab ${periodo === p ? 'activo' : ''}`} onClick={() => setPeriodo(p)}>
            {ETIQUETA_PERIODO[p]}
          </button>
        ))}
      </div>

      {periodo === 'personalizado' && (
        <div className="reportes-fechas">
          <label>
            Desde
            <input type="date" value={desdeInput} onChange={(e) => setDesdeInput(e.target.value)} />
          </label>
          <label>
            Hasta
            <input type="date" value={hastaInput} onChange={(e) => setHastaInput(e.target.value)} />
          </label>
        </div>
      )}

      {error && <p className="warn">{error}</p>}
      {cargando && <p className="app-status">Cargando...</p>}

      {!cargando && !error && (
        <>
          <div className="panel-stats">
            <div className="panel-stat">
              <span className="panel-stat-etiqueta">Total vendido</span>
              <span className="panel-stat-valor">${totales.totalVentas.toFixed(2)}</span>
              {variacion !== null && (
                <span className={`panel-stat-variacion ${variacion >= 0 ? 'positiva' : 'negativa'}`}>
                  {variacion >= 0 ? '▲' : '▼'} {Math.abs(variacion).toFixed(0)}% vs. período anterior
                </span>
              )}
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

          {porDia.length > 1 && (
            <>
              <h3>Ventas por día</h3>
              <div className="reportes-chart-wrap">
                <div className="reportes-chart">
                  {(() => {
                    const maxDia = Math.max(1, ...porDia.map(([, t]) => t))
                    return porDia.map(([fecha, total]) => (
                      <div key={fecha} className="reportes-barra-col" title={`${fecha}: $${total.toFixed(2)}`}>
                        <div className="reportes-barra" style={{ height: `${(total / maxDia) * 100}%` }} />
                        <span className="reportes-barra-etiqueta">{fecha.slice(5)}</span>
                      </div>
                    ))
                  })()}
                </div>
              </div>
            </>
          )}

          <h3>Por método de pago</h3>
          <table className="panel-tabla">
            <tbody>
              {METODOS.map((m) => (
                <tr key={m}>
                  <td>{ETIQUETA_METODO[m]}</td>
                  <td>${totales.porMetodo[m].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Por caja</h3>
          {cajas.length === 0 ? (
            <p className="app-status">Todavía no hay ninguna caja creada.</p>
          ) : (
            <>
              <div className="panel-tabs panel-tabs-secundarias">
                <button
                  className={`panel-tab ${!cajaSeleccionada ? 'activo' : ''}`}
                  onClick={() => setCajaSeleccionada(null)}
                >
                  Todas
                </button>
                {cajas.map((c) => (
                  <button
                    key={c.id}
                    className={`panel-tab ${cajaSeleccionada === c.id ? 'activo' : ''}`}
                    onClick={() => setCajaSeleccionada(c.id)}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>

              {!cajaSeleccionada ? (
                porCaja.length === 0 ? (
                  <p className="app-status">No hay ventas de ninguna caja en este período.</p>
                ) : (
                  <table className="panel-tabla">
                    <thead>
                      <tr>
                        <th>Caja</th>
                        <th>Ventas</th>
                        <th>Total vendido</th>
                        <th>Efectivo acumulado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {porCaja.map((f) => (
                        <tr key={f.caja.id}>
                          <td>{f.caja.nombre}</td>
                          <td>{f.ventas}</td>
                          <td>${f.total.toFixed(2)}</td>
                          <td>${f.efectivo.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              ) : (
                detalleCaja && (
                  <div key={cajaSeleccionada} className="reportes-caja-detalle">
                    <div className="panel-stats">
                      <div className="panel-stat">
                        <span className="panel-stat-etiqueta">Ventas</span>
                        <span className="panel-stat-valor">{detalleCaja.cantidadVentas}</span>
                      </div>
                      <div className="panel-stat">
                        <span className="panel-stat-etiqueta">Total vendido</span>
                        <span className="panel-stat-valor">${detalleCaja.total.toFixed(2)}</span>
                      </div>
                      <div className="panel-stat">
                        <span className="panel-stat-etiqueta">Efectivo acumulado</span>
                        <span className="panel-stat-valor">${detalleCaja.efectivo.toFixed(2)}</span>
                      </div>
                    </div>

                    {detalleCaja.cantidadVentas === 0 ? (
                      <p className="app-status">{detalleCaja.caja.nombre} no tiene ventas en este período.</p>
                    ) : (
                      <>
                        {detalleCaja.porDia.length > 1 && (
                          <div className="reportes-chart-wrap">
                            <div className="reportes-chart">
                              {(() => {
                                const maxDia = Math.max(1, ...detalleCaja.porDia.map(([, t]) => t))
                                return detalleCaja.porDia.map(([fecha, total]) => (
                                  <div
                                    key={fecha}
                                    className="reportes-barra-col"
                                    title={`${fecha}: $${total.toFixed(2)}`}
                                  >
                                    <div className="reportes-barra" style={{ height: `${(total / maxDia) * 100}%` }} />
                                    <span className="reportes-barra-etiqueta">{fecha.slice(5)}</span>
                                  </div>
                                ))
                              })()}
                            </div>
                          </div>
                        )}

                        <table className="panel-tabla">
                          <tbody>
                            {METODOS.map((m) => (
                              <tr key={m}>
                                <td>{ETIQUETA_METODO[m]}</td>
                                <td>${detalleCaja.porMetodo[m].toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <p className="app-status">Productos más vendidos en {detalleCaja.caja.nombre}</p>
                        <table className="panel-tabla">
                          <thead>
                            <tr>
                              <th>Producto</th>
                              <th>Cantidad</th>
                              <th>Monto</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detalleCaja.masVendidos.map((f) => (
                              <tr key={f.producto.id}>
                                <td>{f.producto.nombre}</td>
                                <td>
                                  {f.cantidad} {f.producto.unidad_medida}
                                </td>
                                <td>${f.monto.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )
              )}
            </>
          )}

          <h3>Por cajero</h3>
          {porCajero.length === 0 ? (
            <p className="app-status">No hay ventas en este período.</p>
          ) : (
            <table className="panel-tabla">
              <thead>
                <tr>
                  <th>Cajero</th>
                  <th>Ventas</th>
                  <th>Total vendido</th>
                </tr>
              </thead>
              <tbody>
                {porCajero.map((f) => (
                  <tr key={f.id}>
                    <td>{f.nombre}</td>
                    <td>{f.ventas}</td>
                    <td>${f.total.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3>Productos más vendidos</h3>
          {masVendidos.length === 0 ? (
            <p className="app-status">No hay ventas en este período.</p>
          ) : (
            <table className="panel-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Cantidad vendida</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {masVendidos.map((f) => (
                  <tr key={f.producto.id}>
                    <td>{f.producto.nombre}</td>
                    <td>
                      {f.cantidad} {f.producto.unidad_medida}
                    </td>
                    <td>${f.monto.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  )
}
