"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Users, Eye, Mail, Activity, Megaphone, X, Phone, Clock, MessageSquare, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Send } from "lucide-react"

export function AdminTeam() {
    const supabase = createClient()
    const [spyAgent, setSpyAgent] = useState<any>(null)
    const [selectedLead, setSelectedLead] = useState<any>(null)
    const [newMessage, setNewMessage] = useState("")
    
    const [salesAgents, setSalesAgents] = useState<any[]>([])
    const [staffMembers, setStaffMembers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // --- CARGA DE EQUIPO Y MÉTRICAS REALES ---
    useEffect(() => {
        const fetchTeamData = async () => {
            setLoading(true)
            
            // 1. Traer Perfiles
            const { data: profiles } = await supabase.from('profiles').select('*')
            
            // 2. Traer Leads para calcular métricas (traemos solo columnas necesarias para no explotar)
            const { data: leads } = await supabase
                .from('leads')
                .select('id, agent_name, status, created_at, last_update')

            if (profiles && leads) {
                // Mapear Vendedores con métricas reales
                const sellers = profiles
                    .filter(u => u.role === 'seller' || u.role === 'gestor')
                    .map(u => {
                        // Filtrar leads de este vendedor
                        const myLeads = leads.filter(l => l.agent_name === u.full_name)
                        
                        // Calcular Ventas del Mes (status 'vendido' o 'cumplidas')
                        const sales = myLeads.filter(l => ['vendido', 'cumplidas', 'ingresado'].includes(l.status)).length
                        
                        // Calcular Activos
                        const active = myLeads.filter(l => !['vendido', 'cumplidas', 'perdido', 'rechazado'].includes(l.status)).length

                        // Calcular Conversión (simple)
                        const total = myLeads.length
                        const conversion = total > 0 ? Math.round((sales / total) * 100) : 0

                        return {
                            id: u.id,
                            name: u.full_name || 'Sin Nombre',
                            role: u.role === 'seller' ? 'Vendedora' : 'Gestora',
                            status: 'online', // Podríamos conectar presencia real luego
                            salesMonth: sales,
                            passMonth: 0, // Si tuvieras lógica de pass, iría acá
                            conversion: `${conversion}%`,
                            leadsActive: active,
                            lastActivity: "Gestionando...",
                            avatarSeed: u.email
                        }
                    })
                setSalesAgents(sellers)

                // Mapear Staff
                const staff = profiles
                    .filter(u => u.role !== 'seller' && u.role !== 'gestor')
                    .map(u => ({
                        id: u.id,
                        name: u.full_name || 'Admin',
                        role: u.role === 'admin_god' ? 'Gerencia' : 'Staff',
                        email: u.email,
                        access: 'Total'
                    }))
                setStaffMembers(staff)
            }
            setLoading(false)
        }
        fetchTeamData()
    }, [])

    // --- FUNCIÓN ESPIAR TABLERO REAL ---
    const handleSpy = async (agent: any) => {
        // 1. Traemos los leads REALES de este agente para llenar su tablero
        const { data: agentLeads } = await supabase
            .from('leads')
            .select('*')
            .eq('agent_name', agent.name)
            .not('status', 'in', '("vendido","perdido")') // Solo activos

        if (agentLeads) {
            // Organizamos por columnas
            const board = {
                nuevos: agentLeads.filter(l => l.status === 'nuevo'),
                intentando: agentLeads.filter(l => l.status === 'contactado' && l.calls > 0),
                contactado: agentLeads.filter(l => l.status === 'contactado'),
                cotizados: agentLeads.filter(l => l.status === 'cotizacion'),
                cierre: agentLeads.filter(l => l.status === 'documentacion')
            }
            // Guardamos el agente con su tablero cargado
            setSpyAgent({ ...agent, board })
        }
    }

    const handleSendMessage = () => {
        // Aquí iría la lógica de chat real (INSERT en tabla mensajes)
        alert("Chat en desarrollo. El mensaje no se guardó en DB todavía.")
        setNewMessage("")
    }

    if (loading) return <div className="p-10 text-center text-slate-400">Cargando métricas del equipo...</div>

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Users className="h-8 w-8 text-blue-600" /> Gestión de Personas
                    </h2>
                    <p className="text-slate-500">Administración de roles, accesos y métricas en vivo.</p>
                </div>
            </div>

            <Tabs defaultValue="sales" className="w-full">
                <TabsList className="grid w-full md:w-[400px] grid-cols-2 mb-6">
                    <TabsTrigger value="sales">💼 Fuerza de Ventas ({salesAgents.length})</TabsTrigger>
                    <TabsTrigger value="staff">🛡️ Staff & Admin ({staffMembers.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="sales" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {salesAgents.map((agent, i) => (
                            <Card key={i} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-t-4 border-t-transparent hover:border-t-blue-600 group dark:bg-[#18191A] dark:border-slate-800">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <Avatar className="h-16 w-16 border-4 border-white dark:border-slate-700 shadow-sm"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.avatarSeed}`} /><AvatarFallback>{agent.name[0]}</AvatarFallback></Avatar>
                                                <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full border-2 border-white bg-green-500"></span>
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{agent.name}</h3>
                                                <Badge variant="secondary" className="mt-1 font-normal bg-slate-100 text-slate-500">{agent.role}</Badge>
                                            </div>
                                        </div>
                                        <Button size="icon" variant="outline" className="rounded-full" title="Espiar Tablero" onClick={() => handleSpy(agent)}><Eye className="h-5 w-5"/></Button>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-4 py-4 border-t border-b border-slate-100 dark:border-slate-800">
                                        <div className="text-center flex flex-col justify-center">
                                            <span className="text-4xl font-black text-slate-800 dark:text-white">{agent.salesMonth}</span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">Ventas</span>
                                        </div>
                                        <div className="text-center border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                                            <span className="block text-2xl font-black text-slate-800 dark:text-white">{agent.leadsActive}</span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Activos</span>
                                        </div>
                                        <div className="text-center border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center">
                                            <span className="block text-2xl font-black text-green-600">{agent.conversion}</span>
                                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cierre</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg"><Activity className="h-4 w-4 text-blue-500 animate-pulse"/><span className="truncate flex-1">En línea hace 5 min</span></div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="staff">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {staffMembers.map((member, i) => (
                            <Card key={i} className="border-l-4 border-l-slate-500 dark:bg-[#18191A] dark:border-slate-800 dark:border-l-slate-500">
                                <div className="p-6 flex items-start gap-4">
                                    <Avatar className="h-14 w-14 border-2 border-slate-100 dark:border-slate-700"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${member.name}`} /><AvatarFallback>{member.name[0]}</AvatarFallback></Avatar>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-lg dark:text-white">{member.name}</h3>
                                        <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 dark:text-slate-300">{member.role}</Badge>
                                        <div className="text-xs text-slate-500 flex items-center gap-1 mt-2"><Mail className="h-3 w-3"/> {member.email}</div>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {/* MODAL ESPIAR (AHORA CON DATOS REALES) */}
            <Dialog open={!!spyAgent} onOpenChange={() => setSpyAgent(null)}>
                <DialogContent className="max-w-[98vw] h-[90vh] flex flex-col bg-[#F8F9FA] dark:bg-[#0F1011] border-none p-0 overflow-hidden">
                    {spyAgent && (
                        <>
                            <div className="bg-white dark:bg-[#18191A] border-b px-6 py-4 flex justify-between items-center shadow-sm z-10">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-10 w-10 border border-slate-200">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${spyAgent.avatarSeed}`} />
                                    </Avatar>
                                    <DialogTitle className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                                        TABLERO EN VIVO DE {spyAgent.name.toUpperCase()}
                                        <span className="text-xs font-bold text-red-500 tracking-widest ml-2 flex items-center gap-1"><span className="animate-pulse">●</span> LIVE</span>
                                    </DialogTitle>
                                </div>
                                <Button variant="ghost" onClick={() => setSpyAgent(null)}><X className="h-6 w-6 text-slate-400 hover:text-slate-800"/></Button>
                            </div>

                            <ScrollArea className="flex-1 w-full bg-slate-100 dark:bg-[#000000]/10">
                                <div className="flex gap-4 p-6 min-w-[1400px] h-full">
                                    <KanbanColumn title="Nuevos" count={spyAgent.board?.nuevos?.length || 0} color="border-t-blue-500">{spyAgent.board?.nuevos?.map((l:any)=><KanbanCard key={l.id} lead={l} onClick={()=>setSelectedLead(l)}/>)}</KanbanColumn>
                                    <KanbanColumn title="Intentando" count={spyAgent.board?.intentando?.length || 0} color="border-t-yellow-500">{spyAgent.board?.intentando?.map((l:any)=><KanbanCard key={l.id} lead={l} onClick={()=>setSelectedLead(l)} highlight="calls"/>)}</KanbanColumn>
                                    <KanbanColumn title="Contactado" count={spyAgent.board?.contactado?.length || 0} color="border-t-indigo-500">{spyAgent.board?.contactado?.map((l:any)=><KanbanCard key={l.id} lead={l} onClick={()=>setSelectedLead(l)}/>)}</KanbanColumn>
                                    <KanbanColumn title="Cotizados" count={spyAgent.board?.cotizados?.length || 0} color="border-t-purple-500">{spyAgent.board?.cotizados?.map((l:any)=><KanbanCard key={l.id} lead={l} onClick={()=>setSelectedLead(l)} highlight="price" status={l.status}/>)}</KanbanColumn>
                                    <KanbanColumn title="Cierre / Docs" count={spyAgent.board?.cierre?.length || 0} color="border-t-green-500">{spyAgent.board?.cierre?.map((l:any)=><KanbanCard key={l.id} lead={l} onClick={()=>setSelectedLead(l)} highlight="status" status={l.status}/>)}</KanbanColumn>
                                </div>
                                <ScrollBar orientation="horizontal" />
                            </ScrollArea>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* FICHA LEAD (SIMPLE) */}
            <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
                <SheetContent className="sm:max-w-[500px] bg-white dark:bg-[#18191A] border-l dark:border-slate-800 flex flex-col p-0">
                    {selectedLead && (
                        <>
                            <div className="p-6 pb-2 border-b"><SheetHeader><SheetTitle className="text-2xl font-black">{selectedLead.name}</SheetTitle><SheetDescription><Badge variant="outline">{selectedLead.source}</Badge></SheetDescription></SheetHeader></div>
                            <div className="p-6 space-y-4">
                                <div className="bg-slate-50 p-4 rounded-xl border"><p className="text-sm font-bold text-slate-500">Teléfono</p><p className="text-lg font-mono">{selectedLead.phone || '-'}</p></div>
                                <div className="bg-slate-50 p-4 rounded-xl border"><p className="text-sm font-bold text-slate-500">Notas</p><p className="text-sm italic">{selectedLead.notes || 'Sin notas'}</p></div>
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>
        </div>
    )
}

// COMPONENTES UI AUXILIARES
function KanbanColumn({ title, count, color, children }: any) {
    return (
        <div className="flex-1 min-w-[260px] max-w-[300px] flex flex-col gap-3 h-full">
            <div className={`bg-white dark:bg-[#242526] p-3 rounded-t-lg border-t-4 ${color} shadow-sm flex justify-between items-center`}>
                <span className="font-bold text-xs uppercase text-slate-600 dark:text-slate-300">{title}</span>
                <Badge variant="secondary" className="font-bold">{count}</Badge>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1 pb-10 custom-scrollbar">{children}</div>
        </div>
    )
}

function KanbanCard({ lead, highlight, status, onClick }: any) {
    return (
        <div onClick={onClick} className="bg-white dark:bg-[#242526] p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-md cursor-pointer transition-all group">
            <div className="flex justify-between items-start mb-2"><p className="font-bold text-sm text-slate-800 dark:text-white line-clamp-1">{lead.name}</p></div>
            <div className="flex justify-between items-center mt-2 border-t pt-2 border-slate-50 dark:border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1"><Clock className="h-3 w-3"/> {new Date(lead.last_update).toLocaleDateString()}</span>
                {highlight === 'price' && <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">$ {lead.price || '-'}</span>}
            </div>
        </div>
    )
}