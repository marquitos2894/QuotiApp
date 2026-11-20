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
