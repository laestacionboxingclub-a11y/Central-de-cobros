// Tipos que reflejan el modelo de datos de Supabase (ver supabase/migrations/0001_init.sql).
// Se actualizan a mano cada vez que cambia el esquema.

export type EstadoTenant = 'activo' | 'suspendido'

export interface Tenant {
  id: string
  nombre: string
  estado: EstadoTenant
  created_at: string
  updated_at: string
}

export type RolPerfil = 'superadmin' | 'dueno' | 'cajero' | 'vendedor'

export interface Perfil {
  id: string
  tenant_id: string | null
  rol: RolPerfil
  nombre: string
  created_at: string
}

export interface Caja {
  id: string
  tenant_id: string
  nombre: string
  activa: boolean
  created_at: string
}

export interface Producto {
  id: string
  tenant_id: string
  nombre: string
  unidad_medida: string
  foto_url: string | null
  precio: number
  stock_minimo: number | null
  activo: boolean
  created_at: string
  updated_at: string
  // Atajo de "bolsa"/"cajón" entero: null si este producto no lo tiene.
  // El stock sigue siendo siempre en unidad_medida (ej: kg).
  unidad_alternativa: string | null
  equivalencia_alternativa: number | null
  precio_alternativa: number | null
}

export type MetodoPago = 'efectivo' | 'posnet' | 'transferencia' | 'cuenta_corriente'
export type EstadoVenta = 'completada' | 'anulada'

export interface Venta {
  id: string
  tenant_id: string
  caja_id: string
  cajero_id: string
  numero_comprobante: string
  metodo_pago: MetodoPago
  total: number
  estado: EstadoVenta
  creada_en: string
  sincronizada_en: string
}

export interface VentaItem {
  id: string
  venta_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

export type TipoMovimientoStock = 'carga' | 'venta' | 'ajuste' | 'merma'

export interface MovimientoStock {
  id: string
  tenant_id: string
  producto_id: string
  cantidad: number
  tipo: TipoMovimientoStock
  venta_id: string | null
  caja_id: string | null
  creado_por: string | null
  creado_en: string
  sincronizado_en: string
}

export interface StockActual {
  tenant_id: string
  producto_id: string
  stock: number
}

export interface Gasto {
  id: string
  tenant_id: string
  fecha: string
  categoria: string
  descripcion: string | null
  monto: number
  creado_por: string | null
  creado_en: string
}

export interface Cliente {
  id: string
  tenant_id: string
  nombre: string
  telefono: string | null
  activo: boolean
  created_at: string
}

export type TipoMovimientoCuentaCorriente = 'cargo' | 'pago'

export interface MovimientoCuentaCorriente {
  id: string
  tenant_id: string
  cliente_id: string
  monto: number
  tipo: TipoMovimientoCuentaCorriente
  venta_id: string | null
  descripcion: string | null
  creado_por: string | null
  creado_en: string
}

export interface CuentaCorrienteSaldo {
  tenant_id: string
  cliente_id: string
  saldo: number
}

export interface CierreCaja {
  id: string
  tenant_id: string
  caja_id: string
  efectivo_esperado: number
  efectivo_contado: number
  diferencia: number
  cerrado_por: string | null
  creado_en: string
}

export type EstadoPedido = 'pendiente' | 'cobrado' | 'cancelado'

export interface Pedido {
  id: string
  tenant_id: string
  numero: number
  nombre_referencia: string | null
  estado: EstadoPedido
  total: number
  creado_por: string | null
  creado_en: string
  cobrado_en: string | null
  cobrado_por: string | null
  venta_id: string | null
}

export interface PedidoItem {
  id: string
  pedido_id: string
  producto_id: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}
