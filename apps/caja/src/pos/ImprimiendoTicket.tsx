import { useEffect } from 'react'

export function ImprimiendoTicket({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const t = setTimeout(onFinish, 1100)
    return () => clearTimeout(t)
  }, [onFinish])

  return (
    <div className="imprimiendo-overlay">
      <div className="impresora">
        <div className="ticket-saliendo" />
        <div className="impresora-ranura" />
      </div>
      <p className="app-status">Imprimiendo comprobante...</p>
    </div>
  )
}
