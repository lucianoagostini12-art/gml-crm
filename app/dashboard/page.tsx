"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

// --- COMPONENTES PRINCIPALES ---
import { AdminDashboard } from "@/components/admin/AdminDashboard"
import { SetterDashboard } from "@/components/setter/SetterDashboard"
import { OpsManager } from "@/components/ops/OpsManager"
import { SellerManager } from "@/components/crm/SellerManager" 
import { LoginView } from "@/components/auth/LoginView" // Por si se vence la sesión

export default function DashboardPage() {
    const supabase = createClient()
    const router = useRouter()
    
    // Estado de Sesión
    const [userRole, setUserRole] = useState<string | null>(null)
    const [userName, setUserName] = useState("")
    const [loading, setLoading] = useState(true)

    // 1. CHEQUEO DE SESIÓN AL CARGAR
    useEffect(() => {
        const checkSession = async () => {
            // Recuperamos datos guardados en el login
            const cachedRole = localStorage.getItem("gml_user_role")
            const cachedName = localStorage.getItem("gml_user_name")

            if (cachedRole && cachedName) {
                setUserRole(cachedRole)
                setUserName(cachedName)
                setLoading(false)
            } else {
                // Si no hay datos, lo mandamos al login
                router.push("/")
            }
        }
        checkSession()
    }, [])

    // Función de Salir
    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.clear()
        router.push("/") 
    }

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400 animate-pulse">Cargando Sistema GML...</div>

    // --- 2. ROUTER DE VISTAS (SEGÚN ROL) ---

    // A. GERENCIA / ADMIN
    if (userRole === 'admin' || userRole === 'admin_god' || userRole === 'supervisor') {
        return <AdminDashboard onLogout={handleLogout} />
    }

    // B. OPERACIONES (MACA)
    // *** ACÁ ESTABA EL ERROR: AHORA LE PASAMOS LAS PROPS QUE PIDE ***
    if (userRole === 'ops' || userRole === 'admin_ops') {
        return (
            <div className="relative h-screen w-full">
                <OpsManager role={userRole} userName={userName} />
            </div>
        )
    }

    // C. SETTER
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

    // D. VENDEDOR (SELLER)
    return <SellerManager userName={userName} onLogout={handleLogout} />
}