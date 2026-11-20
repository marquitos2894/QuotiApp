import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useLocation, useSearch } from "wouter"
import { Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { buscarCotizaciones } from "@/lib/cotizaciones"
import { colorEstado, estados, fechaVisible } from "@/lib/cotizacion-vista"
import { formatMoney } from "@/lib/money"
import type { CotizacionResumen, EstadoCotizacion } from "@/lib/types"

export default function Cotizaciones() {
  const search = useSearch()
  const [, navegar] = useLocation()
  const params = new URLSearchParams(search)
  const q = params.get("q") || ""
  const desde = params.get("desde") || ""
  const hasta = params.get("hasta") || ""
  const estado: EstadoCotizacion | "" =
    estados.find((e) => e === params.get("estado")) || ""
  const pagina = Math.max(
    1,
    Number.parseInt(params.get("pagina") || "1", 10) || 1
  )
  const [borrador, setBorrador] = useState({ q, texto: q })
  if (borrador.q !== q) setBorrador({ q, texto: q })
  const { texto } = borrador
  const [intento, setIntento] = useState(0)
  const consulta = useMemo(
    () => ({
      intento,
      filtros: { q, desde, hasta, estado, limit: 20, offset: (pagina - 1) * 20 },
    }),
    [q, desde, hasta, estado, pagina, intento]
  )
  const [resultado, setResultado] = useState<{
    consulta: typeof consulta | null
    rows: CotizacionResumen[]
    total: number
    error: string
  }>({ consulta: null, rows: [], total: 0, error: "" })
  const { rows, total } = resultado
  const cargando = resultado.consulta !== consulta
  const error = cargando ? "" : resultado.error

  const actualizar = useCallback(
    (cambios: Record<string, string>, replace = false) => {
      const p = new URLSearchParams(search)
      Object.entries(cambios).forEach(([k, v]) =>
        v ? p.set(k, v) : p.delete(k)
      )
      const query = p.toString()
      navegar(query ? `/?${query}` : "/", { replace })
    },
    [search, navegar]
  )
  useEffect(() => {
    if (texto === q) return
    const timer = setTimeout(
      () => actualizar({ q: texto, pagina: "" }, true),
      300
    )
    return () => clearTimeout(timer)
  }, [texto, q, actualizar])
  useEffect(() => {
    let activo = true
    buscarCotizaciones(consulta.filtros)
      .then((r) => {
        if (activo) setResultado({ ...r, consulta, error: "" })
      })
      .catch((e) => {
        if (activo) {
          const mensaje =
            e instanceof Error
              ? e.message
              : "No se pudieron cargar las cotizaciones."
          setResultado((anterior) => ({ ...anterior, consulta, error: mensaje }))
          toast.error(mensaje)
        }
      })
    return () => {
      activo = false
    }
  }, [consulta])
  const paginas = Math.max(1, Math.ceil(total / 20))
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[.18em] text-muted-foreground uppercase">
            Gestión comercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Cotizaciones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta y da seguimiento a tus propuestas.
          </p>
        </div>
      </div>
      <section
        aria-label="Filtros"
        className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr]"
      >
        <label className="space-y-1.5 text-xs font-medium">
          <span>Buscar</span>
          <div className="relative">
            <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              value={texto}
              onChange={(e) => setBorrador({ q, texto: e.target.value })}
              placeholder="Buscar por N°, cliente, RUC/DNI o descripción"
            />
          </div>
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>Desde</span>
          <Input
            className="h-10"
            type="date"
            value={desde}
            onChange={(e) => actualizar({ desde: e.target.value, pagina: "" })}
          />
        </label>
        <label className="space-y-1.5 text-xs font-medium">
          <span>Hasta</span>
          <Input
            className="h-10"
            type="date"
            value={hasta}
            onChange={(e) => actualizar({ hasta: e.target.value, pagina: "" })}
          />
        </label>
        <div className="space-y-1.5 text-xs font-medium">
          <label htmlFor="filtro-estado">Estado</label>
          <Select
            value={estado || "todos"}
            onValueChange={(v) =>
              actualizar({ estado: v === "todos" ? "" : v, pagina: "" })
            }
          >
            <SelectTrigger id="filtro-estado" className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {estados.map((e) => (
                <SelectItem key={e} value={e}>
                  <span className="capitalize">{e}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
      <section
        className="overflow-hidden rounded-xl border bg-card shadow-sm"
        aria-label="Resultados"
      >
        <div className="border-b px-4 py-3 text-sm text-muted-foreground">
          {cargando
            ? "Buscando…"
            : `${total} ${total === 1 ? "cotización" : "cotizaciones"}`}
        </div>
        {error ? (
          <div className="p-8 text-center">
            <p>{error}</p>
            <Button
              className="mt-4"
              variant="outline"
              onClick={() => setIntento((n) => n + 1)}
            >
              Reintentar
            </Button>
          </div>
        ) : cargando ? (
          <p role="status" className="p-8 text-center text-muted-foreground">
            Cargando cotizaciones…
          </p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            No se encontraron cotizaciones.
          </p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    {["Número", "Fecha", "Cliente", "Total", "Estado"].map(
                      (t) => (
                        <th key={t} className="px-4 py-3 font-medium">
                          {t}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => navegar(`/cotizaciones/${r.id}`)}
                      className="cursor-pointer hover:bg-muted/40"
                    >
                      <td className="px-4 py-4 font-semibold">
                        <Link
                          className="hover:underline"
                          href={`/cotizaciones/${r.id}`}
                        >
                          {r.numero}
                        </Link>
                      </td>
                      <td className="px-4 py-4">{fechaVisible(r.fecha)}</td>
                      <td className="px-4 py-4">
                        <Link href={`/cotizaciones/${r.id}`} className="block">
                          <span className="font-medium">
                            {r.cliente_razon_social}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {r.cliente_num_doc}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-4 font-medium tabular-nums">
                        {formatMoney(r.total, r.moneda)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          className={`capitalize ${colorEstado[r.estado]}`}
                        >
                          {r.estado}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y md:hidden">
              {rows.map((r) => (
                <Link
                  key={r.id}
                  href={`/cotizaciones/${r.id}`}
                  className="block space-y-3 p-4 hover:bg-muted/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.numero}</span>
                    <Badge className={`capitalize ${colorEstado[r.estado]}`}>
                      {r.estado}
                    </Badge>
                  </div>
                  <div>
                    <p className="font-medium">{r.cliente_razon_social}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.cliente_num_doc} · {fechaVisible(r.fecha)}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(r.total, r.moneda)}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
        <div className="flex items-center justify-between gap-3 border-t px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Página {pagina} de {paginas} · {total} en total
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagina <= 1 || cargando}
              onClick={() => actualizar({ pagina: String(pagina - 1) })}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagina >= paginas || cargando}
              onClick={() => actualizar({ pagina: String(pagina + 1) })}
            >
              Siguiente
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}
