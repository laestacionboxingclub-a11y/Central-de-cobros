import type { Pedido, Producto, Tenant } from '@cdc/shared'

// TEMPORAL / SIN PROBAR CON HARDWARE REAL.
//
// Las impresoras térmicas Bluetooth chicas y baratas casi todas usan el
// mismo módulo genérico por dentro, con este UUID de servicio "tipo puerto
// serie" (no es un estándar oficial, es la convención que usan la mayoría
// de los fabricantes chinos de estos módulos). Cuando llegue la impresora
// real, hay que probar esto primero — si no imprime, lo más probable es
// que haya que cambiar estos dos UUID por los que traiga el manual/specs
// de esa impresora puntual.
const SERVICIO_UUID = '000018f0-0000-1000-8000-00805f9b34fb'
const CARACTERISTICA_ESCRITURA_UUID = '00002af1-0000-1000-8000-00805f9b34fb'

const ESC = '\x1b'
const GS = '\x1d'

function lineaTicket(izquierda: string, derecha: string, ancho = 32): string {
  const espacio = Math.max(1, ancho - izquierda.length - derecha.length)
  return izquierda + ' '.repeat(espacio) + derecha
}

function armarTexto(tenant: Tenant, pedido: Pedido, items: { producto: Producto; cantidad: number; precioUnitario: number }[]): string {
  const lineas: string[] = []
  lineas.push(ESC + 'a' + '\x01') // centrado
  lineas.push(tenant.nombre)
  lineas.push(`Pedido n. ${pedido.numero}`)
  if (pedido.nombre_referencia) lineas.push(pedido.nombre_referencia)
  lineas.push(new Date(pedido.creado_en).toLocaleString('es-AR'))
  lineas.push(ESC + 'a' + '\x00') // alineación izquierda
  lineas.push('--------------------------------')
  for (const l of items) {
    lineas.push(`${l.cantidad} ${l.producto.unidad_medida} x ${l.producto.nombre}`)
    lineas.push(lineaTicket('', `$${(l.cantidad * l.precioUnitario).toFixed(2)}`))
  }
  lineas.push('--------------------------------')
  lineas.push(lineaTicket('TOTAL', `$${pedido.total.toFixed(2)}`))
  lineas.push('\n\n\n')
  lineas.push(GS + 'V' + '\x00') // cortar papel (si la impresora lo soporta)
  return lineas.join('\n')
}

// Manda el ticket por Web Bluetooth. Tira una excepción si el navegador no
// soporta Web Bluetooth, si el usuario cancela el selector de dispositivo,
// o si la impresora no habla el protocolo que asumimos acá arriba.
export async function imprimirTicketPedido({
  tenant,
  pedido,
  items
}: {
  tenant: Tenant
  pedido: Pedido
  items: { producto: Producto; cantidad: number; precioUnitario: number }[]
}): Promise<void> {
  const bt = (navigator as Navigator & { bluetooth?: { requestDevice: (opts: unknown) => Promise<BluetoothDeviceLike> } })
    .bluetooth
  if (!bt) throw new Error('Este navegador no soporta Bluetooth.')

  const dispositivo = await bt.requestDevice({
    filters: [{ services: [SERVICIO_UUID] }],
    optionalServices: [SERVICIO_UUID]
  })
  const servidor = await dispositivo.gatt.connect()
  const servicio = await servidor.getPrimaryService(SERVICIO_UUID)
  const caracteristica = await servicio.getCharacteristic(CARACTERISTICA_ESCRITURA_UUID)

  const texto = armarTexto(tenant, pedido, items)
  const bytes = new TextEncoder().encode(texto)

  // Se manda en pedacitos chicos: la mayoría de estos módulos BLE no
  // aceptan un paquete grande de una sola vez.
  const TAMANO_PAQUETE = 180
  for (let i = 0; i < bytes.length; i += TAMANO_PAQUETE) {
    await caracteristica.writeValue(bytes.slice(i, i + TAMANO_PAQUETE))
  }
}

interface BluetoothDeviceLike {
  gatt: {
    connect: () => Promise<{
      getPrimaryService: (uuid: string) => Promise<{
        getCharacteristic: (uuid: string) => Promise<{ writeValue: (data: BufferSource) => Promise<void> }>
      }>
    }>
  }
}
