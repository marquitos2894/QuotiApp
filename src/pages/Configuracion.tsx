import { useEffect, useRef, useState, type FormEvent } from "react"
import { Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
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
  getEmpresa,
  getLogoUrl,
  removeLogo,
  updateEmpresa,
  uploadLogo,
} from "@/lib/empresa"
import type { CuentaBancaria, Empresa } from "@/lib/types"

const camposEmpresa = [
  { campo: "razon_social", etiqueta: "Razón social", requerido: true },
  { campo: "ruc", etiqueta: "RUC", requerido: true },
  { campo: "direccion", etiqueta: "Dirección" },
  { campo: "telefono", etiqueta: "Teléfono", tipo: "tel" },
  { campo: "email", etiqueta: "Correo electrónico", tipo: "email" },
  { campo: "web", etiqueta: "Sitio web" },
] as const

const camposCuenta = [
  { campo: "banco", etiqueta: "Banco" },
  { campo: "numero", etiqueta: "Número de cuenta" },
  { campo: "cci", etiqueta: "CCI" },
] as const

type FilaCuenta = { clave: number; datos: CuentaBancaria }

export default function Configuracion() {
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [cargando, setCargando] = useState(true)
  const [intento, setIntento] = useState(0)
  const [igv, setIgv] = useState("")
  const [validez, setValidez] = useState("")
  const [cuentas, setCuentas] = useState<FilaCuenta[]>([])
  const siguienteCuenta = useRef(0)
  const [vistaLogo, setVistaLogo] = useState<{
    path: string
    url: string
  } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [quitando, setQuitando] = useState(false)
  const pathLogo = empresa?.logo_path

  useEffect(() => {
    let activo = true
    getEmpresa()
      .then((datos) => {
        if (!activo) return
        setEmpresa(datos)
        setIgv(String(datos.igv_pct))
        setValidez(String(datos.validez_dias_default))
        setCuentas(
          datos.cuentas_bancarias.map((cuenta, clave) => ({
            clave,
            datos: cuenta,
          }))
        )
        siguienteCuenta.current = datos.cuentas_bancarias.length
      })
      .catch((error: Error) => {
        if (activo) toast.error(error.message)
      })
      .finally(() => {
        if (activo) setCargando(false)
      })
    return () => {
      activo = false
    }
  }, [intento])

  useEffect(() => {
    if (!pathLogo) return
    let activo = true
    getLogoUrl(pathLogo)
      .then((url) => {
        if (activo) setVistaLogo({ path: pathLogo, url })
      })
      .catch((error: Error) => {
        if (activo) toast.error(error.message)
      })
    return () => {
      activo = false
    }
  }, [pathLogo])

  function editarCuenta(clave: number, cambio: Partial<CuentaBancaria>) {
    setCuentas((filas) =>
      filas.map((fila) =>
        fila.clave === clave
          ? { ...fila, datos: { ...fila.datos, ...cambio } }
          : fila
      )
    )
  }

  async function subirLogo(archivo: File) {
    setSubiendo(true)
    try {
      const path = await uploadLogo(archivo)
      setEmpresa((actual) => actual && { ...actual, logo_path: path })
      toast.success("Logo actualizado.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el logo."
      )
    } finally {
      setSubiendo(false)
    }
  }

  async function quitarLogo() {
    if (!pathLogo) return
    setQuitando(true)
    try {
      await removeLogo(pathLogo)
      setEmpresa((actual) => actual && { ...actual, logo_path: null })
      toast.success("Logo quitado.")
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo quitar el logo."
      )
    } finally {
      setQuitando(false)
    }
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!empresa || guardando || subiendo || quitando) return
    if (!empresa.razon_social.trim()) {
      toast.error("Escribe la razón social.")
      return
    }
    setGuardando(true)
    try {
      const datos = await updateEmpresa({
        razon_social: empresa.razon_social.trim(),
        ruc: empresa.ruc,
        direccion: empresa.direccion?.trim() || null,
        telefono: empresa.telefono?.trim() || null,
        email: empresa.email?.trim() || null,
        web: empresa.web?.trim() || null,
        igv_pct: Number(igv),
        validez_dias_default: Number(validez),
        condiciones_default: empresa.condiciones_default?.trim() || null,
        cuentas_bancarias: cuentas.map(({ datos }) => ({
          ...datos,
          banco: datos.banco.trim(),
          numero: datos.numero.trim(),
          cci: datos.cci.trim(),
        })),
      })
      setEmpresa(datos)
      setIgv(String(datos.igv_pct))
      setValidez(String(datos.validez_dias_default))
      setCuentas((filas) =>
        filas.map((fila, indice) => ({
          ...fila,
          datos: datos.cuentas_bancarias[indice],
        }))
      )
      toast.success("Configuración guardada.")
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la configuración."
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="mx-auto grid max-w-3xl gap-5">
      <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
      {cargando ? (
        <p role="status" className="text-sm text-muted-foreground">
          Cargando…
        </p>
      ) : !empresa ? (
        <Button
          variant="outline"
          className="justify-self-start"
          onClick={() => {
            setCargando(true)
            setIntento(intento + 1)
          }}
        >
          Reintentar
        </Button>
      ) : (
        <form onSubmit={guardar} className="min-w-0">
          <fieldset
            disabled={guardando || subiendo || quitando}
            className="grid min-w-0 gap-4"
          >
            <Card>
              <CardHeader>
                <CardTitle>Datos de la empresa</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {camposEmpresa.map(({ campo, etiqueta, ...opciones }) => (
                  <div key={campo} className="grid min-w-0 gap-2">
                    <Label htmlFor={campo}>{etiqueta}</Label>
                    <Input
                      id={campo}
                      type={"tipo" in opciones ? opciones.tipo : "text"}
                      required={"requerido" in opciones}
                      value={empresa[campo] ?? ""}
                      inputMode={campo === "ruc" ? "numeric" : undefined}
                      pattern={campo === "ruc" ? "[0-9]{11}" : undefined}
                      title={
                        campo === "ruc"
                          ? "Escribe los 11 dígitos del RUC"
                          : undefined
                      }
                      onChange={(event) => {
                        const texto = event.target.value
                        const valor =
                          campo === "ruc"
                            ? texto.replace(/\D/g, "").slice(0, 11)
                            : texto
                        setEmpresa({ ...empresa, [campo]: valor })
                      }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Logo</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {vistaLogo && vistaLogo.path === pathLogo && (
                  <img
                    src={vistaLogo.url}
                    alt="Logo de la empresa"
                    className="h-20 w-40 rounded-lg border object-contain p-2"
                  />
                )}
                {pathLogo && (
                  <Button
                    type="button"
                    variant="outline"
                    className="justify-self-start"
                    onClick={() => void quitarLogo()}
                  >
                    <Trash2 />
                    {quitando ? "Quitando…" : "Quitar logo"}
                  </Button>
                )}
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="logo-empresa">
                    {subiendo ? "Subiendo logo…" : "Subir logo"}
                  </Label>
                  <Input
                    id="logo-empresa"
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-describedby="formato-logo"
                    className="max-w-sm"
                    onChange={(event) => {
                      const archivo = event.target.files?.[0]
                      event.target.value = ""
                      if (archivo) void subirLogo(archivo)
                    }}
                  />
                  <p
                    id="formato-logo"
                    className="text-xs text-muted-foreground"
                  >
                    PNG o JPG, hasta 1 MB.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Valores por defecto</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="igv-empresa">IGV (%)</Label>
                  <Input
                    id="igv-empresa"
                    type="number"
                    required
                    min="0"
                    max="100"
                    step="0.01"
                    value={igv}
                    onChange={(event) => setIgv(event.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="validez-empresa">Validez (días)</Label>
                  <Input
                    id="validez-empresa"
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={validez}
                    onChange={(event) => setValidez(event.target.value)}
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="condiciones-empresa">
                    Condiciones por defecto
                  </Label>
                  <Textarea
                    id="condiciones-empresa"
                    rows={4}
                    value={empresa.condiciones_default ?? ""}
                    onChange={(event) =>
                      setEmpresa({
                        ...empresa,
                        condiciones_default: event.target.value,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cuentas bancarias</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {cuentas.map(({ clave, datos }, indice) => (
                  <fieldset
                    key={clave}
                    className="grid min-w-0 gap-3 rounded-lg border p-3 sm:grid-cols-2"
                  >
                    <legend className="px-1 text-sm font-medium">
                      Cuenta {indice + 1}
                    </legend>
                    <div className="grid min-w-0 gap-2">
                      <Label htmlFor={`moneda-${clave}`}>Moneda</Label>
                      <Select
                        value={datos.moneda}
                        onValueChange={(moneda) => {
                          if (moneda === "PEN" || moneda === "USD")
                            editarCuenta(clave, { moneda })
                        }}
                      >
                        <SelectTrigger
                          id={`moneda-${clave}`}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PEN">PEN</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {camposCuenta.map(({ campo, etiqueta }) => (
                      <div key={campo} className="grid min-w-0 gap-2">
                        <Label htmlFor={`${campo}-${clave}`}>{etiqueta}</Label>
                        <Input
                          id={`${campo}-${clave}`}
                          value={datos[campo]}
                          required={campo !== "cci"}
                          onChange={(event) =>
                            editarCuenta(clave, { [campo]: event.target.value })
                          }
                        />
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      className="justify-self-start sm:col-span-2"
                      aria-label={`Eliminar cuenta ${indice + 1}`}
                      onClick={() =>
                        setCuentas((filas) =>
                          filas.filter((fila) => fila.clave !== clave)
                        )
                      }
                    >
                      <Trash2 />
                      Eliminar cuenta
                    </Button>
                  </fieldset>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="justify-self-start"
                  onClick={() => {
                    const clave = siguienteCuenta.current++
                    setCuentas((filas) => [
                      ...filas,
                      {
                        clave,
                        datos: {
                          banco: "",
                          moneda: "PEN",
                          numero: "",
                          cci: "",
                        },
                      },
                    ])
                  }}
                >
                  <Plus />
                  Agregar cuenta
                </Button>
              </CardContent>
            </Card>
            <Button type="submit" className="h-10 justify-self-start">
              {guardando ? "Guardando…" : "Guardar"}
            </Button>
          </fieldset>
        </form>
      )}
    </section>
  )
}
