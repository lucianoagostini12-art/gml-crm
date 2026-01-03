"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Eye, Mail, Activity, Megaphone, X, Clock, Pencil, Save, UserCog } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogFooter, DialogHeader, DialogDescription } from "@/components/ui/dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatDistanceToNow } from "date-fns"
import { es } from "date-fns/locale"

// --- COLUMNAS DEL VENDEDOR ---
const SELLER_COLUMNS = [
  { id: "nuevo", title: "Sin Trabajar 📥", color: "border-t-slate-400" }, 
  { id: "contactado", title: "En Contacto 📞", color: "border-t-blue-500" },
  { id: "cotizacion", title: "Cotizando 💲", color: "border-t-yellow-500" },
  { id: "documentacion", title: "Documentación 📂", color: "border-t-purple-500" },
]

export function AdminTeam() {
    const supabase = createClient()
    
    // Estados Principales
    const [salesAgents, setSalesAgents] = useState<any[]>([])
    const [staffMembers, setStaffMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Estados de Modales
    const [spyAgent, setSpyAgent] = useState<any>(null)
    const [selectedLead, setSelectedLead] = useState<any>(null)
    const [messageModalOpen, setMessageModalOpen] = useState(false)
    const [urgentMessage, setUrgentMessage] = useState("")
    
    // Estado Edición Staff
    const [editingMember, setEditingMember] = useState<any>(null)
    const [editForm, setEditForm] = useState({ full_name: "", role: "", email: "" })

    // Estado Chat Lead
    const [chatMessage, setChatMessage] = useState("")

    // --- 1. CARGA DE EQUIPO ---
    const fetchTeam = async () => {
        setLoading(true)
        const { data: profiles } = await supabase.from('profiles').select('*')
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
                        avatarSeed: u.email
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
                    avatarSeed: u.email // Usamos email o nombre para generar la cara
                }))
            setStaffMembers(staff)
        }
        setLoading(false)
    }

    useEffect(() => { fetchTeam() }, [])

    // --- 2. ESPIAR TABLERO ---
    const handleSpy = async (agent: any) => {
        const { data: agentLeads } = await supabase
            .from('leads')
            .select('*')
            .eq('agent_name', agent.name)
            .not('status', 'in', '("vendido","perdido","rechazado","baja")')

        if (agentLeads) {
            setSpyAgent({ ...agent, leads: agentLeads })
        }
    }

    // --- 3. ENVIAR COMUNICADO ---
    const sendUrgentMessage = async () => {
        if (!spyAgent || !urgentMessage) return
        await supabase.from('profiles').update({ urgent_message: urgentMessage }).eq('id', spyAgent.id)
        setUrgentMessage(""); setMessageModalOpen(false)
        alert(`📢 Enviado a ${spyAgent.name}`)
    }

    // --- 4. CHAT LEAD ---
    const sendLeadComment = async () => {
        if (!selectedLead || !chatMessage.trim()) return
        const newComment = { author: 'Admin', text: chatMessage, date: new Date().toISOString(), role: 'admin' }
        const currentComments = selectedLead.comments || []
        const updatedComments = [...currentComments, newComment]

        const { error } = await supabase.from('leads').update({ comments: updatedComments }).eq('id', selectedLead.id)
        if (!error) {
            setSelectedLead({ ...selectedLead, comments: updatedComments })
            setChatMessage("")
        }
    }

    // --- 5. EDITAR STAFF ---
    const openEditStaff = (member: any) => {
        setEditingMember(member)
        setEditForm({ full_name: member.name, role: member.role, email: member.email })
    }

    const saveStaffChanges = async () => {
        if (!editingMember) return
        
        const { error } = await supabase
            .from('profiles')
            .update({ full_name: editForm.full_name, role: editForm.role }) // Email suele ser inmutable en Auth, solo cambiamos display
            .eq('id', editingMember.id)

        if (!error) {
            fetchTeam() // Recargar lista
            setEditingMember(null)
        } else {
            alert("Error al actualizar perfil.")
        }
    }

    if (loading) return <div className="flex h-full items-center justify-center"><Activity className="animate-spin mr-2"/> Cargando Equipo...</div>

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
                                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.avatarSeed}`} />
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
                                            <Eye className="h-5 w-5 text-slate-600"/>
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-slate-100">
                                        <div className="text-center"><span className="block text-2xl font-black">{agent.salesMonth}</span><span className="text-[10px] uppercase font-bold text-slate-400">Ventas</span></div>
                                        <div className="text-center border-l"><span className="block text-2xl font-black">{agent.leadsActive}</span><span className="text-[10px] uppercase font-bold text-slate-400">Activos</span></div>
                                        <div className="text-center border-l"><span className="block text-2xl font-black text-green-600">{agent.conversion}</span><span className="text-[10px] uppercase font-bold text-slate-400">Conv.</span></div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                                        <Activity className={`h-4 w-4 ${agent.status === 'online' ? 'text-green-500' : 'text-slate-300'}`}/>
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
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.avatarSeed}`} />
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><UserCog className="h-5 w-5"/> Editar Perfil</DialogTitle>
                        <DialogDescription>Modificá los datos del miembro del equipo.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex justify-center mb-4">
                            <Avatar className="h-20 w-20 border-4 border-slate-100">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${editForm.email}`} />
                            </Avatar>
                        </div>
                        <div className="space-y-2">
                            <Label>Nombre Completo</Label>
                            <Input value={editForm.full_name} onChange={(e) => setEditForm({...editForm, full_name: e.target.value})} />
                        </div>
                        <div className="space-y-2">
                            <Label>Rol (Permisos)</Label>
                            <Input value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} placeholder="admin, seller, gestor..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Email (ID de Avatar)</Label>
                            <Input value={editForm.email} disabled className="bg-slate-100 text-slate-500" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingMember(null)}>Cancelar</Button>
                        <Button onClick={saveStaffChanges} className="gap-2"><Save className="h-4 w-4"/> Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* --- MODAL ESPIAR (TABLERO LIVE) --- */}
            <Dialog open={!!spyAgent} onOpenChange={() => setSpyAgent(null)}>
                <DialogContent className="max-w-[98vw] h-[90vh] flex flex-col bg-[#F8F9FA] p-0 overflow-hidden border-none">
                    {spyAgent && (
                        <>
                            <div className="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-10">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-10 w-10 border">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${spyAgent.avatarSeed}`} />
                                    </Avatar>
                                    <div>
                                        <DialogTitle className="text-lg font-black flex items-center gap-2">
                                            TABLERO DE {spyAgent.name.toUpperCase()}
                                            <Badge className={`${spyAgent.status === 'online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {spyAgent.status === 'online' ? '● LIVE' : '● OFFLINE'}
                                            </Badge>
                                        </DialogTitle>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* MEGÁFONO MINIMALISTA */}
                                    <Button size="icon" variant="outline" className="text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => setMessageModalOpen(true)}>
                                        <Megaphone className="h-5 w-5" />
                                    </Button>
                                    <Button variant="ghost" onClick={() => setSpyAgent(null)}><X className="h-6 w-6 text-slate-400 hover:text-slate-800"/></Button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 w-full bg-slate-100">
                                <div className="flex gap-4 p-6 min-w-[1200px] h-full">
                                    {SELLER_COLUMNS.map(col => {
                                        const colLeads = spyAgent.leads.filter((l:any) => l.status === col.id)
                                        return (
                                            <div key={col.id} className="flex-1 min-w-[280px] max-w-[320px] flex flex-col gap-3">
                                                <div className={`bg-white p-3 rounded-t-lg border-t-4 ${col.color} shadow-sm flex justify-between`}>
                                                    <span className="font-bold text-xs uppercase text-slate-600">{col.title}</span>
                                                    <Badge variant="secondary">{colLeads.length}</Badge>
                                                </div>
                                                <div className="space-y-3 pb-10">
                                                    {colLeads.map((lead:any) => (
                                                        <div key={lead.id} onClick={() => setSelectedLead(lead)} className="bg-white p-3 rounded-lg shadow-sm border border-slate-100 hover:shadow-md cursor-pointer transition-all hover:scale-[1.02]">
                                                            <div className="flex justify-between items-start mb-2"><p className="font-bold text-sm text-slate-800 line-clamp-1">{lead.name}</p></div>
                                                            <div className="flex justify-between items-center mt-2 border-t pt-2 border-slate-50">
                                                                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1"><Clock className="h-3 w-3"/> {new Date(lead.last_update).toLocaleDateString()}</span>
                                                                {col.id === 'cotizacion' && <span className="text-[10px] font-bold text-green-600">$ {lead.quoted_price || '-'}</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* MODAL COMUNICADO */}
            <Dialog open={messageModalOpen} onOpenChange={setMessageModalOpen}>
                <DialogContent>
                    <DialogTitle className="flex items-center gap-2 text-orange-600"><Megaphone className="h-5 w-5"/> Enviar Alerta Bloqueante</DialogTitle>
                    <p className="text-sm text-slate-500">Este mensaje aparecerá en la pantalla de <b>{spyAgent?.name}</b> y no podrá operar hasta que lo cierre.</p>
                    <Textarea placeholder="Mensaje urgente..." value={urgentMessage} onChange={(e) => setUrgentMessage(e.target.value)} className="min-h-[100px]"/>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMessageModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={sendUrgentMessage}>Enviar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* FICHA LEAD (CHAT) */}
            <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
                <SheetContent className="sm:max-w-[500px] flex flex-col p-0">
                    {selectedLead && (
                        <>
                            <div className="p-6 pb-4 border-b bg-slate-50">
                                <SheetHeader>
                                    <SheetTitle className="text-xl font-black">{selectedLead.name}</SheetTitle>
                                    <SheetDescription className="flex gap-2"><Badge variant="outline">{selectedLead.source || 'Sin origen'}</Badge><Badge>{selectedLead.status}</Badge></SheetDescription>
                                </SheetHeader>
                            </div>
                            <Tabs defaultValue="info" className="flex-1 flex flex-col">
                                <TabsList className="w-full rounded-none border-b bg-white"><TabsTrigger value="info" className="flex-1">Datos</TabsTrigger><TabsTrigger value="chat" className="flex-1">Chat Admin</TabsTrigger></TabsList>
                                <TabsContent value="info" className="flex-1 p-6 space-y-4">
                                    <div className="bg-white p-3 rounded border"><p className="text-xs font-bold text-slate-400 uppercase">Teléfono</p><p className="font-mono text-lg">{selectedLead.phone || '-'}</p></div>
                                    <div className="bg-white p-3 rounded border"><p className="text-xs font-bold text-slate-400 uppercase">Notas</p><p className="text-sm italic">{selectedLead.notes || 'Sin notas'}</p></div>
                                </TabsContent>
                                <TabsContent value="chat" className="flex-1 flex flex-col p-0 h-full">
                                    <ScrollArea className="flex-1 p-4 bg-slate-50">
                                        <div className="space-y-4">
                                            {selectedLead.comments?.map((comment: any, i: number) => (
                                                <div key={i} className={`flex flex-col ${comment.role === 'admin' ? 'items-end' : 'items-start'}`}>
                                                    <div className={`max-w-[80%] p-3 rounded-lg text-sm ${comment.role === 'admin' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none'}`}>{comment.text}</div>
                                                    <span className="text-[10px] text-slate-400 mt-1">{comment.author} • {formatDistanceToNow(new Date(comment.date), { addSuffix: true, locale: es })}</span>
                                                </div>
                                            ))}
                                            {(!selectedLead.comments || selectedLead.comments.length === 0) && <p className="text-center text-xs text-slate-400 py-10">No hay mensajes en este lead.</p>}
                                        </div>
                                    </ScrollArea>
                                    <div className="p-4 border-t bg-white flex gap-2">
                                        <Input placeholder="Escribí una nota..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendLeadComment()}/>
                                        <Button size="icon" onClick={sendLeadComment}><Send className="h-4 w-4"/></Button>
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