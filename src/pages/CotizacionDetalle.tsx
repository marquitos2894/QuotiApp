import { useEffect, useState } from "react"
import { Link, useLocation } from "wouter"
import {
  ArrowLeft,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Share2,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  cambiarEstado,
  eliminarCotizacion,
  getCotizacion,
} from "@/lib/cotizaciones"
import { getEmpresa, getLogoDataUrl } from "@/lib/empresa"
import { calcularTotales, formatMoney } from "@/lib/money"
import {
  colorEstado,
  estados,
  fechaVisible,
  fechaVencimiento,
} from "@/lib/cotizacion-vista"
import { generarPdf, nombrePdf } from "@/lib/pdf"
import {
  compartirPdf,
  descargarBlob,
  mailtoUrl,
  whatsappUrl,
} from "@/lib/share"
import type {
  CotizacionConDetalle,
  Empresa,
  EstadoCotizacion,
} from "@/lib/types"

export default function CotizacionDetalle({ id }: { id: string }) {
  const [, navegar] = useLocation()
  const [cot, setCot] = useState<CotizacionConDetalle | null>(null)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [logo, setLogo] = useState("")
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(true)
  const [pdf, setPdf] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [alternativas, setAlternativas] = useState(false)
  const [confirmar, setConfirmar] = useState(false)
  useEffect(() => {
    let activo = true
    Promise.all([getCotizacion(id), getEmpresa()])
      .then(([c, e]) => {
        if (activo) {
          setCot(c)
          setEmpresa(e)
          if (e.logo_path)
            getLogoDataUrl(e.logo_path)
              .then((url) => {
                if (activo) setLogo(url)
              })
              .catch(() => {
                if (activo)
                  toast.error("No se pudo cargar el logo de la empresa.")
              })
        }
      })
      .catch((e) => {
        if (activo) {
          const mensaje =
            e instanceof Error ? e.message : "No se pudo cargar la cotización."
          setError(mensaje)
          toast.error(mensaje)
        }
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [id])
  if (cargando)
    return (
      <p role="status" className="py-10 text-center text-muted-foreground">
        Cargando cotización…
      </p>
    )
  if (error || !cot || !empresa)
    return (
      <div className="space-y-4">
        <p>{error || "No se encontró la cotización."}</p>
        <Button asChild variant="outline">
          <Link href="/">Volver a cotizaciones</Link>
        </Button>
      </div>
    )
  const c = cot
  const emp = empresa
  const cliente = c.cliente
  const money = (n: number) => formatMoney(Number(n), c.moneda)
  const totales = calcularTotales(c.items, c)
  const mensaje = `Le envío la cotización N° ${c.numero} por ${money(c.total)}.`
  const cuentas = [...(emp.cuentas_bancarias || [])].sort(
    (a, b) => Number(b.moneda === c.moneda) - Number(a.moneda === c.moneda)
  )
  const descuento = c.items.some((i) => Number(i.descuento_pct) > 0)
  async function crearPdf(compartir: boolean) {
    setPdf(true)
    try {
      const blob = await generarPdf(c, emp)
      const nombre = nombrePdf(c)
      if (compartir) {
        if (!(await compartirPdf(blob, nombre, mensaje))) {
          descargarBlob(blob, nombre)
          setAlternativas(true)
        }
      } else descargarBlob(blob, nombre)
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        toast.error(
          e instanceof Error ? e.message : "No se pudo generar el PDF."
        )
    } finally {
      setPdf(false)
    }
  }
  async function estadoNuevo(estado: EstadoCotizacion) {
    setOcupado(true)
    try {
      await cambiarEstado(c.id, estado)
      setCot({ ...c, estado })
      toast.success("Estado actualizado.")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo cambiar el estado."
      )
    } finally {
      setOcupado(false)
    }
  }
  async function eliminar() {
    setOcupado(true)
    try {
      await eliminarCotizacion(c.id)
      toast.success("Cotización eliminada.")
      navegar("/")
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo eliminar la cotización."
      )
      setOcupado(false)
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Cotizaciones
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              {c.numero}
            </h1>
            <Badge className={`capitalize ${colorEstado[c.estado]}`}>
              {c.estado}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href={`/cotizaciones/${id}/editar`}>
                <Pencil /> Editar
              </Link>
            </Button>
            <Button disabled={pdf} onClick={() => void crearPdf(false)}>
              <Download /> {pdf ? "Generando…" : "Descargar PDF"}
            </Button>
            <Button
              variant="outline"
              className="hidden sm:inline-flex"
              disabled={pdf}
              onClick={() => void crearPdf(true)}
            >
              <Share2 /> Compartir
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={ocupado}>
                  <MoreHorizontal /> Más
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="sm:hidden"
                  disabled={pdf}
                  onSelect={() => void crearPdf(true)}
                >
                  <Share2 /> Compartir
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/cotizaciones/nueva?desde=${id}`}>
                    <Copy /> Duplicar
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Cambiar estado</DropdownMenuLabel>
                {estados.map((e) => (
                  <DropdownMenuItem
                    key={e}
                    disabled={e === c.estado}
                    onSelect={() => void estadoNuevo(e)}
                    className="capitalize"
                  >
                    {e}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmar(true)}
                >
                  <Trash2 /> Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      <article className="mx-auto max-w-4xl overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="h-1.5 bg-sky-800" />
        <div className="space-y-8 p-5 sm:p-10">
          <header className="flex flex-col justify-between gap-6 sm:flex-row">
            <div className="min-w-0 space-y-1 text-sm text-muted-foreground">
              {logo && (
                <img
                  src={logo}
                  alt={`Logo de ${emp.razon_social}`}
                  className="mb-4 max-h-20 max-w-40 object-contain"
                />
              )}
              <p className="text-lg font-semibold text-foreground">
                {emp.razon_social}
              </p>
              <p>RUC {emp.ruc}</p>
              {emp.direccion && (
                <p className="whitespace-pre-line">{emp.direccion}</p>
              )}
              {[emp.telefono, emp.email, emp.web].filter(Boolean).map((x) => (
                <p className="break-words" key={x}>
                  {x}
                </p>
              ))}
            </div>
            <div className="min-w-52 rounded-lg bg-muted p-4 sm:text-right">
              <p className="text-xs font-semibold tracking-[.16em] text-sky-800 dark:text-sky-300">
                COTIZACIÓN
              </p>
              <p className="mt-1 text-xl font-semibold">{c.numero}</p>
              <p className="mt-3 text-sm text-muted-foreground">
                Fecha: {fechaVisible(c.fecha)}
              </p>
              <p className="text-sm text-muted-foreground">
                Válida hasta {fechaVencimiento(c.fecha, c.validez_dias)}
              </p>
            </div>
          </header>
          <section className="border-t pt-6">
            <h2 className="mb-3 text-xs font-semibold tracking-[.15em] text-sky-800 uppercase dark:text-sky-300">
              Datos del cliente
            </h2>
            <div className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[110px_1fr]">
              <span className="text-muted-foreground">Señor(es)</span>
              <strong className="break-words">{cliente.razon_social}</strong>
              <span className="text-muted-foreground">{cliente.tipo_doc}</span>
              <span>{cliente.num_doc}</span>
              {(
                [
                  ["Dirección", cliente.direccion],
                  ["Contacto", cliente.contacto],
                  ["Correo", cliente.email],
                  ["Teléfono", cliente.telefono],
                ] as const
              ).map(
                ([label, value]) =>
                  value && (
                    <div key={label} className="contents">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="break-words whitespace-pre-line">
                        {value}
                      </span>
                    </div>
                  )
              )}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-xs font-semibold tracking-[.15em] text-sky-800 uppercase dark:text-sky-300">
              Detalle de la propuesta
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-sky-900 text-white">
                  <tr>
                    {[
                      "#",
                      "Descripción",
                      "Und.",
                      "Cant.",
                      "P. Unit.",
                      ...(descuento ? ["Desc.%"] : []),
                      "Total",
                    ].map((t) => (
                      <th className="p-3 font-medium" key={t}>
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {c.items.map((i, n) => (
                    <tr key={i.id || n} className="even:bg-muted/40">
                      <td className="p-3 align-top">{n + 1}</td>
                      <td className="min-w-52 p-3 align-top break-words whitespace-pre-wrap">
                        {i.descripcion}
                      </td>
                      <td className="p-3 align-top">{i.unidad}</td>
                      <td className="p-3 align-top tabular-nums">
                        {i.cantidad}
                      </td>
                      <td className="p-3 align-top whitespace-nowrap tabular-nums">
                        {money(i.precio_unitario)}
                      </td>
                      {descuento && (
                        <td className="p-3 align-top">{i.descuento_pct}%</td>
                      )}
                      <td className="p-3 align-top font-medium whitespace-nowrap tabular-nums">
                        {money(i.total_linea)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <div className="ml-auto w-full max-w-xs space-y-2 text-sm tabular-nums">
            {[
              ["Suma de ítems", money(totales.suma_items)],
              ...(Number(c.descuento_global) > 0
                ? [["Descuento global", `− ${money(c.descuento_global)}`]]
                : []),
              [
                c.aplica_igv ? "Op. gravada / Subtotal" : "Subtotal",
                money(c.subtotal),
              ],
              ...(c.aplica_igv ? [[`IGV ${c.igv_pct}%`, money(c.igv)]] : []),
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <span className="text-muted-foreground">{label}</span>
                <span>{value}</span>
              </div>
            ))}
            <div className="flex justify-between gap-4 rounded-lg bg-muted p-3 text-base font-semibold">
              <span>TOTAL</span>
              <span>{money(c.total)}</span>
            </div>
            {c.aplica_igv && (
              <p className="text-right text-xs text-muted-foreground">
                Precios {c.precios_incluyen_igv ? "incluyen" : "no incluyen"}{" "}
                IGV
              </p>
            )}
          </div>
          {(c.forma_pago || c.plazo_entrega || c.notas) && (
            <section className="border-t pt-6">
              <h2 className="mb-3 text-xs font-semibold tracking-[.15em] text-sky-800 uppercase dark:text-sky-300">
                Condiciones
              </h2>
              <div className="space-y-3 text-sm">
                {(
                  [
                    ["Forma de pago", c.forma_pago],
                    ["Plazo de entrega", c.plazo_entrega],
                    ["Notas / condiciones", c.notas],
                  ] as const
                ).map(
                  ([label, value]) =>
                    value && (
                      <div key={label}>
                        <p className="font-medium">{label}</p>
                        <p className="mt-1 break-words whitespace-pre-wrap text-muted-foreground">
                          {value}
                        </p>
                      </div>
                    )
                )}
              </div>
            </section>
          )}
          {cuentas.length > 0 && (
            <section className="border-t pt-6">
              <h2 className="mb-3 text-xs font-semibold tracking-[.15em] text-sky-800 uppercase dark:text-sky-300">
                Cuentas bancarias
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      {["Banco", "Moneda", "Número", "CCI"].map((x) => (
                        <th key={x} className="pr-4 pb-2 font-medium">
                          {x}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cuentas.map((cuenta, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-4">{cuenta.banco}</td>
                        <td className="py-2 pr-4">{cuenta.moneda}</td>
                        <td className="py-2 pr-4">{cuenta.numero}</td>
                        <td className="py-2">{cuenta.cci}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      </article>
      <Dialog open={alternativas} onOpenChange={setAlternativas}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir cotización</DialogTitle>
            <DialogDescription>
              El PDF se descargó. Adjunta el archivo al mensaje que elijas.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a
                href={whatsappUrl(mensaje, cliente.telefono)}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href={mailtoUrl(
                  cliente.email,
                  `Cotización ${c.numero}`,
                  mensaje
                )}
              >
                Correo
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmar} onOpenChange={setConfirmar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta cotización?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará {c.numero} junto con sus ítems. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void eliminar()}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
