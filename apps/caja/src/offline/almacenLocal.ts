// Todo lo que la tablet necesita recordar por su cuenta para poder seguir
// cobrando sin internet: el último catálogo visto, la sesión del cajero,
// y las ventas que todavía no se pudieron mandar a Supabase.
import type {
  Cliente,
  NuevaVenta,
  NuevoCargoCuentaCorriente,
  NuevoMovimientoStock,
  NuevoVentaItem,
  Perfil,
  Producto,
  Tenant
} from '@cdc/shared'

export interface VentaPendiente {
  venta: NuevaVenta
  items: NuevoVentaItem[]
  movimientos: NuevoMovimientoStock[]
}

const CATALOGO_KEY = (tenantId: string) => `cdc_catalogo_${tenantId}`
const STOCK_KEY = (tenantId: string) => `cdc_stock_${tenantId}`
const CLIENTES_KEY = (tenantId: string) => `cdc_clientes_${tenantId}`
const PERFIL_KEY = (userId: string) => `cdc_perfil_${userId}`
const COLA_KEY = 'cdc_cola_ventas'
const COLA_CARGOS_CC_KEY = 'cdc_cola_cargos_cc'

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

// ---- stock (para saber cuánto queda de cada producto sin depender de la red) ----

export function guardarStock(tenantId: string, stock: Record<string, number>) {
  localStorage.setItem(STOCK_KEY(tenantId), JSON.stringify(stock))
}

export function leerStockGuardado(tenantId: string): Record<string, number> | null {
  const raw = localStorage.getItem(STOCK_KEY(tenantId))
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

// ---- clientes (para poder vender a cuenta corriente sin depender de la red) ----

export function guardarClientes(tenantId: string, clientes: Cliente[]) {
  localStorage.setItem(CLIENTES_KEY(tenantId), JSON.stringify(clientes))
}

export function leerClientesGuardados(tenantId: string): Cliente[] | null {
  const raw = localStorage.getItem(CLIENTES_KEY(tenantId))
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

// ---- cola de cargos a cuenta corriente pendientes de sincronizar ----
// Separada de la cola de ventas: la venta en sí ya se guarda (o encola) igual
// que siempre: esto es solo el cargo a la cuenta del cliente.

function leerColaCargosCC(): NuevoCargoCuentaCorriente[] {
  const raw = localStorage.getItem(COLA_CARGOS_CC_KEY)
  if (!raw) return []
  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function guardarColaCargosCC(cola: NuevoCargoCuentaCorriente[]) {
  localStorage.setItem(COLA_CARGOS_CC_KEY, JSON.stringify(cola))
}

export function encolarCargoCuentaCorriente(cargo: NuevoCargoCuentaCorriente) {
  const cola = leerColaCargosCC()
  cola.push(cargo)
  guardarColaCargosCC(cola)
}

export function obtenerColaCargosCC(): NuevoCargoCuentaCorriente[] {
  return leerColaCargosCC()
}

export function quitarDeColaCargosCC(cargoId: string) {
  guardarColaCargosCC(leerColaCargosCC().filter((c) => c.id !== cargoId))
}

export function cantidadPendientes(): number {
  return leerCola().length + leerColaCargosCC().length
}
