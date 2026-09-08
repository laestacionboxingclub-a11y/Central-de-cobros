import { useEffect, useMemo, useState } from 'react'
import {
  crearCliente,
  fetchClientes,
  fetchProductos,
  fetchStockActual,
  registrarCargoCuentaCorriente,
  registrarVenta,
  type Cliente,
  type MetodoPago,
  type Perfil,
  type Producto,
  type Tenant
} from '@cdc/shared'
import { ETIQUETA_METODO } from './constants'
import { Comprobante, type VentaConfirmada } from './Comprobante'
import { ImprimiendoTicket } from './ImprimiendoTicket'
import { TecladoCantidad } from './TecladoCantidad'
import { siguienteNumeroComprobante, type CajaSeleccionada } from './localCaja'
import {
  encolarCargoCuentaCorriente,
  encolarVenta,
  guardarCatalogo,
  guardarClientes,
  guardarStock,
  leerCatalogoGuardado,
  leerClientesGuardados,
  leerStockGuardado
} from '../offline/almacenLocal'
import { esErrorDeRed } from '../offline/sincronizar'
import { useSincronizacion } from '../offline/useSincronizacion'

interface LineaCarrito {
  producto: Producto
  cantidad: number
}

const METODOS: MetodoPago[] = ['efectivo', 'posnet', 'transferencia', 'cuenta_corriente']

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
  const [stock, setStock] = useState<Record<string, number>>({})
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [catalogoGuardadoEn, setCatalogoGuardadoEn] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<LineaCarrito[]>([])
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null)
  const [metodoPago, setMetodoPago] = useState<MetodoPago | null>(null)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteId, setClienteId] = useState('')
  const [mostrarNuevoCliente, setMostrarNuevoCliente] = useState(false)
  const [nuevoClienteNombre, setNuevoClienteNombre] = useState('')
  const [nuevoClienteTelefono, setNuevoClienteTelefono] = useState('')
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [cobrando, setCobrando] = useState(false)
  const [imprimiendo, setImprimiendo] = useState(false)
  const [errorCobro, setErrorCobro] = useState<string | null>(null)
  const [ventaPendiente, setVentaPendiente] = useState<VentaConfirmada | null>(null)
  const [ventaConfirmada, setVentaConfirmada] = useState<VentaConfirmada | null>(null)

  const { enLinea, pendientes, sincronizando, sincronizarAhora, actualizarPendientes } = useSincronizacion()

  useEffect(() => {
    fetchProductos(tenant.id)
      .then((data) => {
        setProductos(data)
        setCatalogoGuardadoEn(null)
        guardarCatalogo(tenant.id, data)
      })
      .catch(() => {
        const cache = leerCatalogoGuardado(tenant.id)
        if (cache) {
          setProductos(cache.productos)
          setCatalogoGuardadoEn(cache.guardadoEn)
        } else {
          setErrorCarga('No se pudieron cargar los productos.')
        }
      })

    fetchStockActual(tenant.id)
      .then((data) => {
        setStock(data)
        guardarStock(tenant.id, data)
      })
      .catch(() => {
        const cache = leerStockGuardado(tenant.id)
        if (cache) setStock(cache)
      })

    fetchClientes(tenant.id)
      .then((data) => {
        setClientes(data)
        guardarClientes(tenant.id, data)
      })
      .catch(() => {
        const cache = leerClientesGuardados(tenant.id)
        if (cache) setClientes(cache)
      })
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

  const cantidadEnEdicion = productoEnEdicion
    ? carrito.find((l) => l.producto.id === productoEnEdicion.id)?.cantidad
    : undefined

  function confirmarCantidad(cantidad: number) {
    const producto = productoEnEdicion
    if (!producto) return
    setCarrito((actual) => {
      const idx = actual.findIndex((l) => l.producto.id === producto.id)
      if (idx >= 0) {
        const copia = [...actual]
        copia[idx] = { ...copia[idx], cantidad }
        return copia
      }
      return [...actual, { producto, cantidad }]
    })
    setProductoEnEdicion(null)
  }

  function quitarLinea(productoId: string) {
    setCarrito((actual) => actual.filter((l) => l.producto.id !== productoId))
  }

  async function crearClienteRapido() {
    if (!nuevoClienteNombre.trim()) return
    setGuardandoCliente(true)
    setErrorCobro(null)
    try {
      const nuevo = await crearCliente({
        tenant_id: tenant.id,
        nombre: nuevoClienteNombre.trim(),
        telefono: nuevoClienteTelefono.trim() || null
      })
      const actualizados = [...clientes, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre))
      setClientes(actualizados)
      guardarClientes(tenant.id, actualizados)
      setClienteId(nuevo.id)
      setMostrarNuevoCliente(false)
      setNuevoClienteNombre('')
      setNuevoClienteTelefono('')
    } catch {
      setErrorCobro('No se pudo crear el cliente. Probá de nuevo (necesita conexión).')
    } finally {
      setGuardandoCliente(false)
    }
  }

  async function cobrar() {
    if (carrito.length === 0 || !metodoPago) return
    if (metodoPago === 'cuenta_corriente' && !clienteId) {
      setErrorCobro('Elegí a qué cliente se le carga la cuenta.')
      return
    }
    setCobrando(true)
    setErrorCobro(null)

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

    let pendienteSync = false
    try {
      await registrarVenta({ venta, items, movimientos })
    } catch (error) {
      if (!esErrorDeRed(error)) {
        setErrorCobro('No se pudo registrar la venta. Intentá de nuevo.')
        setCobrando(false)
        return
      }
      // Sin conexión: la venta ya pasó (el cliente ya pagó), así que la
      // guardamos en la tablet e imprimimos igual. Se sincroniza sola después.
      encolarVenta({ venta, items, movimientos })
      actualizarPendientes()
      pendienteSync = true
    }

    const clienteDeLaVenta = metodoPago === 'cuenta_corriente' ? clientes.find((c) => c.id === clienteId) : undefined

    if (metodoPago === 'cuenta_corriente' && clienteDeLaVenta) {
      const cargo = {
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        cliente_id: clienteDeLaVenta.id,
        monto: Number(total.toFixed(2)),
        venta_id: ventaId,
        creado_por: perfil.id,
        creado_en: ahora
      }
      try {
        await registrarCargoCuentaCorriente(cargo)
      } catch (error) {
        // La venta ya está guardada (o encolada) — esto solo encola el
        // cargo a la cuenta para que se sume solo apenas vuelva la conexión.
        if (esErrorDeRed(error)) {
          encolarCargoCuentaCorriente(cargo)
          actualizarPendientes()
        }
      }
    }

    // Descontamos el stock ya mismo en la pantalla (no esperamos a releer el
    // servidor): así, si el cajero encadena varias ventas seguidas del mismo
    // producto, cada una ve el stock ya actualizado por la anterior.
    setStock((actual) => {
      const nuevo = { ...actual }
      for (const l of carrito) {
        // Si el producto no tiene stock controlado (nunca se le cargó un
        // movimiento) lo dejamos así: no lo convertimos en "0 - vendido".
        if (nuevo[l.producto.id] !== undefined) {
          nuevo[l.producto.id] = nuevo[l.producto.id] - l.cantidad
        }
      }
      guardarStock(tenant.id, nuevo)
      return nuevo
    })

    setVentaPendiente({
      numero,
      items: carrito,
      total,
      metodoPago,
      fecha: ahora,
      pendienteSync,
      clienteNombre: clienteDeLaVenta?.nombre
    })
    setImprimiendo(true)
    setCarrito([])
    setMetodoPago(null)
    setClienteId('')
    setCobrando(false)
  }

  if (imprimiendo && ventaPendiente) {
    return (
      <ImprimiendoTicket
        tenant={tenant}
        caja={caja}
        venta={ventaPendiente}
        onFinish={() => {
          setVentaConfirmada(ventaPendiente)
          setImprimiendo(false)
        }}
      />
    )
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

      <div className={`pos-conexion no-imprimir ${enLinea ? 'en-linea' : 'sin-linea'}`}>
        <span className="pos-conexion-punto" />
        {enLinea ? 'En línea' : 'Sin conexión'}
        {pendientes > 0 && (
          <>
            {' · '}
            {sincronizando
              ? 'sincronizando...'
              : `${pendientes} movimiento${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de sincronizar`}
            {enLinea && !sincronizando && (
              <button className="link-btn pos-conexion-btn" onClick={sincronizarAhora}>
                Sincronizar ahora
              </button>
            )}
          </>
        )}
      </div>

      <section className="pos-catalogo no-imprimir">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="pos-buscador"
        />
        {errorCarga && <p className="warn">{errorCarga}</p>}
        {catalogoGuardadoEn && (
          <p className="app-status">
            Mostrando el catálogo guardado (sin conexión) · actualizado{' '}
            {new Date(catalogoGuardadoEn).toLocaleString('es-AR')}
          </p>
        )}
        {productos === null && !errorCarga && <p className="app-status">Cargando productos...</p>}
        {productos !== null && productosFiltrados.length === 0 && (
          <p className="app-status">No hay productos cargados todavía.</p>
        )}
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
        <h2>Carrito</h2>
        {carrito.length === 0 && <p className="app-status">Todavía no agregaste productos.</p>}
        <ul className="pos-lineas">
          {carrito.map((l) => (
            <li key={l.producto.id} className="pos-linea">
              <span className="pos-linea-nombre">{l.producto.nombre}</span>
              <button className="pos-cantidad-chip" onClick={() => setProductoEnEdicion(l.producto)}>
                {l.cantidad} {l.producto.unidad_medida}
              </button>
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

        {metodoPago === 'cuenta_corriente' && (
          <div className="pos-cliente">
            {!mostrarNuevoCliente ? (
              <>
                <select
                  className="pos-cliente-select"
                  value={clienteId}
                  onChange={(e) => setClienteId(e.target.value)}
                >
                  <option value="">Elegí un cliente...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                <button type="button" className="link-btn-oscuro" onClick={() => setMostrarNuevoCliente(true)}>
                  + Cliente nuevo
                </button>
              </>
            ) : (
              <div className="pos-cliente-nuevo">
                <input
                  type="text"
                  placeholder="Nombre del cliente"
                  value={nuevoClienteNombre}
                  onChange={(e) => setNuevoClienteNombre(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Teléfono (opcional)"
                  value={nuevoClienteTelefono}
                  onChange={(e) => setNuevoClienteTelefono(e.target.value)}
                />
                <div className="pos-cliente-nuevo-acciones">
                  <button type="button" className="link-btn-oscuro" onClick={() => setMostrarNuevoCliente(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="pos-cliente-guardar"
                    disabled={guardandoCliente || !nuevoClienteNombre.trim()}
                    onClick={crearClienteRapido}
                  >
                    {guardandoCliente ? 'Guardando...' : 'Guardar cliente'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {errorCobro && <p className="warn">{errorCobro}</p>}

        <button
          className="pos-cobrar-btn"
          disabled={
            carrito.length === 0 ||
            !metodoPago ||
            cobrando ||
            (metodoPago === 'cuenta_corriente' && !clienteId)
          }
          onClick={cobrar}
        >
          {cobrando ? 'Cobrando...' : `Cobrar $${total.toFixed(2)}`}
        </button>
      </aside>

      {productoEnEdicion && (
        <TecladoCantidad
          producto={productoEnEdicion}
          cantidadInicial={cantidadEnEdicion}
          stockDisponible={stock[productoEnEdicion.id]}
          onConfirmar={confirmarCantidad}
          onCancelar={() => setProductoEnEdicion(null)}
        />
      )}
    </div>
  )
}
