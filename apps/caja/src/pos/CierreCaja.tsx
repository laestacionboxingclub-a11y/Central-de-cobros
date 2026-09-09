import { useEffect, useState } from 'react'
import {
  calcularEfectivoEsperado,
  fetchUltimoCierre,
  registrarCierreCaja,
  type Perfil,
  type Tenant
} from '@cdc/shared'
import type { CajaSeleccionada } from './localCaja'

export function CierreCaja({
  tenant,
  caja,
  perfil,
  onCerrar,
  onVolver
}: {
  tenant: Tenant
  caja: CajaSeleccionada
  perfil: Perfil
  onCerrar: () => void
  onVolver: () => void
}) {
  const [esperado, setEsperado] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [contado, setContado] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [listo, setListo] = useState<{ esperado: number; contado: number; diferencia: number } | null>(null)

  useEffect(() => {
    fetchUltimoCierre(caja.id)
      .then((ultimo) => calcularEfectivoEsperado(tenant.id, caja.id, ultimo?.creado_en ?? null))
      .then(setEsperado)
      .catch(() => setError('No se pudo calcular el efectivo esperado. Necesitás conexión para cerrar la caja.'))
  }, [tenant.id, caja.id])

  async function confirmar() {
    if (esperado === null || !contado.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const contadoNum = Number(contado)
      await registrarCierreCaja({
        tenant_id: tenant.id,
        caja_id: caja.id,
        efectivo_esperado: Number(esperado.toFixed(2)),
        efectivo_contado: contadoNum,
        diferencia: Number((contadoNum - esperado).toFixed(2)),
        cerrado_por: perfil.id
      })
      setListo({ esperado, contado: contadoNum, diferencia: contadoNum - esperado })
    } catch {
      setError('No se pudo registrar el cierre. Probá de nuevo (necesita conexión).')
    } finally {
      setGuardando(false)
    }
  }

  if (listo) {
    return (
      <main className="app-shell">
        <h1>Caja cerrada</h1>
        <p className="app-status">Esperado: ${listo.esperado.toFixed(2)}</p>
        <p className="app-status">Contado: ${listo.contado.toFixed(2)}</p>
        <p className={listo.diferencia === 0 ? 'app-status' : 'warn'}>
          {listo.diferencia === 0
            ? 'Coincide exacto.'
            : listo.diferencia > 0
              ? `Sobran $${listo.diferencia.toFixed(2)}.`
              : `Faltan $${Math.abs(listo.diferencia).toFixed(2)}.`}
        </p>
        <button onClick={onCerrar}>Volver a vender</button>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <h1>Cerrar caja — {caja.nombre}</h1>
      {error && <p className="warn">{error}</p>}

      {esperado === null && !error && <p className="app-status">Calculando efectivo esperado...</p>}

      {esperado !== null && (
        <>
          <p className="app-status">Efectivo esperado: ${esperado.toFixed(2)}</p>
          <label className="cierre-caja-label">
            Contá el efectivo real y escribilo acá
            <input
              type="number"
              step="0.01"
              min="0"
              autoFocus
              value={contado}
              onChange={(e) => setContado(e.target.value)}
            />
          </label>
          {contado.trim() !== '' && !Number.isNaN(Number(contado)) && (
            <p className={Number(contado) === esperado ? 'app-status' : 'warn'}>
              {Number(contado) === esperado
                ? 'Coincide exacto.'
                : Number(contado) > esperado
                  ? `Van a sobrar $${(Number(contado) - esperado).toFixed(2)}.`
                  : `Van a faltar $${(esperado - Number(contado)).toFixed(2)}.`}
            </p>
          )}
          <div className="cierre-caja-acciones">
            <button className="cierre-caja-cancelar" onClick={onVolver}>
              Cancelar
            </button>
            <button disabled={guardando || !contado.trim()} onClick={confirmar}>
              {guardando ? 'Guardando...' : 'Confirmar cierre'}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
