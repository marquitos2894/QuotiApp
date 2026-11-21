import { supabase } from "@/lib/supabase"
import type { Empresa } from "@/lib/types"

type DatosEmpresa = Partial<Omit<Empresa, "id" | "updated_at">>

let empresaCache: Promise<Empresa> | undefined

supabase.auth.onAuthStateChange((evento) => {
  if (evento === "SIGNED_OUT") empresaCache = undefined
})

async function cargarEmpresa(): Promise<Empresa> {
  const { data, error } = await supabase
    .from("empresa")
    .select()
    .eq("id", 1)
    .single()
  if (error) throw new Error("No se pudieron cargar los datos de la empresa.")
  return data
}

export async function getEmpresa(): Promise<Empresa> {
  const consulta = (empresaCache ??= cargarEmpresa())
  try {
    return await consulta
  } catch (error) {
    if (empresaCache === consulta) empresaCache = undefined
    throw error
  }
}

export async function updateEmpresa(patch: DatosEmpresa): Promise<Empresa> {
  const { data, error } = await supabase
    .from("empresa")
    .update(patch)
    .eq("id", 1)
    .select()
    .single()
  if (error) throw new Error("No se pudieron guardar los datos de la empresa.")
  empresaCache = undefined
  return data
}

const LOGOS = "logos"

export async function uploadLogo(file: File): Promise<string> {
  const extension = file.type === "image/png" ? "png" : "jpg"
  if (file.type !== "image/png" && file.type !== "image/jpeg") {
    throw new Error("El logo debe estar en formato PNG o JPG.")
  }
  if (file.size > 1024 * 1024 || file.size === 0) {
    throw new Error("Elige una imagen de hasta 1 MB.")
  }

  const path = `logo-${Date.now()}.${extension}`
  const { error } = await supabase.storage.from(LOGOS).upload(path, file)
  if (error) throw new Error("No se pudo subir el logo.")
  await updateEmpresa({ logo_path: path })
  return path
}

export async function removeLogo(path: string): Promise<void> {
  await updateEmpresa({ logo_path: null })
  // Si el borrado falla, el archivo queda huérfano pero el logo ya no se usa.
  await supabase.storage.from(LOGOS).remove([path])
}

export async function getLogoUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(LOGOS)
    .createSignedUrl(path, 3600)
  if (error) throw new Error("No se pudo obtener la vista previa del logo.")
  return data.signedUrl
}

export async function getLogoDataUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(LOGOS).download(path)
  if (error) throw new Error("No se pudo descargar el logo.")

  return new Promise((resolve, reject) => {
    const lector = new FileReader()
    lector.onload = () => resolve(String(lector.result))
    lector.onerror = () => reject(new Error("No se pudo leer el logo."))
    lector.readAsDataURL(data)
  })
}
