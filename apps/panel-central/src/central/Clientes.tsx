import { useEffect, useState, type FormEvent } from 'react'
import {
  actualizarEstadoTenant,
  crearTenant,
  fetchCantidadPerfilesPorTenant,
  fetchTenants,
  type Tenant
} from '@cdc/shared'
import { DetalleCliente } from './DetalleCliente'

export function Clientes() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null)
  const [cantidadPerfiles, setCantidadPerfiles] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [creando, setCreando] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [tenantSeleccionado, setTenantSeleccionado] = useState<Tenant | null>(null)

  async function cargar() {
    setError(null)
    try {
      const [listaTenants, mapaPerfiles] = await Promise.all([fetchTenants(), fetchCantidadPerfilesPorTenant()])
      setTenants(listaTenants)
      setCantidadPerfiles(mapaPerfiles)
    } catch {
      setError('No se pudieron cargar los clientes.')
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!nombreNuevo.trim()) return
    setCreando(true)
    setError(null)
    try {
      await crearTenant(nombreNuevo.trim())
      setNombreNuevo('')
      setMostrarForm(false)
      await cargar()
    } catch {
      setError('No se pudo crear el cliente.')
    } finally {
      setCreando(false)
    }
  }

  async function alternarEstado(tenant: Tenant) {
    const nuevoEstado = tenant.estado === 'activo' ? 'suspendido' : 'activo'
    try {
      await actualizarEstadoTenant(tenant.id, nuevoEstado)
      await cargar()
    } catch {
      setError('No se pudo actualizar el estado del cliente.')
    }
  }

  if (tenantSeleccionado) {
    return (
      <DetalleCliente
        tenant={tenantSeleccionado}
        onVolver={() => {
          setTenantSeleccionado(null)
          cargar()
        }}
      />
    )
  }

  return (
    <div>
      <div className="panel-seccion-header">
        <h2>Clientes</h2>
        <button className="btn-primario" onClick={() => setMostrarForm((v) => !v)}>
          + Nuevo cliente
        </button>
      </div>

      {error && <p className="warn">{error}</p>}

      {mostrarForm && (
        <form className="panel-form" onSubmit={crear}>
          <h3>Nuevo cliente</h3>
          <label>
            Nombre de la verdulería
            <input
              type="text"
              required
              value={nombreNuevo}
              onChange={(e) => setNombreNuevo(e.target.value)}
              placeholder="Ej: Verdulería Don José"
            />
          </label>
          <p className="app-status">
            Esto solo crea la verdulería. Para que el dueño pueda entrar, todavía hace falta crear su usuario a
            mano en Authentication → Users y vincularlo desde "Ver / Soporte" de este cliente.
          </p>
          <div className="panel-form-acciones">
            <button type="button" className="btn-secundario" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={creando}>
              {creando ? 'Creando...' : 'Crear cliente'}
            </button>
          </div>
        </form>
      )}

      {tenants === null && !error && <p className="app-status">Cargando...</p>}
      {tenants !== null && tenants.length === 0 && <p className="app-status">Todavía no diste de alta ningún cliente.</p>}

      {tenants !== null && tenants.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Verdulería</th>
              <th>Estado</th>
              <th>Usuarios</th>
              <th>Alta</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id}>
                <td>{t.nombre}</td>
                <td>
                  <span className={`estado-chip ${t.estado === 'activo' ? 'activo' : 'suspendido'}`}>
                    {t.estado === 'activo' ? 'Activo' : 'Suspendido'}
                  </span>
                </td>
                <td>{cantidadPerfiles[t.id] ?? 0}</td>
                <td>{new Date(t.created_at).toLocaleDateString('es-AR')}</td>
                <td className="panel-tabla-acciones">
                  <button className="link-btn-oscuro" onClick={() => setTenantSeleccionado(t)}>
                    Ver / Soporte
                  </button>
                  <button className="link-btn-oscuro" onClick={() => alternarEstado(t)}>
                    {t.estado === 'activo' ? 'Suspender' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
