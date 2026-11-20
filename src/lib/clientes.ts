import { supabase } from "@/lib/supabase"
import type { Cliente } from "@/lib/types"

type DatosCliente = Omit<Cliente, "id" | "created_at" | "updated_at"> & {
  id?: string
}

export async function listarClientes(q = "", limit = 20, offset = 0) {
  let consulta = supabase.from("clientes").select("*", { count: "exact" })
  const busqueda = q.trim()
  if (busqueda) {
    const texto = busqueda.replace(/[\\%_]/g, "\\$&").replace(/[\\"]/g, "\\$&")
    const patron = `"%${texto}%"`
    consulta = consulta.or(
      `razon_social.ilike.${patron},num_doc.ilike.${patron}`
    )
  }
  const { data, count, error } = await consulta
    .order("razon_social")
    .order("id")
    .range(offset, offset + limit - 1)
  if (offset > 0 && error?.code === "PGRST103")
    return { clientes: [], total: 0 }
  if (error) throw new Error("No se pudieron cargar los clientes.")
  return { clientes: data as Cliente[], total: count ?? 0 }
}

export async function getCliente(id: string): Promise<Cliente> {
  const { data, error } = await supabase
    .from("clientes")
    .select()
    .eq("id", id)
    .single()
  if (error) throw new Error("No se pudo cargar el cliente.")
  return data
}

export async function getClientePorDocumento(
  numero: string
): Promise<Cliente | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select()
    .eq("num_doc", numero)
    .maybeSingle()
  if (error)
    throw new Error("No se pudo verificar si el documento ya está registrado.")
  return data
}

export async function guardarCliente({
  id,
  ...datos
}: DatosCliente): Promise<Cliente> {
  const tabla = supabase.from("clientes")
  const consulta = id ? tabla.update(datos).eq("id", id) : tabla.insert(datos)
  const { data, error } = await consulta.select().single()
  if (error?.code === "23505")
    throw new Error("Ya existe un cliente con ese número de documento.")
  if (error) throw new Error("No se pudo guardar el cliente.")
  return data
}

export async function eliminarCliente(id: string): Promise<void> {
  const { error } = await supabase
    .from("clientes")
    .delete()
    .eq("id", id)
    .select("id")
    .single()
  if (error?.code === "23503")
    throw new Error("El cliente tiene cotizaciones y no se puede eliminar.")
  if (error) throw new Error("No se pudo eliminar el cliente.")
}
