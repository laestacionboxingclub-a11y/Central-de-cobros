import { supabase } from './supabase/client'
import type { Gasto, MovimientoStock, Producto, StockActual, Venta } from './types'

// A diferencia de fetchProductos (pos.ts), esta trae también los inactivos:
// el dueño necesita verlos para poder reactivarlos.
export async function fetchTodosLosProductos(tenantId: string): Promise<Producto[]> {
  const { data, error } = await supabase.from('productos').select('*').eq('tenant_id', tenantId).order('nombre')
  if (error) throw error
  return data ?? []
}

export interface NuevoProducto {
  tenant_id: string
  nombre: string
  unidad_medida: string
  precio: number
  stock_minimo: number | null
  foto_url: string | null
}

export async function crearProducto(datos: NuevoProducto): Promise<Producto> {
  const { data, error } = await supabase.from('productos').insert(datos).select().single()
  if (error) throw error
  return data
}

export interface CambiosProducto {
  nombre?: string
  unidad_medida?: string
  precio?: number
  stock_minimo?: number | null
  foto_url?: string | null
  activo?: boolean
}

export async function actualizarProducto(id: string, cambios: CambiosProducto): Promise<Producto> {
  const { data, error } = await supabase.from('productos').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function fetchStockActual(tenantId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('stock_actual').select('*').eq('tenant_id', tenantId)
  if (error) throw error
  const mapa: Record<string, number> = {}
  for (const fila of (data ?? []) as StockActual[]) {
    mapa[fila.producto_id] = fila.stock
  }
  return mapa
}

export interface NuevoMovimientoManual {
  id: string
  tenant_id: string
  producto_id: string
  cantidad: number
  tipo: MovimientoStock['tipo']
  creado_por: string | null
  creado_en: string
}

export async function registrarMovimientoStock(movimiento: NuevoMovimientoManual): Promise<void> {
  const { error } = await supabase.from('movimientos_stock').insert(movimiento)
  if (error) throw error
}

export async function fetchGastos(tenantId: string): Promise<Gasto[]> {
  const { data, error } = await supabase
    .from('gastos')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('fecha', { ascending: false })
  if (error) throw error
  return data ?? []
}

export interface NuevoGasto {
  tenant_id: string
  fecha: string
  categoria: string
  descripcion: string | null
  monto: number
  creado_por: string | null
}

export async function crearGasto(gasto: NuevoGasto): Promise<Gasto> {
  const { data, error } = await supabase.from('gastos').insert(gasto).select().single()
  if (error) throw error
  return data
}

export async function fetchVentasEntre(tenantId: string, desdeISO: string, hastaISO: string): Promise<Venta[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('creada_en', desdeISO)
    .lte('creada_en', hastaISO)
    .order('creada_en', { ascending: false })
  if (error) throw error
  return data ?? []
}
