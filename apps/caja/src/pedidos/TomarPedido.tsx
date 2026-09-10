import { useEffect, useMemo, useState } from 'react'
import { crearPedido, fetchProductos, type Perfil, type Pedido, type Producto, type Tenant } from '@cdc/shared'
import { TecladoCantidad } from '../pos/TecladoCantidad'
import { imprimirTicketPedido } from './imprimirPedido'

interface LineaPedido {
  producto: Producto
  cantidad: number
  precioUnitario: number
}

export function TomarPedido({ perfil, tenant, onLogout }: { perfil: Perfil; tenant: Tenant; onLogout: () => void }) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [items, setItems] = useState<LineaPedido[]>([])
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null)
  const [nombreReferencia, setNombreReferencia] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pedidoListo, setPedidoListo] = useState<Pedido | null>(null)
  const [avisoImpresion, setAvisoImpresion] = useState<string | null>(null)

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

  const total = useMemo(() => items.reduce((acc, l) => acc + l.cantidad * l.precioUnitario, 0), [items])

  const lineaEnEdicion = productoEnEdicion ? items.find((l) => l.producto.id === productoEnEdicion.id) : undefined

  function confirmarLinea(cantidad: number, precioUnitario: number) {
    const producto = productoEnEdicion
    if (!producto) return
    setItems((actual) => {
      const idx = actual.findIndex((l) => l.producto.id === producto.id)
      if (idx >= 0) {
        const copia = [...actual]
        copia[idx] = { ...copia[idx], cantidad, precioUnitario }
        return copia
      }
      return [...actual, { producto, cantidad, precioUnitario }]
    })
    setProductoEnEdicion(null)
  }

  function quitarLinea(productoId: string) {
    setItems((actual) => actual.filter((l) => l.producto.id !== productoId))
  }

  async function confirmarPedido() {
    if (items.length === 0) return
    setGuardando(true)
    setError(null)
    try {
      const pedido = await crearPedido({
        tenant_id: tenant.id,
        nombre_referencia: nombreReferencia.trim() || null,
        creado_por: perfil.id,
        total: Number(total.toFixed(2)),
        items: items.map((l) => ({
          producto_id: l.producto.id,
          cantidad: l.cantidad,
          precio_unitario: l.precioUnitario,
          subtotal: Number((l.cantidad * l.precioUnitario).toFixed(2))
        }))
      })
      setPedidoListo(pedido)
      try {
        await imprimirTicketPedido({ tenant, pedido, items })
      } catch {
        setAvisoImpresion('No se pudo imprimir solo — mostrale este número en la pantalla mientras lo revisamos.')
      }
    } catch {
      setError('No se pudo guardar el pedido. Probá de nuevo (necesita conexión).')
    } finally {
      setGuardando(false)
    }
  }

  function nuevoPedido() {
    setItems([])
    setNombreReferencia('')
    setPedidoListo(null)
    setAvisoImpresion(null)
  }

  if (pedidoListo) {
    return (
      <main className="app-shell">
        <h1>Pedido nº {pedidoListo.numero}</h1>
        {pedidoListo.nombre_referencia && <p className="app-label">{pedidoListo.nombre_referencia}</p>}
        <ul className="ticket-items" style={{ width: '100%', maxWidth: 320 }}>
          {items.map((l) => (
            <li key={l.producto.id}>
              <span>
                {l.cantidad} {l.producto.unidad_medida} × {l.producto.nombre}
              </span>
              <span>${(l.cantidad * l.precioUnitario).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <p className="comprobante-total">Total: ${pedidoListo.total.toFixed(2)}</p>
        {avisoImpresion && <p className="warn">{avisoImpresion}</p>}
        <p className="app-status">Dale este número al cliente — lo cobran en la caja.</p>
        <button onClick={nuevoPedido}>Tomar otro pedido</button>
      </main>
    )
  }

  return (
    <div className="pos-layout">
      <header className="pos-header no-imprimir">
        <div>
          <strong>{tenant.nombre}</strong> · {perfil.nombre}
        </div>
        <div className="pos-header-acciones">
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
        <div className="pos-grid">
          {productosFiltrados.map((p) => (
            <button key={p.id} className="pos-producto" onClick={() => setProductoEnEdicion(p)}>
              {p.foto_url ? (
                <img src={p.foto_url} alt={p.nombre} className="pos-producto-foto" />
              ) : (
                <div className="pos-producto-foto pos-producto-foto-vacia">🥬</div>
              )}
              <span className="pos-producto-nombre">{p.nombre}</span>
              <span className="pos-producto-precio">
                ${p.precio.toFixed(2)} / {p.unidad_medida}
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="pos-carrito no-imprimir">
        <h2>Pedido</h2>
        <input
          type="text"
          placeholder="Nombre del cliente (opcional)"
          value={nombreReferencia}
          onChange={(e) => setNombreReferencia(e.target.value)}
          className="pos-buscador"
        />
        {items.length === 0 && <p className="app-status">Todavía no agregaste productos.</p>}
        <ul className="pos-lineas">
          {items.map((l) => (
            <li key={l.producto.id} className="pos-linea">
              <span className="pos-linea-nombre">{l.producto.nombre}</span>
              <button className="pos-cantidad-chip" onClick={() => setProductoEnEdicion(l.producto)}>
                {l.cantidad} {l.producto.unidad_medida} × ${l.precioUnitario.toFixed(2)}
              </button>
              <span className="pos-linea-subtotal">${(l.cantidad * l.precioUnitario).toFixed(2)}</span>
              <button className="pos-quitar" onClick={() => quitarLinea(l.producto.id)} aria-label="Quitar">
                ✕
              </button>
            </li>
          ))}
        </ul>

        <p className="pos-total">Total: ${total.toFixed(2)}</p>

        {error && <p className="warn">{error}</p>}

        <button className="pos-cobrar-btn" disabled={items.length === 0 || guardando} onClick={confirmarPedido}>
          {guardando ? 'Guardando...' : 'Confirmar pedido e imprimir'}
        </button>
      </aside>

      {productoEnEdicion && (
        <TecladoCantidad
          producto={productoEnEdicion}
          cantidadInicial={lineaEnEdicion?.cantidad}
          precioInicial={lineaEnEdicion?.precioUnitario}
          stockDisponible={undefined}
          precioEditable
          onConfirmar={confirmarLinea}
          onCancelar={() => setProductoEnEdicion(null)}
        />
      )}
    </div>
  )
}
