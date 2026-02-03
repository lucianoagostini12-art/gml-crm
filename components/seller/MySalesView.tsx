"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import type { SupabaseClient } from "@supabase/supabase-js"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DollarSign,
  XCircle,
  AlertTriangle,
  Clock,
  MessageSquare,
  Send,
  User,
  MapPin,
  Paperclip,
  CheckCheck,
  UploadCloud,
  Calendar as CalendarIcon,
  FileUp,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  Lock,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  ArrowRightLeft,
  Filter,
  Users, // <--- Único import agregado
} from "lucide-react"

// ✅ Storage config
const STORAGE_BUCKET = "lead-documents"

// --- HELPERS UI ---
function TabTrigger({ value, label, icon }: any) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:border-b-4 data-[state=active]:border-blue-600 rounded-none h-full px-4 gap-2 text-slate-400 text-xs font-black uppercase tracking-widest transition-all flex-1"
    >
      {icon} {label}
    </TabsTrigger>
  )
}

function ReadOnlyField({ label, value, icon, color, prefix }: any) {
  return (
    <div className="flex flex-col gap-1 items-start w-full group">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
        {icon} {label}
      </span>
      <div className={`w-full border-b border-slate-200 py-1 text-sm font-medium ${color || "text-slate-700"}`}>
        {prefix && <span className="text-slate-400 mr-1">{prefix}</span>}
        {value || "-"}
      </div>
    </div>
  )
}

