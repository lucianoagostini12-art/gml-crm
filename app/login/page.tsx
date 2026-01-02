"use client"

import { useRouter } from "next/navigation"
import { LoginView } from "@/components/auth/LoginView"

export default function LoginPage() {
    const router = useRouter()

    const handleLoginSuccess = (role: string, name: string) => {
        // Guardamos datos básicos para que la UI sepa quién sos rápido
        localStorage.setItem("gml_user_role", role)
        localStorage.setItem("gml_user_name", name)
        
        // Redirigimos al Hall Central
        router.push("/dashboard")
    }

    return <LoginView onLogin={handleLoginSuccess} />
}