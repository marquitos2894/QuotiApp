import { createClient } from "@supabase/supabase-js"

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const clave = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!url || !clave) {
  throw new Error(
    "Falta configurar Supabase. Define VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en el archivo .env."
  )
}

export const supabase = createClient(url, clave)
