import { useCallback, useEffect, useState } from 'react'
import { cantidadPendientes } from './almacenLocal'
import { sincronizarPendientes } from './sincronizar'

const INTERVALO_REINTENTO_MS = 30000

export function useSincronizacion() {
  const [enLinea, setEnLinea] = useState(navigator.onLine)
  const [pendientes, setPendientes] = useState(cantidadPendientes())
  const [sincronizando, setSincronizando] = useState(false)

  const actualizarPendientes = useCallback(() => {
    setPendientes(cantidadPendientes())
  }, [])

  const sincronizarAhora = useCallback(async () => {
    if (!navigator.onLine || cantidadPendientes() === 0) return
    setSincronizando(true)
    try {
      await sincronizarPendientes()
    } finally {
      setPendientes(cantidadPendientes())
      setSincronizando(false)
    }
  }, [])

  useEffect(() => {
    function alConectar() {
      setEnLinea(true)
      sincronizarAhora()
    }
    function alDesconectar() {
      setEnLinea(false)
    }

    window.addEventListener('online', alConectar)
    window.addEventListener('offline', alDesconectar)

    sincronizarAhora()
    const intervalo = setInterval(sincronizarAhora, INTERVALO_REINTENTO_MS)

    return () => {
      window.removeEventListener('online', alConectar)
      window.removeEventListener('offline', alDesconectar)
      clearInterval(intervalo)
    }
  }, [sincronizarAhora])

  return { enLinea, pendientes, sincronizando, sincronizarAhora, actualizarPendientes }
}
