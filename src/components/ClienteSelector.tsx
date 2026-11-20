import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { ClienteDialog } from "@/components/ClienteDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { listarClientes } from "@/lib/clientes"
import type { Cliente } from "@/lib/types"

export function ClienteSelector({
  value,
  onChange,
}: {
  value: Cliente | null
  onChange: (cliente: Cliente) => void
}) {
  const id = useId()
  const entrada = useRef<HTMLInputElement>(null)
  const [abierto, setAbierto] = useState(false)
  const [dialogo, setDialogo] = useState(false)
  const [texto, setTexto] = useState("")
  const [activo, setActivo] = useState(-1)
  const [respuesta, setRespuesta] = useState<{
    texto: string
    clientes: Cliente[]
    error?: boolean
  } | null>(null)
  const clientes = respuesta?.texto === texto ? respuesta.clientes : []
  const cargando = respuesta?.texto !== texto

  useEffect(() => {
    if (abierto && activo >= 0) {
      document
        .getElementById(`${id}-opcion-${activo}`)
        ?.scrollIntoView({ block: "nearest" })
    }
  }, [abierto, activo, id])

  useEffect(() => {
    if (!abierto) return
    let vigente = true
    const timer = window.setTimeout(() => {
      listarClientes(texto, 8)
        .then(({ clientes }) => {
          if (vigente) setRespuesta({ texto, clientes })
        })
        .catch((error: Error) => {
          if (!vigente) return
          setRespuesta({ texto, clientes: [], error: true })
          toast.error(error.message)
        })
    }, 250)
    return () => {
      vigente = false
      window.clearTimeout(timer)
    }
  }, [abierto, texto])

  function abrir() {
    setTexto("")
    setActivo(-1)
    setRespuesta(null)
    setAbierto(true)
  }

  function elegir(cliente: Cliente) {
    onChange(cliente)
    setAbierto(false)
    setActivo(-1)
  }

  function manejarTecla(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && abierto) {
      event.preventDefault()
      setAbierto(false)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      if (!abierto) abrir()
      else if (clientes.length) {
        setActivo((indice) =>
          event.key === "ArrowDown"
            ? (indice + 1) % clientes.length
            : indice <= 0
              ? clientes.length - 1
              : indice - 1
        )
      }
    } else if (event.key === "Enter" && abierto) {
      event.preventDefault()
      if (clientes[activo]) elegir(clientes[activo])
    }
  }

  return (
    <div className="min-w-0">
      <div
        className="relative grid gap-2"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setAbierto(false)
        }}
      >
        <Label htmlFor={id}>Cliente</Label>
        <Input
          ref={entrada}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={abierto}
          aria-controls={abierto ? `${id}-lista` : undefined}
          aria-activedescendant={
            abierto && clientes[activo] ? `${id}-opcion-${activo}` : undefined
          }
          placeholder="Razón social o número de documento"
          value={abierto ? texto : (value?.razon_social ?? "")}
          onFocus={() => {
            if (!dialogo) abrir()
          }}
          onClick={() => {
            if (!abierto) abrir()
          }}
          onKeyDown={manejarTecla}
          onChange={(event) => {
            setAbierto(true)
            setActivo(-1)
            setTexto(event.target.value)
          }}
        />
        {abierto && (
          <div className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md">
            <ul
              id={`${id}-lista`}
              role="listbox"
              aria-label="Clientes"
              className="max-h-60 overflow-y-auto"
            >
              {clientes.map((cliente, indice) => (
                <li
                  key={cliente.id}
                  id={`${id}-opcion-${indice}`}
                  role="option"
                  aria-selected={activo === indice}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm wrap-break-word hover:bg-accent aria-selected:bg-accent"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => elegir(cliente)}
                >
                  {cliente.razon_social}
                  <span className="block text-xs text-muted-foreground">
                    {cliente.tipo_doc} {cliente.num_doc}
                  </span>
                </li>
              ))}
            </ul>
            {clientes.length === 0 && (
              <p
                role="status"
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                {cargando
                  ? "Buscando…"
                  : respuesta?.error
                    ? "Búsqueda no disponible."
                    : "No se encontraron clientes."}
              </p>
            )}
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full justify-start"
              onClick={() => {
                setAbierto(false)
                setDialogo(true)
              }}
            >
              <Plus />
              Nuevo cliente
            </Button>
          </div>
        )}
      </div>
      <ClienteDialog
        open={dialogo}
        onOpenChange={setDialogo}
        onGuardado={elegir}
        focoAlCerrar={() => {
          entrada.current?.focus()
          setAbierto(false)
        }}
      />
    </div>
  )
}
