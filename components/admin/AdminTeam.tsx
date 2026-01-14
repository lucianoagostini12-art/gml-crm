"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Eye, Activity, Megaphone, X, Clock, Pencil, Save, UserCog, Send, MessageSquare, DollarSign, FileText, User, CalendarDays } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogHeader, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

// --- COLUMNAS DEL VENDEDOR (IGUAL QUE EN KANBANBOARD) ---
const SELLER_COLUMNS = [
  { id: "nuevo", title: "Sin Trabajar 📥", color: "border-t-slate-400" }, 
  { id: "contactado", title: "En Contacto 📞", color: "border-t-blue-500" },
  { id: "cotizacion", title: "Cotizando 💲", color: "border-t-yellow-500" },
  { id: "documentacion", title: "Documentación 📂", color: "border-t-purple-500" },
]

// ✅ COLORES DE PREPAGAS (IGUAL A LOS QUE PEDISTE)
const getPrepagaBadgeColor = (prepaga?: string | null) => {
  if (!prepaga) return "bg-slate-100 text-slate-600 border-slate-200"
  const p = prepaga

  if (p.includes("Prevención") || p.includes("Prevencion")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
  if (p.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
  if (p.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
  if (p.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
  if (p.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
  if (p.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"

  return "bg-slate-100 text-slate-800 border-slate-200"
}

export function AdminTeam() {
  const supabase = createClient()

  // Estados Principales
  const [salesAgents, setSalesAgents] = useState<any[]>([])
  const [staffMembers, setStaffMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Estados de Modales y Espionaje
  const [spyAgent, setSpyAgent] = useState<any>(null)
  const [spyLeads, setSpyLeads] = useState<any[]>([]) // Leads en tiempo real

  const [selectedLead, setSelectedLead] = useState<any>(null)
  const [messageModalOpen, setMessageModalOpen] = useState(false)
  const [urgentMessage, setUrgentMessage] = useState("")

  // Estado Edición Staff
  const [editingMember, setEditingMember] = useState<any>(null)
  const [editForm, setEditForm] = useState({ full_name: "", role: "", email: "" })

  // Estado Chat Lead (NUEVO SISTEMA)
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // --- 1. CARGA DE EQUIPO ---
  const fetchTeam = async () => {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*')
    // Solo para estadísticas iniciales
    const { data: leads } = await supabase.from('leads').select('id, agent_name, status, created_at, last_update')

    if (profiles && leads) {
      const now = new Date()

      // Mapeo Vendedores
      const sellers = profiles
        .filter((u:any) => u.role === 'seller' || u.role === 'gestor')
        .map((u:any) => {
          const myLeads = leads.filter((l:any) => l.agent_name === u.full_name)
          const sales = myLeads.filter((l:any) => ['vendido', 'cumplidas'].includes(l.status?.toLowerCase())).length
          const active = myLeads.filter((l:any) => !['vendido', 'cumplidas', 'perdido', 'rechazado'].includes(l.status?.toLowerCase())).length

          const lastActionTime = myLeads.length > 0 ? Math.max(...myLeads.map((l:any) => new Date(l.last_update).getTime())) : 0
          const isOnline = lastActionTime > 0 && (now.getTime() - lastActionTime) < 15 * 60 * 1000

          return {
            id: u.id,
            name: u.full_name || u.email,
            role: u.role === 'seller' ? 'Vendedora' : 'Gestora',
            status: isOnline ? 'online' : 'offline',
            salesMonth: sales,
            leadsActive: active,
            conversion: active > 0 ? Math.round((sales / (sales + active)) * 100) + '%' : '0%',
            avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`
          }
        })
      setSalesAgents(sellers)

      // Mapeo Staff
      const staff = profiles
        .filter((u:any) => u.role !== 'seller' && u.role !== 'gestor')
        .map((u:any) => ({
          id: u.id,
          name: u.full_name || 'Admin',
          role: u.role,
          email: u.email,
          avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`
        }))
      setStaffMembers(staff)
    }
    setLoading(false)
  }

  useEffect(() => { fetchTeam() }, [])

  // --- 2. ESPIAR TABLERO (REALTIME) ---
  const handleSpy = async (agent: any) => {
    setSpyAgent(agent)
    // Carga inicial
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('agent_name', agent.name)
      .not('status', 'in', '("vendido","perdido","rechazado","baja")')

    if (data) setSpyLeads(data)
  }

  // Suscripción Realtime al Tablero del Agente Espiado
  useEffect(() => {
    if (!spyAgent) return

    const channel = supabase.channel(`spy_dashboard_${spyAgent.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
        filter: `agent_name=eq.${spyAgent.name}`
      }, (payload) => {
        // Actualizamos la lista local en vivo
        if (payload.eventType === 'INSERT') {
          setSpyLeads(prev => [...prev, payload.new])
        } else if (payload.eventType === 'UPDATE') {
          const updated: any = payload.new
          // Si cambió a estado final, lo sacamos, sino lo actualizamos
          if (['vendido', 'perdido', 'rechazado'].includes(String(updated.status || '').toLowerCase())) {
            setSpyLeads(prev => prev.filter(l => l.id !== updated.id))
          } else {
            setSpyLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
          }
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [spyAgent])

  // --- 3. CHAT UNIFICADO (REALTIME) ---
  useEffect(() => {
    if (!selectedLead) {
      setChatMessages([])
      return
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from('lead_messages')
        .select('*')
        .eq('lead_id', selectedLead.id)
        .order('created_at', { ascending: true })

      if (data) setChatMessages(data)
    }
    fetchMessages()

    const chatChannel = supabase.channel(`lead_chat_${selectedLead.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'lead_messages',
        filter: `lead_id=eq.${selectedLead.id}`
      }, (payload) => {
        setChatMessages(prev => [...prev, payload.new])
        // Scroll al fondo
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()

    return () => { supabase.removeChannel(chatChannel) }

  }, [selectedLead])

  // --- 4. ACCIONES ---

  // Enviar comunicado (alerta en pantalla del vendedor)
  const sendUrgentMessage = async () => {
    if (!spyAgent || !urgentMessage) return
    await supabase.from('profiles').update({ urgent_message: urgentMessage }).eq('id', spyAgent.id)
    setUrgentMessage(""); setMessageModalOpen(false)
    alert(`📢 Enviado a ${spyAgent.name}`)
  }

  // Enviar mensaje al chat unificado
  const sendLeadComment = async () => {
    if (!selectedLead || !chatMessage.trim()) return

    await supabase.from('lead_messages').insert({
      lead_id: selectedLead.id,
      sender: 'Supervisión',
      text: chatMessage,
      target_role: 'seller' // Para que le llegue la notificación al vendedor
    })

    setChatMessage("")
  }

  // Editar staff
  const openEditStaff = (member: any) => {
    setEditingMember(member)
    setEditForm({ full_name: member.name, role: member.role, email: member.email })
  }

  const saveStaffChanges = async () => {
    if (!editingMember) return
    const { error } = await supabase.from('profiles').update({ full_name: editForm.full_name, role: editForm.role }).eq('id', editingMember.id)
    if (!error) { fetchTeam(); setEditingMember(null) }
    else { alert("Error al actualizar perfil.") }
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Activity className="animate-spin mr-2" /> Cargando Equipo...</div>

  return (
    <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" /> Gestión de Personas
          </h2>
          <p className="text-slate-500">Monitoreo en vivo y administración de perfiles.</p>
        </div>
      </div>

      <Tabs defaultValue="sales" className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2 mb-6">
          <TabsTrigger value="sales">💼 Fuerza de Ventas ({salesAgents.length})</TabsTrigger>
          <TabsTrigger value="staff">🛡️ Staff ({staffMembers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {salesAgents.map((agent, i) => (
              <Card key={i} className="overflow-hidden hover:shadow-lg transition-all border-t-4 border-t-transparent hover:border-t-blue-600 group">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-16 w-16 border-4 border-white shadow-sm">
                          <AvatarImage src={agent.avatar} className="object-cover" />
                          <AvatarFallback>{agent.name[0]}</AvatarFallback>
                        </Avatar>
                        <span className={`absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white ${agent.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">{agent.name}</h3>
                        <Badge variant="secondary" className="mt-1">{agent.role}</Badge>
                      </div>
                    </div>
                    <Button size="icon" variant="outline" className="rounded-full" onClick={() => handleSpy(agent)}>
                      <Eye className="h-5 w-5 text-slate-600" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-slate-100">
                    <div className="text-center"><span className="block text-2xl font-black">{agent.salesMonth}</span><span className="text-[10px] uppercase font-bold text-slate-400">Ventas</span></div>
                    <div className="text-center border-l"><span className="block text-2xl font-black">{agent.leadsActive}</span><span className="text-[10px] uppercase font-bold text-slate-400">Activos</span></div>
                    <div className="text-center border-l"><span className="block text-2xl font-black text-green-600">{agent.conversion}</span><span className="text-[10px] uppercase font-bold text-slate-400">Conv.</span></div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <Activity className={`h-4 w-4 ${agent.status === 'online' ? 'text-green-500' : 'text-slate-300'}`} />
                    <span>{agent.status === 'online' ? 'Trabajando ahora' : 'Desconectada'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="staff">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {staffMembers.map((member, i) => (
              <Card key={i} className="border-l-4 border-l-slate-500 p-6 flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={member.avatar} className="object-cover" />
                    <AvatarFallback>{member.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold">{member.name}</h3>
                    <div className="flex gap-2 items-center">
                      <Badge variant="outline" className="text-[10px]">{member.role}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{member.email}</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-blue-600" onClick={() => openEditStaff(member)}>
                  <Pencil className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- MODAL EDITAR STAFF --- */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5" /> Editar Perfil</DialogTitle>
            <DialogDescription>Modificá los datos del miembro del equipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex justify-center mb-4">
              <Avatar className="h-20 w-20 border-4 border-slate-100">
                <AvatarImage src={editingMember?.avatar} className="object-cover" />
                <AvatarFallback>ED</AvatarFallback>
              </Avatar>
            </div>
            <div className="space-y-2">
              <Label>Nombre Completo</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Rol (Permisos)</Label>
              <Input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} placeholder="admin, seller, gestor..." />
            </div>
            <div className="space-y-2">
              <Label>Email (ID de Avatar)</Label>
              <Input value={editForm.email} disabled className="bg-slate-100 text-slate-500" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button>
            <Button onClick={saveStaffChanges} className="gap-2"><Save className="h-4 w-4" /> Guardar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- MODAL ESPIAR (ACTUALIZADO CON SCROLL HABILITADO) --- */}
      <Dialog open={!!spyAgent} onOpenChange={() => setSpyAgent(null)}>
        <DialogContent
          style={{ maxWidth: '1400px', width: '95vw', height: '90vh' }}
          className="flex flex-col p-0 gap-0 border-none bg-[#F8F9FA] overflow-hidden"
        >
          {spyAgent && (
            <>
              <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-blue-100 shadow-sm">
                    <AvatarImage src={spyAgent.avatar} className="object-cover" />
                    <AvatarFallback>{spyAgent.name[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
                      TABLERO DE {spyAgent.name.toUpperCase()}
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                      <Badge className={`${spyAgent.status === 'online' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 'bg-red-100 text-red-700 hover:bg-red-100'} border-0`}>
                        {spyAgent.status === 'online' ? '● LIVE' : '● OFFLINE'}
                      </Badge>
                      <span className="text-xs text-slate-400">Vista de Supervisor</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-2 font-bold" onClick={() => setMessageModalOpen(true)}>
                    <Megaphone className="h-4 w-4" /> Enviar Alerta
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setSpyAgent(null)} className="h-9 w-9 rounded-full hover:bg-slate-100"><X className="h-5 w-5 text-slate-500" /></Button>
                </div>
              </div>

              {/* ✅ Scroll real habilitado (min-h-0 para que el ScrollArea pueda scrollear en flex) */}
              <ScrollArea className="flex-1 min-h-0 w-full bg-slate-100/50">
                <div className="flex gap-6 p-8 min-w-[1200px] h-full items-start">
                  {SELLER_COLUMNS.map(col => {
                    const colLeads = spyLeads.filter((l: any) => String(l.status || '').toLowerCase() === col.id)
                    return (
                      <div key={col.id} className="flex-1 min-w-[300px] max-w-[350px] flex flex-col gap-3">
                        <div className={`bg-white px-4 py-3 rounded-xl border-t-4 ${col.color} shadow-sm flex justify-between items-center border-x border-b border-slate-100`}>
                          <span className="font-black text-xs uppercase tracking-wider text-slate-700">{col.title}</span>
                          <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0">{colLeads.length}</Badge>
                        </div>
                        <div className="space-y-3 pb-20">
                          {colLeads.map((lead: any) => {
                            const prepaga = lead.prepaga || lead.quoted_prepaga
                            const plan = lead.plan || lead.quoted_plan

                            return (
                              <div
                                key={lead.id}
                                onClick={() => setSelectedLead(lead)}
                                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 hover:shadow-md cursor-pointer transition-all hover:scale-[1.02] group relative overflow-hidden"
                              >
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-100 group-hover:bg-blue-400 transition-colors"></div>
                                <div className="pl-2">
                                  <div className="flex justify-between items-start mb-2">
                                    <p className="font-bold text-sm text-slate-800 line-clamp-1">{lead.name}</p>
                                  </div>

                                  {/* ✅ PREPAGA con colores como pediste */}
                                  {(prepaga || plan) && (
                                    <div className="mb-3 flex flex-col gap-1">
                                      {prepaga && (
                                        <Badge variant="outline" className={getPrepagaBadgeColor(prepaga)}>
                                          {prepaga}
                                        </Badge>
                                      )}
                                      {plan && (
                                        <div className="text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                          {plan}
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50">
                                    {/* AGENDA VISIBLE */}
                                    {lead.scheduled_for ? (
                                      <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded-full">
                                        <CalendarDays className="h-3 w-3" />
                                        {new Date(lead.scheduled_for).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}{" "}
                                        {new Date(lead.scheduled_for).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> {lead.last_update ? new Date(lead.last_update).toLocaleDateString() : "-"}
                                      </span>
                                    )}

                                    {col.id === 'cotizacion' && (
                                      <span className="text-xs font-black text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                                        $ {lead.quoted_price || '-'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL COMUNICADO */}
      <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogTitle className="flex items-center gap-2 text-orange-600"><Megaphone className="h-5 w-5" /> Enviar Alerta Bloqueante</DialogTitle>
          <p className="text-sm text-slate-500">Este mensaje aparecerá en la pantalla de <b>{spyAgent?.name}</b> y no podrá operar hasta que lo cierre.</p>
          <Textarea placeholder="Mensaje urgente..." value={urgentMessage} onChange={(e) => setUrgentMessage(e.target.value)} className="min-h-[100px]" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMessageModalOpen(false)}>Cancelar</Button>
            <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={sendUrgentMessage}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FICHA LEAD (CHAT UNIFICADO + DETALLE PREMIUM) */}
      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        {/* ✅ Scroll habilitado + min-h-0 para que los ScrollArea internos funcionen siempre */}
        <SheetContent className="sm:max-w-[500px] flex flex-col p-0 w-full overflow-hidden" style={{ maxWidth: '500px' }}>
          {selectedLead && (
            <>
              <div className="p-6 pb-4 border-b bg-slate-50 shrink-0">
                <SheetHeader>
                  <SheetTitle className="text-2xl font-black text-slate-800">{selectedLead.name}</SheetTitle>

                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge variant="outline" className="bg-white">{selectedLead.source || 'Sin origen'}</Badge>
                    <Badge className="capitalize bg-slate-800">{selectedLead.status}</Badge>

                    {/* ✅ Prepaga con color cuando existe cotización */}
                    {(selectedLead.prepaga || selectedLead.quoted_prepaga) && (
                      <Badge variant="outline" className={getPrepagaBadgeColor(selectedLead.prepaga || selectedLead.quoted_prepaga)}>
                        {selectedLead.prepaga || selectedLead.quoted_prepaga}
                      </Badge>
                    )}
                  </div>

                  <SheetDescription className="hidden" />
                </SheetHeader>
              </div>

              <Tabs defaultValue="chat" className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <TabsList className="w-full rounded-none border-b bg-white h-12 shrink-0">
                  <TabsTrigger value="info" className="flex-1 h-full data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Ficha Técnica</TabsTrigger>
                  <TabsTrigger value="chat" className="flex-1 h-full data-[state=active]:border-b-2 data-[state=active]:border-blue-600 rounded-none">Chat Supervisión</TabsTrigger>
                </TabsList>

                {/* CONTENIDO DETALLADO */}
                <TabsContent value="info" className="flex-1 min-h-0 p-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-6 space-y-8">
                      {/* SECCIÓN 1: COTIZACIÓN */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <DollarSign className="h-4 w-4" /> Detalle de Cotización
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Prepaga</p>
                            <div className="flex items-start">
                              <Badge variant="outline" className={getPrepagaBadgeColor(selectedLead.prepaga || selectedLead.quoted_prepaga || null)}>
                                {selectedLead.prepaga || selectedLead.quoted_prepaga || '—'}
                              </Badge>
                            </div>
                          </div>
                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Plan</p>
                            <p className="font-bold text-slate-800 text-sm">{selectedLead.plan || selectedLead.quoted_plan || '—'}</p>
                          </div>
                          <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm col-span-2 flex justify-between items-center">
                            <div>
                              <p className="text-[10px] font-bold text-green-600 uppercase">Precio Cotizado</p>
                              <p className="text-xs text-green-500 font-medium">Valor mensual</p>
                            </div>
                            <p className="text-3xl font-black text-green-700 tracking-tight">
                              $ {selectedLead.quoted_price || selectedLead.price || '0'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* SECCIÓN 2: DATOS DEL CLIENTE */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <User className="h-4 w-4" /> Datos Personales
                        </h4>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                          <div className="p-3 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-bold text-slate-500">DNI / CUIT</span>
                            <span className="text-xs font-bold font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded">{selectedLead.dni || selectedLead.cuit || '—'}</span>
                          </div>
                          <div className="p-3 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-bold text-slate-500">Email</span>
                            <span className="text-xs font-medium text-slate-800">{selectedLead.email || '—'}</span>
                          </div>
                          <div className="p-3 border-b border-slate-100 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-bold text-slate-500">Teléfono</span>
                            <span className="text-xs font-bold font-mono text-slate-800 bg-slate-100 px-2 py-1 rounded">{selectedLead.phone || '—'}</span>
                          </div>
                          <div className="p-3 flex justify-between items-center hover:bg-slate-50 transition-colors">
                            <span className="text-xs font-bold text-slate-500">Edad / Nac.</span>
                            <span className="text-xs font-bold text-slate-800">{selectedLead.dob || '—'}</span>
                          </div>
                        </div>
                      </div>

                      {/* SECCIÓN 3: GRUPO FAMILIAR */}
                      {(selectedLead.family_members?.length > 0 || selectedLead.hijos?.length > 0) && (
                        <>
                          <Separator />
                          <div className="space-y-3">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                              <Users className="h-4 w-4" /> Grupo Familiar
                            </h4>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                  <tr>
                                    <th className="text-left p-2 font-bold text-slate-500">Nombre</th>
                                    <th className="text-right p-2 font-bold text-slate-500">Edad/DNI</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(selectedLead.family_members || selectedLead.hijos).map((f: any, idx: number) => (
                                    <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                                      <td className="p-2 font-bold text-slate-700">{f.name || f.nombre}</td>
                                      <td className="p-2 text-right font-mono text-slate-500">{f.dni || f.edad}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </>
                      )}

                      <Separator />

                      {/* SECCIÓN 4: NOTAS */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                          <FileText className="h-4 w-4" /> Notas del Vendedor
                        </h4>
                        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 text-sm text-slate-700 italic leading-relaxed shadow-sm">
                          {selectedLead.notes ? `"${selectedLead.notes}"` : "Sin observaciones registradas."}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="chat" className="flex-1 min-h-0 flex flex-col p-0 overflow-hidden">
                  <ScrollArea className="flex-1 min-h-0 p-4 bg-slate-100">
                    <div className="space-y-4">
                      {chatMessages.length === 0 ? (
                        <div className="text-center text-xs text-slate-400 py-20 opacity-50 flex flex-col items-center gap-2">
                          <MessageSquare size={40} className="text-slate-300" />
                          Inicia el chat con el vendedor.
                        </div>
                      ) : (
                        chatMessages.map((msg: any, i: number) => (
                          <div key={i} className={`flex flex-col ${msg.sender === 'Supervisión' ? 'items-end' : 'items-start'} animate-in slide-in-from-bottom-2`}>
                            <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.sender === 'Supervisión' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-200 rounded-bl-none text-slate-700'}`}>
                              {msg.text}
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 font-bold px-1">
                              {msg.sender === 'Supervisión' ? 'Vos' : msg.sender} • {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                      <div ref={scrollRef} />
                    </div>
                  </ScrollArea>

                  <div className="p-4 border-t bg-white flex gap-2 shrink-0 shadow-[0_-5px_10px_rgba(0,0,0,0.05)] z-20">
                    <Input
                      className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      placeholder="Escribí un mensaje..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendLeadComment()}
                    />
                    <Button size="icon" onClick={sendLeadComment} className="bg-blue-600 hover:bg-blue-700 shadow-md transition-transform active:scale-95">
                      <Send className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
