"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Phone, Headset, Calendar, Plus, Star, Send, History, MessageSquare, Pencil, Check, X, TrendingUp } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"

// Definimos la interfaz aquí para evitar errores de importación
export interface Lead {
  id: string
  name: string
  phone: string
  status: string
  source?: string
  agent_name?: string
  agent?: string
  notes?: string
  prepaga?: string
  plan?: string 
  scheduled_for?: string
  calls?: number
  full_price?: number
  price?: number
  intent?: 'high' | 'medium' | 'low'
  [key: string]: any
}

interface LeadDetailProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetail({ lead, open, onOpenChange }: LeadDetailProps) {
  const supabase = createClient()

  const [scheduledFor, setScheduledFor] = useState("")
  const [obs, setObs] = useState("")
  const [prepaga, setPrepaga] = useState("")
  const [quotes, setQuotes] = useState<any[]>([])
  const [newQuotePrepaga, setNewQuotePrepaga] = useState("")
  const [newQuotePlan, setNewQuotePlan] = useState("")
  const [newQuotePrice, setNewQuotePrice] = useState("")
  const [planesPorEmpresa, setPlanesPorEmpresa] = useState<Record<string, string[]>>({})
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  
  // ✅ NUEVO: Mapa para avatares de logs { "Nombre Usuario": "url_foto" }
  const [logAvatars, setLogAvatars] = useState<Record<string, string>>({})

  // Estado local para Intención (para que se actualice al instante)
  const [intent, setIntent] = useState<'high' | 'medium' | 'low'>('medium')

  const chatEndRef = useRef<HTMLDivElement>(null)

  // phone edit
  const [isEditingPhone, setIsEditingPhone] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState("")

  // headset link from config
  const [omniLink, setOmniLink] = useState<string>("")

