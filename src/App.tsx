import { lazy, Suspense } from "react"
import { Redirect, Route, Switch } from "wouter"
import { AppShell } from "@/components/AppShell"
import { useSession } from "@/hooks/useSession"

const Login = lazy(() => import("@/pages/Login"))
const Cotizaciones = lazy(() => import("@/pages/Cotizaciones"))
const CotizacionForm = lazy(() => import("@/pages/CotizacionForm"))
const CotizacionDetalle = lazy(() => import("@/pages/CotizacionDetalle"))
const Clientes = lazy(() => import("@/pages/Clientes"))
const Configuracion = lazy(() => import("@/pages/Configuracion"))

const cargando = (
  <p role="status" className="p-4 text-sm text-muted-foreground">
    Cargando…
  </p>
)

export function App() {
  const { session, loading } = useSession()
  if (loading) return cargando

  return (
    <Switch>
      <Route path="/login">
        {session ? (
          <Redirect to="/" replace />
        ) : (
          <Suspense fallback={cargando}>
            <Login />
          </Suspense>
        )}
      </Route>
      <Route>
        {session ? (
          <AppShell email={session.user.email}>
            <Suspense fallback={cargando}>
              <Switch>
                <Route path="/" component={Cotizaciones} />
                <Route path="/cotizaciones/nueva">
                  <CotizacionForm />
                </Route>
                <Route path="/cotizaciones/:id/editar">
                  {({ id }) => <CotizacionForm key={id} id={id} />}
                </Route>
                <Route path="/cotizaciones/:id">
                  {({ id }) => <CotizacionDetalle key={id} id={id} />}
                </Route>
                <Route path="/clientes" component={Clientes} />
                <Route path="/configuracion" component={Configuracion} />
                <Route>
                  <Redirect to="/" replace />
                </Route>
              </Switch>
            </Suspense>
          </AppShell>
        ) : (
          <Redirect to="/login" replace />
        )}
      </Route>
    </Switch>
  )
}

export default App
