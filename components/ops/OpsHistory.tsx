"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
    History, Calendar as CalendarIcon, ArrowRight, 
    Edit3, ShieldAlert, CheckCircle2, Search, 
    Clock, RefreshCw, FileText, User as UserIcon, 
    Phone, CreditCard, ArrowRightLeft, Hash
} from "lucide-react"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// Importamos el Modal para ver detalles
import { OpsModal } from "./OpsModal"
import { getStatusColor } from "./data"

// --- TIPOS DE EVENTOS ---
type HistoryEvent = {
    id: string
    type: 'status_change' | 'audit_log' | 'system_msg' | 'manual_edit'
    title: string
    description: string
    // Datos del Operador (Quien lo hizo)
    user: {
        name: string
        avatar?: string
        email?: string
    }
    timestamp: string
    leadId?: string
    // Datos del Cliente (A quien se lo hicieron)
    clientInfo?: {
        name: string
        dni: string
        phone: string
        status: string
        plan?: string
        prepaga?: string
    }
    context?: string 
    metadata?: any 
    icon?: any
    color?: string
}

// --- HELPER: DEDUCIR CONTEXTO ---
const inferContext = (field: string | null, status: string) => {
    const f = field?.toLowerCase() || ""
    if (f.includes('billing') || f.includes('price') || f.includes('aportes')) return { label: 'FACTURACIÓN', color: 'bg-green-100 text-green-700' }
    if (f.includes('status') || f.includes('sub_state')) return { label: 'FLUJO / ESTADO', color: 'bg-blue-100 text-blue-700' }
    if (f.includes('doc') || f.includes('file')) return { label: 'DOCUMENTACIÓN', color: 'bg-orange-100 text-orange-700' }
    if (f.includes('dni') || f.includes('name') || f.includes('address') || f.includes('telefono') || f.includes('phone')) return { label: 'DATOS PERSONALES', color: 'bg-purple-100 text-purple-700' }
    
    if (status === 'cumplidas') return { label: 'POST-VENTA', color: 'bg-emerald-100 text-emerald-700' }
    if (status === 'ingresado') return { label: 'MESA DE ENTRADA', color: 'bg-slate-100 text-slate-700' }
    
    return { label: 'OPERATIVA', color: 'bg-gray-100 text-gray-700' }
}

