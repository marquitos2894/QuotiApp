// Contrato compartido entre la BD (supabase/migrations) y el front.
// No cambiar nombres sin actualizar la migración y AGENTS.md.

export type Moneda = "PEN" | "USD"
export type TipoDoc = "RUC" | "DNI"
export type EstadoCotizacion = "borrador" | "enviada" | "aceptada" | "rechazada"

export interface CuentaBancaria {
  banco: string
  moneda: Moneda
  numero: string
  cci: string
}

export interface Empresa {
  id: 1
  razon_social: string
  ruc: string
  direccion: string | null
  telefono: string | null
  email: string | null
  web: string | null
  logo_path: string | null
  cuentas_bancarias: CuentaBancaria[]
  condiciones_default: string | null
  validez_dias_default: number
  igv_pct: number
  updated_at: string
}

export interface Cliente {
  id: string
  tipo_doc: TipoDoc
  num_doc: string
  razon_social: string
  direccion: string | null
  email: string | null
  telefono: string | null
  contacto: string | null
  created_at: string
  updated_at: string
}

export interface CotizacionItem {
  id?: string
  cotizacion_id?: string
  orden: number
  descripcion: string
  unidad: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  total_linea: number
}

export interface Cotizacion {
  id: string
  numero: string
  cliente_id: string
  fecha: string // YYYY-MM-DD
  validez_dias: number
  moneda: Moneda
  aplica_igv: boolean
  precios_incluyen_igv: boolean
  igv_pct: number
  descuento_global: number
  subtotal: number
  igv: number
  total: number
  estado: EstadoCotizacion
  forma_pago: string | null
  plazo_entrega: string | null
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CotizacionConDetalle extends Cotizacion {
  cliente: Cliente
  items: CotizacionItem[]
}

/** Payload de la RPC guardar_cotizacion(p jsonb). Sin id => crea. */
export interface GuardarCotizacionPayload {
  id?: string
  cliente_id: string
  fecha: string
  validez_dias: number
  moneda: Moneda
  aplica_igv: boolean
  precios_incluyen_igv: boolean
  igv_pct: number
  descuento_global: number
  estado: EstadoCotizacion
  forma_pago: string | null
  plazo_entrega: string | null
  notas: string | null
  items: Array<
    Pick<
      CotizacionItem,
      | "orden"
      | "descripcion"
      | "unidad"
      | "cantidad"
      | "precio_unitario"
      | "descuento_pct"
    >
  >
}

/** Fila devuelta por la RPC buscar_cotizaciones. */
export interface CotizacionResumen {
  id: string
  numero: string
  fecha: string
  moneda: Moneda
  total: number
  estado: EstadoCotizacion
  cliente_id: string
  cliente_razon_social: string
  cliente_num_doc: string
  total_count: number
}

/** Respuesta normalizada de la Edge Function decolecta. */
export interface ConsultaDocumento {
  tipo_doc: TipoDoc
  num_doc: string
  razon_social: string
  direccion: string | null
}

export interface Totales {
  suma_items: number
  descuento_global: number
  subtotal: number
  igv: number
  total: number
}
