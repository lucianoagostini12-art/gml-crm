"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Moon, Sun, Monitor, Save, User, Link as LinkIcon, Loader2 } from "lucide-react"
import { useTheme } from "next-themes"

export function SettingsView() {
  const supabase = createClient()
  const { setTheme } = useTheme()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [omniUrl, setOmniUrl] = useState("")

  // CARGAR DATOS AL ENTRAR
  useEffect(() => {
    const loadConfig = async () => {
      // 1. Primero miramos si ya está en el navegador (para que sea instantáneo)
      const localUrl = localStorage.getItem("omni_url")
      if (localUrl) setOmniUrl(localUrl)

      // 2. Luego confirmamos con la base de datos (por si cambió de PC)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        const { data, error } = await supabase
          .from("profiles")
          .select("omni_url")
          .eq("id", user.id)
          .single()

        if (data?.omni_url) {
          setOmniUrl(data.omni_url)
          // ✅ IMPORTANTE: Sincronizamos el navegador con lo que viene de la nube
          localStorage.setItem("omni_url", data.omni_url)
        }
      }
      setLoading(false)
    }

    loadConfig()
  }, [])

  // GUARDAR DATOS
  const handleSave = async () => {
    setSaving(true)
    
    // ✅ 1. Guardar en NAVEGADOR (Para que el Kanban lo vea YA)
    if (omniUrl) {
        localStorage.setItem("omni_url", omniUrl)
    }

    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        alert("Configuración guardada en este dispositivo.")
        setSaving(false)
        return
    }

    // ✅ 2. Guardar en NUBE (Para no perderlo nunca)
    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        omni_url: omniUrl,
      })

    if (error) {
      console.error("Error Supabase:", error)
      // Aunque falle la nube, avisamos que localmente ya funciona
      alert("Guardado en este equipo (Error de sincronización nube)")
    } else {
      alert("¡Configuración guardada y sincronizada! ☁️")
    }
    
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center text-slate-500 animate-pulse">
        Cargando preferencias...
      </div>
    )
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto space-y-8 text-slate-900 dark:text-slate-100">
      <div>
        <h2 className="text-2xl font-black flex items-center gap-2">
          <User className="h-6 w-6 text-blue-600" /> Mi Configuración
        </h2>
        <p className="text-slate-500 text-sm">Personalizá tu experiencia en GML Sales.</p>
      </div>

      {/* 1. APARIENCIA */}
      <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
          <CardDescription>Elegí el modo que prefieras para trabajar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 h-24 flex-col gap-2 dark:border-slate-700 dark:hover:bg-slate-800 hover:bg-slate-50"
              onClick={() => setTheme("light")}
            >
              <Sun className="h-6 w-6 text-orange-500" /> Claro
            </Button>

            <Button
              variant="outline"
              className="flex-1 h-24 flex-col gap-2 dark:border-slate-700 dark:hover:bg-slate-800 hover:bg-slate-50"
              onClick={() => setTheme("dark")}
            >
              <Moon className="h-6 w-6 text-blue-500" /> Oscuro
            </Button>

            <Button
              variant="outline"
              className="flex-1 h-24 flex-col gap-2 dark:border-slate-700 dark:hover:bg-slate-800 hover:bg-slate-50"
              onClick={() => setTheme("system")}
            >
              <Monitor className="h-6 w-6 text-slate-500" /> Sistema
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. OMNILEADS LINK */}
      <Card className="border-indigo-100 bg-indigo-50/30 dark:bg-slate-900 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle className="text-indigo-700 dark:text-indigo-400 flex items-center gap-2">
            <LinkIcon className="h-5 w-5" /> Vinculación Telefónica
          </CardTitle>
          <CardDescription>
            Configurá tu consola para que al hacer clic en "Llamar", se abra automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-bold text-slate-600 dark:text-slate-300">URL de tu Consola OmniLeads</Label>
            <Input
              value={omniUrl}
              onChange={(e) => setOmniUrl(e.target.value)}
              placeholder="Ej: https://omnileads.gmlsalud.com"
              className="bg-white dark:bg-slate-950 dark:border-slate-700 border-indigo-200 focus-visible:ring-indigo-500"
            />
            <p className="text-[10px] text-slate-400">Si no sabés tu link, pedíselo a Sistemas.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-4">
        <Button 
            size="lg" 
            onClick={handleSave} 
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold shadow-lg shadow-blue-900/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Guardando..." : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  )
}