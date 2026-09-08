import { useEffect, useMemo, useState } from 'react'
import { fetchProductos, registrarVenta, type MetodoPago, type Perfil, type Producto, type Tenant } from '@cdc/shared'
import { ETIQUETA_METODO } from './constants'
import { Comprobante, type VentaConfirmada } from './Comprobante'
import { siguienteNumeroComprobante, type CajaSeleccionada } from './localCaja'

interface LineaCarrito {
  producto: Producto
  cantidad: number
}

const METODOS: MetodoPago[] = ['efectivo', 'posnet', 'transferencia']

export function PuntoDeVenta({
  perfil,
  tenant,
  caja,
  onCambiarCaja,
  onLogout
}: {
  perfil: Perfil
  tenant: Tenant
  caja: CajaSeleccionada
  onCambiarCaja: () => void
  onLogout: () => void
}) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null)
  const [cobrando, setCobrando] = useState(false)
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  const [ventaConfirmada, setVentaConfirmada] = useState<VentaConfirmada | null>(null)

  useEffect(() => {
    fetchProductos(tenant.id)
      .then(setProductos)
      .catch(() => setErrorCarga('No se pudieron cargar los productos.'))
  }, [tenant.id])

  const productosFiltrados = useMemo(() => {
    if (!productos) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [productos, busqueda])

  const total = useMemo(
    () => carrito.reduce((acc, l) => acc + l.cantidad * l.producto.precio, 0),
    [carrito]
  )

  function agregarProducto(producto: Producto) {
    setCarrito((actual) => {
      const idx = actual.findIndex((l) => l.producto.id === producto.id)
      if (idx >= 0) {
        const copia = [...actual]
        copia[idx] = { ...copia[idx], cantidad: copia[idx].cantidad + 1 }
        return copia
      }
      return [...actual, { producto, cantidad: 1 }]
    })
  }

  function cambiarCantidad(productoId: string, cantidad: number) {
    if (cantidad < 0) return
    setCarrito((actual) => actual.map((l) => (l.producto.id === productoId ? { ...l, cantidad } : l)))
  }

  function quitarLinea(productoId: string) {
    setCarrito((actual) => actual.filter((l) => l.producto.id !== productoId))
  }

  async function cobrar() {
    if (carrito.length === 0 || !metodoPago) return
    setCobrando(true)
    setErrorCobro(null)
    try {
      const ventaId = crypto.randomUUID()
      const ahora = new Date().toISOString()
      const numero = siguienteNumeroComprobante(caja.id, caja.nombre)

      const venta = {
        id: ventaId,
        tenant_id: tenant.id,
        caja_id: caja.id,
        cajero_id: perfil.id,
        numero_comprobante: numero,
        metodo_pago: metodoPago,
        total: Number(total.toFixed(2)),
        estado: 'completada' as const,
        creada_en: ahora
      }
      const items = carrito.map((l) => ({
        id: crypto.randomUUID(),
        venta_id: ventaId,
        producto_id: l.producto.id,
        cantidad: l.cantidad,
        precio_unitario: l.producto.precio,
        subtotal: Number((l.cantidad * l.producto.precio).toFixed(2))
      }))
      const movimientos = carrito.map((l) => ({
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        producto_id: l.producto.id,
        cantidad: -l.cantidad,
        tipo: 'venta' as const,
        venta_id: ventaId,
        caja_id: caja.id,
        creado_por: perfil.id,
        creado_en: ahora
      }))

      await registrarVenta({ venta, items, movimientos })

      setVentaConfirmada({ numero, items: carrito, total, metodoPago, fecha: ahora })
      setCarrito([])
      setMetodoPago(null)
    } catch {
      setErrorCobro('No se pudo registrar la venta. Intentá de nuevo.')
    } finally {
      setCobrando(false)
    }
  }

  if (ventaConfirmada) {
    return (
      <Comprobante
        tenant={tenant}
        caja={caja}
        venta={ventaConfirmada}
        onNuevaVenta={() => setVentaConfirmada(null)}
      />
    )
  }

  return (
    <div className="pos-layout">
      <header className="pos-header no-imprimir">
        <div>
          <strong>{tenant.nombre}</strong> · {caja.nombre} · {perfil.nombre}
        </div>
        <div className="pos-header-acciones">
          <button className="link-btn" onClick={onCambiarCaja}>
            Cambiar caja
          </button>
          <button className="link-btn" onClick={onLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <section className="pos-catalogo no-imprimir">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pos-buscador"
        />
        {errorCarga && <p className="warn">{errorCarga}</p>}
        {productos === null && !errorCarga && <p className="app-status">Cargando productos...</p>}
        {productos !== null && productosFiltrados.length === 0 && (
          <p className="app-status">No hay productos cargados todavía.</p>
        )}
        <div className="pos-grid">
          {productosFiltrados.map((p) => (
            <button key={p.id} className="pos-producto" onClick={() => agregarProducto(p)}>
              <span className="pos-producto-nombre">{p.nombre}</span>
              <span className="pos-producto-precio">
                ${p.precio.toFixed(2)} / {p.unidad_medida}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="pos-carrito no-imprimir">
        <h2>Carrito</h2>
        {carrito.length === 0 && <p className="app-status">Todavía no agregaste productos.</p>}
        <ul className="pos-lineas">
          {carrito.map((l) => (
            <li key={l.producto.id} className="pos-linea">
              <span className="pos-linea-nombre">{l.producto.nombre}</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={l.cantidad}
                onChange={(e) => cambiarCantidad(l.producto.id, Number(e.target.value))}
                className="pos-cantidad"
              />
              <span className="pos-linea-subtotal">${(l.cantidad * l.producto.precio).toFixed(2)}</span>
              <button className="pos-quitar" onClick={() => quitarLinea(l.producto.id)} aria-label="Quitar">
                ✕
              </button>
            </li>
          ))}
        </ul>

        <p className="pos-total">Total: ${total.toFixed(2)}</p>

        <div className="pos-metodos">
          {METODOS.map((m) => (
            <button
              key={m}
              className={`pos-metodo-btn ${metodoPago === m ? 'activo' : ''}`}
              onClick={() => setMetodoPago(m)}
            >
              {ETIQUETA_METODO[m]}
            </button>
          ))}
        </div>

        {errorCobro && <p className="warn">{errorCobro}</p>}

        <button
          className="pos-cobrar-btn"
          disabled={carrito.length === 0 || !metodoPago || cobrando}
          onClick={cobrar}
        >
          {cobrando ? 'Cobrando...' : `Cobrar $${total.toFixed(2)}`}
        </button>
      </aside>
    </div>
  )
}
