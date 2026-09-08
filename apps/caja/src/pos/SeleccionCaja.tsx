import { useEffect, useState, type FormEvent } from 'react'
import { crearCaja, fetchCajas } from '@cdc/shared'
import { guardarCaja, type CajaSeleccionada } from './localCaja'

export function SeleccionCaja({
  tenantId,
  onSeleccionada
}: {
  tenantId: string
  onSeleccionada: (caja: CajaSeleccionada) => void
}) {
  const [cajas, setCajas] = useState<CajaSeleccionada[] | null>(null)
  const [nombreNueva, setNombreNueva] = useState('')
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    fetchCajas(tenantId)
      .then((data) => {
        if (cancelado) return
        setCajas(data)
        if (data.length === 1) {
          seleccionar(data[0])
        }
      })
      .catch(() => {
        if (cancelado) return
        setError('No se pudieron cargar las cajas.')
        setCajas([])
      })
    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId])

  function seleccionar(caja: CajaSeleccionada) {
    guardarCaja(caja)
    onSeleccionada(caja)
  }

  async function handleCrear(e: FormEvent) {
    e.preventDefault()
    if (!nombreNueva.trim()) return
    setCreando(true)
    setError(null)
    try {
      const caja = await crearCaja(tenantId, nombreNueva.trim())
      seleccionar(caja)
    } catch {
      setError('No se pudo crear la caja.')
    } finally {
      setCreando(false)
    }
  }

  if (cajas === null) {
    return (
      <main className="app-shell">
        <p className="app-status">Cargando cajas...</p>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <h1>Central de Cobros</h1>
      <p className="app-label">¿Qué caja es esta tablet?</p>

      {cajas.length > 0 && (
        <div className="lista-cajas">
          {cajas.map((c) => (
            <button key={c.id} className="opcion-caja" onClick={() => seleccionar(c)}>
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleCrear} className="login-form">
        <input
          type="text"
          placeholder="Nombre de una caja nueva (ej: Caja 1)"
          value={nombreNueva}
          onChange={(e) => setNombreNueva(e.target.value)}
        />
        <button type="submit" disabled={creando}>
          {creando ? 'Creando...' : 'Crear caja'}
        </button>
      </form>

      {error && <p className="warn">{error}</p>}
    </main>
  )
}
