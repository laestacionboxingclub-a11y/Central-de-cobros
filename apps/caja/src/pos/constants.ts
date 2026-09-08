import type { MetodoPago } from '@cdc/shared'

export const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  posnet: 'Posnet',
  transferencia: 'Transferencia'
}
