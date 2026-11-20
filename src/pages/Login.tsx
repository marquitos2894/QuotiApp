import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"

const mensajes: Record<string, string> = {
  invalid_credentials: "El correo o la contraseña son incorrectos.",
  email_not_confirmed: "Confirma tu correo antes de iniciar sesión.",
  over_request_rate_limit:
    "Hubo demasiados intentos. Espera un momento e inténtalo de nuevo.",
  user_banned: "La cuenta está deshabilitada.",
}

export default function Login() {
  const [email, setEmail] = useState("")
  const [contrasena, setContrasena] = useState("")
  const [enviando, setEnviando] = useState(false)

  async function ingresar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEnviando(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: contrasena,
      })
      if (error) {
        toast.error(
          mensajes[error.code ?? ""] ??
            "No se pudo iniciar sesión. Inténtalo de nuevo."
        )
      }
    } catch {
      toast.error("No se pudo conectar. Inténtalo de nuevo.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">QuotiApp</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Iniciar sesión
          </h1>
        </CardHeader>
        <CardContent>
          <form onSubmit={ingresar}>
            <fieldset disabled={enviando} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="login-email">Correo electrónico</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="login-contrasena">Contraseña</Label>
                <Input
                  id="login-contrasena"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={contrasena}
                  onChange={(event) => setContrasena(event.target.value)}
                />
              </div>
              <Button type="submit" className="h-10">
                {enviando ? "Ingresando…" : "Ingresar"}
              </Button>
            </fieldset>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
