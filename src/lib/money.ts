import type { CotizacionItem, Moneda, Totales } from "./types"

type EntradaLinea = Pick<
  CotizacionItem,
  "cantidad" | "precio_unitario" | "descuento_pct"
>
type OpcionesTotales = {
  aplica_igv: boolean
  precios_incluyen_igv: boolean
  igv_pct: number
  descuento_global: number
}

const escalaPorcentaje = 10_000n
const escalaCantidad = 10_000n

function dividirRedondeando(numerador: bigint, denominador: bigint): bigint {
  const signo = numerador < 0n ? -1n : 1n
  return signo * ((signo * numerador * 2n + denominador) / (denominador * 2n))
}

// Usa la representación decimal que recibe Postgres en el JSON y admite notación científica.
function aEntero(valor: number, escala: number): bigint {
  // Entradas incompletas del formulario (NaN, vacío) cuentan como 0.
  if (typeof valor !== "number" || !Number.isFinite(valor)) return 0n
  const [mantisa, exponente = "0"] = valor.toString().split("e")
  const [entero, fraccion = ""] = mantisa.split(".")
  const digitos = BigInt(entero + fraccion)
  const posiciones = escala + Number(exponente) - fraccion.length

  return posiciones >= 0
    ? digitos * 10n ** BigInt(posiciones)
    : dividirRedondeando(digitos, 10n ** BigInt(-posiciones))
}

export function r2(n: number): number {
  return Number(aEntero(n, 2)) / 100
}

function lineaEnCentimos(item: EntradaLinea): bigint {
  const cantidad = aEntero(item.cantidad, 4)
  const precio = aEntero(item.precio_unitario, 2)
  const descuento = aEntero(item.descuento_pct, 2)

  return dividirRedondeando(
    cantidad * precio * (escalaPorcentaje - descuento),
    escalaCantidad * escalaPorcentaje
  )
}

export function calcularLinea(item: EntradaLinea): number {
  return Number(lineaEnCentimos(item)) / 100
}

export function calcularTotales(
  items: readonly EntradaLinea[],
  opciones: OpcionesTotales
): Totales {
  const suma = items.reduce(
    (acumulado, item) => acumulado + lineaEnCentimos(item),
    0n
  )
  const descuento = aEntero(opciones.descuento_global, 2)
  const base = suma - descuento
  let subtotal = base
  let igv = 0n

  if (opciones.aplica_igv) {
    const tasa = aEntero(opciones.igv_pct, 2)

    if (opciones.precios_incluyen_igv) {
      subtotal = dividirRedondeando(
        base * escalaPorcentaje,
        escalaPorcentaje + tasa
      )
      igv = base - subtotal
    } else {
      igv = dividirRedondeando(base * tasa, escalaPorcentaje)
    }
  }

  return {
    suma_items: Number(suma) / 100,
    descuento_global: Number(descuento) / 100,
    subtotal: Number(subtotal) / 100,
    igv: Number(igv) / 100,
    total: Number(subtotal + igv) / 100,
  }
}

const formatos = {
  PEN: new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }),
  USD: new Intl.NumberFormat("es-PE", { style: "currency", currency: "USD" }),
}

export function formatMoney(n: number, moneda: Moneda): string {
  const formato = formatos[moneda]
  if (moneda === "PEN") return formato.format(n)

  return formato
    .formatToParts(n)
    .map(({ type, value }) => (type === "currency" ? "US$" : value))
    .join("")
}
