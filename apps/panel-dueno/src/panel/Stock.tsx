import { useEffect, useState, type FormEvent } from 'react'
import {
  fetchStockActual,
  fetchTodosLosProductos,
  registrarMovimientoStock,
  type Perfil,
  type Producto,
  type Tenant
} from '@cdc/shared'

type Movimiento = 'carga' | 'merma' | 'ajuste'

const ETIQUETA_MOVIMIENTO: Record<Movimiento, string> = {
  carga: 'Carga de mercadería (suma stock)',
  merma: 'Merma / pérdida (resta stock)',
  ajuste: 'Ajuste manual (cantidad exacta a sumar o restar)'
}

export function Stock({ tenant, perfil }: { tenant: Tenant; perfil: Perfil }) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [stock, setStock] = useState<Record<string, number>>({})
  const [productoId, setProductoId] = useState('')
  const [movimiento, setMovimiento] = useState<Movimiento>('carga')
  const [cantidad, setCantidad] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mensaje, setMensaje] = useState<string | null>(null)

  async function cargar() {
    try {
      const [lista, mapaStock] = await Promise.all([fetchTodosLosProductos(tenant.id), fetchStockActual(tenant.id)])
      const activos = lista.filter((p) => p.activo)
      setProductos(activos)
      setStock(mapaStock)
      if (!productoId && activos.length > 0) setProductoId(activos[0].id)
    } catch {
      setError('No se pudieron cargar los productos.')
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id])

  const productoSeleccionado = productos?.find((p) => p.id === productoId) ?? null

  async function registrar(e: FormEvent) {
    e.preventDefault()
    if (!productoSeleccionado) return
    const numero = Number(cantidad)
    if (!numero) return

    setGuardando(true)
    setError(null)
    setMensaje(null)
    try {
      const cantidadFinal = movimiento === 'merma' ? -Math.abs(numero) : movimiento === 'carga' ? Math.abs(numero) : numero
      await registrarMovimientoStock({
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        producto_id: productoSeleccionado.id,
        cantidad: cantidadFinal,
        tipo: movimiento,
        creado_por: perfil.id,
        creado_en: new Date().toISOString()
      })
      setCantidad('')
      setMensaje(`Listo: se registró el movimiento de ${productoSeleccionado.nombre}.`)
      await cargar()
    } catch {
      setError('No se pudo registrar el movimiento.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <h2>Cargar stock</h2>

      {error && <p className="warn">{error}</p>}
      {productos !== null && productos.length === 0 && (
        <p className="app-status">Primero cargá algún producto en la pestaña Productos.</p>
      )}

      {productos !== null && productos.length > 0 && (
        <form className="panel-form panel-form-ancho" onSubmit={registrar}>
          <label>
            Producto
            <select value={productoId} onChange={(e) => setProductoId(e.target.value)}>
              {productos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {productoSeleccionado && (
            <p className="app-status">
              Stock actual: {stock[productoSeleccionado.id] ?? 0} {productoSeleccionado.unidad_medida}
            </p>
          )}

          <label>
            Tipo de movimiento
            <select value={movimiento} onChange={(e) => setMovimiento(e.target.value as Movimiento)}>
              {(Object.keys(ETIQUETA_MOVIMIENTO) as Movimiento[]).map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MOVIMIENTO[m]}
                </option>
              ))}
            </select>
          </label>

          <label>
            {movimiento === 'ajuste' ? 'Cantidad (podés poner negativo para restar)' : 'Cantidad'}
            <input
              type="number"
              step="0.001"
              required
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
            />
          </label>

          <button type="submit" className="btn-primario" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Registrar movimiento'}
          </button>

          {mensaje && <p className="ok">{mensaje}</p>}
        </form>
      )}
    </div>
  )
}
