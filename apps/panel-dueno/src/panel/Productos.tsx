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
  tieneAtajo: boolean
  unidad_alternativa: string
  equivalencia_alternativa: string
  precio_alternativa: string
}

const FORM_VACIO: FormState = {
  nombre: '',
  unidad_medida: 'kg',
  precio: '',
  stock_minimo: '',
  foto_url: '',
  tieneAtajo: false,
  unidad_alternativa: 'bolsa',
  equivalencia_alternativa: '',
  precio_alternativa: ''
}

export function Productos({ tenant }: { tenant: Tenant }) {
  const [productos, setProductos] = useState<Producto[] | null>(null)
  const [stock, setStock] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [form, setForm] = useState<FormState>(FORM_VACIO)
  const [guardando, setGuardando] = useState(false)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [porcentajeAjuste, setPorcentajeAjuste] = useState('')
  const [aplicandoAjuste, setAplicandoAjuste] = useState(false)

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
      foto_url: p.foto_url ?? '',
      tieneAtajo: p.unidad_alternativa !== null,
      unidad_alternativa: p.unidad_alternativa ?? 'bolsa',
      equivalencia_alternativa: p.equivalencia_alternativa === null ? '' : String(p.equivalencia_alternativa),
      precio_alternativa: p.precio_alternativa === null ? '' : String(p.precio_alternativa)
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
        foto_url: form.foto_url.trim() === '' ? null : form.foto_url.trim(),
        unidad_alternativa: form.tieneAtajo ? form.unidad_alternativa.trim() || null : null,
        equivalencia_alternativa: form.tieneAtajo && form.equivalencia_alternativa.trim() !== '' ? Number(form.equivalencia_alternativa) : null,
        precio_alternativa: form.tieneAtajo && form.precio_alternativa.trim() !== '' ? Number(form.precio_alternativa) : null
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

  function alternarSeleccion(id: string) {
    setSeleccionados((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  function seleccionarTodos() {
    setSeleccionados(new Set((productos ?? []).map((p) => p.id)))
  }

  function deseleccionarTodos() {
    setSeleccionados(new Set())
  }

  async function aplicarAjustePrecio() {
    const pct = Number(porcentajeAjuste)
    if (!porcentajeAjuste.trim() || Number.isNaN(pct) || pct === 0 || seleccionados.size === 0) return
    setAplicandoAjuste(true)
    setError(null)
    try {
      const afectados = (productos ?? []).filter((p) => seleccionados.has(p.id))
      await Promise.all(
        afectados.map((p) =>
          actualizarProducto(p.id, { precio: Number((p.precio * (1 + pct / 100)).toFixed(2)) })
        )
      )
      setSeleccionados(new Set())
      setPorcentajeAjuste('')
      await cargar()
    } catch {
      setError('No se pudieron actualizar todos los precios. Revisá e intentá de nuevo.')
    } finally {
      setAplicandoAjuste(false)
    }
  }

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
              <option value="cajón" />
              <option value="bulto" />
              <option value="saco" />
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

          <label className="panel-form-checkbox">
            <input
              type="checkbox"
              checked={form.tieneAtajo}
              onChange={(e) => setForm({ ...form, tieneAtajo: e.target.checked })}
            />
            También se vende entero por bolsa/cajón (además de suelto por {form.unidad_medida || 'kg'})
          </label>

          {form.tieneAtajo && (
            <>
              <label>
                ¿Cómo se llama esa unidad?
                <input
                  type="text"
                  list="unidades-sugeridas"
                  value={form.unidad_alternativa}
                  onChange={(e) => setForm({ ...form, unidad_alternativa: e.target.value })}
                />
              </label>
              <label>
                Cuántos {form.unidad_medida || 'kg'} tiene una {form.unidad_alternativa || 'bolsa'}
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.equivalencia_alternativa}
                  onChange={(e) => setForm({ ...form, equivalencia_alternativa: e.target.value })}
                />
              </label>
              <label>
                Precio de la {form.unidad_alternativa || 'bolsa'} entera
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.precio_alternativa}
                  onChange={(e) => setForm({ ...form, precio_alternativa: e.target.value })}
                />
              </label>
            </>
          )}

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
        <>
          <div className="panel-ajuste-precios">
            <span>
              {seleccionados.size > 0
                ? `${seleccionados.size} producto${seleccionados.size === 1 ? '' : 's'} seleccionado${seleccionados.size === 1 ? '' : 's'}`
                : 'Seleccioná productos para ajustar el precio a varios a la vez'}
            </span>
            <button type="button" className="link-btn-oscuro" onClick={seleccionarTodos}>
              Seleccionar todos
            </button>
            {seleccionados.size > 0 && (
              <>
                <button type="button" className="link-btn-oscuro" onClick={deseleccionarTodos}>
                  Ninguno
                </button>
                <input
                  type="number"
                  step="0.1"
                  placeholder="% ej: 10 o -5"
                  className="panel-ajuste-input"
                  value={porcentajeAjuste}
                  onChange={(e) => setPorcentajeAjuste(e.target.value)}
                />
                <button
                  type="button"
                  className="btn-primario"
                  disabled={aplicandoAjuste || !porcentajeAjuste.trim()}
                  onClick={aplicarAjustePrecio}
                >
                  {aplicandoAjuste ? 'Aplicando...' : 'Aplicar'}
                </button>
              </>
            )}
          </div>

          <table className="panel-tabla">
            <thead>
              <tr>
                <th></th>
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
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccionados.has(p.id)}
                        onChange={() => alternarSeleccion(p.id)}
                        aria-label={`Seleccionar ${p.nombre}`}
                      />
                    </td>
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
        </>
      )}
    </div>
  )
}
