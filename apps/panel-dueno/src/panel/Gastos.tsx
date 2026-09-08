import { useEffect, useState, type FormEvent } from 'react'
import { crearGasto, fetchGastos, type Gasto, type Perfil, type Tenant } from '@cdc/shared'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

export function Gastos({ tenant, perfil }: { tenant: Tenant; perfil: Perfil }) {
  const [gastos, setGastos] = useState<Gasto[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fecha, setFecha] = useState(hoyISO())
  const [categoria, setCategoria] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function cargar() {
    try {
      setGastos(await fetchGastos(tenant.id))
    } catch {
      setError('No se pudieron cargar los gastos.')
    }
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant.id])

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!categoria.trim() || !monto) return
    setGuardando(true)
    setError(null)
    try {
      await crearGasto({
        tenant_id: tenant.id,
        fecha,
        categoria: categoria.trim(),
        descripcion: descripcion.trim() === '' ? null : descripcion.trim(),
        monto: Number(monto),
        creado_por: perfil.id
      })
      setFecha(hoyISO())
      setCategoria('')
      setDescripcion('')
      setMonto('')
      await cargar()
    } catch {
      setError('No se pudo guardar el gasto.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div>
      <h2>Gastos</h2>

      {error && <p className="warn">{error}</p>}

      <form className="panel-form panel-form-ancho" onSubmit={guardar}>
        <label>
          Fecha
          <input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </label>
        <label>
          Categoría
          <input
            type="text"
            list="categorias-sugeridas"
            required
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
          <datalist id="categorias-sugeridas">
            <option value="Mercadería" />
            <option value="Alquiler" />
            <option value="Sueldos" />
            <option value="Servicios" />
            <option value="Otros" />
          </datalist>
        </label>
        <label>
          Descripción (opcional)
          <input type="text" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </label>
        <label>
          Monto
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </label>
        <button type="submit" className="btn-primario" disabled={guardando}>
          {guardando ? 'Guardando...' : 'Agregar gasto'}
        </button>
      </form>

      {gastos === null && !error && <p className="app-status">Cargando...</p>}
      {gastos !== null && gastos.length === 0 && <p className="app-status">Todavía no cargaste gastos.</p>}

      {gastos !== null && gastos.length > 0 && (
        <table className="panel-tabla">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {gastos.map((g) => (
              <tr key={g.id}>
                <td>{new Date(g.fecha).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                <td>{g.categoria}</td>
                <td>{g.descripcion ?? '—'}</td>
                <td>${g.monto.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
