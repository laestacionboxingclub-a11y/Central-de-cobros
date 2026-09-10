import { useEffect, useMemo, useState } from 'react'
import { fetchPedidosPendientes, type Pedido, type Tenant } from '@cdc/shared'

export function PedidosPendientes({
  tenant,
  onElegir,
  onVolver
}: {
  tenant: Tenant
  onElegir: (pedido: Pedido) => void
  onVolver: () => void
}) {
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    fetchPedidosPendientes(tenant.id)
      .then(setPedidos)
      .catch(() => setError('No se pudieron cargar los pedidos.'))
  }, [tenant.id])

  const filtrados = useMemo(() => {
    if (!pedidos) return []
    const q = busqueda.trim().toLowerCase()
    if (!q) return pedidos
    return pedidos.filter(
      (p) => String(p.numero).includes(q) || (p.nombre_referencia ?? '').toLowerCase().includes(q)
    )
  }, [pedidos, busqueda])

  return (
    <main className="app-shell">
      <h1>Pedidos esperando cobro</h1>
      {error && <p className="warn">{error}</p>}

      <input
        type="text"
        placeholder="Buscar por número o nombre..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        className="pos-buscador"
      />

      {pedidos === null && !error && <p className="app-status">Cargando...</p>}
      {pedidos !== null && pedidos.length === 0 && <p className="app-status">No hay pedidos pendientes.</p>}
      {pedidos !== null && pedidos.length > 0 && filtrados.length === 0 && (
        <p className="app-status">Ningún pedido coincide con la búsqueda.</p>
      )}

      <ul className="lista-cajas">
        {filtrados.map((p) => (
          <li key={p.id}>
            <button className="opcion-caja" onClick={() => onElegir(p)}>
              Pedido nº {p.numero}
              {p.nombre_referencia ? ` — ${p.nombre_referencia}` : ''} — ${p.total.toFixed(2)}
            </button>
          </li>
        ))}
      </ul>

      <button onClick={onVolver}>Volver</button>
    </main>
  )
}
