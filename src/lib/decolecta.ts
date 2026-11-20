import { FunctionsHttpError } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"
import type { ConsultaDocumento } from "@/lib/types"

export async function consultarDocumento(
  numero: string
): Promise<ConsultaDocumento> {
  const { data, error } = await supabase.functions.invoke<
    ConsultaDocumento & { error?: string }
  >("decolecta", { body: { numero } })
  if (error instanceof FunctionsHttpError) {
    const cuerpo = await error.context.json().catch(() => null)
    if (typeof cuerpo?.error === "string" && cuerpo.error)
      throw new Error(cuerpo.error)
  }
  if (data?.error) throw new Error(data.error)
  if (error || !data)
    throw new Error("No se pudo consultar el documento. Inténtalo de nuevo.")
  return data
}
