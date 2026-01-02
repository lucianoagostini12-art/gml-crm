"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

// --- COMPONENTES PRINCIPALES (LOS "GERENTES") ---
import { LoginView } from "@/components/auth/LoginView"
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { SetterDashboard } from "@/components/setter/SetterDashboard"
import { OpsManager } from "@/components/ops/OpsManager"
import { SellerManager } from "@/components/crm/SellerManager" // <--- ACÁ ESTÁ LA MAGIA

export default function Page() {
    const supabase = createClient()
    
    // Estado de Sesión
    const [userRole, setUserRole] = useState<string | null>(null)
    const [userName, setUserName] = useState("")
    const [loading, setLoading] = useState(true)

    // 1. CHEQUEO DE SESIÓN AL CARGAR
    useEffect(() => {
        const checkSession = async () => {
            // Intentamos recuperar sesión rápida del navegador
            const cachedRole = localStorage.getItem("gml_user_role")
            const cachedName = localStorage.getItem("gml_user_name")

            if (cachedRole && cachedName) {
                setUserRole(cachedRole)
                setUserName(cachedName)
            }

            // Verificamos con Supabase que la sesión siga válida
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
                // Si no hay sesión real, borramos lo cacheado por seguridad (opcional)
                // localStorage.clear() 
                // setUserRole(null)
            }
            setLoading(false)
        }
        checkSession()
    }, [])

    // Callback cuando el Login es exitoso
    const handleLoginSuccess = (role: string, name: string) => {
        localStorage.setItem("gml_user_role", role)
        localStorage.setItem("gml_user_name", name)
        setUserRole(role)
        setUserName(name)
    }

    // Función de Salir
    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.clear()
        setUserRole(null)
        setUserName("")
        // Forzamos recarga para limpiar estados de memoria
        window.location.href = "/" 
    }

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Cargando Sistema GML...</div>

    // --- 2. ROUTER DE VISTAS (SEGÚN ROL) ---

    // A. NO LOGUEADO -> LOGIN
    if (!userRole) {
        return <LoginView onLogin={handleLoginSuccess} />
    }

    // B. GERENCIA / ADMIN
    if (userRole === 'admin' || userRole === 'admin_god' || userRole === 'supervisor') {
        return <AdminDashboard onLogout={handleLogout} />
    }

    // C. OPERACIONES (MACA)
    if (userRole === 'ops' || userRole === 'admin_ops') {
        // Envolvemos Ops para pasarle el logout si el componente no lo tiene nativo
        return (
            <div className="relative h-screen w-full">
                <div className="absolute top-4 right-20 z-50">
                     {/* Botón de emergencia por si OpsManager tapa el logout */}
                </div>
                <OpsManager role={userRole} userName={userName} />
            </div>
        )
    }

    // D. SETTER
    if (userRole === 'setter') {
        return (
            <div className="relative h-screen w-full">
                <div className="absolute top-4 right-4 z-50">
                    <button onClick={handleLogout} className="bg-white/90 px-3 py-1 text-xs font-bold text-red-500 rounded border shadow-sm hover:bg-red-50 transition-colors">
                        Cerrar Sesión
                    </button>
                </div>
                <SetterDashboard />
            </div>
        )
    }

    // E. VENDEDOR (SELLER)
    // Acá usamos el componente limpio que creamos antes.
    return <SellerManager userName={userName} onLogout={handleLogout} />
}