  useEffect(() => {
    if (lead && open) {
      setObs("")
      setPrepaga(lead.prepaga || "")
      setScheduledFor(lead.scheduled_for ? new Date(lead.scheduled_for).toISOString().slice(0, 16) : "")
      setIntent(lead.intent || 'medium')

      setIsEditingPhone(false)
      setPhoneDraft(lead.phone || "")

      fetchPlanesDeOps()
      fetchQuotes()
      fetchChatMessages()
      fetchAuditLogs()
      fetchOmniLink()

      const channel = supabase
        .channel(`realtime_chat_${lead.id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "lead_messages", filter: `lead_id=eq.${lead.id}` },
          (payload) => {
            setMessages((prev) => {
              if (prev.find((m) => m.id === payload.new.id)) return prev
              return [...prev, payload.new]
            })
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead, open])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages])

  // ✅ 24h infalible
  const fmtDateTime24 = (date: Date) =>
    new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date)

  const fetchAuditLogs = async () => {
    if (!lead?.id) return
    const { data } = await supabase.from("audit_logs").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false })
    if (data) {
        setAuditLogs(data)
        
        // ✅ Buscar avatares de los usuarios que aparecen en los logs
        const uniqueUsers = Array.from(new Set(data.map((l: any) => l.user_name))).filter(Boolean)
        
        if (uniqueUsers.length > 0) {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .in('full_name', uniqueUsers)
            
            const avatarMap: Record<string, string> = {}
            profiles?.forEach((p: any) => {
                if (p.full_name) avatarMap[p.full_name] = p.avatar_url
            })
            setLogAvatars(avatarMap)
        }
    }
  }

  const fetchPlanesDeOps = async () => {
    const { data } = await supabase.from("system_config").select("value").eq("key", "prepagas_plans").single()
    if (data && Array.isArray(data.value)) {
      const transform: Record<string, string[]> = {}
      data.value.forEach((item: any) => {
        transform[item.name] = item.plans
      })
      setPlanesPorEmpresa(transform)
    }
  }

  const fetchQuotes = async () => {
    if (!lead?.id) return
    const { data } = await supabase.from("quotes").select("*").eq("lead_id", lead.id).order("created_at", { ascending: false })
    if (data) setQuotes(data)
  }

  const fetchChatMessages = async () => {
    if (!lead?.id) return
    const { data } = await supabase.from("lead_messages").select("*").eq("lead_id", lead.id).order("created_at", { ascending: true })
    if (data) setMessages(data)
  }

  const fetchOmniLink = async () => {
    const tryKeys = ["omni_link", "omnileads_link"]
    for (const key of tryKeys) {
      const { data, error } = await supabase.from("system_config").select("value").eq("key", key).single()
      if (!error && data?.value) {
        setOmniLink(String(data.value))
        return
      }
    }
    setOmniLink("")
  }

  // --- NUEVA FUNCIÓN: GUARDAR INTENCIÓN ---
  const handleIntentChange = async (newIntent: 'high' | 'medium' | 'low') => {
      if (!lead) return
      setIntent(newIntent) 
      lead.intent = newIntent

      await supabase.from("leads").update({ intent: newIntent, last_update: new Date().toISOString() }).eq("id", lead.id)
  }

  const saveAgenda = async () => {
    if (!lead || !scheduledFor) return
    const isoDate = new Date(scheduledFor).toISOString()

    await supabase.from("leads").update({ scheduled_for: isoDate, last_update: new Date().toISOString() }).eq("id", lead.id)
    await supabase.from("audit_logs").insert({
      lead_id: lead.id,
      user_name: lead.agent,
      action: "Agenda actualizada",
      details: `Nueva cita: ${fmtDateTime24(new Date(scheduledFor))}`,
    })

    lead.scheduled_for = isoDate
    fetchAuditLogs()
  }

  const saveNote = async () => {
    if (!lead || !obs.trim()) return
    const timestamp = fmtDateTime24(new Date())
    const newNoteLine = `SEP_NOTE|${timestamp}|${lead.agent}|${obs.trim()}`
    const updatedNotes = (lead.notes || "") + (lead.notes ? "|||" : "") + newNoteLine

    await supabase.from("leads").update({ notes: updatedNotes, last_update: new Date().toISOString() }).eq("id", lead.id)
    await supabase.from("audit_logs").insert({
      lead_id: lead.id,
      user_name: lead.agent,
      action: "Nota agregada",
      details: obs.trim(),
    })

    lead.notes = updatedNotes
    setObs("")
    fetchAuditLogs()
  }

  // ✅ crea quote
  const handleAddQuote = async () => {
    if (!lead || !newQuotePrepaga || !newQuotePlan || !newQuotePrice) return

    const isMain = quotes.length === 0
    const price = parseFloat(newQuotePrice)

    const { data: inserted, error } = await supabase
      .from("quotes")
      .insert({ lead_id: lead.id, prepaga: newQuotePrepaga, plan: newQuotePlan, price, is_main: isMain })
      .select()
      .single()

    if (error) return

    await supabase.from("audit_logs").insert({
      lead_id: lead.id,
      user_name: lead.agent,
      action: "Cotización creada",
      details: `${newQuotePrepaga} - ${newQuotePlan} ($${newQuotePrice})${isMain ? " [PRINCIPAL]" : ""}`,
    })

    if (isMain) {
      await supabase
        .from("leads")
        .update({
          quoted_prepaga: newQuotePrepaga,
          quoted_plan: newQuotePlan,
          quoted_price: price,
          last_update: new Date().toISOString(),
        })
        .eq("id", lead.id)

      lead.quoted_prepaga = newQuotePrepaga as any
      lead.quoted_plan = newQuotePlan as any
      lead.quoted_price = price as any
    }

    fetchQuotes()
    fetchAuditLogs()
    setNewQuotePrepaga("")
    setNewQuotePlan("")
    setNewQuotePrice("")
  }

  // ✅ set principal quote
  const setMainQuote = async (quoteId: string) => {
    if (!lead) return

    const currentMain = quotes.find((q) => q.is_main)
    const newMain = quotes.find((q) => q.id === quoteId)
    if (!newMain) return

    if (currentMain?.id === newMain.id) return

    await supabase.from("quotes").update({ is_main: false }).eq("lead_id", lead.id)
    await supabase.from("quotes").update({ is_main: true }).eq("id", quoteId)

    await supabase
      .from("leads")
      .update({
        quoted_prepaga: newMain.prepaga,
        quoted_plan: newMain.plan,
        quoted_price: newMain.price,
        last_update: new Date().toISOString(),
      })
      .eq("id", lead.id)

    lead.quoted_prepaga = newMain.prepaga as any
    lead.quoted_plan = newMain.plan as any
    lead.quoted_price = newMain.price as any

    await supabase.from("audit_logs").insert({
      lead_id: lead.id,
      user_name: lead.agent,
      action: "Cotización principal cambiada",
      details: `Anterior: ${
        currentMain ? `${currentMain.prepaga} - ${currentMain.plan} ($${currentMain.price})` : "(ninguna)"
      } → Nueva: ${newMain.prepaga} - ${newMain.plan} ($${newMain.price})`,
    })

    fetchQuotes()
    fetchAuditLogs()
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !lead) return
    const messageData = { lead_id: lead.id, sender: lead.agent, text: newMessage.trim(), target_role: "supervisión" }
    const { data, error } = await supabase.from("lead_messages").insert(messageData).select().single()
    if (!error && data) setNewMessage("")
  }

  const savePhone = async () => {
    if (!lead) return
    const newPhone = phoneDraft.trim()
    const oldPhone = (lead.phone || "").trim()

    if (!newPhone || newPhone === oldPhone) {
      setIsEditingPhone(false)
      setPhoneDraft(oldPhone)
      return
    }

    await supabase.from("leads").update({ phone: newPhone, last_update: new Date().toISOString() }).eq("id", lead.id)
    await supabase.from("audit_logs").insert({
      lead_id: lead.id,
      user_name: lead.agent,
      action: "Número cambiado",
      details: `Anterior: ${oldPhone || "(vacío)"} → Nuevo: ${newPhone}`,
    })

    lead.phone = newPhone
    setIsEditingPhone(false)
    fetchAuditLogs()
  }

  const handleCallIncrement = async () => {
    if (!lead) return

    const currentCalls = Number(lead.calls || 0)
    const newCallCount = currentCalls + 1

    const timestamp = fmtDateTime24(new Date())
    const updatedNotes =
      (lead.notes || "") +
      (lead.notes ? "|||" : "") +
      `SEP_NOTE|${timestamp}|SISTEMA|Llamada realizada #${newCallCount}`

    let newStatus = (lead.status || "").toLowerCase()
    const isBurned = newCallCount >= 7 && (newStatus === "nuevo" || newStatus === "contactado")
    if (isBurned) newStatus = "perdido"

    lead.calls = newCallCount as any
    lead.notes = updatedNotes as any
    lead.status = newStatus as any

    await supabase
      .from("leads")
      .update({
        calls: newCallCount,
        notes: updatedNotes,
        status: newStatus,
        last_update: new Date().toISOString(),
        loss_reason: isBurned ? "Dato quemado (7 llamados)" : null,
      })
      .eq("id", lead.id)

    await supabase.from("audit_logs").insert({
      lead_id: lead.id,
      user_name: lead.agent,
      action: "Llamada registrada",
      details: `Llamada #${newCallCount}${isBurned ? " (Dato quemado)" : ""}`,
    })

    fetchAuditLogs()
  }

  // --- HELPER PARA ESTILO INTENCIÓN ---
  const getIntentStyle = (val: string) => {
      switch(val) {
          case 'high': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
          case 'medium': return 'bg-amber-50 text-amber-700 border-amber-200'
          case 'low': return 'bg-rose-50 text-rose-700 border-rose-200'
          default: return 'bg-slate-50 text-slate-600'
      }
  }

  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[650px] flex flex-col h-full bg-white dark:bg-[#18191A] p-0 shadow-2xl border-l dark:border-slate-800">
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <SheetHeader className="mb-6 space-y-4">
            <div className="flex flex-col space-y-2 mt-4">
              
              <div className="flex justify-between items-start">
                  <SheetTitle className="text-3xl font-black text-slate-900 tracking-tight">
                    {lead.name}
                  </SheetTitle>
                  
                  {/* SELECTOR DE INTENCIÓN */}
                  <Select value={intent} onValueChange={(v: any) => handleIntentChange(v)}>
                      <SelectTrigger className={`h-8 w-[140px] text-[11px] font-black uppercase tracking-wider border-2 ${getIntentStyle(intent)}`}>
                          <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                          <SelectItem value="high" className="text-emerald-600 font-bold">🔥 ALTA</SelectItem>
                          <SelectItem value="medium" className="text-amber-600 font-bold">⚖️ MEDIA</SelectItem>
                          <SelectItem value="low" className="text-rose-600 font-bold">❄️ BAJA</SelectItem>
                      </SelectContent>
                  </Select>
              </div>

              <div className="flex gap-2">
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none px-3 uppercase text-[10px] font-black tracking-widest">
                    {lead.status}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] font-bold text-slate-500">
                    Fuente: {lead.source}
                  </Badge>
              </div>

              <div className="flex items-center justify-between mt-2">
                {/* phone + pencil */}
                <div className="flex items-center gap-2">
                  {!isEditingPhone ? (
                    <>
                      <span className="text-2xl font-bold text-blue-700 font-mono">{lead.phone}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setPhoneDraft(lead.phone || "")
                          setIsEditingPhone(true)
                        }}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Editar número"
                        title="Editar número"
                      >
                        <Pencil className="h-4 w-4 opacity-70" />
                      </button>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        value={phoneDraft}
                        onChange={(e) => setPhoneDraft(e.target.value)}
                        className="h-10 w-[210px] bg-white border-slate-200 font-mono"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") savePhone()
                          if (e.key === "Escape") {
                            setIsEditingPhone(false)
                            setPhoneDraft(lead.phone || "")
                          }
                        }}
                      />
                      <Button size="icon" variant="outline" className="h-10 w-10 rounded-full" onClick={savePhone}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-10 w-10 rounded-full"
                        onClick={() => {
                          setIsEditingPhone(false)
                          setPhoneDraft(lead.phone || "")
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  {/* phone button (calls count + same behavior) */}
                  <Button
                    type="button"
                    onClick={handleCallIncrement}
                    variant="outline"
                    className="relative h-10 w-10 rounded-full bg-green-50 text-green-600 border-green-200 hover:bg-green-100"
                    title="Registrar llamada"
                  >
                    <Phone className="h-5 w-5" />
                    <span className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white text-[9px] font-black rounded-full px-1.5 py-0.5 border-2 border-white">
                      {lead.calls || 0}
                    </span>
                  </Button>

                  {/* headset opens config link */}
                  <Button
                    type="button"
                    onClick={() => {
                      if (omniLink) window.open(omniLink, "_blank")
                    }}
                    size="icon"
                    variant="outline"
                    className="h-10 w-10 rounded-full bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100"
                    title={omniLink ? "Abrir Omni" : "No hay link configurado"}
                    disabled={!omniLink}
                  >
                    <Headset className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </div>
            <Separator />
          </SheetHeader>

          <Tabs defaultValue="datos" className="w-full h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4 mb-6 h-12 bg-slate-100/80 p-1 rounded-xl">
              <TabsTrigger value="datos" className="font-bold data-[state=active]:bg-white rounded-lg transition-all">Datos</TabsTrigger>
              <TabsTrigger value="cotizacion" className="font-bold data-[state=active]:bg-white rounded-lg transition-all">Cotización</TabsTrigger>
              <TabsTrigger value="chat" className="font-bold data-[state=active]:bg-white rounded-lg transition-all uppercase tracking-tighter">Chat Interno</TabsTrigger>
              <TabsTrigger value="historial" className="font-bold data-[state=active]:bg-white rounded-lg transition-all">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="datos" className="space-y-5">
              <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center justify-between text-blue-800 font-bold text-sm">
                  <span className="flex items-center gap-2 font-black uppercase"><Calendar className="h-4 w-4" /> Próximo Llamado</span>
                </div>

                <Input
                  type="datetime-local"
                  className="bg-white border-blue-200"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />

                <div className="flex justify-end">
                  <Button size="sm" variant="ghost" onClick={saveAgenda} className="h-8 text-blue-700 hover:bg-blue-200 uppercase text-[10px] font-black px-4 rounded-lg">
                    Agendar
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-end px-1">
                  <Label className="font-black text-[11px] uppercase text-slate-500 tracking-wider">Nota de Gestión</Label>
                </div>

                <Textarea
                  placeholder="Escribe detalles del llamado..."
                  className="min-h-[100px] focus-visible:ring-blue-600 border-slate-200 rounded-xl"
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                />

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={saveNote}
                    className="h-9 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest px-4 rounded-lg shadow-md transition-all active:scale-95"
                  >
                    Guardar Nota
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="space-y-4 pt-2">
                <Label className="text-slate-400 uppercase text-[10px] font-black tracking-[0.2em] px-1">Historial de Comentarios</Label>
                <div className="space-y-4">
                  {lead.notes?.split("|||").reverse().map((notaStr: string, i: number) => {
                    const parts = notaStr.split("|")
                    const isFormatted = parts[0] === "SEP_NOTE"
                    const fecha = isFormatted ? parts[1] : ""
                    const asesora = isFormatted ? parts[2] : ""
                    const texto = isFormatted ? parts[3] : notaStr
                    return (
                      <div key={i} className="flex flex-col gap-1 animate-in fade-in slide-in-from-top-1">
                        <div className="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm relative">
                          <p className="text-slate-700 text-[14px] leading-relaxed font-medium">{texto}</p>
                        </div>
                        <div className="flex items-center gap-2 px-2">
                          <span className="text-[10px] font-black text-blue-600 uppercase italic">{asesora || lead.agent}</span>
                          <span className="text-[10px] text-slate-400 font-bold tracking-tighter">{fecha}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="cotizacion" className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                <h4 className="font-black text-xs text-slate-500 uppercase flex items-center gap-2"><Plus className="h-4 w-4"/> Agregar Propuesta Económica</h4>
                <div className="grid grid-cols-2 gap-3">
                  <Select value={newQuotePrepaga} onValueChange={(val) => { setNewQuotePrepaga(val); setNewQuotePlan("") }}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Empresa" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(planesPorEmpresa).map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                    </SelectContent>
                  </Select>

                  <Select value={newQuotePlan} onValueChange={setNewQuotePlan} disabled={!newQuotePrepaga}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Plan" /></SelectTrigger>
                    <SelectContent>
                      {newQuotePrepaga && planesPorEmpresa[newQuotePrepaga]?.map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Input type="number" placeholder="Precio Final $" className="bg-white" value={newQuotePrice} onChange={(e) => setNewQuotePrice(e.target.value)} />
                  <Button onClick={handleAddQuote} className="bg-slate-900 text-white font-black px-6">AGREGAR</Button>
                </div>
              </div>

              {/* ✅ ahora se puede elegir principal */}
              <div className="space-y-2">
                {quotes.map((q) => (
                  <div
                    key={q.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setMainQuote(q.id)}
                    onKeyDown={(e) => e.key === "Enter" && setMainQuote(q.id)}
                    className={`p-4 rounded-xl border flex justify-between items-center transition-all cursor-pointer
                      ${q.is_main ? "bg-yellow-50 border-yellow-200 shadow-sm" : "bg-white border-slate-100 hover:bg-slate-50"}`}
                    title="Click para marcar como principal"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-black text-sm ${q.is_main ? "text-yellow-800" : "text-slate-800"}`}>{q.prepaga}</span>
                        {q.is_main && <Badge className="bg-yellow-400 text-yellow-900 text-[9px] font-black border-none">PRINCIPAL</Badge>}
                      </div>
                      <p className="text-xs font-bold text-slate-500">
                        {q.plan} — <span className="text-slate-900">${q.price.toLocaleString()}</span>
                      </p>
                    </div>
                    {q.is_main ? <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" /> : <Star className="h-5 w-5 text-slate-200" />}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* CHAT MAXIMIZADO */}
            <TabsContent value="chat" className="h-full min-h-[580px] flex flex-col pt-2 animate-in fade-in">
              <div className="flex flex-col border border-slate-200 rounded-3xl overflow-hidden shadow-xl bg-white h-[550px]">
                <div className="bg-[#0f172a] text-[10px] font-black text-center py-3 uppercase text-white tracking-[0.3em] flex items-center justify-center gap-2 shrink-0">
                  <MessageSquare className="h-3 w-3 text-blue-400" /> Canal de Supervisión en Vivo
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/80 p-6 flex flex-col gap-5 custom-scrollbar shadow-inner min-h-0">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 opacity-40">
                      <MessageSquare className="h-12 w-12 stroke-[1px]" />
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-center">Inicia una conversación<br/>con el supervisor</p>
                    </div>
                  ) : (
                    messages.map((m, i) => (
                      <div key={i} className={`flex flex-col ${m.sender === (lead.agent || lead.agent_name) ? "items-end" : "items-start animate-in slide-in-from-left-3 duration-300"}`}>
                        <span className="text-[9px] text-slate-400 font-black mb-1.5 uppercase px-2 tracking-widest">{m.sender}</span>
                        <div className={`px-5 py-3 rounded-2xl max-w-[85%] text-[14px] shadow-sm font-semibold leading-relaxed border transition-all ${
                          m.sender === (lead.agent || lead.agent_name)
                            ? "bg-blue-600 text-white rounded-tr-none border-blue-500"
                            : "bg-white border-slate-200 rounded-tl-none text-slate-700"
                        }`}>
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-4 bg-white border-t border-slate-100 flex gap-3 shrink-0">
                  <Input
                    placeholder="Escribe tu mensaje aquí..."
                    className="bg-slate-50 h-14 rounded-2xl border-slate-200 shadow-sm focus-visible:ring-blue-600 font-medium px-5 text-md"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                  />
                  <Button
                    onClick={handleSendMessage}
                    className="bg-blue-600 h-14 w-14 rounded-2xl shadow-lg hover:bg-blue-700 shrink-0 flex items-center justify-center transition-all active:scale-90"
                  >
                    <Send className="h-6 w-6 text-white" />
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="historial" className="space-y-6">
              <div className="flex items-center gap-2 text-slate-900 font-black text-[11px] uppercase tracking-[0.2em] mb-4 px-1">
                <History className="h-4 w-4 text-blue-600"/> Línea de Tiempo de Auditoría
              </div>
              <div className="space-y-8 pl-2 pr-2 overflow-y-auto max-h-[500px] custom-scrollbar">
                {auditLogs.map((log, i) => (
                  <div key={i} className="flex gap-4 relative">
                    {i !== auditLogs.length - 1 && <div className="absolute left-4 top-10 bottom-[-32px] w-0.5 bg-slate-100"></div>}
                    <Avatar className="h-10 w-10 border-2 border-white shadow-md z-10 shrink-0 mt-1">
                      {/* ✅ FOTO REAL EN HISTORIAL */}
                      <AvatarImage src={logAvatars[log.user_name] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${log.user_name}`} />
                      <AvatarFallback className="bg-blue-600 text-white text-[10px] font-black">{log.user_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1">
                      <div className="flex items-center gap-2 mb-1 justify-between">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">
                          {fmtDateTime24(new Date(log.created_at))}
                        </span>
                        <Badge variant="outline" className="text-[9px] h-5 border-slate-200 text-slate-400 font-black uppercase italic tracking-tighter bg-slate-50/50">
                          vía {log.user_name}
                        </Badge>
                      </div>
                      <span className="text-[14px] font-black text-slate-800 leading-tight">{log.action}</span>
                      {log.details && <p className="text-[12px] text-slate-500 mt-2 bg-slate-50/80 p-4 rounded-xl italic border border-slate-100 shadow-sm leading-relaxed">{log.details}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}