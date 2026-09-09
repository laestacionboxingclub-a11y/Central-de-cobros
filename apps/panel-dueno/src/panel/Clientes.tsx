import { useEffect, useState, type FormEvent } from 'react'
import {
  actualizarCliente,
  crearCliente,
  fetchClientes,
  fetchMovimientosCliente,
  fetchSaldosCuentaCorriente,
  registrarPagoCuentaCorriente,
  type Cliente,
  type MovimientoCuentaCorriente,
  type Perfil,
  type Tenant
} from '@cdc/shared'

// wa.me necesita el teléfono solo con dígitos, con código de país
// (por eso el formulario pide que se cargue así, ej: 5491122223333).
function linkRecordatorioWhatsApp(cliente: Cliente, saldo: number, nombreTenant: string): string | null {
  if (!cliente.telefono) return null
  const digitos = cliente.telefono.replace(/\D/g, '')
  if (!digitos) return null
  const mensaje = `Hola ${cliente.nombre}, te escribo de ${nombreTenant} para recordarte que tenés un saldo pendiente de $${saldo.toFixed(2)}. ¡Gracias!`
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`
}

export function Clientes({ tenant, perfil }: { tenant: Tenant; perfil: Perfil }) {
  const [clientes, setClientes] = useState<Cliente[] | null>(null)
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [clienteAbierto, setClienteAbierto] = useState<Cliente | null>(null)
  const [movimientos, setMovimientos] = useState<MovimientoCuentaCorriente[] | null>(null)
  const [montoPago, setMontoPago] = useState('')
  const [descripcionPago, setDescripcionPago] = useState('')
  const [registrandoPago, setRegistrandoPago] = useState(false)

  async function cargar() {
    setError(null)
    try {
      const [listaClientes, mapaSaldos] = await Promise.all([
        fetchClientes(tenant.id),
        fetchSaldosCuentaCorriente(tenant.id)
      ])
      setClientes(listaClientes)
      setSaldos(mapaSaldos)
    } catch {
      setError('No se pudieron cargar los clientes.')
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id])

  async function guardarCliente(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      await crearCliente({ tenant_id: tenant.id, nombre: nombre.trim(), telefono: telefono.trim() || null })
      setNombre('')
      setTelefono('')
      setMostrarForm(false)
      await cargar()
    } catch {
      setError('No se pudo guardar el cliente.')
    } finally {
      setGuardando(false)
    }
  }

  async function alternarActivo(c: Cliente) {
    try {
      await actualizarCliente(c.id, { activo: !c.activo })
      await cargar()
    } catch {
      setError('No se pudo actualizar el cliente.')
    }
  }

  async function abrirCliente(c: Cliente) {
    setClienteAbierto(c)
    setMovimientos(null)
    setMontoPago('')
    setDescripcionPago('')
    try {
      setMovimientos(await fetchMovimientosCliente(c.id))
    } catch {
      setError('No se pudo cargar el historial del cliente.')
    }
  }

  async function registrarPago(e: FormEvent) {
    e.preventDefault()
    if (!clienteAbierto || !montoPago) return
    setRegistrandoPago(true)
    setError(null)
    try {
      await registrarPagoCuentaCorriente({
        id: crypto.randomUUID(),
        tenant_id: tenant.id,
        cliente_id: clienteAbierto.id,
        monto: Number(montoPago),
        descripcion: descripcionPago.trim() || null,
        creado_por: perfil.id,
        creado_en: new Date().toISOString()
      })
      setMontoPago('')
      setDescripcionPago('')
      await Promise.all([cargar(), fetchMovimientosCliente(clienteAbierto.id).then(setMovimientos)])
    } catch {
      setError('No se pudo registrar el pago.')
    } finally {
      setRegistrandoPago(false)
    }
  }

  if (clienteAbierto) {
    const saldo = saldos[clienteAbierto.id] ?? 0
    return (
      <div>
        <div className="panel-seccion-header">
          <h2>{clienteAbierto.nombre}</h2>
          <button className="link-btn-oscuro" onClick={() => setClienteAbierto(null)}>
            ← Volver a clientes
          </button>
        </div>

        {error && <p className="warn">{error}</p>}

        <p className={saldo > 0 ? 'texto-alerta' : 'app-status'}>
          {saldo > 0
            ? `Debe $${saldo.toFixed(2)}`
            : saldo < 0
              ? `Tiene a favor $${Math.abs(saldo).toFixed(2)}`
              : 'Está al día'}
        </p>

        {saldo > 0 &&
          (() => {
            const link = linkRecordatorioWhatsApp(clienteAbierto, saldo, tenant.nombre)
            return link ? (
              <a className="btn-whatsapp" href={link} target="_blank" rel="noopener noreferrer">
                Recordar por WhatsApp
              </a>
            ) : (
              <p className="app-status">Cargale el teléfono para poder mandarle un recordatorio.</p>
            )
          })()}

        <form className="panel-form" onSubmit={registrarPago}>
          <h3>Registrar pago</h3>
          <label>
            Monto
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={montoPago}
              onChange={(e) => setMontoPago(e.target.value)}
            />
          </label>
          <label>
            Descripción (opcional)
            <input type="text" value={descripcionPago} onChange={(e) => setDescripcionPago(e.target.value)} />
          </label>
          <div className="panel-form-acciones">
            <button type="submit" className="btn-primario" disabled={registrandoPago}>
              {registrandoPago ? 'Guardando...' : 'Registrar pago'}
            </button>
          </div>
        </form>

        {movimientos === null && <p className="app-status">Cargando historial...</p>}
        {movimientos !== null && movimientos.length === 0 && (
          <p className="app-status">Todavía no hay movimientos.</p>
        )}
        {movimientos !== null && movimientos.length > 0 && (
          <table className="panel-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id}>
                  <td>{new Date(m.creado_en).toLocaleString('es-AR')}</td>
                  <td>{m.tipo === 'cargo' ? 'Venta a cuenta' : 'Pago'}</td>
                  <td className={m.tipo === 'cargo' ? 'texto-alerta' : ''}>
                    {m.tipo === 'cargo' ? '+' : ''}${Math.abs(m.monto).toFixed(2)}
                  </td>
                  <td>{m.descripcion ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="panel-seccion-header">
        <h2>Clientes</h2>
        <button className="btn-primario" onClick={() => setMostrarForm(!mostrarForm)}>
          + Nuevo cliente
        </button>
      </div>

      {error && <p className="warn">{error}</p>}

      {mostrarForm && (
        <form className="panel-form" onSubmit={guardarCliente}>
          <h3>Nuevo cliente</h3>
          <label>
            Nombre
            <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </label>
          <label>
            Teléfono (opcional)
            <input
              type="text"
              placeholder="Con código de país, ej: 5491122223333"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
          </label>
          <div className="panel-form-acciones">
            <button type="button" className="btn-secundario" onClick={() => setMostrarForm(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}

      {clientes === null && !error && <p className="app-status">Cargando...</p>}
      {clientes !== null && clientes.length === 0 && (
        <p className="app-status">Todavía no cargaste ningún cliente.</p>
      )}

      {clientes !== null && clientes.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Teléfono</th>
              <th>Saldo</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {[...clientes]
              .sort((a, b) => (saldos[b.id] ?? 0) - (saldos[a.id] ?? 0))
              .map((c) => {
                const saldo = saldos[c.id] ?? 0
                const linkWhatsApp = saldo > 0 ? linkRecordatorioWhatsApp(c, saldo, tenant.nombre) : null
                return (
                  <tr key={c.id} className={!c.activo ? 'fila-inactiva' : ''}>
                    <td>
                      <button className="link-btn-oscuro" onClick={() => abrirCliente(c)}>
                        {c.nombre}
                      </button>
                    </td>
                    <td>{c.telefono ?? '—'}</td>
                    <td className={saldo > 0 ? 'texto-alerta' : ''}>
                      {saldo > 0 ? `Debe $${saldo.toFixed(2)}` : 'Al día'}
                    </td>
                    <td>{c.activo ? 'Activo' : 'Inactivo'}</td>
                    <td className="panel-tabla-acciones">
                      {linkWhatsApp && (
                        <a className="link-btn-oscuro" href={linkWhatsApp} target="_blank" rel="noopener noreferrer">
                          WhatsApp
                        </a>
                      )}
                      <button className="link-btn-oscuro" onClick={() => alternarActivo(c)}>
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      )}
    </div>
  )
}
