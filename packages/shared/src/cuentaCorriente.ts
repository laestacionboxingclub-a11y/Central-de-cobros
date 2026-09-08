import { supabase } from './supabase/client'
import type { Cliente, MovimientoCuentaCorriente } from './types'

// Los activos primero (los inactivos quedan para consultar historial viejo,
// no para volver a venderles a cuenta).
export async function fetchClientes(tenantId: string): Promise<Cliente[]> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('nombre')
  if (error) throw error
  return data ?? []
}

export interface NuevoCliente {
  tenant_id: string
  nombre: string
  telefono: string | null
}

export async function crearCliente(datos: NuevoCliente): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').insert(datos).select().single()
  if (error) throw error
  return data
}

export interface CambiosCliente {
  nombre?: string
  telefono?: string | null
  activo?: boolean
}

export async function actualizarCliente(id: string, cambios: CambiosCliente): Promise<Cliente> {
  const { data, error } = await supabase.from('clientes').update(cambios).eq('id', id).select().single()
  if (error) throw error
  return data
}

// Saldo actual de cada cliente (positivo = te debe). Igual que fetchStockActual,
// un cliente sin movimientos no aparece en el mapa (no es lo mismo "sin dato"
// que "saldo 0").
export async function fetchSaldosCuentaCorriente(tenantId: string): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('cuenta_corriente_saldo').select('*').eq('tenant_id', tenantId)
  if (error) throw error
  const mapa: Record<string, number> = {}
  for (const fila of data ?? []) {
    mapa[fila.cliente_id] = fila.saldo
  }
  return mapa
}

export interface NuevoCargoCuentaCorriente {
  id: string
  tenant_id: string
  cliente_id: string
  monto: number
  venta_id: string | null
  creado_por: string | null
  creado_en: string
}

// Se llama después de registrarVenta cuando el método de pago fue "cuenta
// corriente" — queda separado (no atómico con la venta) a propósito: si esto
// falla, la venta ya se guardó igual y el cargo se puede cargar a mano después.
export async function registrarCargoCuentaCorriente(cargo: NuevoCargoCuentaCorriente): Promise<void> {
  const { error } = await supabase.from('cuenta_corriente_movimientos').insert({ ...cargo, tipo: 'cargo' })
  if (error) throw error
}

export interface NuevoPagoCuentaCorriente {
  id: string
  tenant_id: string
  cliente_id: string
  monto: number
  descripcion: string | null
  creado_por: string | null
  creado_en: string
}

export async function registrarPagoCuentaCorriente(pago: NuevoPagoCuentaCorriente): Promise<void> {
  const { error } = await supabase
    .from('cuenta_corriente_movimientos')
    .insert({ ...pago, monto: -Math.abs(pago.monto), tipo: 'pago' })
  if (error) throw error
}

export async function fetchMovimientosCliente(clienteId: string): Promise<MovimientoCuentaCorriente[]> {
  const { data, error } = await supabase
    .from('cuenta_corriente_movimientos')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data ?? []
}
