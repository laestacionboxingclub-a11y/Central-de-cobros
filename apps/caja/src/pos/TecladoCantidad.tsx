import { useState } from 'react'
import type { Producto } from '@cdc/shared'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

function chipsPara(producto: Producto): number[] {
  return producto.unidad_medida === 'kg' ? [0.25, 0.5, 1, 2] : [1, 2, 3, 6, 12]
}

export function TecladoCantidad({
  producto,
  cantidadInicial,
  stockDisponible,
  onConfirmar,
  onCancelar
}: {
  producto: Producto
  cantidadInicial?: number
  // Cuánto queda de este producto según los movimientos de stock (Paso 2).
  // No deja cargar más de esto en el carrito.
  stockDisponible: number
  onConfirmar: (cantidad: number) => void
  onCancelar: () => void
}) {
  const [valor, setValor] = useState(() => {
    if (cantidadInicial) return String(cantidadInicial)
    return producto.unidad_medida === 'unidad' || producto.unidad_medida === 'docena' ? '1' : ''
  })
  const [avisoStock, setAvisoStock] = useState(false)

  function tocarTecla(tecla: string) {
    setAvisoStock(false)
    if (tecla === '⌫') {
      setValor((v) => v.slice(0, -1))
      return
    }
    setValor((v) => {
      if (tecla === '.' && v.includes('.')) return v
      if (v === '0' && tecla !== '.') return tecla
      return v + tecla
    })
  }

  function elegirChip(c: number) {
    setAvisoStock(false)
    setValor(String(c))
  }

  const cantidad = Number(valor)
  const sinStock = stockDisponible <= 0
  const esValido = valor !== '' && cantidad > 0 && !sinStock

  function confirmar() {
    if (cantidad > stockDisponible) {
      setValor(String(stockDisponible))
      setAvisoStock(true)
      return
    }
    onConfirmar(cantidad)
  }

  return (
    <div className="teclado-overlay" onClick={onCancelar}>
      <div className="teclado-card" onClick={(e) => e.stopPropagation()}>
        <p className="teclado-producto">{producto.nombre}</p>

        <div className="teclado-display">
          {valor === '' ? '0' : valor}
          <span className="teclado-unidad">{producto.unidad_medida}</span>
        </div>

        <p className="app-status teclado-disponible">
          Disponible: {stockDisponible} {producto.unidad_medida}
        </p>

        {sinStock ? (
          <p className="warn teclado-aviso">No queda stock de este producto.</p>
        ) : (
          avisoStock && (
            <p className="warn teclado-aviso">
              No hay tanto — se ajustó al máximo disponible ({stockDisponible} {producto.unidad_medida}).
            </p>
          )
        )}

        <div className="teclado-chips">
          {chipsPara(producto).map((c) => (
            <button key={c} type="button" onClick={() => elegirChip(c)}>
              {c}
            </button>
          ))}
        </div>

        <div className="teclado-grid">
          {TECLAS.map((t) => (
            <button key={t} type="button" onClick={() => tocarTecla(t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="teclado-acciones">
          <button type="button" className="teclado-cancelar" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="button" className="teclado-confirmar" disabled={!esValido} onClick={confirmar}>
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
