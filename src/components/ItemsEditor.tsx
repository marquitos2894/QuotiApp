import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  convertirItem,
  crearItem,
  type ItemBorrador,
} from "@/lib/cotizacion-borrador"
import { calcularLinea, formatMoney } from "@/lib/money"
import type { Moneda } from "@/lib/types"

const campos = [
  { clave: "unidad", etiqueta: "Unidad" },
  { clave: "cantidad", etiqueta: "Cantidad" },
  { clave: "precio_unitario", etiqueta: "Precio unit." },
  { clave: "descuento_pct", etiqueta: "Desc. %" },
] as const

export function ItemsEditor({
  value,
  onChange,
  moneda,
}: {
  value: ItemBorrador[]
  onChange: (items: ItemBorrador[]) => void
  moneda: Moneda
}) {
  function reordenar(items: ItemBorrador[]) {
    onChange(items.map((item, indice) => ({ ...item, orden: indice + 1 })))
  }

  function actualizar(indice: number, cambios: Partial<ItemBorrador>) {
    onChange(
      value.map((item, posicion) =>
        posicion === indice ? { ...item, ...cambios } : item
      )
    )
  }

  function mover(indice: number, direccion: -1 | 1) {
    const items = [...value]
    const destino = indice + direccion
    const item = items[indice]
    items[indice] = items[destino]
    items[destino] = item
    reordenar(items)
  }

  function duplicar(indice: number) {
    const items = [...value]
    items.splice(indice + 1, 0, crearItem(indice + 2, items[indice]))
    reordenar(items)
  }

  return (
    <div className="grid gap-3">
      {value.map((item, indice) => {
        const baseId = `item-${item.idLocal}`
        const fila = `ítem ${indice + 1}`
        return (
          <div
            key={item.idLocal}
            role="group"
            aria-label={`Ítem ${indice + 1}`}
            className="grid min-w-0 grid-cols-2 items-start gap-3 rounded-lg border p-3 odd:bg-muted/20 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_auto] md:gap-2"
          >
            <div className="col-span-2 grid min-w-0 gap-2 md:col-span-6">
              <Label htmlFor={`${baseId}-descripcion`}>
                <span className="text-muted-foreground">#{indice + 1}</span>
                Descripción
              </Label>
              <Textarea
                id={`${baseId}-descripcion`}
                rows={2}
                className="min-h-16 min-w-0 resize-none"
                placeholder="Describe el servicio"
                value={item.descripcion}
                onChange={(event) =>
                  actualizar(indice, { descripcion: event.target.value })
                }
              />
            </div>
            {campos.map(({ clave, etiqueta }) => {
              const id = `${baseId}-${clave}`
              return (
                <div key={clave} className="grid min-w-0 gap-2">
                  <Label htmlFor={id} className="md:text-xs">
                    {etiqueta}
                  </Label>
                  <Input
                    id={id}
                    className="h-11 min-w-0 md:h-9 md:px-2"
                    inputMode={clave === "unidad" ? undefined : "decimal"}
                    value={item[clave]}
                    onChange={(event) =>
                      actualizar(indice, { [clave]: event.target.value })
                    }
                  />
                </div>
              )
            })}
            <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-between gap-2 md:col-span-1 md:grid md:gap-2">
              <Label htmlFor={`${baseId}-total`} className="md:text-xs">
                Total de línea
              </Label>
              <output
                id={`${baseId}-total`}
                aria-live="off"
                className="text-right font-medium wrap-anywhere tabular-nums md:flex md:min-h-9 md:items-center md:justify-end md:text-sm"
              >
                {formatMoney(calcularLinea(convertirItem(item)), moneda)}
              </output>
            </div>
            <div className="col-span-2 flex flex-wrap justify-end gap-1 md:col-span-1 md:flex-nowrap md:self-end">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 cursor-pointer md:size-8"
                aria-label={`Subir ${fila}`}
                title="Subir"
                disabled={indice === 0}
                onClick={() => mover(indice, -1)}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 cursor-pointer md:size-8"
                aria-label={`Bajar ${fila}`}
                title="Bajar"
                disabled={indice === value.length - 1}
                onClick={() => mover(indice, 1)}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 cursor-pointer md:size-8"
                aria-label={`Duplicar ${fila}`}
                title="Duplicar"
                onClick={() => duplicar(indice)}
              >
                <Copy aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 cursor-pointer text-destructive md:size-8"
                aria-label={`Eliminar ${fila}`}
                title="Eliminar"
                onClick={() =>
                  reordenar(value.filter((_, posicion) => posicion !== indice))
                }
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        )
      })}
      <Button
        type="button"
        variant="outline"
        className="h-11 w-fit cursor-pointer lg:h-9"
        onClick={() => onChange([...value, crearItem(value.length + 1)])}
      >
        <Plus aria-hidden="true" />
        Agregar ítem
      </Button>
    </div>
  )
}
