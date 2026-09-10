import { useState } from 'react'
import type { Producto } from '@cdc/shared'

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']

function chipsPara(producto: Producto): number[] {
  return producto.unidad_medida === 'kg' ? [0.25, 0.5, 1, 2] : [1, 2, 3, 6, 12]
}

export function TecladoCantidad({
  producto,
  cantidadInicial,
  precioInicial,
  stockDisponible,
  precioEditable = false,
  onConfirmar,
  onCancelar
}: {
  producto: Producto
  cantidadInicial?: number
  precioInicial?: number
  // Cuánto queda de este producto según los movimientos de stock (Paso 2).
  // undefined = todavía no se cargó ningún movimiento de este producto (no
  // hay dato, no es lo mismo que "hay 0"): en ese caso no se limita nada.
  stockDisponible: number | undefined
  // Acá no hay precios fijos: el que vende negocia el precio con cada
  // cliente. Cuando está prendido, se puede tocar el precio y escribir
  // otro en vez del de catálogo.
  precioEditable?: boolean
  onConfirmar: (cantidad: number, precioUnitario: number) => void
  onCancelar: () => void
}) {
  const [campoActivo, setCampoActivo] = useState<'cantidad' | 'precio'>('cantidad')
  const [valorCantidad, setValorCantidad] = useState(() => {
    if (cantidadInicial) return String(cantidadInicial)
    return producto.unidad_medida === 'unidad' || producto.unidad_medida === 'docena' ? '1' : ''
  })
  const [valorPrecio, setValorPrecio] = useState(() => String(precioInicial ?? producto.precio))
  const [avisoStock, setAvisoStock] = useState(false)

  function tocarTecla(tecla: string) {
    setAvisoStock(false)
    const setValor = campoActivo === 'cantidad' ? setValorCantidad : setValorPrecio
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
    setCampoActivo('cantidad')
    setValorCantidad(String(c))
  }

  // Atajo de bolsa/cajón entero: carga los kg que corresponden y ajusta el
  // precio por kg para que el total dé el precio de la bolsa entera — el
  // stock sigue siendo siempre en la unidad de base (kg), no se toca nada
  // del resto del sistema.
  const tieneAtajoBolsa =
    producto.unidad_alternativa !== null &&
    producto.equivalencia_alternativa !== null &&
    producto.equivalencia_alternativa > 0 &&
    producto.precio_alternativa !== null

  function elegirBolsa() {
    if (!tieneAtajoBolsa || producto.equivalencia_alternativa === null || producto.precio_alternativa === null) return
    setAvisoStock(false)
    setCampoActivo('cantidad')
    setValorCantidad(String(producto.equivalencia_alternativa))
    setValorPrecio(String(Number((producto.precio_alternativa / producto.equivalencia_alternativa).toFixed(4))))
  }

  const cantidad = Number(valorCantidad)
  const precioUnitario = Number(valorPrecio)
  // Si todavía no hay ningún movimiento cargado para este producto no hay
  // dato de stock (no es que haya 0), así que no se limita nada.
  const hayControlDeStock = stockDisponible !== undefined
  const sinStock = hayControlDeStock && stockDisponible <= 0
  const esValido = valorCantidad !== '' && cantidad > 0 && valorPrecio !== '' && precioUnitario > 0 && !sinStock
  const subtotal = (Number.isFinite(cantidad) ? cantidad : 0) * (Number.isFinite(precioUnitario) ? precioUnitario : 0)

  function confirmar() {
    if (hayControlDeStock && cantidad > stockDisponible) {
      setValorCantidad(String(stockDisponible))
      setCampoActivo('cantidad')
      setAvisoStock(true)
      return
    }
    onConfirmar(cantidad, precioUnitario)
  }

  return (
    <div className="teclado-overlay" onClick={onCancelar}>
      <div className="teclado-card" onClick={(e) => e.stopPropagation()}>
        <p className="teclado-producto">{producto.nombre}</p>

        <button
          type="button"
          className={`teclado-campo ${campoActivo === 'cantidad' ? 'activo' : ''}`}
          onClick={() => setCampoActivo('cantidad')}
        >
          <span className="teclado-campo-etiqueta">Cantidad</span>
          <span className="teclado-display">
            {valorCantidad === '' ? '0' : valorCantidad}
            <span className="teclado-unidad">{producto.unidad_medida}</span>
          </span>
        </button>

        {precioEditable ? (
          <button
            type="button"
            className={`teclado-campo ${campoActivo === 'precio' ? 'activo' : ''}`}
            onClick={() => setCampoActivo('precio')}
          >
            <span className="teclado-campo-etiqueta">Precio (tocá para cambiarlo)</span>
            <span className="teclado-display teclado-display-chico">
              ${valorPrecio === '' ? '0' : valorPrecio}
            </span>
          </button>
        ) : (
          <p className="app-status teclado-precio-fijo">Precio: ${producto.precio.toFixed(2)}</p>
        )}

        <p className="teclado-subtotal">Subtotal: ${subtotal.toFixed(2)}</p>

        {hayControlDeStock && (
          <p className="app-status teclado-disponible">
            Disponible: {stockDisponible} {producto.unidad_medida}
          </p>
        )}

        {sinStock ? (
          <p className="warn teclado-aviso">No queda stock de este producto.</p>
        ) : (
          avisoStock && (
            <p className="warn teclado-aviso">
              No hay tanto — se ajustó al máximo disponible ({stockDisponible} {producto.unidad_medida}).
            </p>
          )
        )}

        {campoActivo === 'cantidad' && (
          <div className="teclado-chips">
            {chipsPara(producto).map((c) => (
              <button key={c} type="button" onClick={() => elegirChip(c)}>
                {c}
              </button>
            ))}
          </div>
        )}

        {campoActivo === 'cantidad' && tieneAtajoBolsa && (
          <button type="button" className="teclado-chip-bolsa" onClick={elegirBolsa}>
            1 {producto.unidad_alternativa} ({producto.equivalencia_alternativa} {producto.unidad_medida}) — $
            {producto.precio_alternativa?.toFixed(2)}
          </button>
        )}

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
