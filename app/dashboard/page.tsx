"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase" 

// 1. ADMIN
import { AdminDashboard } from "@/components/admin/AdminDashboard" 

// 2. OPS (Maca)
import { OpsManager } from "@/components/ops/OpsManager"

// 3. SELLER (¡AHORA SÍ! Importamos el archivo que acabamos de crear)
import { SellerManager } from "@/components/crm/SellerManager"

export default function DashboardPage() {
    const router = useRouter()
    const supabase = createClient()
    
    const [userRole, setUserRole] = useState<string | null>(null)
    const [userName, setUserName] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user }, error } = await supabase.auth.getUser()
            
            if (error || !user) {
                router.push("/login")
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('role, full_name')
                .eq('id', user.id)
                .single()

            if (profile) {
                setUserRole(profile.role)
                setUserName(profile.full_name)
            }
            setLoading(false)
        }
        checkUser()
    }, [])

    const handleLogout = async () => {
        await supabase.auth.signOut()
        localStorage.clear()
        router.push("/login")
    }

    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 text-slate-400">Cargando GML System...</div>

    // CASO 1: ADMIN
    if (userRole === 'admin' || userRole === 'supervisor') {
        return <AdminDashboard onLogout={handleLogout} />
    }

    // CASO 2: OPS
    if (userRole === 'ops' || userRole === 'administracion') {
        return <OpsManager />
    }

    // CASO 3: VENDEDOR
    // Ahora le pasamos el control a SellerManager, que tiene tu sidebar original
    if (userRole === 'seller' || userRole === 'vendedor') {
        return <SellerManager userName={userName} onLogout={handleLogout} />
    }

    // Fallback
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-4">
            <p>Rol detectado: {userRole}. No tenés panel asignado.</p>
            <button onClick={handleLogout} className="text-blue-500 underline">Salir</button>
        </div>
    )
}