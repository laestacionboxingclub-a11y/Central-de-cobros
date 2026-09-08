// Qué caja es esta tablet, guardado en el dispositivo (no en Supabase):
// cada tablet recuerda su propia caja para no tener que elegirla en cada login.

export interface CajaSeleccionada {
  id: string
  nombre: string
}

const CAJA_KEY = 'cdc_caja_seleccionada'

export function getCajaGuardada(): CajaSeleccionada | null {
  const raw = localStorage.getItem(CAJA_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as CajaSeleccionada
  } catch {
    return null
  }
}

export function guardarCaja(caja: CajaSeleccionada) {
  localStorage.setItem(CAJA_KEY, JSON.stringify(caja))
}

export function olvidarCaja() {
  localStorage.removeItem(CAJA_KEY)
}

// El número de comprobante se arma en la tablet (ej: "Caja 1 - 000123"), sin pedirle
// nada al servidor, para poder vender offline sin depender de una numeración central.
export function siguienteNumeroComprobante(cajaId: string, cajaNombre: string): string {
  const key = `cdc_contador_${cajaId}`
  const siguiente = Number(localStorage.getItem(key) ?? '0') + 1
  localStorage.setItem(key, String(siguiente))
  return `${cajaNombre} - ${String(siguiente).padStart(6, '0')}`
}