export function OpsHistory() {
    const supabase = createClient()
    
    // --- ESTADOS ---
    const [events, setEvents] = useState<HistoryEvent[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
    const [selectedOperator, setSelectedOperator] = useState<string>("all")
    const [searchTerm, setSearchTerm] = useState("")
    
    // Data auxiliar
    const [operatorsMap, setOperatorsMap] = useState<Record<string, any>>({}) // Mapa ID/Email -> Perfil
    const [operatorsList, setOperatorsList] = useState<any[]>([]) // Lista para el select
    const [stats, setStats] = useState({ total: 0, changes: 0, edits: 0, alerts: 0 })

    // Modal de Detalle
    const [selectedOp, setSelectedOp] = useState<any>(null)
    const [isModalOpen, setIsModalOpen] = useState(false)

    // --- 1. CARGAR PERFILES (La base de la identidad) ---
    useEffect(() => {
        const loadProfiles = async () => {
            const { data } = await supabase.from('profiles').select('*')
            if (data) {
                const map: Record<string, any> = {}
                data.forEach(p => {
                    // Mapeamos por ID, por Email y por Nombre (Normalizado a minúsculas para evitar errores)
                    if (p.id) map[p.id] = p
                    if (p.email) map[p.email.toLowerCase()] = p
                    if (p.full_name) map[p.full_name.toLowerCase()] = p
                })
                setOperatorsMap(map)
                setOperatorsList(data)
            }
        }
        loadProfiles()
    }, [])

    // --- HELPER PARA RESOLVER USUARIO ---
    const resolveUser = (identifier: string | null) => {
        if (!identifier) return { name: "Sistema", avatar: undefined }
        
        // 1. Buscamos coincidencia directa o normalizada
        const profile = operatorsMap[identifier] || operatorsMap[identifier.toLowerCase()]
        
        if (profile) {
            return {
                name: profile.full_name || profile.email || "Usuario",
                avatar: profile.avatar_url,
                email: profile.email
            }
        }
        // Si es un UUID y no lo encontró, mostramos "Usuario Desconocido"
        if (identifier.length > 20 && identifier.includes('-')) {
             return { name: "Usuario Desconocido", avatar: undefined }
        }
        
        // Si no es UUID, devolvemos el texto original (ej: "Juan")
        return { name: identifier, avatar: undefined }
    }

    // --- 2. FETCH HISTORIAL ---
    const fetchHistory = async () => {
        if (!selectedDate) return
        setIsLoading(true)
        
        const start = new Date(selectedDate)
        start.setHours(0, 0, 0, 0)
        const end = new Date(selectedDate)
        end.setHours(23, 59, 59, 999)
        
        const startIso = start.toISOString()
        const endIso = end.toISOString()

        try {
            // A. Fetch de las fuentes
            const { data: statusHistory } = await supabase.from('lead_status_history').select('*').gte('changed_at', startIso).lte('changed_at', endIso).order('changed_at', { ascending: false })
            // Intentamos traer audit logs
            const { data: auditLogs, error: auditError } = await supabase.from('audit_logs').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })
            const { data: messages } = await supabase.from('lead_messages').select('*').gte('created_at', startIso).lte('created_at', endIso).order('created_at', { ascending: false })

            // B. Recolectar IDs de Leads (Unificar nombres de columnas)
            const leadIds = new Set<string>()
            statusHistory?.forEach((h: any) => h.lead_id && leadIds.add(h.lead_id))
            
            // OJO: Audit Logs a veces usa record_id o lead_id
            if (!auditError && auditLogs) {
                auditLogs.forEach((a: any) => {
                    if (a.record_id) leadIds.add(a.record_id)
                    if (a.lead_id) leadIds.add(a.lead_id)
                })
            }
            
            messages?.forEach((m: any) => m.lead_id && leadIds.add(m.lead_id))

            // C. Fetch Masivo de Clientes (Datos ricos)
            let leadsMap: Record<string, any> = {}
            if (leadIds.size > 0) {
                const { data: leadsData } = await supabase
                    .from('leads')
                    .select('id, name, dni, phone, status, plan, prepaga') 
                    .in('id', Array.from(leadIds))
                
                leadsData?.forEach((l: any) => { leadsMap[l.id] = l })
            }

            // D. Unificación
            const combinedEvents: HistoryEvent[] = []

            // -> Cambios de Estado
            statusHistory?.forEach((h: any) => {
                const lead = leadsMap[h.lead_id]
                combinedEvents.push({
                    id: `status-${h.id}`,
                    type: 'status_change',
                    title: 'Movimiento de Tablero',
                    description: `${h.from_status?.toUpperCase() || 'DESCONOCIDO'} ➝ ${h.to_status?.toUpperCase() || 'DESCONOCIDO'}`,
                    user: resolveUser(h.agent_name),
                    timestamp: h.changed_at,
                    leadId: h.lead_id,
                    clientInfo: lead ? { name: lead.name, dni: lead.dni, phone: lead.phone, status: lead.status, plan: lead.plan, prepaga: lead.prepaga } : undefined,
                    context: 'FLUJO OPERATIVO',
                    metadata: { from: h.from_status, to: h.to_status },
                    icon: ArrowRightLeft,
                    color: 'text-blue-600 bg-blue-100'
                })
            })

            // -> Auditoría (Fix Edición Undefined)
            if (!auditError && auditLogs) {
                auditLogs.forEach((a: any) => {
                    // Normalizar ID del lead
                    const targetLeadId = a.record_id || a.lead_id
                    const lead = leadsMap[targetLeadId]
                    
                    // Fix nombre campo
                    const fieldName = a.field_changed || "Datos Generales"
                    const contextInfo = inferContext(fieldName, lead?.status || 'unknown')
                    
                    combinedEvents.push({
                        id: `audit-${a.id}`,
                        type: 'manual_edit',
                        title: `Edición: ${fieldName}`,
                        description: `Valor modificado manual`,
                        user: resolveUser(a.performed_by),
                        timestamp: a.created_at,
                        leadId: targetLeadId,
                        clientInfo: lead ? { name: lead.name, dni: lead.dni, phone: lead.phone, status: lead.status, plan: lead.plan, prepaga: lead.prepaga } : undefined,
                        context: contextInfo.label,
                        metadata: { old: a.old_value, new: a.new_value, colorClass: contextInfo.color },
                        icon: Edit3,
                        color: 'text-orange-600 bg-orange-100'
                    })
                })
            }

            // -> Mensajes/Notas
            messages?.forEach((m: any) => {
                const lead = leadsMap[m.lead_id]
                if (m.text.includes("ADMIN_NOTE") || m.text.includes("⚠️") || m.sender === "Sistema" || m.text.includes("FACTURACION")) {
                    const isAlert = m.text.includes("⚠️")
                    const isBilling = m.text.includes("FACTURACION")
                    let typeTitle = "Nota de Gestión"; let icon = FileText; let color = "text-slate-600 bg-slate-100"; let context = "GENERAL"

                    if(isAlert) { typeTitle = "ALERTA DE RECHAZO"; icon = ShieldAlert; color = "text-red-600 bg-red-100"; context = "AUDITORÍA" }
                    if(isBilling) { typeTitle = "Movimiento Facturación"; icon = CreditCard; color = "text-green-600 bg-green-100"; context = "FACTURACIÓN" }

                    combinedEvents.push({
                        id: `msg-${m.id}`,
                        type: isAlert ? 'audit_log' : 'system_msg',
                        title: typeTitle,
                        description: m.text.replace("ADMIN_NOTE|", "").replace("FACTURACION|", "").split('|').pop() || m.text,
                        user: resolveUser(m.sender),
                        timestamp: m.created_at,
                        leadId: m.lead_id,
                        clientInfo: lead ? { name: lead.name, dni: lead.dni, phone: lead.phone, status: lead.status, plan: lead.plan, prepaga: lead.prepaga } : undefined,
                        context: context,
                        icon: icon,
                        color: color
                    })
                }
            })

            combinedEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            setEvents(combinedEvents)

            setStats({
                total: combinedEvents.length,
                changes: combinedEvents.filter(e => e.type === 'status_change').length,
                edits: combinedEvents.filter(e => e.type === 'manual_edit').length,
                alerts: combinedEvents.filter(e => e.type === 'audit_log').length
            })

        } catch (error) {
            console.error("Error fetching history:", error)
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        // Aseguramos cargar historial solo si ya tenemos el mapa de usuarios o al menos lo intentamos
        fetchHistory()
    }, [selectedDate, operatorsMap]) // Recargar si cambian fecha o se cargan perfiles

    // --- ACCIONES ---
    const handleOpenDetail = async (leadId: string) => {
        if (!leadId) return
        const { data } = await supabase.from('leads').select('*').eq('id', leadId).single()
        if (data) {
            setSelectedOp(data)
            setIsModalOpen(true)
        }
    }

    // --- FILTRADO INTELIGENTE ---
    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            const matchUser = selectedOperator === 'all' || e.user.name === selectedOperator
            const term = searchTerm.toLowerCase()
            const matchSearch = searchTerm === '' || 
                                e.title.toLowerCase().includes(term) || 
                                e.description.toLowerCase().includes(term) ||
                                e.user.name.toLowerCase().includes(term) ||
                                e.clientInfo?.name.toLowerCase().includes(term) ||
                                e.clientInfo?.dni.includes(term) ||
                                e.context?.toLowerCase().includes(term)
            return matchUser && matchSearch
        })
    }, [events, selectedOperator, searchTerm])

    return (
        <div className="h-full flex flex-col bg-slate-50/50">
            {/* HEADER DE MANDO */}
            <div className="bg-white border-b border-slate-200 p-6 shrink-0 shadow-sm z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <History className="text-orange-600" size={28}/> 
                            Historial Global
                        </h2>
                        <p className="text-slate-500 text-sm mt-1">Auditoría completa con identificación de usuarios y clientes.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="bg-blue-50 px-4 py-2 rounded-xl border border-blue-100 text-center"><span className="block text-2xl font-black text-blue-700">{stats.total}</span><span className="text-[10px] uppercase font-bold text-blue-400">Total</span></div>
                        <div className="bg-orange-50 px-4 py-2 rounded-xl border border-orange-100 text-center"><span className="block text-2xl font-black text-orange-700">{stats.edits}</span><span className="text-[10px] uppercase font-bold text-orange-400">Ediciones</span></div>
                        <div className="bg-red-50 px-4 py-2 rounded-xl border border-red-100 text-center"><span className="block text-2xl font-black text-red-700">{stats.alerts}</span><span className="text-[10px] uppercase font-bold text-red-400">Alertas</span></div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className={`w-[240px] justify-start text-left font-normal ${!selectedDate && "text-muted-foreground"}`}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, "PPP", { locale: es }) : <span>Seleccionar fecha</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={selectedDate} onSelect={setSelectedDate} initialFocus />
                        </PopoverContent>
                    </Popover>

                    <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Filtrar por Responsable" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los operadores</SelectItem>
                            {operatorsList.map((op: any) => (
                                <SelectItem key={op.id} value={op.full_name}>{op.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input placeholder="Buscar cliente, DNI, acción..." className="pl-9 bg-slate-50" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchHistory}><RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/></Button>
                </div>
            </div>

            {/* TIMELINE BODY */}
            <ScrollArea className="flex-1 p-8">
                <div className="max-w-5xl mx-auto relative pl-8 border-l-2 border-slate-200 space-y-6 pb-20">
                    {filteredEvents.length === 0 ? (
                        <div className="text-center py-20 text-slate-400"><History size={48} className="mx-auto mb-4 opacity-20"/><p>Sin movimientos registrados.</p></div>
                    ) : (
                        filteredEvents.map((event) => {
                            const Icon = event.icon || CheckCircle2
                            const time = new Date(event.timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})
                            
                            return (
                                <div key={event.id} className="relative group">
                                    <div className={`absolute -left-[41px] top-6 h-5 w-5 rounded-full bg-white border-4 group-hover:scale-110 transition-all z-10 ${event.type === 'audit_log' ? 'border-red-500' : 'border-slate-300 group-hover:border-blue-500'}`}></div>
                                    
                                    <Card className="hover:shadow-xl transition-all border-slate-200 group-hover:border-blue-300 overflow-hidden cursor-default">
                                        <div className="flex">
                                            <div className={`w-1.5 shrink-0 ${event.type === 'status_change' ? 'bg-blue-500' : event.type === 'manual_edit' ? 'bg-orange-500' : event.type === 'audit_log' ? 'bg-red-500' : 'bg-slate-300'}`}></div>
                                            
                                            <div className="flex-1 p-4">
                                                <div className="flex justify-between items-start mb-3">
                                                    {/* INFO OPERADOR + TÍTULO */}
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shadow-sm ${event.color}`}>
                                                            <Icon size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-black text-slate-800 text-sm uppercase">{event.title}</h4>
                                                                <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-widest bg-slate-50">{event.context || "SISTEMA"}</Badge>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {/* ✅ AVATAR DEL OPERADOR */}
                                                                <Avatar className="h-5 w-5 border border-slate-200">
                                                                    <AvatarImage src={event.user.avatar} />
                                                                    <AvatarFallback className="text-[8px] font-bold bg-slate-900 text-white">{event.user.name.substring(0,2)}</AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-xs font-bold text-slate-700">{event.user.name}</span>
                                                                <span className="text-[10px] text-slate-400">• {time}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {event.leadId && (
                                                        <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50 text-xs font-bold h-8 px-3 border border-blue-100" onClick={() => handleOpenDetail(event.leadId!)}>
                                                            Ver Operación <ArrowRight size={12} className="ml-2"/>
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* ✅ TARJETA DEL CLIENTE AFECTADO (Bien visible) */}
                                                {event.clientInfo ? (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 flex items-center justify-between group-hover:border-blue-200 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">
                                                                {event.clientInfo.name?.charAt(0) || "U"}
                                                            </div>
                                                            <div>
                                                                <p className="text-xs font-black text-slate-700 uppercase">{event.clientInfo.name || "Cliente Desconocido"}</p>
                                                                <p className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                                                                    <Hash size={10}/> {event.clientInfo.dni || "S/DNI"}
                                                                    {event.clientInfo.prepaga && <span className="bg-white px-1 rounded border border-slate-200">{event.clientInfo.prepaga}</span>}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Badge className={`${getStatusColor(event.clientInfo.status)} border-0 text-[10px]`}>{event.clientInfo.status}</Badge>
                                                    </div>
                                                ) : (
                                                    // Mensaje si no se encuentra el lead (Posiblemente eliminado)
                                                    <div className="bg-red-50 border border-red-100 rounded-lg p-2 mb-3 text-xs text-red-600 italic">
                                                        Datos del cliente no disponibles (Lead ID: {event.leadId})
                                                    </div>
                                                )}

                                                {/* DETALLE DEL CAMBIO (DIFF) */}
                                                <div className="text-sm text-slate-600 pl-1">
                                                    {event.type === 'manual_edit' ? (
                                                        <div className={`flex items-center gap-3 font-mono text-xs p-2 rounded border ${event.metadata?.colorClass || 'bg-white border-slate-100'}`}>
                                                            <span className="text-red-500 line-through opacity-70 bg-slate-50 px-2 py-0.5 rounded border border-red-100">{event.metadata?.old || '(Vacío)'}</span>
                                                            <ArrowRight size={14} className="text-slate-400"/>
                                                            <span className="text-green-700 font-bold bg-green-50 px-2 py-0.5 rounded border border-green-100">{event.metadata?.new}</span>
                                                        </div>
                                                    ) : (
                                                        <p className="font-medium">{event.description}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </Card>
                                </div>
                            )
                        })
                    )}
                </div>
            </ScrollArea>

            {selectedOp && (
                <OpsModal 
                    op={selectedOp} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}
                    onUpdateOp={()=>{}} currentUser={"Auditor"} role={"admin_god"} 
                    onStatusChange={()=>{}} onRelease={()=>{}} requestAdvance={()=>{}} requestBack={()=>{}} onPick={()=>{}} 
                    onSubStateChange={()=>{}} onAddNote={()=>{}} onSendChat={()=>{}} onAddReminder={()=>{}} 
                    getStatusColor={getStatusColor} getSubStateStyle={getSubStateStyle}
                    globalConfig={{prepagas:[], subStates:{}}}
                />
            )}
        </div>
    )
}