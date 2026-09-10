import type { MetodoPago, Producto, Tenant } from '@cdc/shared'
import { ETIQUETA_METODO } from './constants'
import type { CajaSeleccionada } from './localCaja'

export interface VentaConfirmada {
  numero: string
  items: { producto: Producto; cantidad: number; precioUnitario: number }[]
  total: number
  metodoPago: MetodoPago
  fecha: string
  pendienteSync: boolean
  clienteNombre?: string
  pagaCon?: number
  vuelto?: number
}

export function Comprobante({
  tenant,
  caja,
  venta,
  onNuevaVenta
}: {
  tenant: Tenant
  caja: CajaSeleccionada
  venta: VentaConfirmada
  onNuevaVenta: () => void
}) {
  return (
    <main className="app-shell">
      <div className="comprobante">
        <h2>{tenant.nombre}</h2>
        <p>{caja.nombre}</p>
        <p>Comprobante {venta.numero}</p>
        <p>{new Date(venta.fecha).toLocaleString('es-AR')}</p>
        <hr />
        <ul className="comprobante-items">
          {venta.items.map((linea) => (
            <li key={linea.producto.id}>
              <span>
                {linea.cantidad} {linea.producto.unidad_medida} × {linea.producto.nombre}
              </span>
              <span>${(linea.cantidad * linea.precioUnitario).toFixed(2)}</span>
            </li>
          ))}
        </ul>
        <hr />
        <p className="comprobante-total">Total: ${venta.total.toFixed(2)}</p>
        <p>Pago: {ETIQUETA_METODO[venta.metodoPago]}</p>
        {venta.pagaCon !== undefined && (
          <>
            <p>Paga con: ${venta.pagaCon.toFixed(2)}</p>
            <p className="comprobante-total">Vuelto: ${(venta.vuelto ?? 0).toFixed(2)}</p>
          </>
        )}
        {venta.clienteNombre && <p>Cliente: {venta.clienteNombre}</p>}
      </div>

      {venta.pendienteSync && (
        <p className="no-imprimir warn">
          ⚠ Guardada en la tablet — se va a sincronizar sola apenas vuelva la conexión.
        </p>
      )}

      <div className="no-imprimir comprobante-acciones">
        <button onClick={() => window.print()}>Imprimir</button>
        <button onClick={onNuevaVenta}>Nueva venta</button>
      </div>
    </main>
  )
}