function ChatBubble({ user, text, time, isMe }: any) {
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-4 animate-in slide-in-from-bottom-2`}>
      <div
        className={`px-4 py-2 rounded-2xl max-w-[85%] text-[13px] shadow-sm ${isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white border text-slate-700 rounded-bl-none"
          }`}
      >
        {!isMe && <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-tighter">{user}</p>}
        {text}
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <span className="text-[9px] text-slate-400 font-bold">{time}</span>
        {isMe && <CheckCheck size={12} className="text-blue-400" />}
      </div>
    </div>
  )
}

// --- COLORES DE PREPAGAS ---
const getPrepagaBadge = (prepaga: string) => {
  const p = prepaga || "Generica"
  if (p.includes("Prevención")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
  if (p.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
  if (p.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
  if (p.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
  if (p.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
  if (p.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"
  return "bg-slate-50 border-slate-100 text-slate-800"
}

// --- HELPERS DE ESTADO ---
const getAdminStatus = (status: string) => {
  switch (status?.toLowerCase()) {
    case "ingresado":
      return { label: "INGRESADO", color: "bg-slate-100 text-slate-600 border-slate-200", icon: <Clock className="w-3 h-3" /> }
    case "precarga":
      return { label: "EN PRECARGA", color: "bg-blue-50 text-blue-600 border-blue-200", icon: <FileUp className="w-3 h-3" /> }
    case "medicas":
      return { label: "AUD. MÉDICA", color: "bg-purple-50 text-purple-600 border-purple-200", icon: <ShieldCheck className="w-3 h-3" /> }
    case "legajo":
      return { label: "LEGAJO", color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <Lock className="w-3 h-3" /> }
    case "cumplidas":
      return { label: "CUMPLIDA", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> }
    case "rechazado":
      return { label: "RECHAZADO", color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> }
    case "demoras":
      return { label: "CON DEMORA", color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> }
    default:
      return { label: status?.toUpperCase(), color: "bg-gray-100 text-gray-600", icon: <Clock className="w-3 h-3" /> }
  }
}

interface MySalesViewProps {
  userName: string
  supabase: SupabaseClient
  onLogout?: () => void

  // ✅ Abrir directo desde campana / notificación
  openLeadId?: string | null
  openTab?: "chat" | "files"
  onOpenedLead?: () => void
}

export function MySalesView({ userName, supabase, onLogout, openLeadId, openTab = "chat", onOpenedLead }: MySalesViewProps) {
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("chat")

  // FILTRO INTELIGENTE DE FECHAS (igual lógica AdminConteo)
  const [currentDate, setCurrentDate] = useState(new Date())

  // ✅ filtro de estado (para la lista)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Estados para Chat
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatMsg, setChatMsg] = useState("")
  const [latestMsgMap, setLatestMsgMap] = useState<Record<string, any>>({})

  // Estados Documentos
  const [docs, setDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ✅ misma regla que AdminConteo (ventas por sold_at, con fallback)
  const salesDateOf = (l: any) => l?.sold_at || l?.fecha_ingreso || l?.activation_date || l?.fecha_alta || l?.created_at

  // ✅ LÓGICA ROBUSTA PARA DETECTAR PASS (igual que Ops)
  const isPass = (l: any) =>
    String(l?.type || "").toLowerCase() === "pass" ||
    String(l?.sub_state || "").toLowerCase() === "auditoria_pass" ||
    String(l?.source || "").toLowerCase() === "pass"

  // Handlers de Fecha
  const handlePrevMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() - 1)
    setCurrentDate(newDate)
  }
  const handleNextMonth = () => {
    const newDate = new Date(currentDate)
    newDate.setMonth(newDate.getMonth() + 1)
    setCurrentDate(newDate)
  }

  // --- 1. CARGA DE LISTA DE VENTAS (SIN filtrar por created_at: se filtra por sold_at/fallback en frontend, igual AdminConteo) ---
  const fetchSales = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_name", userName)
      .not("status", "in", '("nuevo","contactado","cotizacion","documentacion","perdido")')
      .order("last_update", { ascending: false })

    if (error) {
      console.error("Error cargando ventas:", error)
      setSales([])
      setLoading(false)
      return
    }

    if (data) {
      setSales(data)
      fetchLatestMessages(data)

      if (selectedSale) {
        const updatedSelected = data.find((s) => s.id === selectedSale.id)
        if (updatedSelected) setSelectedSale((prev: any) => ({ ...prev, ...updatedSelected }))
      }
    }

    setLoading(false)
  }

  const fetchLatestMessages = async (salesData: any[]) => {
    if (!salesData.length) return
    const ids = salesData.map((s) => s.id)
    const { data } = await supabase
      .from("lead_messages")
      .select("lead_id, sender, created_at")
      .in("lead_id", ids)
      .order("created_at", { ascending: false })

    if (data) {
      const map: any = {}
      data.forEach((msg: any) => {
        if (!map[msg.lead_id]) map[msg.lead_id] = msg
      })
      setLatestMsgMap(map)
    }
  }

  useEffect(() => {
    fetchSales()
    const channel = supabase
      .channel("my_sales_list_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `agent_name=eq.${userName}` }, () => fetchSales())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName])

  // ✅ ABRIR VENTA DESDE NOTIFICACIÓN (lead_id) + TAB
  useEffect(() => {
    if (!openLeadId) return

    // 1) si ya está en la lista, abrir directo
    const found = (sales || []).find((s) => s.id === openLeadId)
    if (found) {
      setSelectedSale(found)
      setActiveTab(openTab)
      onOpenedLead?.()
      return
    }

    // 2) fallback: traerla desde DB (por si todavía no entró en la lista)
    const fetchOne = async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", openLeadId).maybeSingle()
      if (error || !data) return
      // seguridad: solo si le pertenece a la vendedora
      if (data.agent_name !== userName) return

      setSales((prev) => [data, ...prev])
      setSelectedSale(data)
      setActiveTab(openTab)
      onOpenedLead?.()
    }

    fetchOne()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openLeadId])

  // --- 2. CARGA DE DETALLES ---
  const fetchDocs = async (leadId: string) => {
    setDocsLoading(true)
    const { data } = await supabase.from("lead_documents").select("*").eq("lead_id", leadId).order("uploaded_at", { ascending: false })
    if (data) setDocs(data)
    setDocsLoading(false)
  }

  useEffect(() => {
    if (!selectedSale?.id) {
      setChatMessages([])
      setDocs([])
      return
    }

    const fetchMessages = async () => {
      const { data } = await supabase.from("lead_messages").select("*").eq("lead_id", selectedSale.id).order("created_at", { ascending: true })
      if (data) {
        const mapped = data.map((m) => ({
          id: m.id,
          user: m.sender,
          text: m.text,
          time: new Date(m.created_at).toLocaleTimeString('es-AR', { hour: "2-digit", minute: "2-digit", timeZone: 'America/Argentina/Buenos_Aires' }),
          isMe: m.sender === userName,
          rawDate: m.created_at,
        }))
        setChatMessages(mapped)
      }
    }

    fetchMessages()
    fetchDocs(selectedSale.id)

    const chatChannel = supabase
      .channel(`sales_chat:${selectedSale.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lead_messages", filter: `lead_id=eq.${selectedSale.id}` }, (payload) => {
        const m: any = payload.new
        setChatMessages((prev) => [
          ...prev,
          {
            id: m.id,
            user: m.sender,
            text: m.text,
            time: new Date(m.created_at).toLocaleTimeString('es-AR', { hour: "2-digit", minute: "2-digit", timeZone: 'America/Argentina/Buenos_Aires' }),
            isMe: m.sender === userName,
            rawDate: m.created_at,
          },
        ])
      })
      .subscribe()

    return () => {
      supabase.removeChannel(chatChannel)
    }
  }, [selectedSale?.id, supabase, userName])

  // ✅ Al abrir una venta, marcar como leídas las notificaciones de ESA venta (lead_id)
  // Esto hace que baje el contador de campana y el badge del sidebar.
  useEffect(() => {
    if (!selectedSale?.id) return
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_name", userName)
      .eq("lead_id", selectedSale.id)
      .eq("read", false)
      .then(() => {
        // no-op: el estado visual lo maneja SellerManager
      })
  }, [selectedSale?.id, supabase, userName])

  // --- ACCIONES ---

  // ✅ CHAT: target_role consistente con tu data real + manejo de error visible
  const sendMessage = async () => {
    if (!chatMsg.trim() || !selectedSale) return

    const payload = {
      lead_id: selectedSale.id,
      sender: userName,
      text: chatMsg.trim(),
      target_role: "seller", // ✅ CLAVE: así lo tenés en la tabla (ejemplo que pegaste)
    }

    try {
      const { error } = await supabase.from("lead_messages").insert(payload)
      if (error) {
        console.error("CHAT INSERT ERROR:", error, payload)
        alert("No se pudo enviar el mensaje: " + error.message)
        return
      }
      setChatMsg("")
    } catch (e: any) {
      console.error("CHAT UNEXPECTED ERROR:", e, payload)
      alert("Error inesperado enviando mensaje: " + (e?.message || String(e)))
    }
  }

  // ✅ HANDLER UNIFICADO DE SUBIDA (Trigger)
  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.click()
  }

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!selectedSale?.id) return
      const files = e.target.files
      if (!files || files.length === 0) return

      setUploading(true)
      const leadId = selectedSale.id

      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_")
        const path = `${leadId}/${Date.now()}-${safeName}`

        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        })

        if (upErr) {
          alert(`Error subiendo ${file.name}: ${upErr.message}`)
          continue
        }

        // ✅ IMPORTANTE: chequear el INSERT a lead_documents y si falla limpiar el storage
        const { error: dbErr } = await supabase.from("lead_documents").insert({
          lead_id: leadId,
          type: file.type.includes("image") ? "IMG" : "PDF",
          file_path: path,
          name: file.name,
          uploaded_by: userName,
          uploaded_at: new Date().toISOString(),
          status: "uploaded",
        })

        if (dbErr) {
          console.error("LEAD_DOCUMENTS INSERT ERROR:", dbErr, { leadId, path })
          alert(`Se subió el archivo pero NO se pudo registrar en la base: ${dbErr.message}`)

          // limpiar para no dejar "basura" en el bucket
          await supabase.storage.from(STORAGE_BUCKET).remove([path])

          continue
        }
      }

      await fetchDocs(leadId)
    } catch (error: any) {
      alert("Error inesperado: " + error.message)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  const handleDeleteFile = async (file: any) => {
    if (!confirm("¿Borrar este archivo?")) return

    const { error: dbErr } = await supabase.from("lead_documents").delete().eq("id", file.id)
    if (dbErr) return alert("No se pudo borrar de la base de datos")

    await supabase.storage.from(STORAGE_BUCKET).remove([file.file_path])
    fetchDocs(selectedSale.id)
  }

  const priceFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

  // ✅ FILTRO DE MES/AÑO (igual AdminConteo: por sold_at/fallback)
  const monthFilteredSales = useMemo(() => {
    const y = currentDate.getFullYear()
    const m = currentDate.getMonth()

    return (sales || []).filter((l: any) => {
      const dRaw = salesDateOf(l)
      if (!dRaw) return false
      const d = new Date(dRaw)
      if (Number.isNaN(d.getTime())) return false
      return d.getFullYear() === y && d.getMonth() === m
    })
  }, [sales, currentDate])

  // ✅ FILTRO DE ESTADO (sin tocar la data)
  const filteredSales = useMemo(() => {
    if (statusFilter === "all") return monthFilteredSales
    return monthFilteredSales.filter((l: any) => String(l?.status || "").toLowerCase() === statusFilter)
  }, [monthFilteredSales, statusFilter])

  // ✅ CONTADORES (NO SUMA PASS)
  const nonPassCount = useMemo(() => filteredSales.filter((s: any) => !isPass(s)).length, [filteredSales])
  const capitasShown = useMemo(() => {
    return filteredSales.reduce((sum: number, l: any) => {
      if (isPass(l)) return sum
      const prep = String(l?.prepaga || "")
      const isAMPF = prep.toUpperCase().includes("AMPF")
      const points = isAMPF ? 1 : Number(l?.capitas) || 1
      return sum + points
    }, 0)
  }, [filteredSales])

  return (
    <div className="p-6 h-full overflow-y-auto w-full bg-white dark:bg-slate-950 text-slate-900">
      {/* HEADER + FILTRO FECHAS + FILTRO ESTADO + CONTADOR */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <DollarSign className="h-6 w-6 text-green-600" /> Mis Ventas Ingresadas
          </h2>

          <p className="text-slate-500 text-sm flex items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="animate-spin h-3 w-3" /> Sincronizando...
              </span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <span>Panel en tiempo real</span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-slate-600">Mostrando: {nonPassCount} ventas</span>
                <span className="text-slate-300">|</span>
                <span className="font-bold text-slate-600">{capitasShown} cápitas</span>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* ✅ FILTRO DE ESTADOS */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 px-2 text-slate-400">
              <Filter size={14} />
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 pr-8 pl-2 text-sm font-bold text-slate-700 bg-transparent outline-none"
            >
              <option value="all">Todos (ventas)</option>
              <option value="ingresado">Ingresado</option>
              <option value="precarga">Precarga</option>
              <option value="medicas">Médicas</option>
              <option value="legajo">Legajo</option>
              <option value="cumplidas">Cumplidas</option>
              <option value="demoras">Demoras</option>
              <option value="rechazado">Rechazado</option>
            </select>

            <Badge variant="outline" className="mr-2 bg-slate-50 text-slate-700 border-slate-200 font-black">
              {filteredSales.length}
            </Badge>
          </div>

          {/* CONTROLES DE FECHA */}
          <div className="flex items-center bg-slate-100 rounded-lg p-1 shadow-sm border border-slate-200">
            <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-8 w-8 hover:bg-white rounded-md text-slate-500">
              <ChevronLeft size={16} />
            </Button>
            <div className="px-4 text-sm font-bold text-slate-700 w-36 text-center capitalize">
              {currentDate.toLocaleString("es-AR", { month: "long", year: "numeric" })}
            </div>
            <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-8 w-8 hover:bg-white rounded-md text-slate-500">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* LISTADO DE TARJETAS */}
      <div className="grid gap-4 pb-20 max-w-4xl mx-auto md:mx-0">
        {filteredSales.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">
              No hay ventas registradas en {currentDate.toLocaleString("es-AR", { month: "long" })} con ese filtro.
            </p>
          </div>
        )}

        {filteredSales.map((sale) => {
          const adminStatus = getAdminStatus(sale.status)
          const isRejected = sale.status === "rechazado" || sale.status === "demoras"

          const lastMsg = latestMsgMap[sale.id]
          const hasNewMessage = lastMsg && lastMsg.sender !== userName

          const pass = isPass(sale)

          // Color de borde (Prioridad: Rojo rechazo > Violeta Pass > Azul Alta)
          const borderColorClass = isRejected ? "border-l-red-500" : pass ? "border-l-purple-500" : "border-l-blue-500"

          // ✅ fecha visual igual lógica AdminConteo (sold_at/fallback)
          const dRaw = salesDateOf(sale)
          const d = dRaw ? new Date(dRaw) : null
          const shownDate = d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("es-AR") : "-"

          return (
            <Card
              key={sale.id}
              onClick={() => setSelectedSale(sale)}
              className={`cursor-pointer hover:shadow-xl hover:translate-x-1 transition-all border-l-[6px] relative group ${borderColorClass} ${isRejected ? "bg-red-50/10" : ""
                } shadow-sm`}
            >
              <CardContent className="p-4 flex items-center gap-4">
                {/* BLOQUE ICONO */}
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black shadow-sm shrink-0 ${pass ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"}`}>
                  {pass ? <ArrowRightLeft size={20} /> : <UserPlus size={20} />}
                </div>

                <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {/* AVATAR + NOMBRE + BADGES */}
                    <div className="flex items-center gap-3 mb-1">
                      <Avatar className="h-8 w-8 border border-slate-200">
                        <AvatarFallback className="font-bold text-xs text-slate-600 bg-slate-100">{sale.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-lg text-slate-800 truncate leading-none">{sale.name || "Sin Nombre"}</h4>
                          <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[10px] font-bold text-slate-500">
                            {sale.dni || "S/DNI"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={`text-[9px] font-bold h-4 px-1.5 border ${getPrepagaBadge(sale.prepaga)}`}>
                            {sale.prepaga}
                          </Badge>

                          {pass && (
                            <Badge className="bg-purple-100 text-purple-700 border border-purple-200 text-[9px] h-4 px-1.5 font-black uppercase">
                              PASS
                            </Badge>
                          )}

                          {hasNewMessage && (
                            <Badge className="bg-orange-500 text-white border-0 animate-pulse text-[9px] h-4 px-1.5">
                              <MessageSquare size={10} className="mr-1" fill="currentColor" /> 1
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Sub-info */}
                    <div className="flex items-center gap-3 ml-11">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-1">
                        <CalendarIcon size={12} /> {shownDate}
                      </span>

                      <span className="text-xs text-slate-500 font-medium border-l border-slate-200 pl-3">
                        Plan: <span className="font-bold text-slate-700">{sale.plan}</span>
                      </span>

                      {/* ✅ AGREGADO: CÁPITAS */}
                      <span className="text-xs text-slate-500 font-medium border-l border-slate-200 pl-3 flex items-center gap-1">
                        <Users size={12} className="text-slate-400" />
                        <span className="font-bold text-slate-700">{sale.capitas || 1}</span>
                      </span>

                      {sale.sub_state && (
                        <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase hidden sm:inline-block">
                          {sale.sub_state}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Badge de Estado Administrativo */}
                  <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-[10px] font-black uppercase tracking-wider shadow-sm whitespace-nowrap shrink-0 ${adminStatus.color}`}>
                    {adminStatus.icon} {adminStatus.label}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* MODAL DETALLE */}
      <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
        <DialogContent
          style={{ maxWidth: "1200px", width: "95%", height: "90vh" }}
          className="flex flex-col p-0 gap-0 bg-white border-0 shadow-2xl overflow-hidden rounded-2xl text-slate-900"
        >
          <DialogTitle className="sr-only">Detalle de Venta</DialogTitle>

          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={onFilesSelected} />

          {/* CABECERA MODAL */}
          <div className="px-8 py-6 border-b bg-slate-50/50 flex flex-row justify-between items-center shrink-0">
            <div className="flex items-center gap-6">
              <Avatar className="h-16 w-16 bg-white border-2 border-slate-200 shadow-sm text-slate-300">
                <AvatarFallback className="text-2xl font-black text-slate-400">{selectedSale?.name?.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-3xl font-black text-slate-800">{selectedSale?.name}</h2>
                <div className="flex gap-2 mt-2">
                  <Badge className={`border ${getPrepagaBadge(selectedSale?.prepaga)}`}>{selectedSale?.prepaga}</Badge>
                  <Badge variant="outline" className="bg-white text-slate-700">
                    {selectedSale?.plan}
                  </Badge>
                  {isPass(selectedSale) && (
                    <Badge className="bg-purple-100 text-purple-700 border border-purple-200 font-black uppercase">PASS</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`h-8 px-4 text-xs font-bold uppercase tracking-widest ${getAdminStatus(selectedSale?.status).color}`}>
                {getAdminStatus(selectedSale?.status).label}
              </Badge>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* COLUMNA IZQ: DATOS */}
            <ScrollArea className="w-[55%] border-r border-slate-100 bg-white shrink-0">
              <div className="p-8 space-y-8">
                <section className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex gap-2">
                    <User size={14} /> Datos Personales
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <ReadOnlyField label="DNI / CUIL" value={selectedSale?.dni} />
                    <ReadOnlyField label="Teléfono" value={selectedSale?.phone} />
                    <ReadOnlyField label="Email" value={selectedSale?.email} />
                    <ReadOnlyField label="Domicilio" value={selectedSale?.address_street} icon={<MapPin size={10} />} />
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex gap-2">
                    <DollarSign size={14} /> Económicos
                  </h4>
                  <div className="grid grid-cols-2 gap-6">
                    <ReadOnlyField
                      label="Precio Lista"
                      value={priceFormatter.format(selectedSale?.full_price || selectedSale?.price || 0)}
                      color="text-lg font-bold text-slate-800"
                    />
                    <ReadOnlyField label="Aportes" value={priceFormatter.format(selectedSale?.aportes || 0)} />
                  </div>
                </section>

                {selectedSale?.admin_notes && (
                  <section className="space-y-4 pt-4 border-t border-red-100">
                    <h4 className="text-xs font-black text-red-500 uppercase tracking-widest flex gap-2">
                      <AlertTriangle size={14} /> Notas de Administración
                    </h4>
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-800">
                      {typeof selectedSale.admin_notes === "string" ? selectedSale.admin_notes : "Ver historial"}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>

            {/* COLUMNA DERECHA */}
            <div className="flex-1 flex flex-col bg-slate-50/50">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <div className="px-8 pt-4 border-b bg-white">
                  <TabsList className="bg-transparent h-10 w-full justify-start gap-8 p-0">
                    <TabTrigger value="chat" label="Chat Admin" icon={<MessageSquare size={16} />} />
                    <TabTrigger value="files" label="Archivos" icon={<UploadCloud size={16} />} />
                  </TabsList>
                </div>

                <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
                  <ScrollArea
                    className="flex-1 p-8 bg-[#e5ddd5]"
                    style={{
                      backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')",
                      backgroundBlendMode: "overlay",
                    }}
                  >
                    <div className="space-y-4">
                      {chatMessages.map((msg: any, i: number) => (
                        <ChatBubble key={i} {...msg} />
                      ))}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>
                  <div className="p-4 bg-white border-t flex gap-3 shadow-lg z-10">
                    <Button variant="ghost" size="icon" onClick={handleUploadClick} className="text-slate-400 hover:text-slate-600">
                      <Paperclip size={20} />
                    </Button>
                    <Input
                      className="h-11 border-slate-200"
                      placeholder="Escribí un mensaje..."
                      value={chatMsg}
                      onChange={(e) => setChatMsg(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <Button size="icon" className="h-11 w-11 bg-blue-600 hover:bg-blue-700 shadow-md shrink-0" onClick={sendMessage}>
                      <Send size={20} />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="p-8 flex flex-col gap-4 m-0 h-full">
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={handleUploadClick}
                  >
                    <UploadCloud className="text-slate-400 mb-2" size={32} />
                    <p className="text-sm font-bold text-slate-600">{uploading ? "Subiendo..." : "Subir Archivos"}</p>
                    <p className="text-xs text-slate-400 mt-1">Fotos DNI, Recibos, Formularios</p>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">Archivos cargados ({docs.length})</div>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <ScrollArea className="h-[360px]">
                        <div className="p-4 space-y-3">
                          {docs.map((d: any) => {
                            const filename = d.name || (d.file_path || "").split("/").pop()
                            const url = d.file_path ? getPublicUrl(d.file_path) : "#"
                            return (
                              <div key={d.id} className="flex justify-between items-center p-3 rounded-lg border border-slate-200 hover:bg-blue-50 transition-colors">
                                <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-3 flex-1 min-w-0">
                                  <FileText className="text-blue-500 shrink-0" size={18} />
                                  <span className="text-sm font-bold text-slate-800 truncate">{filename}</span>
                                </a>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-slate-400 hover:text-red-500"
                                  onClick={() => handleDeleteFile(d)}
                                >
                                  <Trash2 size={16} />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
