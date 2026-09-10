import { useEffect, useState, type FormEvent } from 'react'
import {
  actualizarEstadoTenant,
  fetchCajas,
  fetchGastos,
  fetchPerfilesDeTenant,
  fetchStockActual,
  fetchTodosLosProductos,
  fetchVentasEntre,
  vincularPerfil,
  type Caja,
  type Gasto,
  type Perfil,
  type Producto,
  type RolPerfil,
  type Tenant,
  type Venta
} from '@cdc/shared'

const ETIQUETA_ROL: Record<RolPerfil, string> = {
  superadmin: 'Súper-admin',
  dueno: 'Dueño',
  cajero: 'Cajero',
  vendedor: 'Vendedor'
}

function hace7Dias() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d
}

export function DetalleCliente({ tenant, onVolver }: { tenant: Tenant; onVolver: () => void }) {
  const [perfiles, setPerfiles] = useState<Perfil[] | null>(null)
  const [cajas, setCajas] = useState<Caja[] | null>(null)
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [stock, setStock] = useState<Record<string, number>>({})
  const [ventas, setVentas] = useState<Venta[] | null>(null)
  const [gastos, setGastos] = useState<Gasto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [estado, setEstado] = useState(tenant.estado)

  const [mostrarVincular, setMostrarVincular] = useState(false)
  const [userId, setUserId] = useState('')
  const [nombreUsuario, setNombreUsuario] = useState('')
  const [rolUsuario, setRolUsuario] = useState<RolPerfil>('dueno')
  const [vinculando, setVinculando] = useState(false)

  async function cargar() {
    setError(null)
    try {
      const [listaPerfiles, listaCajas, listaProductos, mapaStock, listaVentas, listaGastos] = await Promise.all([
        fetchPerfilesDeTenant(tenant.id),
        fetchCajas(tenant.id),
        fetchTodosLosProductos(tenant.id),
        fetchStockActual(tenant.id),
        fetchVentasEntre(tenant.id, hace7Dias().toISOString(), new Date().toISOString()),
        fetchGastos(tenant.id)
      ])
      setPerfiles(listaPerfiles)
      setCajas(listaCajas)
      setProductos(listaProductos)
      setStock(mapaStock)
      setVentas(listaVentas.filter((v) => v.estado === 'completada'))
      setGastos(listaGastos.slice(0, 5))
    } catch {
      setError('No se pudieron cargar los datos de este cliente.')
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id])

  async function alternarEstado() {
    const nuevo = estado === 'activo' ? 'suspendido' : 'activo'
    try {
      await actualizarEstadoTenant(tenant.id, nuevo)
      setEstado(nuevo)
    } catch {
      setError('No se pudo actualizar el estado.')
    }
  }

  async function vincular(e: FormEvent) {
    e.preventDefault()
    if (!userId.trim() || !nombreUsuario.trim()) return
    setVinculando(true)
    setError(null)
    try {
      await vincularPerfil(userId.trim(), tenant.id, rolUsuario, nombreUsuario.trim())
      setUserId('')
      setNombreUsuario('')
      setMostrarVincular(false)
      await cargar()
    } catch {
      setError('No se pudo vincular el usuario. Revisá que el UID sea correcto y no esté vinculado ya a otro cliente.')
    } finally {
      setVinculando(false)
    }
  }

  const totalVentas7dias = (ventas ?? []).reduce((acc, v) => acc + v.total, 0)

  return (
    <div>
      <button className="link-btn" onClick={onVolver}>
        ← Volver a clientes
      </button>

      <div className="panel-seccion-header">
        <h2>{tenant.nombre}</h2>
        <div>
          <span className={`estado-chip ${estado === 'activo' ? 'activo' : 'suspendido'}`}>
            {estado === 'activo' ? 'Activo' : 'Suspendido'}
          </span>{' '}
          <button className="btn-secundario" onClick={alternarEstado}>
            {estado === 'activo' ? 'Suspender acceso' : 'Reactivar acceso'}
          </button>
        </div>
      </div>

      {error && <p className="warn">{error}</p>}

      <div className="panel-stats">
        <div className="panel-stat">
          <span className="panel-stat-etiqueta">Ventas últimos 7 días</span>
          <span className="panel-stat-valor">${totalVentas7dias.toFixed(2)}</span>
        </div>
        <div className="panel-stat">
          <span className="panel-stat-etiqueta">Cajas</span>
          <span className="panel-stat-valor">{cajas?.length ?? '—'}</span>
        </div>
        <div className="panel-stat">
          <span className="panel-stat-etiqueta">Productos</span>
          <span className="panel-stat-valor">{productos?.length ?? '—'}</span>
        </div>
        <div className="panel-stat">
          <span className="panel-stat-etiqueta">Usuarios</span>
          <span className="panel-stat-valor">{perfiles?.length ?? '—'}</span>
        </div>
      </div>

      <div className="panel-seccion-header">
        <h3>Usuarios</h3>
        <button className="btn-secundario" onClick={() => setMostrarVincular((v) => !v)}>
          + Vincular usuario existente
        </button>
      </div>

      {mostrarVincular && (
        <form className="panel-form" onSubmit={vincular}>
          <p className="app-status">
            Primero creá el usuario en Supabase → Authentication → Users → Add user, y pegá acá su UID.
          </p>
          <label>
            UID del usuario
            <input
              type="text"
              required
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="a1b2c3d4-..."
            />
          </label>
          <label>
            Nombre
            <input type="text" required value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)} />
          </label>
          <label>
            Rol
            <select value={rolUsuario} onChange={(e) => setRolUsuario(e.target.value as RolPerfil)}>
              <option value="dueno">Dueño</option>
              <option value="cajero">Cajero</option>
            </select>
          </label>
          <div className="panel-form-acciones">
            <button type="button" className="btn-secundario" onClick={() => setMostrarVincular(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={vinculando}>
              {vinculando ? 'Vinculando...' : 'Vincular'}
            </button>
          </div>
        </form>
      )}

      {perfiles !== null && perfiles.length === 0 && (
        <p className="app-status">Este cliente todavía no tiene ningún usuario vinculado.</p>
      )}
      {perfiles !== null && perfiles.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((p) => (
              <tr key={p.id}>
                <td>{p.nombre}</td>
                <td>{ETIQUETA_ROL[p.rol]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Productos y stock</h3>
      {productos !== null && productos.length === 0 && <p className="app-status">Todavía no cargó productos.</p>}
      {productos !== null && productos.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Precio</th>
              <th>Stock actual</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => (
              <tr key={p.id} className={!p.activo ? 'fila-inactiva' : ''}>
                <td>{p.nombre}</td>
                <td>
                  ${p.precio.toFixed(2)} / {p.unidad_medida}
                </td>
                <td>
                  {stock[p.id] ?? 0} {p.unidad_medida}
                </td>
                <td>{p.activo ? 'Activo' : 'Inactivo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3>Últimos gastos</h3>
      {gastos !== null && gastos.length === 0 && <p className="app-status">Todavía no cargó gastos.</p>}
      {gastos !== null && gastos.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{new Date(g.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                <td>{g.categoria}</td>
                <td>${g.monto.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
