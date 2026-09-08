import { useState, type FormEvent } from 'react'
import { useAuth } from './AuthProvider'

export function LoginPage({ etiqueta }: { etiqueta: string }) {
  const { signIn, error, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    signIn(email, password)
  }

  return (
    <main className="app-shell">
      <h1>Central de Cobros</h1>
      <p className="app-label">{etiqueta}</p>
      <form onSubmit={handleSubmit} className="login-form">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Ingresando...' : 'Ingresar'}
        </button>
        {error && <p className="warn">{error}</p>}
      </form>
    </main>
  )
}
