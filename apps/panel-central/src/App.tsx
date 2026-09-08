import { isSupabaseConfigured } from '@cdc/shared'
import { AuthProvider, useAuth } from './auth/AuthProvider'
import { LoginPage } from './auth/LoginPage'
import { Clientes } from './central/Clientes'

const ROLES_PERMITIDOS = ['superadmin']
const ETIQUETA_APP = 'Panel Central (Súper-Admin)'

function Contenido() {
  const { loading, session, perfil, error, logout } = useAuth()

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

  if (!perfil) {
    return (
      <main className="app-shell">
        <p className="app-status">Cargando...</p>
      </main>
    )
  }

  return (
    <div className="panel-layout">
      <header className="panel-header">
        <div>
          <strong>{ETIQUETA_APP}</strong> · {perfil.nombre}
        </div>
        <button className="link-btn" onClick={logout}>
          Cerrar sesión
        </button>
      </header>
      <main className="panel-contenido">
        <Clientes />
      </main>
    </div>
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
