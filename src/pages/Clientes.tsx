import { useEffect, useRef, useState } from "react"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ClienteDialog } from "@/components/ClienteDialog"
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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { eliminarCliente, listarClientes } from "@/lib/clientes"
import type { Cliente } from "@/lib/types"

const TAMANO_PAGINA = 20
type Resultado = Awaited<ReturnType<typeof listarClientes>>

export default function Clientes() {
  const [q, setQ] = useState("")
  const [pagina, setPagina] = useState(0)
  const [revision, setRevision] = useState(0)
  const [respuesta, setRespuesta] = useState<{
    clave: string
    datos: Resultado | null
  } | null>(null)
  const [dialogo, setDialogo] = useState<{ cliente: Cliente | null } | null>(
    null
  )
  const [porEliminar, setPorEliminar] = useState<Cliente | null>(null)
  const [eliminando, setEliminando] = useState(false)
  const buscador = useRef<HTMLInputElement>(null)
  const botonEliminar = useRef<HTMLButtonElement | null>(null)
  const clave = JSON.stringify([q, pagina, revision])
  const resultado = respuesta?.clave === clave ? respuesta.datos : undefined

  useEffect(() => {
    let activo = true
    const timer = window.setTimeout(
      () => {
        listarClientes(q, TAMANO_PAGINA, pagina * TAMANO_PAGINA)
          .then((datos) => {
            if (!activo) return
            if (pagina > 0 && datos.clientes.length === 0) {
              setPagina(Math.max(0, Math.ceil(datos.total / TAMANO_PAGINA) - 1))
            } else {
              setRespuesta({ clave, datos })
            }
          })
          .catch((error: Error) => {
            if (!activo) return
            setRespuesta({ clave, datos: null })
            toast.error(error.message)
          })
      },
      q ? 250 : 0
    )
    return () => {
      activo = false
      window.clearTimeout(timer)
    }
  }, [q, pagina, clave])

  function recargar() {
    setRevision((actual) => actual + 1)
  }

  async function confirmarEliminar() {
    if (!porEliminar || eliminando) return
    setEliminando(true)
    try {
      await eliminarCliente(porEliminar.id)
      botonEliminar.current = null
      setPorEliminar(null)
      recargar()
      toast.success("Cliente eliminado.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el cliente."
      )
    } finally {
      setEliminando(false)
    }
  }

  const paginas = resultado
    ? Math.max(1, Math.ceil(resultado.total / TAMANO_PAGINA))
    : 1

  return (
    <section className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
        <Button
          type="button"
          className="h-10"
          onClick={() => setDialogo({ cliente: null })}
        >
          <Plus />
          Nuevo cliente
        </Button>
      </div>
      <div className="grid w-full max-w-sm gap-2">
        <Label htmlFor="buscar-clientes">Buscar clientes</Label>
        <Input
          id="buscar-clientes"
          ref={buscador}
          type="search"
          placeholder="Razón social o número de documento"
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setPagina(0)
          }}
        />
      </div>
      {resultado === undefined ? (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando clientes…
        </p>
      ) : resultado === null ? (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={recargar}
        >
          Reintentar
        </Button>
      ) : resultado.clientes.length === 0 ? (
        <p role="status" className="text-sm text-muted-foreground">
          No se encontraron clientes.
        </p>
      ) : (
        <>
          <div className="min-w-0 rounded-lg border">
            <Table className="min-w-lg">
              <TableHeader>
                <TableRow>
                  <TableHead>Razón social o nombre</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultado.clientes.map((cliente) => (
                  <TableRow key={cliente.id}>
                    <TableCell className="max-w-64 font-medium wrap-break-word whitespace-normal">
                      {cliente.razon_social}
                    </TableCell>
                    <TableCell>
                      {cliente.tipo_doc} {cliente.num_doc}
                    </TableCell>
                    <TableCell className="max-w-56 wrap-break-word whitespace-normal">
                      {cliente.contacto ||
                        cliente.email ||
                        cliente.telefono ||
                        "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={`Editar a ${cliente.razon_social}`}
                        onClick={() => setDialogo({ cliente })}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={`Eliminar a ${cliente.razon_social}`}
                        onClick={(event) => {
                          botonEliminar.current = event.currentTarget
                          setPorEliminar(cliente)
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <nav
            aria-label="Paginación de clientes"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <span className="text-sm text-muted-foreground">
              Página {pagina + 1} de {paginas}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={pagina === 0}
                onClick={() => setPagina(pagina - 1)}
              >
                Anterior
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pagina + 1 >= paginas}
                onClick={() => setPagina(pagina + 1)}
              >
                Siguiente
              </Button>
            </div>
          </nav>
        </>
      )}
      <ClienteDialog
        open={dialogo !== null}
        cliente={dialogo?.cliente}
        onOpenChange={(open) => {
          if (!open) setDialogo(null)
        }}
        onGuardado={() => {
          recargar()
        }}
        focoAlCerrar={() => buscador.current?.focus()}
      />
      <AlertDialog
        open={porEliminar !== null}
        onOpenChange={(open) => {
          if (!open && !eliminando) setPorEliminar(null)
        }}
      >
        <AlertDialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            if (botonEliminar.current?.isConnected)
              botonEliminar.current.focus()
            else buscador.current?.focus()
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
            <AlertDialogDescription className="min-w-0 wrap-anywhere">
              Se eliminará a {porEliminar?.razon_social} de la lista de
              clientes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminando}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={eliminando}
              onClick={(event) => {
                event.preventDefault()
                void confirmarEliminar()
              }}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
