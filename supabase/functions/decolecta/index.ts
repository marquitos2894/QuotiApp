const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const mensajeProveedor = "No se pudo consultar el documento en Decolecta."

function responder(
  datos: unknown,
  status = 200,
  headers: HeadersInit = cors
): Response {
  return Response.json(datos, { status, headers })
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor)
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : ""
}

async function verificarSesion(req: Request): Promise<boolean> {
  const authorization = req.headers.get("authorization")
  const apikey = req.headers.get("apikey")
  if (!authorization?.match(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/i) || !apikey)
    return false

  // La pasarela también admite claves de API. Auth comprueba que el JWT sea de un usuario.
  const url = Deno.env.get("SUPABASE_URL")
  if (!url) throw new Error("Falta la URL de Supabase.")

  const respuesta = await fetch(new URL("/auth/v1/user", url), {
    headers: { authorization, apikey },
    signal: AbortSignal.timeout(5000),
  })
  if (respuesta.status >= 500)
    throw new Error("El servicio de autenticación no está disponible.")
  if (!respuesta.ok) return false

  const usuario: unknown = await respuesta.json()
  return (
    esObjeto(usuario) &&
    usuario.role === "authenticated" &&
    usuario.is_anonymous !== true
  )
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors })
  if (req.method !== "POST") {
    return responder({ error: "Método no permitido. Usa POST." }, 405, {
      ...cors,
      Allow: "POST, OPTIONS",
    })
  }

  const cuerpo: unknown = await req.json().catch(() => null)
  const numero = esObjeto(cuerpo) ? texto(cuerpo.numero) : ""
  if (!/^(?:[0-9]{8}|[0-9]{11})$/.test(numero)) {
    return responder(
      { error: "Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos." },
      400
    )
  }

  try {
    if (!(await verificarSesion(req))) {
      return responder(
        { error: "Inicia sesión para consultar un documento." },
        401
      )
    }
  } catch {
    return responder({ error: "No se pudo verificar la sesión." }, 502)
  }

  const token = Deno.env.get("DECOLECTA_TOKEN")
  if (!token) return responder({ error: mensajeProveedor }, 502)

  const esRuc = numero.length === 11
  const recurso = esRuc ? "sunat/ruc" : "reniec/dni"
  const url = new URL(`https://api.decolecta.com/v1/${recurso}`)
  url.searchParams.set("numero", numero)

  try {
    const consulta = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    })
    if (consulta.status === 404)
      return responder({ error: "No se encontró el documento." }, 404)
    if (consulta.status === 400 || consulta.status === 422) {
      return responder({ error: "El número de documento no es válido." }, 400)
    }
    if (!consulta.ok) return responder({ error: mensajeProveedor }, 502)

    const datos: unknown = await consulta.json()
    if (!esObjeto(datos)) return responder({ error: mensajeProveedor }, 502)

    const razonSocial = esRuc
      ? texto(datos.razon_social)
      : texto(datos.full_name) ||
        [
          texto(datos.first_name) || texto(datos.nombres),
          texto(datos.first_last_name) || texto(datos.apellido_paterno),
          texto(datos.second_last_name) || texto(datos.apellido_materno),
        ]
          .filter(Boolean)
          .join(" ")
    if (!razonSocial) return responder({ error: mensajeProveedor }, 502)

    const direccion = esRuc
      ? [
          texto(datos.direccion) || texto(datos.dirección),
          datos.distrito,
          datos.provincia,
          datos.departamento,
        ]
          .map(texto)
          .filter(Boolean)
          .join(", ") || null
      : null

    return responder({
      tipo_doc: esRuc ? "RUC" : "DNI",
      num_doc: numero,
      razon_social: razonSocial,
      direccion,
    })
  } catch {
    return responder({ error: mensajeProveedor }, 502)
  }
})
