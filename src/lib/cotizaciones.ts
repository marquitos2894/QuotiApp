import { supabase } from "@/lib/supabase"
import type {
  CotizacionConDetalle,
  CotizacionResumen,
  EstadoCotizacion,
  GuardarCotizacionPayload,
} from "@/lib/types"

interface FiltrosCotizaciones {
  q?: string | null
  desde?: string | null
  hasta?: string | null
  estado?: EstadoCotizacion | "" | null
  limit?: number
  offset?: number
}

const noEncontrada = "No se encontró la cotización."

function errorCotizacion(mensaje: string, error: { message: string }) {
  return new Error(`${mensaje} ${error.message}`)
}

export async function getCotizacion(id: string): Promise<CotizacionConDetalle> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*, cliente:clientes(*), items:cotizacion_items(*)")
    .eq("id", id)
    .order("orden", { referencedTable: "items" })
    .maybeSingle()

  if (error?.code === "22P02") throw new Error(noEncontrada)
  if (error) throw errorCotizacion("No se pudo cargar la cotización.", error)
  if (!data) throw new Error(noEncontrada)
  return data as CotizacionConDetalle
}

export async function getNumeroCotizacion(id: string): Promise<string> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("numero")
    .eq("id", id)
    .maybeSingle()

  if (error)
    throw errorCotizacion(
      "No se pudo consultar el número de cotización.",
      error
    )
  if (!data) throw new Error(noEncontrada)
  return data.numero
}

export async function guardarCotizacion(
  payload: GuardarCotizacionPayload
): Promise<string> {
  const { data, error } = await supabase.rpc("guardar_cotizacion", {
    p: payload,
  })
  if (error) throw errorCotizacion("No se pudo guardar la cotización.", error)
  return data
}

export async function buscarCotizaciones({
  q,
  desde,
  hasta,
  estado,
  limit = 20,
  offset = 0,
}: FiltrosCotizaciones = {}): Promise<{
  rows: CotizacionResumen[]
  total: number
}> {
  const filtros = {
    q: q?.trim() || null,
    desde: desde?.trim() || null,
    hasta: hasta?.trim() || null,
    p_estado: estado || null,
  }
  const { data, error } = await supabase.rpc("buscar_cotizaciones", {
    ...filtros,
    lim: limit,
    off: offset,
  })
  if (error)
    throw errorCotizacion("No se pudieron buscar las cotizaciones.", error)

  const rows: CotizacionResumen[] = data ?? []
  if (rows.length === 0 && (offset > 0 || limit <= 0)) {
    // El conteo de la RPC viaja en cada fila; una página vacía no lo incluye.
    const { total } = await buscarCotizaciones({
      q,
      desde,
      hasta,
      estado,
      limit: 1,
    })
    return { rows, total }
  }
  return { rows, total: Number(rows[0]?.total_count ?? 0) }
}

export async function cambiarEstado(
  id: string,
  estado: EstadoCotizacion
): Promise<void> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .update({ estado })
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error)
    throw errorCotizacion(
      "No se pudo cambiar el estado de la cotización.",
      error
    )
  if (!data) throw new Error(noEncontrada)
}

export async function eliminarCotizacion(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle()

  if (error) throw errorCotizacion("No se pudo eliminar la cotización.", error)
  if (!data) throw new Error(noEncontrada)
}
