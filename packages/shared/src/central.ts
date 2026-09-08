import { supabase } from './supabase/client'
import type { EstadoTenant, Perfil, RolPerfil, Tenant } from './types'

// Todo lo de acá lo puede usar cualquier fila gracias a is_superadmin() en las
// políticas de RLS (ver supabase/migrations/0001_init.sql): un superadmin
// autenticado ve y edita los datos de cualquier tenant, no solo el propio.

export async function fetchTenants(): Promise<Tenant[]> {
  const { data, error } = await supabase.from('tenants').select('*').order('nombre')
  if (error) throw error
  return data ?? []
}

export async function crearTenant(nombre: string): Promise<Tenant> {
  const { data, error } = await supabase.from('tenants').insert({ nombre }).select().single()
  if (error) throw error
  return data
}

export async function actualizarEstadoTenant(id: string, estado: EstadoTenant): Promise<void> {
  const { error } = await supabase.from('tenants').update({ estado }).eq('id', id)
  if (error) throw error
}

// Cuenta cajeros/dueños por tenant, para mostrar en la lista de clientes sin
// tener que abrir cada uno.
export async function fetchCantidadPerfilesPorTenant(): Promise<Record<string, number>> {
  const { data, error } = await supabase.from('perfiles').select('tenant_id').not('tenant_id', 'is', null)
  if (error) throw error
  const mapa: Record<string, number> = {}
  for (const fila of data ?? []) {
    if (!fila.tenant_id) continue
    mapa[fila.tenant_id] = (mapa[fila.tenant_id] ?? 0) + 1
  }
  return mapa
}

// Vincula un usuario que ya existe en Authentication (creado a mano en el
// dashboard de Supabase) como dueño/cajero de un tenant. No crea el login en
// sí — eso requiere la clave de servicio, que nunca debe estar en el navegador.
export async function vincularPerfil(userId: string, tenantId: string, rol: RolPerfil, nombre: string): Promise<Perfil> {
  const { data, error } = await supabase
    .from('perfiles')
    .insert({ id: userId, tenant_id: tenantId, rol, nombre })
    .select()
    .single()
  if (error) throw error
  return data
}
