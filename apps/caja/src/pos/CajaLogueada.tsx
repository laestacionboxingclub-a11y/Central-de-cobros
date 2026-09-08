import { useEffect, useState } from 'react'
import type { Perfil, Tenant } from '@cdc/shared'
import { SeleccionCaja } from './SeleccionCaja'
import { PuntoDeVenta } from './PuntoDeVenta'
import { getCajaGuardada, olvidarCaja, type CajaSeleccionada } from './localCaja'

export function CajaLogueada({
  perfil,
  tenant,
  onLogout
}: {
  perfil: Perfil
  tenant: Tenant
  onLogout: () => void
}) {
  const [caja, setCaja] = useState<CajaSeleccionada | null | undefined>(undefined)

  useEffect(() => {
    setCaja(getCajaGuardada())
  }, [])

  function cambiarCaja() {
    olvidarCaja()
    setCaja(null)
  }

  if (caja === undefined) {
    return (
      <main className="app-shell">
        <p className="app-status">Cargando...</p>
      </main>
    )
  }

  if (!caja) {
    return <SeleccionCaja tenantId={tenant.id} onSeleccionada={setCaja} />
  }

  return (
    <PuntoDeVenta
      perfil={perfil}
      tenant={tenant}
      caja={caja}
      onCambiarCaja={cambiarCaja}
      onLogout={onLogout}
    />
  )
}
