// Todo lo que la tablet necesita recordar por su cuenta para poder seguir
// cobrando sin internet: el último catálogo visto, la sesión del cajero,
// y las ventas que todavía no se pudieron mandar a Supabase.
import type { NuevaVenta, NuevoMovimientoStock, NuevoVentaItem, Perfil, Producto, Tenant } from '@cdc/shared'

export interface VentaPendiente {
  venta: NuevaVenta
  items: NuevoVentaItem[]
  movimientos: NuevoMovimientoStock[]
}

const CATALOGO_KEY = (tenantId: string) => `cdc_catalogo_${tenantId}`
const PERFIL_KEY = (userId: string) => `cdc_perfil_${userId}`
const COLA_KEY = 'cdc_cola_ventas'

// ---- catálogo ----

export function guardarCatalogo(tenantId: string, productos: Producto[]) {
  localStorage.setItem(
    CATALOGO_KEY(tenantId),
    JSON.stringify({ productos, guardadoEn: new Date().toISOString() })
  )
}

export function leerCatalogoGuardado(tenantId: string): { productos: Producto[]; guardadoEn: string } | null {
  const raw = localStorage.getItem(CATALOGO_KEY(tenantId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---- perfil/tenant (para poder entrar sin red si ya se inició sesión antes) ----

export function guardarPerfilCache(userId: string, perfil: Perfil, tenant: Tenant | null) {
  localStorage.setItem(PERFIL_KEY(userId), JSON.stringify({ perfil, tenant }))
}

export function leerPerfilCache(userId: string): { perfil: Perfil; tenant: Tenant | null } | null {
  const raw = localStorage.getItem(PERFIL_KEY(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---- cola de ventas pendientes de sincronizar ----

function leerCola(): VentaPendiente[] {
  const raw = localStorage.getItem(COLA_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function guardarCola(cola: VentaPendiente[]) {
  localStorage.setItem(COLA_KEY, JSON.stringify(cola))
}

export function encolarVenta(pendiente: VentaPendiente) {
  const cola = leerCola()
  cola.push(pendiente)
  guardarCola(cola)
}

export function obtenerCola(): VentaPendiente[] {
  return leerCola()
}

export function quitarDeCola(ventaId: string) {
  guardarCola(leerCola().filter((p) => p.venta.id !== ventaId))
}

export function cantidadPendientes(): number {
  return leerCola().length
}
