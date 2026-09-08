import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  fetchPerfil,
  fetchTenant,
  getSession,
  onAuthStateChange,
  signInWithPassword,
  signOut,
  type Perfil,
  type Tenant
} from '@cdc/shared'
import { guardarPerfilCache, leerPerfilCache } from '../offline/almacenLocal'

interface AuthState {
  loading: boolean
  session: Session | null
  perfil: Perfil | null
  tenant: Tenant | null
  error: string | null
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    perfil: null,
    tenant: null,
    error: null
  })

  useEffect(() => {
    async function loadPerfil(session: Session | null) {
      if (!session) {
        setState({ loading: false, session: null, perfil: null, tenant: null, error: null })
        return
      }
      try {
        const perfil = await fetchPerfil(session.user.id)
        if (!perfil) {
          setState({
            loading: false,
            session,
            perfil: null,
            tenant: null,
            error: 'Tu usuario no tiene un perfil asignado. Contactá al soporte.'
          })
          return
        }
        const tenant = perfil.tenant_id ? await fetchTenant(perfil.tenant_id) : null
        setState({ loading: false, session, perfil, tenant, error: null })
        guardarPerfilCache(session.user.id, perfil, tenant)
      } catch {
        // Sin conexión: si esta tablet ya inició sesión antes, seguimos con
        // el último perfil/tenant que se guardó localmente en vez de trabarnos.
        const cache = leerPerfilCache(session.user.id)
        if (cache) {
          setState({ loading: false, session, perfil: cache.perfil, tenant: cache.tenant, error: null })
          return
        }
        setState({
          loading: false,
          session,
          perfil: null,
          tenant: null,
          error: 'No se pudo cargar el perfil. Intentá de nuevo.'
        })
      }
    }

    getSession().then(loadPerfil)
    return onAuthStateChange(loadPerfil)
  }, [])

  async function signIn(email: string, password: string) {
    setState((s) => ({ ...s, loading: true, error: null }))
    const { error } = await signInWithPassword(email, password)
    if (error) {
      setState((s) => ({ ...s, loading: false, error: 'Email o contraseña incorrectos.' }))
    }
  }

  async function logout() {
    await signOut()
  }

  return <AuthContext.Provider value={{ ...state, signIn, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
