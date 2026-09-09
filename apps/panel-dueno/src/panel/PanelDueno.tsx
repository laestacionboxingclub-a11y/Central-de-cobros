import { useState } from 'react'
import type { Perfil, Tenant } from '@cdc/shared'
import { Productos } from './Productos'
import { Stock } from './Stock'
import { Clientes } from './Clientes'
import { Gastos } from './Gastos'
import { Cierres } from './Cierres'
import { Reportes } from './Reportes'

type Tab = 'productos' | 'stock' | 'clientes' | 'gastos' | 'cierres' | 'reportes'

const TABS: { id: Tab; etiqueta: string }[] = [
  { id: 'productos', etiqueta: 'Productos' },
  { id: 'stock', etiqueta: 'Stock' },
  { id: 'clientes', etiqueta: 'Clientes' },
  { id: 'gastos', etiqueta: 'Gastos' },
  { id: 'cierres', etiqueta: 'Cierres' },
  { id: 'reportes', etiqueta: 'Reportes' }
]

export function PanelDueno({
  perfil,
  tenant,
  onLogout
}: {
  perfil: Perfil
  tenant: Tenant
  onLogout: () => void
}) {
  const [tab, setTab] = useState<Tab>('productos')

  return (
    <div className="panel-layout">
      <header className="panel-header">
        <div>
          <strong>{tenant.nombre}</strong> · {perfil.nombre}
        </div>
        <button className="link-btn" onClick={onLogout}>
          Cerrar sesión
        </button>
      </header>

      <nav className="panel-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`panel-tab ${tab === t.id ? 'activo' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.etiqueta}
          </button>
        ))}
      </nav>

      <main className="panel-contenido">
        {tab === 'productos' && <Productos tenant={tenant} />}
        {tab === 'stock' && <Stock tenant={tenant} perfil={perfil} />}
        {tab === 'clientes' && <Clientes tenant={tenant} perfil={perfil} />}
        {tab === 'gastos' && <Gastos tenant={tenant} perfil={perfil} />}
        {tab === 'cierres' && <Cierres tenant={tenant} />}
        {tab === 'reportes' && <Reportes tenant={tenant} />}
      </main>
    </div>
  )
}
