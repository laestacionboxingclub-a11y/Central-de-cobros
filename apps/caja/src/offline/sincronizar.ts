import { registrarVenta } from '@cdc/shared'
import { obtenerCola, quitarDeCola } from './almacenLocal'

// Heurística para distinguir "no hay internet ahora" de un error real: si el
// fetch nunca llegó a un servidor, el navegador tira un TypeError (o similar).
export function esErrorDeRed(error: unknown): boolean {
  if (!navigator.onLine) return true
  if (error instanceof TypeError) return true
  const mensaje = error instanceof Error ? error.message.toLowerCase() : ''
  return mensaje.includes('fetch') || mensaje.includes('network')
}

// 23505 = unique_violation en Postgres: esta venta ya se había guardado en un
// intento anterior (el id lo genera la tablet, así que reintentar es seguro).
function yaEstabaSincronizada(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === '23505'
}

export async function sincronizarPendientes(): Promise<{ sincronizadas: number; quedanPendientes: number }> {
  const cola = obtenerCola()
  let sincronizadas = 0

  for (const pendiente of cola) {
    try {
      await registrarVenta(pendiente)
      quitarDeCola(pendiente.venta.id)
      sincronizadas++
    } catch (error) {
      if (yaEstabaSincronizada(error)) {
        quitarDeCola(pendiente.venta.id)
        sincronizadas++
        continue
      }
      // Seguimos sin conexión (u otro problema pasajero): dejamos de intentar
      // por ahora. Se vuelve a intentar solo o con "Sincronizar ahora".
      break
    }
  }

  return { sincronizadas, quedanPendientes: obtenerCola().length }
}
