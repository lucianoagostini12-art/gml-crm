"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, ArrowRight, ArrowLeft, CheckCircle2, MessageCircle, Flame, Copy } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

export function FocusModeView() {
  const supabase = createClient()

  const [leads, setLeads] = useState<any[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copySuccess, setCopySuccess] = useState(false)
  const [streak, setStreak] = useState(0)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  // ✅ USUARIO LOGUEADO (NO HARDCODEADO)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setCurrentUser(data.user.user_metadata?.full_name || null)
      }
    })
  }, [])

  // ✅ FETCH DE LEADS SOLO CUANDO HAY USUARIO
  useEffect(() => {
    if (!currentUser) return

    const fetchFocusLeads = async () => {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .eq("agent_name", currentUser)
        .in("status", ["nuevo", "contactado"])
        .order("created_at", { ascending: false })

      if (data) setLeads(data)
      setLoading(false)
    }

    fetchFocusLeads()
  }, [currentUser])

  const currentLead = leads[currentIndex]
  const progress = leads.length > 0 ? (currentIndex / leads.length) * 100 : 0

  const handleNext = () => {
    if (currentIndex < leads.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setStreak((prev) => prev + 1)
    } else {
      alert("¡Terminaste la lista por hoy! 🚀")
    }
  }

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1)
    }
  }

  const sendWpp = (type: "no_contesta" | "normal") => {
    if (!currentLead) return
    const cleanPhone = currentLead.phone.replace(/[^0-9]/g, "")
    let text = ""

    if (type === "no_contesta") {
      text = `Hola, ¿cómo estás? 👋🏼

Mi nombre es *${currentLead.agent_name}* y me comunico desde *GML Salud*.
Te contacto porque recibimos tu consulta sobre planes de cobertura médica.

¿Preferís que te pase la info por acá o coordinamos una llamada rápida?`
    }

    window.open(
      `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`,
      "_blank"
    )
  }

  const handleCall = async () => {
    if (!currentLead) return

    const cleanPhone = currentLead.phone.replace(/[^0-9]/g, "")
    navigator.clipboard.writeText(cleanPhone)

    const omniUrl = localStorage.getItem("omni_url")
    if (omniUrl) window.open(omniUrl, "_blank")

    setCopySuccess(true)
    setTimeout(() => setCopySuccess(false), 2000)

    const newCount = (currentLead.calls || 0) + 1
    const now = new Date()
    const newNotes =
      (currentLead.notes || "") +
      `\n[FOCO] Llamada #${newCount} - ${now.toLocaleTimeString()}`

    await supabase
      .from("leads")
      .update({
        calls: newCount,
        notes: newNotes,
        last_update: now.toISOString()
      })
      .eq("id", currentLead.id)
  }

  if (loading)
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Cargando...
      </div>
    )

  if (leads.length === 0)
    return (
      <div className="h-full flex items-center justify-center font-bold text-slate-500">
        ¡Todo listo! 🎉
      </div>
    )

  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
      <div className="w-full max-w-lg mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Modo Foco 🎯
            {streak > 2 && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full flex items-center">
                <Flame className="h-3 w-3 mr-1" /> {streak}
              </span>
            )}
          </h2>
          <p className="text-sm text-slate-500">Concentración total</p>
        </div>
        <div className="text-right w-32">
          <span className="text-xs font-bold text-slate-400">
            {currentIndex + 1} / {leads.length}
          </span>
          <Progress value={progress} className="h-1.5 mt-1" />
        </div>
      </div>

      <Card className="w-full max-w-lg shadow-xl border-t-4 border-t-blue-600 bg-white dark:bg-[#1e1e1e]">
        <CardContent className="p-8 text-center">
          <div className="mb-6 space-y-2">
            <Badge variant="secondary" className="mb-2">
              {currentLead.source}
            </Badge>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
              {currentLead.name}
            </h2>
            <div
              className="inline-flex items-center justify-center gap-2 text-xl font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-200 transition-colors mt-2"
              onClick={() => {
                navigator.clipboard.writeText(currentLead.phone)
                setCopySuccess(true)
                setTimeout(() => setCopySuccess(false), 1500)
              }}
            >
              {currentLead.phone}
              {copySuccess ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 opacity-50" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <Button
              onClick={handleCall}
              className="h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-md"
            >
              <Phone className="mr-2 h-4 w-4" /> LLAMAR
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="h-12 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 font-bold text-base"
                >
                  <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Opciones Rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => sendWpp("no_contesta")}>
                  👋 No Contesta (Plantilla)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => sendWpp("normal")}>
                  💬 Chat Normal (Vacío)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="text-slate-400 hover:text-slate-600"
            >
              <ArrowLeft className="h-4 w-4 mr-1" /> Anterior
            </Button>

            <span className="text-xs text-slate-400 italic max-w-[150px] truncate">
              "{currentLead.notes?.split("\n").pop() || "Sin notas"}"
            </span>

            <Button
              onClick={handleNext}
              className="bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 gap-2"
            >
              Siguiente <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
