import { useState } from 'react'
import type { Producto } from '@cdc/shared'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

function chipsPara(producto: Producto): number[] {
  return producto.unidad_medida === 'kg' ? [0.25, 0.5, 1, 2] : [1, 2, 3, 6, 12]
}

export function TecladoCantidad({
  producto,
  cantidadInicial,
  onConfirmar,
  onCancelar
}: {
  producto: Producto
  cantidadInicial?: number
  onConfirmar: (cantidad: number) => void
  onCancelar: () => void
}) {
  const [valor, setValor] = useState(() => {
    if (cantidadInicial) return String(cantidadInicial)
    return producto.unidad_medida === 'unidad' || producto.unidad_medida === 'docena' ? '1' : ''
  })

  function tocarTecla(tecla: string) {
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

  const cantidad = Number(valor)
  const esValido = valor !== '' && cantidad > 0

  return (
    <div className="teclado-overlay" onClick={onCancelar}>
      <div className="teclado-card" onClick={(e) => e.stopPropagation()}>
        <p className="teclado-producto">{producto.nombre}</p>

        <div className="teclado-display">
          {valor === '' ? '0' : valor}
          <span className="teclado-unidad">{producto.unidad_medida}</span>
        </div>

        <div className="teclado-chips">
          {chipsPara(producto).map((c) => (
            <button key={c} type="button" onClick={() => setValor(String(c))}>
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
          <button
            type="button"
            className="teclado-confirmar"
            disabled={!esValido}
            onClick={() => onConfirmar(cantidad)}
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  )
}
