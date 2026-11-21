import type { GuardarCotizacionPayload } from "@/lib/types"

type ItemParaGuardar = GuardarCotizacionPayload["items"][number]
type CampoDecimal = "cantidad" | "precio_unitario" | "descuento_pct"

export type ItemBorrador = Omit<ItemParaGuardar, CampoDecimal> &
  Record<CampoDecimal, string> & { idLocal: number }

let ultimoIdLocal = 0

export function crearItem(
  orden: number,
  item?: ItemParaGuardar | ItemBorrador
): ItemBorrador {
  return {
    idLocal: ++ultimoIdLocal,
    orden,
    descripcion: item?.descripcion ?? "",
    unidad: item?.unidad === "bienes" ? "unidad" : (item?.unidad ?? "servicio"),
    cantidad: String(item?.cantidad ?? 1),
    precio_unitario: String(item?.precio_unitario ?? 0),
    descuento_pct: String(item?.descuento_pct ?? 0),
  }
}

export function leerDecimal(texto: string): number {
  const valor = texto.trim()
  if (!valor) return 0
  return /^-?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(valor)
    ? Number(valor.replace(",", "."))
    : NaN
}

export function convertirItem(item: ItemBorrador): ItemParaGuardar {
  return {
    orden: item.orden,
    descripcion: item.descripcion,
    unidad: item.unidad.trim() || "servicio",
    cantidad: leerDecimal(item.cantidad),
    precio_unitario: leerDecimal(item.precio_unitario),
    descuento_pct: leerDecimal(item.descuento_pct),
  }
}
