import { useEffect, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { useLocation, useSearchParams } from "wouter"
import { ClienteSelector } from "@/components/ClienteSelector"
import { ItemsEditor } from "@/components/ItemsEditor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  convertirItem,
  crearItem,
  leerDecimal,
  type ItemBorrador,
} from "@/lib/cotizacion-borrador"
import {
  getCotizacion,
  getNumeroCotizacion,
  guardarCotizacion,
} from "@/lib/cotizaciones"
import { getEmpresa } from "@/lib/empresa"
import { calcularTotales, formatMoney } from "@/lib/money"
import type {
  Cliente,
  EstadoCotizacion,
  GuardarCotizacionPayload,
  Moneda,
} from "@/lib/types"

type Borrador = Omit<
  GuardarCotizacionPayload,
  "id" | "cliente_id" | "items" | "validez_dias" | "descuento_global"
> & {
  cliente: Cliente | null
  items: ItemBorrador[]
  validez_dias: string
  descuento_global: string
}

type DatosIniciales = { borrador: Borrador; numero?: string }

const estados: Record<EstadoCotizacion, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
}

const fechaLima = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

async function cargarDatos(
  id?: string,
  desde?: string
): Promise<DatosIniciales> {
  const hoy = fechaLima.format(new Date())
  const origen = id ?? desde
  if (origen) {
    const cotizacion = await getCotizacion(origen)
    return {
      numero: id ? cotizacion.numero : undefined,
      borrador: {
        cliente: cotizacion.cliente,
        fecha: id ? cotizacion.fecha : hoy,
        validez_dias: String(cotizacion.validez_dias),
        moneda: cotizacion.moneda,
        estado: id ? cotizacion.estado : "borrador",
        aplica_igv: cotizacion.aplica_igv,
        precios_incluyen_igv: cotizacion.precios_incluyen_igv,
        igv_pct: cotizacion.igv_pct,
        descuento_global: String(cotizacion.descuento_global),
        forma_pago: cotizacion.forma_pago,
        plazo_entrega: cotizacion.plazo_entrega,
        notas: cotizacion.notas,
        items: cotizacion.items.map((item, indice) =>
          crearItem(indice + 1, item)
        ),
      },
    }
  }

  const empresa = await getEmpresa()
  return {
    borrador: {
      cliente: null,
      fecha: hoy,
      validez_dias: String(empresa.validez_dias_default),
      moneda: "PEN",
      estado: "borrador",
      aplica_igv: true,
      precios_incluyen_igv: false,
      igv_pct: empresa.igv_pct,
      descuento_global: "0",
      forma_pago: null,
      plazo_entrega: null,
      notas: empresa.condiciones_default,
      items: [crearItem(1)],
    },
  }
}

function validarItems(
  items: GuardarCotizacionPayload["items"]
): string | undefined {
  if (!items.length) return "Agrega al menos un ítem con una descripción."

  for (const item of items) {
    const fila = `Ítem ${item.orden}`
    if (!item.descripcion.trim()) return `${fila}: escribe una descripción.`
    if (!Number.isFinite(item.cantidad) || item.cantidad < 0.00005) {
      return `${fila}: ingresa una cantidad mayor a cero con hasta cuatro decimales de precisión.`
    }
    if (!Number.isFinite(item.precio_unitario) || item.precio_unitario < 0) {
      return `${fila}: ingresa un precio mayor o igual a cero.`
    }
    if (
      !Number.isFinite(item.descuento_pct) ||
      item.descuento_pct < 0 ||
      item.descuento_pct > 100
    ) {
      return `${fila}: ingresa un descuento entre 0 y 100 %.`
    }
  }
}

function mensajeError(error: unknown, alternativa: string) {
  return error instanceof Error ? error.message : alternativa
}

