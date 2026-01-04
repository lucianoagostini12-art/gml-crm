"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

// --- IMPORTACIONES ---
import { LoginView } from "@/components/auth/LoginView"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { OpsManager } from "@/components/ops/OpsManager"
import { SellerManager } from "@/components/crm/SellerManager" // <--- CAMBIADO
import { SetterDashboard } from "@/components/setter/SetterDashboard"

export default function Home() {
  const supabase = createClient()
  const [session, setSession] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [userName, setUserName] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Verificar sesión activa
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

    // 2. Escuchar cambios (login/logout)
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
    // Forzamos recarga para limpiar estados de memoria
    window.location.href = "/" 
  }

  // PANTALLA DE CARGA
  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
        <p className="text-slate-400 text-sm font-medium animate-pulse">Cargando sistema...</p>
      </div>
    )
  }

  // 1. LOGIN
  if (!session) {
    return <LoginView />
  }

  // 2. RUTEO DE ROLES

  // A. SUPERVISIÓN GOD
  if (role === "supervisor_god") {
    return <AdminDashboard onLogout={handleLogout} />
  }

  // B. ADMINISTRACIÓN (GOD y COMÚN)
  if (role === "admin_god" || role === "admin_common" || role === "ops") {
    return <OpsManager role={role as any} userName={userName} />
  }

  // C. SETTER (GESTORA DE LEADS)
  if (role === "setter") {
    return <SetterDashboard /> 
  }

  // D. VENDEDORAS
  if (role === "seller") {
    // CAMBIO CLAVE: Llamamos al Manager para que dibuje el Sidebar
    return <SellerManager userName={userName} onLogout={handleLogout} />
  }

  // Default: Por seguridad mandamos al SellerManager
  return <SellerManager userName={userName} onLogout={handleLogout} />
}