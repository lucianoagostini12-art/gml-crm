"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import type { AuthChangeEvent, Session } from "@supabase/supabase-js"

// --- IMPORTACIONES DE PANELES ---
import { LoginView } from "@/components/auth/LoginView"
import { AdminDashboard } from "@/components/admin/AdminDashboard" // Archivos ADMIN
import { OpsManager } from "@/components/ops/OpsManager"         // Archivos OPS
import { SellerManager } from "@/components/crm/SellerManager"     // Vendedora
import { SetterDashboard } from "@/components/setter/SetterDashboard" // Gestora

export default function Home() {
  const supabase = createClient()
  const router = useRouter()
  
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verificar sesión activa al inicio
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

    // 2. Escuchar cambios de estado (Login / Logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setSession(session)
        if (session) {
          fetchProfile(session.user.id)
        } else {
          setRole(null)
          setUserName("")
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

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
        // Guardamos en local para acceso rápido en otros componentes
        localStorage.setItem("gml_user_role", data.role)
        localStorage.setItem("gml_user_name", data.full_name || "Usuario")
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = "/" 
  }

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-400 text-sm font-medium animate-pulse">Cargando sistema GML...</p>
      </div>
    )
  }

  if (!session) return <LoginView />

  // --- DISTRIBUCIÓN DE ROLES ---

  // 1. SUPERVISIÓN GOD -> Archivos ADMIN
  if (role === "supervisor_god") {
    return <AdminDashboard onLogout={handleLogout} />
  }

  // 2. ADMINISTRACIÓN (GOD y COMÚN) -> Archivos OPS
  // La diferencia de permisos se maneja dentro de OpsManager
  if (role === "admin_god" || role === "admin_common" || role === "ops") {
    return <OpsManager role={role as any} userName={userName} />
  }

  // 3. GESTORA DE LEADS -> Setter
  if (role === "setter") {
    return <SetterDashboard userName={userName} onLogout={handleLogout} /> 
  }

  // 4. VENDEDORA -> Seller
  if (role === "seller") {
    return <SellerManager userName={userName} onLogout={handleLogout} />
  }

  // Fallback por seguridad (Vendedora)
  return <SellerManager userName={userName} onLogout={handleLogout} />
}