function CamposCotizacion({
  id,
  inicial,
}: {
  id?: string
  inicial: DatosIniciales
}) {
  const [, navegar] = useLocation()
  const [datos, setDatos] = useState(inicial.borrador)
  const [validar, setValidar] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const guardado = useRef(false)
  const envioEnCurso = useRef(false)
  const vigente = useRef(true)
  const sucio = JSON.stringify(datos) !== JSON.stringify(inicial.borrador)
  const items = datos.items.map(convertirItem)
  const descuento = leerDecimal(datos.descuento_global)
  const dias = Number(datos.validez_dias)
  const totales = calcularTotales(items, {
    ...datos,
    descuento_global: descuento,
  })

  const errorCliente = datos.cliente ? undefined : "Selecciona un cliente."
  const errorDatos = !datos.fecha
    ? "Ingresa una fecha válida."
    : !datos.validez_dias.trim() ||
        !Number.isInteger(dias) ||
        dias < 0 ||
        dias > 2_147_483_647
      ? "Ingresa un número entero de días de validez mayor o igual a cero."
      : undefined
  const errorItems = validarItems(items)
  const errorDescuento =
    !Number.isFinite(descuento) || descuento < 0
      ? "Ingresa un descuento global mayor o igual a cero."
      : descuento > totales.suma_items
        ? "El descuento global no puede superar la suma de los ítems."
        : undefined

  useEffect(() => {
    vigente.current = true
    return () => {
      vigente.current = false
    }
  }, [])

  useEffect(() => {
    if (!sucio) return
    function advertir(event: BeforeUnloadEvent) {
      if (guardado.current) return
      event.preventDefault()
      event.returnValue = true
    }
    window.addEventListener("beforeunload", advertir)
    return () => window.removeEventListener("beforeunload", advertir)
  }, [sucio])

  function actualizar<K extends keyof Borrador>(campo: K, valor: Borrador[K]) {
    setDatos((actual) => ({ ...actual, [campo]: valor }))
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (envioEnCurso.current) return
    const error = errorCliente ?? errorDatos ?? errorItems ?? errorDescuento
    if (error || !datos.cliente) {
      setValidar(true)
      toast.error(error ?? "Selecciona un cliente.")
      return
    }

    const { cliente, ...campos } = datos
    envioEnCurso.current = true
    setGuardando(true)
    try {
      const idGuardado = await guardarCotizacion({
        ...campos,
        id,
        cliente_id: cliente.id,
        validez_dias: dias,
        descuento_global: descuento,
        items,
        forma_pago: datos.forma_pago?.trim() ? datos.forma_pago : null,
        plazo_entrega: datos.plazo_entrega?.trim() ? datos.plazo_entrega : null,
        notas: datos.notas?.trim() ? datos.notas : null,
      })
      guardado.current = true
      if (!vigente.current) return
      const numero =
        inicial.numero ??
        (await getNumeroCotizacion(idGuardado).catch(() => null))
      if (!vigente.current) return
      toast.success(
        numero ? `Cotización ${numero} guardada` : "Cotización guardada"
      )
      navegar(`/cotizaciones/${idGuardado}`, { replace: true })
    } catch (error) {
      if (vigente.current)
        toast.error(mensajeError(error, "No se pudo guardar la cotización."))
    } finally {
      envioEnCurso.current = false
      if (vigente.current) setGuardando(false)
    }
  }

  const monto = (valor: number) => formatMoney(valor, datos.moneda)

  return (
    <form
      noValidate
      aria-busy={guardando}
      className="pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0"
      onSubmit={guardar}
    >
      <fieldset
        disabled={guardando}
        className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]"
      >
        <div className="grid min-w-0 gap-5">
          <Card className="overflow-visible">
            <CardContent>
              <ClienteSelector
                value={datos.cliente}
                onChange={(cliente) => actualizar("cliente", cliente)}
              />
              {validar && errorCliente && (
                <p className="mt-2 text-destructive">{errorCliente}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Datos</CardTitle>
            </CardHeader>
            <CardContent className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="cot-fecha">Fecha</Label>
                <Input
                  id="cot-fecha"
                  className="h-11 lg:h-9"
                  type="date"
                  value={datos.fecha}
                  onChange={(event) => actualizar("fecha", event.target.value)}
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="cot-validez">Validez (días)</Label>
                <Input
                  id="cot-validez"
                  className="h-11 lg:h-9"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={datos.validez_dias}
                  onChange={(event) =>
                    actualizar("validez_dias", event.target.value)
                  }
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="cot-moneda">Moneda</Label>
                <Select
                  value={datos.moneda}
                  onValueChange={(valor: Moneda) => actualizar("moneda", valor)}
                >
                  <SelectTrigger
                    id="cot-moneda"
                    className="w-full data-[size=default]:h-11 lg:data-[size=default]:h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PEN">PEN (S/)</SelectItem>
                    <SelectItem value="USD">USD (US$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="cot-estado">Estado</Label>
                <Select
                  value={datos.estado}
                  onValueChange={(valor: EstadoCotizacion) =>
                    actualizar("estado", valor)
                  }
                >
                  <SelectTrigger
                    id="cot-estado"
                    className="w-full data-[size=default]:h-11 lg:data-[size=default]:h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(estados).map(([valor, etiqueta]) => (
                      <SelectItem key={valor} value={valor}>
                        {etiqueta}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {validar && errorDatos && (
                <p className="col-span-full text-destructive">{errorDatos}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ítems</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0">
              <ItemsEditor
                value={datos.items}
                onChange={(value) => actualizar("items", value)}
                moneda={datos.moneda}
              />
              {validar && errorItems && (
                <p className="mt-2 text-destructive">{errorItems}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Condiciones</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="cot-pago">Forma de pago</Label>
                <Input
                  id="cot-pago"
                  className="h-11 lg:h-9"
                  value={datos.forma_pago ?? ""}
                  onChange={(event) =>
                    actualizar("forma_pago", event.target.value || null)
                  }
                />
              </div>
              <div className="grid min-w-0 gap-2">
                <Label htmlFor="cot-entrega">Plazo de entrega</Label>
                <Input
                  id="cot-entrega"
                  className="h-11 lg:h-9"
                  value={datos.plazo_entrega ?? ""}
                  onChange={(event) =>
                    actualizar("plazo_entrega", event.target.value || null)
                  }
                />
              </div>
              <div className="col-span-full grid min-w-0 gap-2">
                <Label htmlFor="cot-notas">Notas y condiciones</Label>
                <Textarea
                  id="cot-notas"
                  value={datos.notas ?? ""}
                  onChange={(event) =>
                    actualizar("notas", event.target.value || null)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Totales</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <dl className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <dt>Suma de ítems</dt>
              <dd className="min-w-0 text-right wrap-anywhere tabular-nums">
                {monto(totales.suma_items)}
              </dd>
            </dl>
            <div className="grid gap-2">
              <Label htmlFor="cot-descuento">
                Descuento global ({datos.moneda})
              </Label>
              <Input
                id="cot-descuento"
                className="h-11 lg:h-9"
                inputMode="decimal"
                value={datos.descuento_global}
                aria-invalid={validar && Boolean(errorDescuento)}
                aria-describedby={
                  validar && errorDescuento ? "cot-descuento-error" : undefined
                }
                onChange={(event) =>
                  actualizar("descuento_global", event.target.value)
                }
              />
              {validar && errorDescuento && (
                <p id="cot-descuento-error" className="text-destructive">
                  {errorDescuento}
                </p>
              )}
            </div>
            <div className="grid">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 lg:min-h-8">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={datos.aplica_igv}
                  onChange={(event) => {
                    const aplica = event.target.checked
                    setDatos((actual) => ({
                      ...actual,
                      aplica_igv: aplica,
                      precios_incluyen_igv:
                        aplica && actual.precios_incluyen_igv,
                    }))
                  }}
                />
                Aplicar IGV
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-2 has-disabled:cursor-default has-disabled:text-muted-foreground lg:min-h-8">
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-primary"
                  checked={datos.precios_incluyen_igv}
                  disabled={!datos.aplica_igv}
                  onChange={(event) =>
                    actualizar("precios_incluyen_igv", event.target.checked)
                  }
                />
                Precios incluyen IGV
              </label>
            </div>
            <dl className="grid gap-2 border-t pt-3">
              <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                <dt>{datos.aplica_igv ? "Op. gravada" : "Subtotal"}</dt>
                <dd className="min-w-0 text-right wrap-anywhere tabular-nums">
                  {monto(totales.subtotal)}
                </dd>
              </div>
              <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                <dt>IGV ({datos.aplica_igv ? datos.igv_pct : 0} %)</dt>
                <dd className="min-w-0 text-right wrap-anywhere tabular-nums">
                  {monto(totales.igv)}
                </dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1 border-t pt-3 font-semibold">
                <dt>Total</dt>
                <dd className="min-w-0 text-right text-lg wrap-anywhere tabular-nums">
                  {monto(totales.total)}
                </dd>
              </div>
            </dl>
            <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-background px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] lg:static lg:block lg:border-0 lg:bg-transparent lg:p-0">
              <div className="min-w-0 lg:hidden">
                <span className="block text-xs text-muted-foreground">
                  Total
                </span>
                <span className="block font-semibold wrap-anywhere tabular-nums">
                  {monto(totales.total)}
                </span>
              </div>
              <Button
                type="submit"
                className="h-11 shrink-0 cursor-pointer lg:h-9 lg:w-full"
              >
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </fieldset>
    </form>
  )
}

function CargarFormulario({ id, desde }: { id?: string; desde?: string }) {
  const [, navegar] = useLocation()
  const [carga, setCarga] = useState<DatosIniciales | { error: string } | null>(
    null
  )

  useEffect(() => {
    let vigente = true
    cargarDatos(id, desde).then(
      (inicial) => {
        if (vigente) setCarga(inicial)
      },
      (error: unknown) => {
        if (!vigente) return
        const mensaje = mensajeError(error, "No se pudo cargar el formulario.")
        setCarga({ error: mensaje })
        toast.error(mensaje)
      }
    )
    return () => {
      vigente = false
    }
  }, [id, desde])

  function cancelar() {
    if (window.navigation?.canGoBack ?? window.history.length > 1) {
      window.history.back()
      return
    }
    navegar(id ? `/cotizaciones/${id}` : "/", { replace: true })
  }

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {id
            ? "Editar cotización"
            : desde
              ? "Duplicar cotización"
              : "Nueva cotización"}
        </h1>
        <Button
          type="button"
          variant="outline"
          className="h-11 cursor-pointer lg:h-9"
          onClick={cancelar}
        >
          Cancelar
        </Button>
      </div>
      {carga === null ? (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : "error" in carga ? (
        <p role="alert" className="text-sm text-destructive">
          {carga.error}
        </p>
      ) : (
        <CamposCotizacion id={id} inicial={carga} />
      )}
    </div>
  )
}

export default function CotizacionForm({ id }: { id?: string }) {
  const [consulta] = useSearchParams()
  const desde = id ? undefined : consulta.get("desde")?.trim() || undefined
  return (
    <CargarFormulario
      key={id ? `editar-${id}` : `nueva-${desde ?? ""}`}
      id={id}
      desde={desde}
    />
  )
}
