"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

// --- IMPORTACIONES DE PANELES ---
import { LoginView } from "@/components/auth/LoginView"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { OpsManager } from "@/components/ops/OpsManager"
import { SellerManager } from "@/components/crm/SellerManager"
import { SetterDashboard } from "@/components/setter/SetterDashboard"

export default function Home() {
  const supabase = createClient()
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

    // 2. Escuchar cambios de estado (Login / Logout externos)
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

  // Buscar rol real en la tabla 'profiles'
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
      } else {
        console.warn("Usuario sin perfil:", userId)
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setLoading(false)
    }
  }

  // LOGOUT GLOBAL (Limpia todo)
  const handleLogout = async () => {
    await supabase.auth.signOut()
    // Forzamos recarga dura para limpiar estados de memoria (chat, notificaciones, etc.)
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

  // 1. SI NO HAY SESIÓN -> LOGIN
  if (!session) {
    return <LoginView />
  }

  // 2. RUTEO DE ROLES (Director de Tráfico)

  // A. NIVEL GERENCIAL (GOD MODE)
  // Ahora incluye 'admin_god' para que vea el Dashboard Global
  if (role === "supervisor_god" || role === "admin_god") {
    return <AdminDashboard onLogout={handleLogout} />
  }

  // B. NIVEL OPERATIVO (OPS)
  // 'admin_common' y 'ops' van a la gestión diaria
  if (role === "admin_common" || role === "ops") {
    // OpsManager maneja su propio logout internamente o via prop si se actualiza
    return <OpsManager role={role as any} userName={userName} />
  }

  // C. SETTER (GESTORA DE LEADS)
  if (role === "setter") {
    // Le pasamos props por si el componente las acepta
    return <SetterDashboard userName={userName} onLogout={handleLogout} /> 
  }

  // D. VENDEDORAS (SELLER)
  if (role === "seller") {
    return <SellerManager userName={userName} onLogout={handleLogout} />
  }

  // E. DEFAULT / ERROR DE ROL
  // Si el rol no coincide con ninguno, mandamos al SellerManager como fallback seguro
  // o podríamos mostrar un mensaje de "Rol no asignado".
  return <SellerManager userName={userName} onLogout={handleLogout} />
}