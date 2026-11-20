import { useEffect, useState } from "react"
import type { Session } from "@supabase/supabase-js"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let activo = true
    let huboCambio = false

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((evento, sesion) => {
      if (!activo || evento === "INITIAL_SESSION") return
      huboCambio = true
      setSession(sesion)
      setLoading(false)
    })

    async function cargar() {
      try {
        const { data, error } = await supabase.auth.getSession()
        if (!activo || huboCambio) return
        if (error) throw error
        setSession(data.session)
      } catch {
        if (activo && !huboCambio)
          toast.error("No se pudo recuperar la sesión.")
      } finally {
        if (activo && !huboCambio) setLoading(false)
      }
    }

    void cargar()
    return () => {
      activo = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, loading }
}
