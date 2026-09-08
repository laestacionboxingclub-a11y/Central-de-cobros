import { useEffect, useState, type FormEvent } from 'react'
import {
  actualizarProducto,
  crearProducto,
  fetchStockActual,
  fetchTodosLosProductos,
  type Producto,
  type Tenant
} from '@cdc/shared'

interface FormState {
  nombre: string
  unidad_medida: string
  precio: string
  stock_minimo: string
  foto_url: string
}

const FORM_VACIO: FormState = { nombre: '', unidad_medida: 'kg', precio: '', stock_minimo: '', foto_url: '' }

export function Productos({ tenant }: { tenant: Tenant }) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [stock, setStock] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    setError(null)
    try {
      const [listaProductos, mapaStock] = await Promise.all([
        fetchTodosLosProductos(tenant.id),
        fetchStockActual(tenant.id)
      ])
      setProductos(listaProductos)
      setStock(mapaStock)
    } catch {
      setError('No se pudieron cargar los productos.')
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id])

  function abrirNuevo() {
    setEditando(null)
    setForm(FORM_VACIO)
    setMostrarForm(true)
  }

  function abrirEditar(p: Producto) {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      unidad_medida: p.unidad_medida,
      precio: String(p.precio),
      stock_minimo: p.stock_minimo === null ? '' : String(p.stock_minimo),
      foto_url: p.foto_url ?? ''
    })
    setMostrarForm(true)
  }

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    try {
      const datos = {
        nombre: form.nombre.trim(),
        unidad_medida: form.unidad_medida.trim() || 'unidad',
        precio: Number(form.precio) || 0,
        stock_minimo: form.stock_minimo.trim() === '' ? null : Number(form.stock_minimo),
        foto_url: form.foto_url.trim() === '' ? null : form.foto_url.trim()
      }
      if (editando) {
        await actualizarProducto(editando.id, datos)
      } else {
        await crearProducto({ ...datos, tenant_id: tenant.id })
      }
      setMostrarForm(false)
      await cargar()
    } catch {
      setError('No se pudo guardar el producto.')
    } finally {
      setGuardando(false)
    }
  }

  async function alternarActivo(p: Producto) {
    try {
      await actualizarProducto(p.id, { activo: !p.activo })
      await cargar()
    } catch {
      setError('No se pudo actualizar el producto.')
    }
  }

  const conStockBajo = (productos ?? []).filter(
    (p) => p.activo && p.stock_minimo !== null && (stock[p.id] ?? 0) < p.stock_minimo
  )

  return (
    <div>
      <div className="panel-seccion-header">
        <h2>Productos</h2>
        <button className="btn-primario" onClick={abrirNuevo}>
          + Nuevo producto
        </button>
      </div>

      {error && <p className="warn">{error}</p>}

      {conStockBajo.length > 0 && (
        <p className="alerta-stock">
          ⚠ {conStockBajo.length} producto{conStockBajo.length === 1 ? '' : 's'} con stock bajo:{' '}
          {conStockBajo.map((p) => p.nombre).join(', ')}
        </p>
      )}

      {mostrarForm && (
        <form className="panel-form" onSubmit={guardar}>
          <h3>{editando ? `Editar ${editando.nombre}` : 'Nuevo producto'}</h3>
          <label>
            Nombre
            <input
              type="text"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
          </label>
          <label>
            Unidad
            <input
              type="text"
              list="unidades-sugeridas"
              value={form.unidad_medida}
              onChange={(e) => setForm({ ...form, unidad_medida: e.target.value })}
            />
            <datalist id="unidades-sugeridas">
              <option value="kg" />
              <option value="unidad" />
              <option value="docena" />
              <option value="bolsa" />
            </datalist>
          </label>
          <label>
            Precio
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.precio}
              onChange={(e) => setForm({ ...form, precio: e.target.value })}
            />
          </label>
          <label>
            Stock mínimo (para la alerta, opcional)
            <input
              type="number"
              step="0.001"
              min="0"
              value={form.stock_minimo}
              onChange={(e) => setForm({ ...form, stock_minimo: e.target.value })}
            />
          </label>
          <label>
            URL de la foto (opcional)
            <input
              type="text"
              placeholder="https://..."
              value={form.foto_url}
              onChange={(e) => setForm({ ...form, foto_url: e.target.value })}
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

      {productos === null && !error && <p className="app-status">Cargando...</p>}
      {productos !== null && productos.length === 0 && (
        <p className="app-status">Todavía no cargaste ningún producto.</p>
      )}

      {productos !== null && productos.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Precio</th>
              <th>Stock actual</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const stockActual = stock[p.id] ?? 0
              const stockBajo = p.stock_minimo !== null && stockActual < p.stock_minimo
              return (
                <tr key={p.id} className={!p.activo ? 'fila-inactiva' : ''}>
                  <td>{p.nombre}</td>
                  <td>
                    ${p.precio.toFixed(2)} / {p.unidad_medida}
                  </td>
                  <td className={stockBajo ? 'texto-alerta' : ''}>
                    {stockActual} {p.unidad_medida}
                    {stockBajo ? ' ⚠' : ''}
                  </td>
                  <td>{p.activo ? 'Activo' : 'Inactivo'}</td>
                  <td className="panel-tabla-acciones">
                    <button className="link-btn-oscuro" onClick={() => abrirEditar(p)}>
                      Editar
                    </button>
                    <button className="link-btn-oscuro" onClick={() => alternarActivo(p)}>
                      {p.activo ? 'Desactivar' : 'Activar'}
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
