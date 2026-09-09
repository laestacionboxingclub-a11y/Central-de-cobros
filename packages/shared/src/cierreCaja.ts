import { supabase } from './supabase/client'
import type { CierreCaja } from './types'

// El último cierre de esa caja (si hubo alguno) — a partir de su fecha se
// cuenta el efectivo esperado del próximo cierre.
export async function fetchUltimoCierre(cajaId: string): Promise<CierreCaja | null> {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .eq('caja_id', cajaId)
    .order('creado_en', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// Suma de las ventas en efectivo de esa caja desde una fecha (o desde
// siempre, si nunca se cerró antes) — lo que "debería haber" en el cajón.
export async function calcularEfectivoEsperado(
  tenantId: string,
  cajaId: string,
  desdeISO: string | null
): Promise<number> {
  let query = supabase
    .from('ventas')
    .select('total')
    .eq('tenant_id', tenantId)
    .eq('caja_id', cajaId)
    .eq('metodo_pago', 'efectivo')
    .eq('estado', 'completada')
  if (desdeISO) query = query.gt('creada_en', desdeISO)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).reduce((acc, v) => acc + v.total, 0)
}

export interface NuevoCierreCaja {
  tenant_id: string
  caja_id: string
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  cerrado_por: string | null
}

export async function registrarCierreCaja(cierre: NuevoCierreCaja): Promise<CierreCaja> {
  const { data, error } = await supabase.from('cierres_caja').insert(cierre).select().single()
  if (error) throw error
  return data
}

// Para el panel del dueño: el historial completo de cierres del tenant,
// más recientes primero.
export async function fetchCierresCaja(tenantId: string): Promise<CierreCaja[]> {
  const { data, error } = await supabase
    .from('cierres_caja')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('creado_en', { ascending: false })
  if (error) throw error
  return data ?? []
}
