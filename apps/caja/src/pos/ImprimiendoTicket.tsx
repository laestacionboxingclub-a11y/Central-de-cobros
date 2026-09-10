import { useEffect } from 'react'
import type { Tenant } from '@cdc/shared'
import { ETIQUETA_METODO } from './constants'
import type { VentaConfirmada } from './Comprobante'
import type { CajaSeleccionada } from './localCaja'

export function ImprimiendoTicket({
  tenant,
  caja,
  venta,
  onFinish
}: {
  tenant: Tenant
  caja: CajaSeleccionada
  venta: VentaConfirmada
  onFinish: () => void
}) {
  useEffect(() => {
    const t = setTimeout(onFinish, 1100)
    return () => clearTimeout(t)
  }, [onFinish])

  return (
    <div className="imprimiendo-overlay">
      <div className="impresora">
        <div className="impresora-ranura" />
      </div>
      <div className="paper-window">
        <div className="ticket-saliendo">
          <div className="head-line" />
          <p className="ticket-marca">{tenant.nombre}</p>
          <p className="ticket-meta">{caja.nombre}</p>
          <p className="ticket-meta">Comprobante {venta.numero}</p>
          <hr className="ticket-linea" />
          <ul className="ticket-items">
            {venta.items.map((l) => (
              <li key={l.producto.id}>
                <span>
                  {l.cantidad} {l.producto.unidad_medida} × {l.producto.nombre}
                </span>
                <span>${(l.cantidad * l.precioUnitario).toFixed(2)}</span>
              </li>
            ))}
          </ul>
          <hr className="ticket-linea" />
          <p className="ticket-total">Total: ${venta.total.toFixed(2)}</p>
          <p className="ticket-meta">Pago: {ETIQUETA_METODO[venta.metodoPago]}</p>
          {venta.clienteNombre && <p className="ticket-meta">Cliente: {venta.clienteNombre}</p>}
        </div>
      </div>
      <p className="app-status">Imprimiendo comprobante...</p>
    </div>
  )
}
