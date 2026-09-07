import { isSupabaseConfigured } from '@cdc/shared'

function App() {
  return (
    <main className="app-shell">
      <h1>Central de Cobros</h1>
      <p className="app-label">Panel del Dueño</p>
      <p className="app-status">
        Base técnica lista (Paso 1). Todavía sin stock, precios ni reportes.
      </p>
      <p className={isSupabaseConfigured ? 'ok' : 'warn'}>
        Supabase: {isSupabaseConfigured ? 'conectado' : 'sin configurar (completá .env)'}
      </p>
    </main>
  )
}

export default App
