import { isSupabaseConfigured } from '@cdc/shared'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'

const ROLES_PERMITIDOS = ['cajero', 'dueno']
const ETIQUETA_APP = 'App de Caja'

function Contenido() {
  const { loading, session, perfil, tenant, error, logout } = useAuth()

  if (loading) {
    return (
      <main className="app-shell">
        <p className="app-status">Cargando...</p>
      </main>
    )
  }

  if (!session) {
    return <LoginPage etiqueta={ETIQUETA_APP} />
  }

  if (error) {
    return (
      <main className="app-shell">
        <p className="warn">{error}</p>
        <button onClick={logout}>Cerrar sesión</button>
      </main>
    )
  }

  if (perfil && !ROLES_PERMITIDOS.includes(perfil.rol)) {
    return (
      <main className="app-shell">
        <p className="warn">Tu usuario ({perfil.rol}) no tiene acceso a {ETIQUETA_APP}.</p>
        <button onClick={logout}>Cerrar sesión</button>
      </main>
    )
  }

  if (tenant && tenant.estado === 'suspendido') {
    return (
      <main className="app-shell">
        <p className="warn">
          Tu cuenta está suspendida. Contactá a Central de Cobros para regularizar el pago de la
          membresía.
        </p>
        <button onClick={logout}>Cerrar sesión</button>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <h1>Central de Cobros</h1>
      <p className="app-label">{ETIQUETA_APP}</p>
      <p className="app-status">
        Sesión iniciada como {perfil?.nombre} ({perfil?.rol})
      </p>
      <p className="app-status">Todavía sin funciones de venta (Paso 4).</p>
      <button onClick={logout}>Cerrar sesión</button>
    </main>
  )
}

function App() {
  if (!isSupabaseConfigured) {
    return (
      <main className="app-shell">
        <h1>Central de Cobros</h1>
        <p className="app-label">{ETIQUETA_APP}</p>
        <p className="warn">Falta configurar Supabase (ver README) antes de poder iniciar sesión.</p>
      </main>
    )
  }

  return (
    <AuthProvider>
      <Contenido />
    </AuthProvider>
  )
}

export default App
