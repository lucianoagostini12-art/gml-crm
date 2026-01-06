"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Phone, ArrowRight, ArrowLeft, CheckCircle2, MessageCircle, Flame, Copy, FileText, ExternalLink } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu"

// IMPORTAMOS LA FICHA DEL LEAD
import { LeadDetail, Lead } from "@/components/crm/LeadDetail"

export function FocusModeView() {
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copySuccess, setCopySuccess] = useState(false)
  const [streak, setStreak] = useState(0)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  
  // ESTADO PARA EL MODAL DE DETALLE
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        const name = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || "Vendedor"
        setCurrentUser(name)
      }
    })
  }, [])

  const fetchFocusLeads = async () => {
    if (!currentUser) return
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_name", currentUser)
      .in("status", ["nuevo", "contactado"])
      .order("created_at", { ascending: false })

    if (data) {
        setLeads(data)
        if (currentIndex >= data.length && data.length > 0) {
            setCurrentIndex(data.length - 1)
        }
    }
    setLoading(false)
  }

  useEffect(() => {
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
      text = `Hola, ¿cómo estás? 👋🏼\n\nMi nombre es *${currentLead.agent_name}* y me comunico desde *GML Salud*.\nTe contacto porque recibimos tu consulta sobre planes de cobertura médica.\n\n¿Preferís que te pase la info por acá o coordinamos una llamada rápida?`
    }
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, "_blank")
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
    const newNotes = (currentLead.notes || "") + `\n[FOCO] Llamada #${newCount} - ${now.toLocaleTimeString()}`

    const updatedLead = { ...currentLead, calls: newCount, notes: newNotes, last_update: now.toISOString() }
    const newLeads = [...leads]
    newLeads[currentIndex] = updatedLead
    setLeads(newLeads)

    await supabase.from("leads").update({ calls: newCount, notes: newNotes, last_update: now.toISOString() }).eq("id", currentLead.id)
  }

  if (loading) return <div className="h-full flex items-center justify-center text-slate-500 animate-pulse">Cargando prospectos...</div>
  if (leads.length === 0) return <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4"><div className="text-6xl">🎉</div><div className="text-xl font-bold text-slate-800 dark:text-white">¡Todo listo por hoy!</div><p className="text-sm">No tenés leads pendientes.</p></div>

  return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative">
      
      <div className="w-full max-w-lg mb-6 flex justify-between items-end animate-in fade-in slide-in-from-top-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            Modo Foco 🎯
            {streak > 2 && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full flex items-center border border-orange-200 shadow-sm animate-pulse"><Flame className="h-3 w-3 mr-1 fill-orange-500" /> {streak}</span>}
          </h2>
          <p className="text-sm text-slate-500">Concentración total</p>
        </div>
        <div className="text-right w-32">
          <span className="text-xs font-bold text-slate-400">{currentIndex + 1} / {leads.length}</span>
          <Progress value={progress} className="h-2 mt-1 bg-slate-200" />
        </div>
      </div>

      <Card className="w-full max-w-lg shadow-2xl border-t-4 border-t-blue-600 bg-white dark:bg-[#1e1e1e] relative overflow-hidden">
        <CardContent className="p-8 text-center">
          <div className="mb-8 space-y-3">
            <Badge variant="secondary" className="mb-2 uppercase tracking-wider text-[10px]">{currentLead.source}</Badge>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">{currentLead.name}</h2>
            <div className="inline-flex items-center justify-center gap-3 text-2xl font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-6 py-3 rounded-xl cursor-pointer hover:bg-slate-100 transition-all active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm mt-2" onClick={() => { navigator.clipboard.writeText(currentLead.phone); setCopySuccess(true); setTimeout(() => setCopySuccess(false), 1500) }}>
              {currentLead.phone}
              {copySuccess ? <CheckCircle2 className="h-5 w-5 text-green-500 animate-in zoom-in" /> : <Copy className="h-5 w-5 opacity-40" />}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <Button onClick={handleCall} className="h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all active:translate-y-0.5"><Phone className="mr-2 h-5 w-5" /> LLAMAR</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-14 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 font-bold text-lg shadow-sm"><MessageCircle className="mr-2 h-5 w-5" /> WhatsApp</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Opciones Rápidas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => sendWpp("no_contesta")} className="cursor-pointer">👋 Plantilla "No Contesta"</DropdownMenuItem>
                <DropdownMenuItem onClick={() => sendWpp("normal")} className="cursor-pointer">💬 Chat Directo</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* BOTÓN VER FICHA (Props corregidas) */}
          <div className="mb-6">
             <Button 
                className="w-full h-12 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold text-base shadow-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-all active:scale-[0.98] group"
                onClick={() => setIsDetailOpen(true)}
             >
                <FileText className="mr-2 h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors"/> 
                Ver Ficha Completa / Notas
                <ExternalLink className="ml-2 h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity"/>
             </Button>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <Button variant="ghost" size="sm" onClick={handlePrev} disabled={currentIndex === 0} className="text-slate-400 hover:text-slate-600"><ArrowLeft className="h-4 w-4 mr-1" /> Anterior</Button>
            <span className="text-xs text-slate-400 italic max-w-[150px] truncate" title={currentLead.notes}>"{currentLead.notes?.split("\n").pop() || "Sin notas recientes"}"</span>
            <Button onClick={handleNext} className="bg-slate-900 dark:bg-white text-white dark:text-black hover:opacity-90 gap-2 shadow-lg">Siguiente <ArrowRight className="h-4 w-4" /></Button>
          </div>
        </CardContent>
      </Card>

      {/* RENDERIZADO CON PROPS CORREGIDAS (open y onOpenChange) */}
      {isDetailOpen && currentLead && (
          <LeadDetail
            open={isDetailOpen}
            onOpenChange={(isOpen: boolean) => {
                setIsDetailOpen(isOpen)
                if (!isOpen) fetchFocusLeads()
            }}
            lead={currentLead}
          />
      )}
    </div>
  )
}