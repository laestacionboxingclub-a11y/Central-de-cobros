import { supabase } from './supabase/client'
import type { Caja, EstadoVenta, MetodoPago, Producto, TipoMovimientoStock } from './types'

export async function fetchProductos(tenantId: string): Promise<Producto[]> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('activo', true)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function fetchCajas(tenantId: string): Promise<Caja[]> {
  const { data, error } = await supabase
    .from('cajas')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('activa', true)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export async function crearCaja(tenantId: string, nombre: string): Promise<Caja> {
  const { data, error } = await supabase
    .from('cajas')
    .insert({ tenant_id: tenantId, nombre })
    .select()
    .single()
  if (error) throw error
  return data
}

// Estas son las filas "nuevas" que arma la tablet antes de guardar la venta:
// sin las columnas que pone el servidor solo (sincronizada_en, etc.).
export interface NuevaVenta {
  id: string
  tenant_id: string
  caja_id: string
  cajero_id: string
  numero_comprobante: string
  metodo_pago: MetodoPago
  total: number
  estado: EstadoVenta
  creada_en: string
}

export interface NuevoVentaItem {
  id: string
  venta_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface NuevoMovimientoStock {
  id: string
  tenant_id: string
  producto_id: string
  cantidad: number
  tipo: TipoMovimientoStock
  venta_id: string | null
  caja_id: string | null
  creado_por: string | null
  creado_en: string
}

export interface RegistrarVentaInput {
  venta: NuevaVenta
  items: NuevoVentaItem[]
  movimientos: NuevoMovimientoStock[]
}

// Llama a la función registrar_venta (ver supabase/migrations/0002_registrar_venta.sql):
// inserta la venta + sus líneas + los movimientos de stock en una sola operación atómica.
export async function registrarVenta({ venta, items, movimientos }: RegistrarVentaInput): Promise<void> {
  const { error } = await supabase.rpc('registrar_venta', { venta, items, movimientos })
  if (error) throw error
}
