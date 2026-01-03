"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

// --- IMPORTACIONES CORREGIDAS ---
import { LoginView } from "@/components/auth/LoginView" // <--- CAMBIADO DE AuthLogin A LoginView
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { OpsManager } from "@/components/ops/OpsManager"
import { MySalesView } from "@/components/seller/MySalesView"

export default function Home() {
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verificar sesión activa al cargar
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      
      if (session) {
        await fetchProfile(session.user.id)
      } else {
        setLoading(false)
      }
    }

    checkSession()

    // 2. Escuchar cambios (login/logout) en tiempo real
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchProfile(session.user.id)
      } else {
        setRole(null)
        setUserName("")
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // 3. Buscar el Rol REAL en la tabla 'profiles'
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", userId)
        .single()

      if (data) {
        setRole(data.role) 
        setUserName(data.full_name || "Usuario")
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setRole(null)
    setSession(null)
    window.location.href = "/" // Recarga limpia para borrar estados de memoria
  }

  // --- PANTALLA DE CARGA ---
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-400 text-sm font-medium animate-pulse">Cargando sistema...</p>
      </div>
    )
  }

  // --- 1. LOGIN (Si no hay usuario) ---
  if (!session) {
    // Usamos tu componente existente. 
    // NOTA: Asegurate de que LoginView haga el 'supabase.auth.signInWithPassword'.
    // Al hacerlo, el 'onAuthStateChange' de arriba detectará el login automáticamente.
    return <LoginView />
  }

  // --- 2. RUTEO SEGÚN ROL (JERARQUÍA REAL) ---

  // A. SUPERVISIÓN GOD -> Torre de Control Total
  if (role === "supervisor_god") {
    return <AdminDashboard onLogout={handleLogout} />
  }

  // B. ADMINISTRACIÓN (GOD y COMÚN) -> Tablero Operativo
  if (role === "admin_god" || role === "admin_common") {
    return <OpsManager role={role as any} userName={userName} />
  }

  // C. VENDEDORAS -> Panel de Ventas
  if (role === "seller") {
    return <MySalesView />
  }

  // D. DEFAULT (Rol nuevo o desconocido) -> Panel Vendedor por seguridad
  return <MySalesView />
}