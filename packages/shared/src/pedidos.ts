import { supabase } from './supabase/client'
import type { Pedido, PedidoItem } from './types'

export interface NuevoPedidoItem {
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export interface NuevoPedido {
  tenant_id: string
  nombre_referencia: string | null
  creado_por: string | null
  total: number
  items: NuevoPedidoItem[]
}

// Crea el pedido + sus líneas y calcula el número del día de forma atómica
// (ver crear_pedido en 0008_pedidos.sql).
export async function crearPedido(pedido: NuevoPedido): Promise<Pedido> {
  const { data, error } = await supabase.rpc('crear_pedido', {
    p_tenant_id: pedido.tenant_id,
    p_nombre_referencia: pedido.nombre_referencia,
    p_creado_por: pedido.creado_por,
    p_total: pedido.total,
    p_items: pedido.items
  })
  if (error) throw error
  return data
}

// Los que todavía no se cobraron — lo que ve la caja para buscar por
// número o nombre.
export async function fetchPedidosPendientes(tenantId: string): Promise<Pedido[]> {
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('estado', 'pendiente')
    .order('creado_en', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function fetchItemsDePedido(pedidoId: string): Promise<PedidoItem[]> {
  const { data, error } = await supabase.from('pedido_items').select('*').eq('pedido_id', pedidoId)
  if (error) throw error
  return data ?? []
}

// Se llama después de registrar la venta real (registrarVenta): deja
// asentado que este pedido ya se cobró y con qué venta corresponde.
export async function marcarPedidoCobrado(
  pedidoId: string,
  ventaId: string,
  cobradoPor: string
): Promise<void> {
  const { error } = await supabase
    .from('pedidos')
    .update({ estado: 'cobrado', venta_id: ventaId, cobrado_por: cobradoPor, cobrado_en: new Date().toISOString() })
    .eq('id', pedidoId)
  if (error) throw error
}

export async function cancelarPedido(pedidoId: string): Promise<void> {
  const { error } = await supabase.from('pedidos').update({ estado: 'cancelado' }).eq('id', pedidoId)
  if (error) throw error
}
