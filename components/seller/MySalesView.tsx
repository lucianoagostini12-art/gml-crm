"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DollarSign, XCircle, AlertTriangle,
  Clock, MessageSquare, Send, User, MapPin, Paperclip,
  CheckCheck, StickyNote, UploadCloud, Calendar as CalendarIcon,
  FileUp, RefreshCw, CheckCircle2, ShieldCheck, Lock
} from "lucide-react"

// ✅ Storage config (no toca UI)
const STORAGE_BUCKET = "lead-documents"

// --- COMPONENTES UI INTERNOS ---

function TabTrigger({ value, label, icon }: any) {
  return (
    <TabsTrigger value={value} className="data-[state=active]:border-b-4 data-[state=active]:border-blue-600 rounded-none h-full px-4 gap-2 text-slate-400 text-xs font-black uppercase tracking-widest transition-all flex-1">
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

function ChatBubble({ user, text, time, isMe, type }: any) {
  return (
    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} mb-4 animate-in slide-in-from-bottom-2`}>
      <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-[13px] shadow-sm ${isMe ? "bg-blue-600 text-white rounded-br-none" : "bg-white border text-slate-700 rounded-bl-none"}`}>
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

// --- HELPERS DE ESTADO ---
const getAdminStatus = (status: string) => {
  switch (status?.toLowerCase()) {
    case "ingresado": return { label: "INGRESADO", color: "bg-slate-100 text-slate-600 border-slate-200", icon: <Clock className="w-3 h-3" /> }
    case "precarga": return { label: "EN PRECARGA", color: "bg-blue-50 text-blue-600 border-blue-200", icon: <FileUp className="w-3 h-3" /> }
    case "medicas": return { label: "AUD. MÉDICA", color: "bg-purple-50 text-purple-600 border-purple-200", icon: <ShieldCheck className="w-3 h-3" /> }
    case "legajo": return { label: "LEGAJO", color: "bg-yellow-50 text-yellow-600 border-yellow-200", icon: <Lock className="w-3 h-3" /> }
    case "cumplidas": return { label: "CUMPLIDA", color: "bg-green-100 text-green-700 border-green-200", icon: <CheckCircle2 className="w-3 h-3" /> }
    case "rechazado": return { label: "RECHAZADO", color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3 h-3" /> }
    case "demoras": return { label: "CON DEMORA", color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertTriangle className="w-3 h-3" /> }
    default: return { label: status?.toUpperCase(), color: "bg-gray-100 text-gray-600", icon: <Clock className="w-3 h-3" /> }
  }
}

interface MySalesViewProps {
  userName: string
  onLogout?: () => void
}

export function MySalesView({ userName, onLogout }: MySalesViewProps) {
  const supabase = createClient()
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("chat")
  const [chatMsg, setChatMsg] = useState("")

  // ✅ docs state (no toca UI)
  const [docs, setDocs] = useState<any[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [uploading, setUploading] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Scroll automático al abrir chat o enviar mensaje
  useEffect(() => {
    if (selectedSale && scrollRef.current) {
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    }
  }, [selectedSale?.chat, activeTab, selectedSale])

  // --- CARGA DE DATOS ---
  const fetchSales = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_name", userName) // Solo mis ventas
      .not("status", "in", '("nuevo","contactado","cotizacion")') // Solo las ingresadas como venta
      .order("last_update", { ascending: false })

    if (data) {
      // Mapeamos los comentarios de DB al formato del chat UI
      const mappedData = data.map((sale) => ({
        ...sale,
        chat: (sale.comments || []).map((c: any) => ({
          user: c.author,
          text: c.text,
          time: new Date(c.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isMe: c.author === userName,
          rawDate: c.date,
        })),
        adminNotes: sale.admin_notes || [],
      }))
      setSales(mappedData)

      // Si hay una seleccionada, actualizamos sus datos en tiempo real
      if (selectedSale) {
        const updatedSelected = mappedData.find((s) => s.id === selectedSale.id)
        if (updatedSelected) setSelectedSale(updatedSelected)
      }
    }
    setLoading(false)
  }

  // ✅ Traer documentos de la venta seleccionada
  const fetchDocs = async (leadId: string) => {
    setDocsLoading(true)
    const { data, error } = await supabase
      .from("lead_documents")
      .select("*")
      .eq("lead_id", leadId)
      .order("uploaded_at", { ascending: false })

    if (!error && data) setDocs(data)
    setDocsLoading(false)
  }

  useEffect(() => {
    fetchSales()

    const channel = supabase
      .channel("my_sales_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `agent_name=eq.${userName}` }, () => {
        fetchSales()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userName]) // Dependencia userName crítica

  // ✅ cuando cambia selectedSale, actualizo docs
  useEffect(() => {
    if (selectedSale?.id) fetchDocs(selectedSale.id)
    else setDocs([])
  }, [selectedSale?.id])

  // --- ACCIONES ---
  const sendMessage = async () => {
    if (!chatMsg.trim() || !selectedSale) return

    const newMessage = {
      text: chatMsg,
      author: userName,
      date: new Date().toISOString(),
    }

    // 1. Obtener comentarios actuales frescos de la DB para no pisar nada
    const { data: currentData } = await supabase.from("leads").select("comments").eq("id", selectedSale.id).single()
    const currentComments = currentData?.comments || []

    // 2. Agregar el nuevo
    const updatedComments = [...currentComments, newMessage]

    // 3. Guardar
    await supabase
      .from("leads")
      .update({
        comments: updatedComments,
        last_update: new Date().toISOString(),
      })
      .eq("id", selectedSale.id)

    setChatMsg("")
  }

  // ✅ Upload real a Storage + insert a lead_documents
  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!selectedSale?.id) return
      const files = e.target.files
      if (!files || files.length === 0) return

      setUploading(true)

      const { data: authData, error: authErr } = await supabase.auth.getUser()
      if (authErr || !authData?.user) {
        console.error("No auth user for upload", authErr)
        return
      }

      const leadId = selectedSale.id
      const uploaderId = authData.user.id

      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^\w.\-() ]+/g, "_")
        const path = `${leadId}/${Date.now()}-${safeName}`

        const { error: upErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        })

        if (upErr) {
          console.error("upload error:", upErr)
          continue
        }

        const { error: insErr } = await supabase.from("lead_documents").insert({
          lead_id: leadId,
          type: file.type || "file",
          file_path: path,
          uploaded_by: uploaderId,
          uploaded_at: new Date().toISOString(),
          status: "uploaded",
        })

        if (insErr) {
          console.error("insert lead_documents error:", insErr)
        }
      }

      // refresco lista
      await fetchDocs(selectedSale.id)

      // opcional: tocar last_update para que admin lo vea
      await supabase.from("leads").update({ last_update: new Date().toISOString() }).eq("id", selectedSale.id)
    } finally {
      setUploading(false)
      // reset input (para poder subir el mismo archivo de nuevo)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    return data.publicUrl
  }

  // Helper precio
  const priceFormatter = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })

  return (
    <div className="p-6 h-full overflow-y-auto w-full bg-white dark:bg-slate-950 text-slate-900">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-black flex items-center gap-2 text-slate-800">
            <DollarSign className="h-6 w-6 text-green-600" /> Mis Ventas Ingresadas
          </h2>
          <p className="text-slate-500 text-sm flex items-center gap-2">
            {loading ? (
              <span className="flex items-center gap-1">
                <RefreshCw className="animate-spin h-3 w-3" /> Sincronizando...
              </span>
            ) : (
              "Panel en tiempo real"
            )}
          </p>
        </div>
      </div>

      {/* LISTADO DE TARJETAS */}
      <div className="grid gap-4 pb-20">
        {sales.length === 0 && !loading && (
          <div className="text-center py-20 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No tenés ventas ingresadas aún.</p>
            <p className="text-xs text-slate-400 mt-1">Usá el botón "Cargar Venta" del menú lateral.</p>
          </div>
        )}

        {sales.map((sale) => {
          const adminStatus = getAdminStatus(sale.status)
          // Calculamos mensajes no leídos (si el último no soy yo)
          const lastMsg = sale.chat[sale.chat.length - 1]
          const hasNewMsg = lastMsg && !lastMsg.isMe
          const isRejected = sale.status === "rechazado" || sale.status === "demoras"

          return (
            <Card
              key={sale.id}
              onClick={() => setSelectedSale(sale)}
              className={`cursor-pointer hover:shadow-lg transition-all border-l-4 relative group ${isRejected ? "border-l-red-500 bg-red-50/10" : "border-l-blue-500"}`}
            >
              {hasNewMsg && (
                <span className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse z-10">
                  1
                </span>
              )}

              <CardContent className="p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h4 className="font-bold text-lg text-slate-800">
                    {sale.name || "Sin Nombre"} <Badge variant="secondary" className="text-[10px] ml-2">{sale.prepaga}</Badge>
                  </h4>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <CalendarIcon size={12} /> {new Date(sale.created_at).toLocaleDateString()}
                    </span>
                    {sale.sub_state && (
                      <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                        {sale.sub_state}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-xs font-black uppercase tracking-wider ${adminStatus.color}`}>
                  {adminStatus.icon} {adminStatus.label}
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

          {/* CABECERA MODAL */}
          <div className="px-8 py-6 border-b bg-slate-50/50 flex flex-row justify-between items-center shrink-0">
            <div className="flex items-center gap-6">
              <Avatar className="h-16 w-16 bg-white border-2 border-slate-200 shadow-sm text-slate-300">
                <AvatarFallback className="text-2xl font-black text-slate-400">
                  {selectedSale?.name?.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-3xl font-black text-slate-800">{selectedSale?.name}</h2>
                <div className="flex gap-2 mt-2">
                  <Badge className="bg-slate-900 text-white border-0">{selectedSale?.prepaga}</Badge>
                  <Badge variant="outline" className="bg-white text-slate-700">{selectedSale?.plan}</Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`h-8 px-4 text-xs font-bold uppercase tracking-widest ${getAdminStatus(selectedSale?.status).color}`}>
                {getAdminStatus(selectedSale?.status).label}
              </Badge>
              {selectedSale?.sub_state && (
                <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded border border-blue-100 mt-2 text-center">
                  {selectedSale?.sub_state}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* COLUMNA IZQ: DATOS (SOLO LECTURA) */}
            <ScrollArea className="w-[55%] border-r border-slate-100 bg-white shrink-0">
              <div className="p-8 space-y-8">
                {/* SECCION DATOS */}
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

                {/* SECCION ECONOMICOS */}
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

                {/* SECCION NOTAS ADMIN */}
                {selectedSale?.adminNotes?.length > 0 && (
                  <section className="space-y-4 pt-4 border-t border-red-100">
                    <h4 className="text-xs font-black text-red-500 uppercase tracking-widest flex gap-2">
                      <AlertTriangle size={14} /> Notas de Administración
                    </h4>
                    <div className="space-y-2">
                      {selectedSale.adminNotes.map((note: any, i: number) => (
                        <div key={i} className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-800">
                          <p>{note.text || note.action}</p>
                          <span className="text-[10px] opacity-70 font-bold mt-1 block">{note.user} • {note.date}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            </ScrollArea>

            {/* COLUMNA DER: CHAT INTERACTIVO */}
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
                      {selectedSale?.chat.length === 0 && (
                        <div className="text-center p-4 bg-white/80 rounded-lg text-xs text-slate-500 shadow-sm mx-auto w-fit">
                          Inicio del chat con Administración
                        </div>
                      )}
                      {selectedSale?.chat.map((msg: any, i: number) => <ChatBubble key={i} {...msg} />)}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>

                  <div className="p-4 bg-white border-t flex gap-3 shadow-lg z-10">
                    {/* ✅ ahora sí abre el file picker y sube real (mismo ícono y layout) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-slate-400 hover:text-slate-600"
                      title="Adjuntar archivos"
                      disabled={uploading}
                    >
                      <Paperclip size={20} />
                    </Button>

                    {/* ✅ input real (se usa en chat y en files tab) */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={onFilesSelected}
                    />

                    <Input
                      className="h-11 border-slate-200 focus-visible:ring-blue-500"
                      placeholder="Escribí un mensaje..."
                      value={chatMsg}
                      onChange={(e) => setChatMsg(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    />

                    <Button
                      size="icon"
                      className="h-11 w-11 bg-blue-600 hover:bg-blue-700 shadow-md shrink-0"
                      onClick={sendMessage}
                    >
                      <Send size={20} />
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="files" className="p-8 flex flex-col gap-4 m-0 h-full">
                  {/* ✅ MISMA CAJA, ahora sube real */}
                  <div
                    className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <UploadCloud className="text-slate-400 mb-2" size={32} />
                    <p className="text-sm font-bold text-slate-600">
                      {uploading ? "Subiendo..." : "Subir Archivos"}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Fotos DNI, Recibos, Formularios</p>
                  </div>

                  {/* ✅ LISTA de archivos (sin romper visual) */}
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                      Archivos cargados
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <ScrollArea className="h-[360px]">
                        <div className="p-4 space-y-3">
                          {docsLoading ? (
                            <div className="text-center text-xs text-slate-400 py-6">Cargando archivos...</div>
                          ) : docs.length === 0 ? (
                            <div className="text-center text-xs text-slate-400 py-6">Todavía no hay archivos.</div>
                          ) : (
                            docs.map((d: any) => {
                              const filename = (d.file_path || "").split("/").pop()
                              const created = d.uploaded_at ? new Date(d.uploaded_at).toLocaleString("es-AR") : ""
                              const url = d.file_path ? getPublicUrl(d.file_path) : "#"

                              return (
                                <a
                                  key={d.id}
                                  href={url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block p-3 rounded-lg border border-slate-200 hover:bg-blue-50 transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-slate-800 truncate">
                                        {filename || "Archivo"}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-bold mt-1">
                                        {created}
                                      </div>
                                    </div>
                                    <div className="shrink-0 text-[10px] font-black px-2 py-1 rounded bg-slate-100 text-slate-600">
                                      VER
                                    </div>
                                  </div>
                                </a>
                              )
                            })
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    <p className="text-center text-[10px] text-slate-400 mt-3">
                      Tip: podés adjuntar desde el clip del chat o desde esta pestaña.
                    </p>
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
