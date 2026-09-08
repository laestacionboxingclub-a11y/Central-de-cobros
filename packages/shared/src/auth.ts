import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase/client'
import type { Perfil, Tenant } from './types'

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signOut() {
  return supabase.auth.signOut()
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

// perfiles.id = auth.users.id (ver supabase/migrations/0001_init.sql)
export async function fetchPerfil(userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function fetchTenant(tenantId: string): Promise<Tenant | null> {
  const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle()
  if (error) throw error
  return data
}
