"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Moon, Sun, Monitor, Save, User, Link as LinkIcon } from "lucide-react"
import { useTheme } from "next-themes"

export function SettingsView() {
    const { setTheme, theme } = useTheme()
    
    // Estados
    const [name, setName] = useState("Maca")
    const [avatarUrl, setAvatarUrl] = useState("https://github.com/shadcn.png")
    const [omniUrl, setOmniUrl] = useState("")

    useEffect(() => {
        const savedUrl = localStorage.getItem("omni_url")
        if (savedUrl) setOmniUrl(savedUrl)
    }, [])

    const handleSave = () => {
        localStorage.setItem("omni_url", omniUrl)
        alert("¡Configuración guardada!")
        window.location.reload()
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto space-y-8 text-slate-900 dark:text-slate-100">
            <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <User className="h-6 w-6 text-blue-600" /> Mi Perfil y Configuración
                </h2>
                <p className="text-slate-500">Personalizá tu experiencia en GML Sales.</p>
            </div>

            {/* 1. APARIENCIA */}
            <Card className="dark:bg-slate-900 dark:border-slate-800">
                <CardHeader>
                    <CardTitle>Apariencia</CardTitle>
                    <CardDescription>Elegí el modo que prefieras.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <Button variant="outline" className="flex-1 h-24 flex-col gap-2 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => setTheme("light")}><Sun className="h-6 w-6" /> Claro</Button>
                        <Button variant="outline" className="flex-1 h-24 flex-col gap-2 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => setTheme("dark")}><Moon className="h-6 w-6" /> Oscuro</Button>
                        <Button variant="outline" className="flex-1 h-24 flex-col gap-2 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => setTheme("system")}><Monitor className="h-6 w-6" /> Sistema</Button>
                    </div>
                </CardContent>
            </Card>

            {/* 2. OMNILEADS LINK */}
            <Card className="border-indigo-100 bg-indigo-50/30 dark:bg-slate-900 dark:border-slate-800">
                <CardHeader>
                    <CardTitle className="text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
                        <LinkIcon className="h-5 w-5"/> Link de Omnileads
                    </CardTitle>
                    <CardDescription>
                        Pegá acá el link de tu consola para que el botón de llamar te abra la pestaña directo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>URL de tu Consola</Label>
                        <Input 
                            value={omniUrl} 
                            onChange={(e) => setOmniUrl(e.target.value)} 
                            placeholder="Ej: https://omnileads.gmlsalud.com" 
                            className="dark:bg-slate-950 dark:border-slate-700"
                        />
                    </div>
                </CardContent>
            </Card>
            
            <div className="flex justify-end pt-4">
                <Button size="lg" onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                    <Save className="h-5 w-5" /> Guardar Cambios
                </Button>
            </div>
        </div>
    )
}