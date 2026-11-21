import type { EstadoCotizacion } from "@/lib/types"

export const estados: EstadoCotizacion[] = [
  "borrador",
  "enviada",
  "aceptada",
  "rechazada",
]
export const fechaVisible = (fecha: string) => {
  const [a, m, d] = fecha.split("-")
  return `${d}/${m}/${a}`
}
// Servicio y Unidad van primero; el resto son unidades de medida.
export const tipos = [
  { valor: "servicio", etiqueta: "Servicio" },
  { valor: "unidad", etiqueta: "Unidad" },
  { valor: "kg", etiqueta: "Kg" },
  { valor: "caja", etiqueta: "Caja" },
  { valor: "paquete", etiqueta: "Paquete" },
  { valor: "gln", etiqueta: "Gln" },
  { valor: "litro", etiqueta: "Litro" },
  { valor: "metro", etiqueta: "Metro" },
  { valor: "m2", etiqueta: "M2" },
  { valor: "juego", etiqueta: "Juego" },
  { valor: "par", etiqueta: "Par" },
  { valor: "rollo", etiqueta: "Rollo" },
  { valor: "bolsa", etiqueta: "Bolsa" },
  { valor: "balde", etiqueta: "Balde" },
  { valor: "docena", etiqueta: "Docena" },
]
export const tipoVisible = (tipo: string) =>
  // "bienes" es el valor anterior de "unidad" en cotizaciones ya guardadas.
  tipos.find((t) => t.valor === (tipo === "bienes" ? "unidad" : tipo))
    ?.etiqueta ?? tipo.charAt(0).toUpperCase() + tipo.slice(1)
export function fechaVencimiento(fecha: string, dias: number) {
  const f = new Date(`${fecha}T00:00:00Z`)
  f.setUTCDate(f.getUTCDate() + dias)
  return fechaVisible(f.toISOString().slice(0, 10))
}
export const colorEstado: Record<EstadoCotizacion, string> = {
  borrador: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  enviada: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  aceptada:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  rechazada: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
}
