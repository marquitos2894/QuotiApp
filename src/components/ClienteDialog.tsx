import { useId, useRef, useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getClientePorDocumento, guardarCliente } from "@/lib/clientes"
import { consultarDocumento } from "@/lib/decolecta"
import type { Cliente, TipoDoc } from "@/lib/types"

const campos = [
  { campo: "razon_social", etiqueta: "Razón social o nombre", tipo: "text" },
  { campo: "direccion", etiqueta: "Dirección", tipo: "text" },
  { campo: "email", etiqueta: "Correo electrónico", tipo: "email" },
  { campo: "telefono", etiqueta: "Teléfono", tipo: "tel" },
  { campo: "contacto", etiqueta: "Contacto", tipo: "text" },
] as const

type ClienteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cliente?: Cliente | null
  onGuardado: (cliente: Cliente) => void
  focoAlCerrar?: () => void
}

export function ClienteDialog({
  open,
  onOpenChange,
  cliente,
  onGuardado,
  focoAlCerrar,
}: ClienteDialogProps) {
  const [ocupado, setOcupado] = useState(false)
  const focoAnterior = useRef<HTMLElement | null>(null)

  return (
    <Dialog
      open={open}
      onOpenChange={(siguiente) => {
        if (!ocupado) onOpenChange(siguiente)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={() => {
          const activo = document.activeElement
          focoAnterior.current = activo instanceof HTMLElement ? activo : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (focoAlCerrar) focoAlCerrar()
          else focoAnterior.current?.focus()
        }}
      >
        {open && (
          <FormularioCliente
            key={cliente?.id}
            cliente={cliente}
            onCancelar={() => onOpenChange(false)}
            onGuardado={(guardado) => {
              onOpenChange(false)
              onGuardado(guardado)
            }}
            setOcupado={setOcupado}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function FormularioCliente({
  cliente,
  onCancelar,
  onGuardado,
  setOcupado,
}: {
  cliente?: Cliente | null
  onCancelar: () => void
  onGuardado: (cliente: Cliente) => void
  setOcupado: (ocupado: boolean) => void
}) {
  const prefijo = useId()
  const [datos, setDatos] = useState(() => ({
    id: cliente?.id,
    tipo_doc: cliente?.tipo_doc ?? ("RUC" as TipoDoc),
    num_doc: cliente?.num_doc ?? "",
    razon_social: cliente?.razon_social ?? "",
    direccion: cliente?.direccion ?? "",
    email: cliente?.email ?? "",
    telefono: cliente?.telefono ?? "",
    contacto: cliente?.contacto ?? "",
  }))
  const [operacion, setOperacion] = useState<"consulta" | "guardar" | null>(
    null
  )
  const longitud = datos.tipo_doc === "RUC" ? 11 : 8

  async function consultar() {
    if (datos.num_doc.length !== longitud) {
      toast.error(`Escribe los ${longitud} dígitos del ${datos.tipo_doc}.`)
      return
    }
    setOperacion("consulta")
    setOcupado(true)
    try {
      const existente = await getClientePorDocumento(datos.num_doc)
      if (existente) {
        setDatos({
          id: existente.id,
          tipo_doc: existente.tipo_doc,
          num_doc: existente.num_doc,
          razon_social: existente.razon_social,
          direccion: existente.direccion ?? "",
          email: existente.email ?? "",
          telefono: existente.telefono ?? "",
          contacto: existente.contacto ?? "",
        })
        toast.info(
          "Este documento ya está registrado. Se cargaron los datos del cliente."
        )
      } else {
        const resultado = await consultarDocumento(datos.num_doc)
        setDatos({
          ...datos,
          razon_social: resultado.razon_social,
          direccion: resultado.direccion ?? "",
        })
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo consultar el documento."
      )
    } finally {
      setOperacion(null)
      setOcupado(false)
    }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (operacion) return
    const razonSocial = datos.razon_social.trim()
    if (!razonSocial) {
      toast.error("Escribe la razón social o el nombre del cliente.")
      return
    }
    setOperacion("guardar")
    setOcupado(true)
    try {
      const guardado = await guardarCliente({
        ...datos,
        razon_social: razonSocial,
        direccion: datos.direccion.trim() || null,
        email: datos.email.trim() || null,
        telefono: datos.telefono.trim() || null,
        contacto: datos.contacto.trim() || null,
      })
      toast.success("Cliente guardado.")
      onGuardado(guardado)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar el cliente."
      )
    } finally {
      setOperacion(null)
      setOcupado(false)
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {datos.id ? "Editar cliente" : "Nuevo cliente"}
        </DialogTitle>
        <DialogDescription>
          Completa los datos del cliente para usarlo en cotizaciones.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={guardar} className="grid min-w-0 gap-4">
        <fieldset
          disabled={operacion !== null}
          className="grid min-w-0 gap-3 sm:grid-cols-2"
        >
          <div className="grid min-w-0 gap-2">
            <Label htmlFor={`${prefijo}-tipo`}>Tipo de documento</Label>
            <Select
              value={datos.tipo_doc}
              onValueChange={(tipo) => {
                if (tipo !== "RUC" && tipo !== "DNI") return
                setDatos({ ...datos, tipo_doc: tipo, num_doc: "" })
              }}
            >
              <SelectTrigger id={`${prefijo}-tipo`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RUC">RUC</SelectItem>
                <SelectItem value="DNI">DNI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-0 gap-2">
            <Label htmlFor={`${prefijo}-numero`}>Número de documento</Label>
            <div className="flex min-w-0 gap-2">
              <Input
                id={`${prefijo}-numero`}
                className="min-w-0"
                inputMode="numeric"
                required
                value={datos.num_doc}
                maxLength={longitud}
                pattern={`[0-9]{${longitud}}`}
                title={`Escribe los ${longitud} dígitos del ${datos.tipo_doc}`}
                onChange={(event) =>
                  setDatos({
                    ...datos,
                    num_doc: event.target.value.replace(/\D/g, ""),
                  })
                }
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void consultar()}
              >
                {operacion === "consulta" ? "Consultando…" : "Consultar"}
              </Button>
            </div>
          </div>
          {campos.map(({ campo, etiqueta, tipo }) => (
            <div
              key={campo}
              className={
                campo === "razon_social" || campo === "direccion"
                  ? "grid min-w-0 gap-2 sm:col-span-2"
                  : "grid min-w-0 gap-2"
              }
            >
              <Label htmlFor={`${prefijo}-${campo}`}>{etiqueta}</Label>
              <Input
                id={`${prefijo}-${campo}`}
                type={tipo}
                required={campo === "razon_social"}
                value={datos[campo]}
                onChange={(event) =>
                  setDatos({ ...datos, [campo]: event.target.value })
                }
              />
            </div>
          ))}
        </fieldset>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={operacion !== null}
            onClick={onCancelar}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={operacion !== null}>
            {operacion === "guardar" ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
