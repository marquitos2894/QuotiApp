import { useState, type ReactNode } from "react"
import { LogOut, Menu, Plus, UserRound } from "lucide-react"
import { Link, useLocation } from "wouter"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { supabase } from "@/lib/supabase"

const destinos = [
  { ruta: "/", titulo: "Cotizaciones" },
  { ruta: "/clientes", titulo: "Clientes" },
  { ruta: "/configuracion", titulo: "Configuración" },
]

export function AppShell({
  email,
  children,
}: {
  email?: string
  children: ReactNode
}) {
  const [rutaActual] = useLocation()
  const [saliendo, setSaliendo] = useState(false)
  const seccion = rutaActual.startsWith("/cotizaciones/") ? "/" : rutaActual

  async function cerrarSesion() {
    setSaliendo(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" })
      if (error) throw error
    } catch {
      toast.error("No se pudo cerrar la sesión.")
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <div className="min-h-svh">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link
            href="/"
            className="mr-auto text-base font-semibold tracking-tight md:mr-4"
          >
            QuotiApp
          </Link>
          <nav
            aria-label="Navegación principal"
            className="mr-auto hidden items-center gap-1 md:flex"
          >
            {destinos.map(({ ruta, titulo }) => (
              <Button
                key={ruta}
                asChild
                variant={seccion === ruta ? "secondary" : "ghost"}
              >
                <Link
                  href={ruta}
                  aria-current={rutaActual === ruta ? "page" : undefined}
                >
                  {titulo}
                </Link>
              </Button>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 md:hidden"
                aria-label="Navegación principal"
              >
                <Menu />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {destinos.map(({ ruta, titulo }) => (
                <DropdownMenuItem key={ruta} asChild>
                  <Link
                    href={ruta}
                    aria-current={rutaActual === ruta ? "page" : undefined}
                  >
                    {titulo}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild className="h-10 md:h-9">
            <Link href="/cotizaciones/nueva">
              <Plus />
              Nueva cotización
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10"
                aria-label="Menú de usuario"
                disabled={saliendo}
              >
                <UserRound />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-w-[calc(100vw-2rem)]"
            >
              <DropdownMenuLabel className="break-all">
                {email || "Mi cuenta"}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void cerrarSesion()}>
                <LogOut />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto max-w-6xl min-w-0 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
