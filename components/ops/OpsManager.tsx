"use client"
import { useState, useEffect, useMemo } from "react"
// 1. IMPORTAMOS SUPABASE
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Search, Bell, PartyPopper, X, UserPlus, Sparkles, Undo2, Lock, AlertTriangle, Filter, MessageCircle, Clock, Wallet, ShieldCheck, Calendar as CalendarIcon, Trash2, PlusCircle, Building2, User, RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label" 

// DATOS
import { Operation, OpStatus, Reminder, getStatusColor, getSubStateStyle, FLOW_STATES, PLANES_POR_EMPRESA } from "./data"

// MODULOS
import { OpsSidebar } from "./OpsSidebar"
import { OpsDashboard } from "./OpsDashboard"
import { OpsAgenda } from "./OpsAgenda"
import { OpsMetrics } from "./OpsMetrics"
import { OpsKanban } from "./OpsKanban" 
import { OpsList } from "./OpsList"     
import { OpsModal } from "./OpsModal"
import { OpsChat } from "./OpsChat"
import { OpsDatabase } from "./OpsDatabase"
import { OpsSettings } from "./OpsSettings"
import { OpsAnnouncements } from "./OpsAnnouncements" 
import { OpsBilling } from "./OpsBilling" 
import { OpsPostSale } from "./OpsPostSale"

interface OpsManagerProps { role: 'admin_god' | 'admin_ops', userName: string }

export function OpsManager({ role, userName }: OpsManagerProps) {
    const supabase = createClient()
    const [sidebarOpen, setSidebarOpen] = useState(true) 
    const [isLoading, setIsLoading] = useState(false)
    
    // VIEW MODE
    const [viewMode, setViewMode] = useState<'dashboard' | 'stage_list' | 'pool' | 'mine' | 'kanban' | 'agenda' | 'metrics' | 'chat' | 'database' | 'settings' | 'announcements' | 'billing' | 'post_sale'>('dashboard')
    
    const [currentStageFilter, setCurrentStageFilter] = useState<string | null>(null)
    
    // --- ESTADO PRINCIPAL ---
    const [operations, setOperations] = useState<Operation[]>([])
    
    const [selectedOp, setSelectedOp] = useState<Operation | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    
    // --- FILTROS POTENTES (ESTADO) ---
    const [filterStatus, setFilterStatus] = useState<string>("all")
    const [filterSubState, setFilterSubState] = useState<string>("all")
    const [filterSeller, setFilterSeller] = useState<string>("all")
    const [dateFilter, setDateFilter] = useState<{start: string, end: string}>({start: "", end: ""})
    const [isFilterOpen, setIsFilterOpen] = useState(false) 

    const [generalTasks, setGeneralTasks] = useState<Reminder[]>([])

    // MODALES & NOTIFICACIONES
    const [assigningOp, setAssigningOp] = useState<Operation | null>(null)
    const [confirmingAdvance, setConfirmingAdvance] = useState<{op: Operation, nextStage: OpStatus} | null>(null)
    const [confirmingBack, setConfirmingBack] = useState<{op: Operation, prevStage: OpStatus} | null>(null)
    const [confirmingRelease, setConfirmingRelease] = useState<Operation | null>(null)
    const [confirmingManualStatus, setConfirmingManualStatus] = useState<{op: Operation, newStatus: OpStatus} | null>(null)
    const [showCelebration, setShowCelebration] = useState(false)
    const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'} | null>(null)

    // --- ESTADO PARA MODAL DE CARGA MANUAL ---
    const [isManualLoadOpen, setIsManualLoadOpen] = useState(false)
    const [manualLoadData, setManualLoadData] = useState({
        clientName: "", dni: "", prepaga: "", plan: "", source: "Oficina", specificSeller: ""
    })

    const [notifications, setNotifications] = useState<{id: number, text: string, time: string, read: boolean, type: 'chat'|'sale'|'alert'|'agenda'}[]>([])
    const [newSaleNotif, setNewSaleNotif] = useState<any>(null)
    const [isBellOpen, setIsBellOpen] = useState(false) 
    const unreadCount = notifications.filter(n => !n.read).length

    // --- 1. FUNCIÓN MAESTRA DE CARGA DE DATOS ---
    const fetchOperations = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .not('status', 'in', '("nuevo","contactado","cotizacion","perdido")') 
            .order('last_update', { ascending: false })

        if (data) {
            // ARREGLO: 'any' para evitar que TS se queje de propiedades que faltan
            const mappedOps: any = data.map((op: any) => ({
                id: op.id,
                clientName: op.name || "Sin Nombre", // Protección contra nulos
                dni: op.dni || "S/D",
                plan: op.plan || op.quoted_plan || "-",
                prepaga: op.prepaga || op.quoted_prepaga || "Sin Asignar",
                status: (op.status === 'vendido' ? 'ingresado' : op.status) as OpStatus, 
                subState: op.sub_state || "Pendiente",
                seller: op.agent_name || "Desconocido",
                operator: op.operator, 
                entryDate: new Date(op.created_at).toISOString().split('T')[0],
                lastUpdate: op.last_update ? new Date(op.last_update).toLocaleDateString() : "Hoy",
                type: op.type || "alta",
                phone: op.phone || "",
                history: op.notes ? [{ date: "Historial", user: "Sistema", action: op.notes }] : [],
                chat: [],
                adminNotes: [],
                reminders: [],
                daysInStatus: 0,
                // Agregamos campos opcionales para evitar errores en otros componentes
                origen: op.source || "Dato",
                hijos: [],
                condicionLaboral: "Monotributo" // Default
            }))
            setOperations(mappedOps)
        }
        setIsLoading(false)
    }

    // Cargar datos al iniciar
    useEffect(() => {
        fetchOperations()
        
        const channel = supabase.channel('ops-realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
                if(payload.new.status === 'vendido') {
                    addNotification(`¡Nueva Venta Ingresada! ${payload.new.name}`, 'sale')
                    setNewSaleNotif({ client: payload.new.name, plan: payload.new.plan, seller: payload.new.agent_name })
                    fetchOperations() 
                }
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'leads' }, () => {
                fetchOperations() 
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])


    // --- DATOS DINÁMICOS PARA LOS FILTROS ---
    const uniqueSellers = useMemo(() => Array.from(new Set(operations.map(o => o.seller).filter(Boolean))), [operations])
    const uniqueSubStates = useMemo(() => {
        let relevantOps = operations;
        if (currentStageFilter) {
            relevantOps = operations.filter(o => o.status === currentStageFilter)
        } else if (filterStatus !== 'all') {
            relevantOps = operations.filter(o => o.status === filterStatus)
        }
        return Array.from(new Set(relevantOps.map(o => o.subState).filter(Boolean)))
    }, [operations, currentStageFilter, filterStatus])

    const activeFiltersCount = (filterStatus !== 'all' ? 1 : 0) + (filterSubState !== 'all' ? 1 : 0) + (filterSeller !== 'all' ? 1 : 0) + (dateFilter.start ? 1 : 0) + (dateFilter.end ? 1 : 0)

    const addNotification = (text: string, type: 'chat'|'sale'|'alert'|'agenda') => {
        setNotifications(prev => [{ id: Date.now(), text, time: "Ahora", read: false, type }, ...prev])
        setIsBellOpen(true)
        setTimeout(() => setIsBellOpen(false), 4000)
    }

    const handleNotificationClick = (n: any) => {
        if (n.type === 'sale') setViewMode('pool')
        if (n.type === 'chat') setViewMode('chat')
        if (n.type === 'agenda') setViewMode('agenda')
        
        setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif))
        setIsBellOpen(false)
    }

    const getNotifIcon = (type: string) => {
        switch(type) {
            case 'sale': return <Wallet className="h-4 w-4 text-green-600"/>
            case 'chat': return <MessageCircle className="h-4 w-4 text-blue-600"/>
            case 'agenda': return <Clock className="h-4 w-4 text-amber-600"/>
            default: return <AlertTriangle className="h-4 w-4 text-red-600"/>
        }
    }

    const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 5000) }

    // --- 2. FUNCIÓN DE UPDATE A SUPABASE ---
    const updateOpInDb = async (id: string, updates: any) => {
        setOperations(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o))
        
        const dbUpdates: any = {}
        if (updates.status) dbUpdates.status = updates.status
        if (updates.subState) dbUpdates.sub_state = updates.subState
        if (updates.operator !== undefined) dbUpdates.operator = updates.operator 
        if (updates.adminNotes) {
             const lastNote = updates.adminNotes[0]?.action || ""
             dbUpdates.notes = lastNote 
        }
        dbUpdates.last_update = new Date().toISOString()

        const { error } = await supabase.from('leads').update(dbUpdates).eq('id', id)
        
        if (error) {
            console.error("Error actualizando:", error)
            showToast("Error al guardar cambios", "error")
            fetchOperations() 
        }
    }

    const updateOp = (newOp: Operation) => { 
        updateOpInDb(newOp.id, {
            status: newOp.status,
            subState: newOp.subState,
            operator: newOp.operator
        })
        
        if (selectedOp && selectedOp.id === newOp.id) setSelectedOp(newOp); 
        if (assigningOp && assigningOp.id === newOp.id) setAssigningOp(null) 
    }

    const addHistory = (op: Operation, action: string) => [...op.history, { date: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), user: userName, action }]
    const handleCardClick = (op: Operation) => { if (op.status === 'ingresado' && !op.operator) { setAssigningOp(op) } else { setSelectedOp(op) } }

    // ARREGLO: Protección contra Nulos en el filtro
    const filteredOps = operations.filter(op => {
        const cName = op.clientName || "" // Evitar error si viene null
        if (searchTerm && !cName.toLowerCase().includes(searchTerm.toLowerCase()) && !op.dni.includes(searchTerm)) return false
        if (viewMode === 'dashboard' && currentStageFilter && op.status !== currentStageFilter) return false
        if (viewMode === 'stage_list' && currentStageFilter && op.status !== currentStageFilter) return false
        if (viewMode === 'mine' && op.operator !== userName) return false
        if (viewMode === 'pool' && (op.operator || ['cumplidas','rechazado'].includes(op.status))) return false
        if (filterStatus !== 'all' && op.status !== filterStatus) return false
        if (filterSubState !== 'all' && op.subState !== filterSubState) return false
        if (filterSeller !== 'all' && op.seller !== filterSeller) return false
        if (dateFilter.start && op.entryDate < dateFilter.start) return false
        if (dateFilter.end && op.entryDate > dateFilter.end) return false
        return true
    })

    const confirmAssignment = async (operator: string) => { 
        if (!assigningOp) return; 
        await updateOpInDb(assigningOp.id, { operator })
        setAssigningOp(null); 
        setSelectedOp({ ...assigningOp, operator }); 
        showToast(`👍 Asignado a ${operator}.`, 'success'); 
    }

    const requestAdvance = () => { if(!selectedOp) return; const idx = FLOW_STATES.indexOf(selectedOp.status); if(idx !== -1 && idx < FLOW_STATES.length - 1) setConfirmingAdvance({ op: selectedOp, nextStage: FLOW_STATES[idx+1] }); }
    
    const confirmAdvanceAction = async () => { 
        if(!confirmingAdvance) return; 
        await updateOpInDb(confirmingAdvance.op.id, { status: confirmingAdvance.nextStage })
        
        if (confirmingAdvance.nextStage === 'cumplidas') setShowCelebration(true); 
        else showToast(`✅ Avanzó de etapa`, 'success'); 
        setConfirmingAdvance(null); 
    }

    const requestBack = () => { if(!selectedOp) return; const idx = FLOW_STATES.indexOf(selectedOp.status); if(idx > 0) setConfirmingBack({ op: selectedOp, prevStage: FLOW_STATES[idx-1] }); }
    
    const confirmBackAction = async () => { 
        if(!confirmingBack) return; 
        await updateOpInDb(confirmingBack.op.id, { status: confirmingBack.prevStage })
        showToast(`⏪ Retrocedió`, 'success'); 
        setConfirmingBack(null); 
    }

    const handleStatusChange = (id: string, newStatus: OpStatus) => { const op = operations.find(o => o.id === id); if(op && op.status !== newStatus) setConfirmingManualStatus({ op, newStatus }); }
    
    const confirmManualStatusChange = async () => { 
        if(!confirmingManualStatus) return; 
        await updateOpInDb(confirmingManualStatus.op.id, { status: confirmingManualStatus.newStatus })
        setConfirmingManualStatus(null); 
        showToast(`Estado cambiado`); 
    }

    const handleRelease = () => { if(selectedOp) setConfirmingRelease(selectedOp) }
    
    const confirmReleaseAction = async () => { 
        if(!confirmingRelease) return; 
        await updateOpInDb(confirmingRelease.id, { operator: null }) 
        setSelectedOp(null); 
        setConfirmingRelease(null); 
        showToast("🔓 Caso liberado", 'success'); 
    }

    const clearFilters = () => { setFilterStatus('all'); setFilterSubState('all'); setFilterSeller('all'); setDateFilter({start:"", end:""}); setIsFilterOpen(false); }

    // --- CARGA MANUAL CON INSERT EN SUPABASE ---
    const handleCreateManualSale = async () => {
        if (!manualLoadData.clientName || !manualLoadData.dni) return;

        const { error } = await supabase.from('leads').insert({
            name: manualLoadData.clientName, 
            dni: manualLoadData.dni, 
            plan: manualLoadData.plan || "Base", 
            prepaga: manualLoadData.prepaga || "Generica",
            status: "ingresado", 
            sub_state: "Carga Manual", 
            agent_name: manualLoadData.source === 'Vendedor' ? manualLoadData.specificSeller : manualLoadData.source, 
            created_at: new Date().toISOString(), 
            last_update: new Date().toISOString(), 
            type: "alta",
            source: "Manual Admin"
        })

        if (!error) {
            setIsManualLoadOpen(false)
            setManualLoadData({ clientName: "", dni: "", prepaga: "", plan: "", source: "Oficina", specificSeller: "" }) 
            showToast("✅ Operación guardada en Base de Datos", 'success')
            fetchOperations() 
        } else {
            showToast("Error al guardar", "error")
            console.error(error)
        }
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[#0F1115] overflow-hidden font-sans relative">
            {toast && <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] animate-in slide-in-from-top-5 pointer-events-none"><div className="bg-slate-900/95 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">{toast.msg}</div></div>}

            {/* NOTIFICACIÓN DE NUEVA VENTA */}
            {newSaleNotif && (
                <div className="fixed bottom-8 right-8 z-[99999] animate-in slide-in-from-right-10 fade-in duration-500 cursor-pointer hover:translate-y-[-4px] transition-all" onClick={() => {setViewMode('pool'); setNewSaleNotif(null)}}>
                     <div className="bg-[#0f172a] border-l-4 border-l-green-500 border-t border-r border-b border-slate-700 text-white p-0 rounded-lg shadow-2xl w-[350px] relative overflow-hidden group">
                         <div className="bg-slate-800/50 p-3 flex justify-between items-center border-b border-slate-700">
                             <div className="flex items-center gap-2"><Badge className="bg-green-500 text-white border-0 text-[10px] uppercase font-black tracking-widest hover:bg-green-600">Nueva Venta</Badge><span className="text-[10px] text-slate-400">Hace instantes</span></div>
                             <button className="text-slate-400 hover:text-white" onClick={(e) => {e.stopPropagation(); setNewSaleNotif(null)}}><X size={14}/></button>
                         </div>
                         <div className="p-4 flex items-center gap-4">
                             <div className="h-12 w-12 rounded-full bg-green-900/40 flex items-center justify-center border border-green-500/30 text-green-400 shrink-0"><Wallet size={24}/></div>
                             <div><h4 className="text-lg font-black text-white leading-tight mb-1">{newSaleNotif.client}</h4><div className="flex flex-col gap-0.5"><span className="text-xs font-bold text-green-400">{newSaleNotif.plan}</span><span className="text-[10px] text-slate-400 flex items-center gap-1"><UserPlus size={10}/> Vendido por: {newSaleNotif.seller}</span></div></div>
                         </div>
                     </div>
                </div>
            )}

            <OpsSidebar open={sidebarOpen} setOpen={setSidebarOpen} viewMode={viewMode} setViewMode={setViewMode} role={role} currentStage={currentStageFilter} setStage={setCurrentStageFilter} />

            <main className="flex-1 flex flex-col min-w-0 bg-slate-100 relative text-slate-900 h-full">
                <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
                    <div className="flex items-center gap-8">
                        <h2 className="text-lg font-bold text-slate-700 capitalize min-w-[100px] flex items-center gap-2">
                            {viewMode === 'metrics' ? 'Métricas' : 
                             viewMode === 'chat' ? 'Chat Equipo' : 
                             viewMode === 'database' ? 'Base de Datos' : 
                             viewMode === 'settings' ? 'Configuración' :
                             viewMode === 'announcements' ? 'Comunicados' : 
                             viewMode === 'billing' ? 'Facturación' : 
                             viewMode === 'post_sale' ? 'Posventa & Cartera' : 
                             viewMode === 'stage_list' && currentStageFilter ? `Etapa: ${currentStageFilter}` :
                             viewMode.replace('_', ' ')}
                             <Button variant="ghost" size="icon" onClick={fetchOperations} title="Recargar"><RefreshCw className={`h-4 w-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`}/></Button>
                        </h2>
                        <div className="relative group w-[320px]">
                            <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10"><Search className="h-5 w-5 text-slate-400/80" strokeWidth={2}/></div>
                            <Input className="pl-10 w-full bg-slate-50 border-slate-200 h-9 focus:bg-white" placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        <Button 
                            className="bg-[#1e3a8a] hover:bg-blue-900 text-white gap-2 h-9 shadow-md px-4 flex animate-in zoom-in duration-300" 
                            onClick={() => setIsManualLoadOpen(true)}
                        >
                            <PlusCircle className="h-4 w-4" /> <span className="hidden md:inline">Nueva Op.</span>
                        </Button>

                        {!['post_sale', 'billing', 'chat', 'settings', 'announcements', 'agenda'].includes(viewMode) && (
                            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant={activeFiltersCount > 0 ? "default" : "outline"} className="h-9 gap-2 relative">
                                        <Filter size={16}/> 
                                        Filtros
                                        {activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">{activeFiltersCount}</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent align="end" className="w-[340px] p-4 shadow-xl border-slate-200">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center"><h4 className="font-bold text-sm flex items-center gap-2"><Filter size={16}/> Filtros Avanzados</h4>{activeFiltersCount > 0 && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50" onClick={clearFilters}><Trash2 size={12} className="mr-1"/> Borrar</Button>}</div>
                                        <Separator />
                                        <div className="space-y-2"><Label className="text-xs font-bold text-slate-500 uppercase">Fecha de Ingreso</Label><div className="flex gap-2"><div className="relative flex-1"><Input type="date" className="h-8 text-xs" value={dateFilter.start} onChange={e => setDateFilter({...dateFilter, start: e.target.value})} /></div><span className="text-slate-400 self-center">-</span><div className="relative flex-1"><Input type="date" className="h-8 text-xs" value={dateFilter.end} onChange={e => setDateFilter({...dateFilter, end: e.target.value})} /></div></div></div>
                                        {!currentStageFilter && <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Etapa Actual</Label><Select value={filterStatus} onValueChange={setFilterStatus}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{FLOW_STATES.map(st => <SelectItem key={st} value={st} className="uppercase">{st}</SelectItem>)}</SelectContent></Select></div>}
                                        <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Sub-Estado</Label><Select value={filterSubState} onValueChange={setFilterSubState}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{uniqueSubStates.map(sub => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}</SelectContent></Select></div>
                                        <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Vendedor</Label><Select value={filterSeller} onValueChange={setFilterSeller}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{uniqueSellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                        <Button className="w-full bg-slate-900 h-8 text-xs mt-2" onClick={() => setIsFilterOpen(false)}>Aplicar Filtros</Button>
                                    </div>
                                </PopoverContent>
                            </Popover>
                        )}
                        <Popover open={isBellOpen} onOpenChange={setIsBellOpen}>
                            <PopoverTrigger asChild><Button variant="outline" size="icon" className="relative h-9 w-9 bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm flex items-center justify-center overflow-visible"><Bell size={20}/>{unreadCount > 0 && <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] text-white font-bold border-2 border-white shadow-sm animate-bounce">{unreadCount}</span>}</Button></PopoverTrigger>
                            <PopoverContent align="end" className="w-80 p-0 shadow-xl border-slate-200"><div className="p-3 border-b border-slate-100 font-bold text-sm bg-slate-50 text-slate-700 flex justify-between items-center">Notificaciones{unreadCount > 0 && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{unreadCount} nuevas</span>}</div><ScrollArea className="h-[300px]">{notifications.length > 0 ? notifications.map((n) => (<div key={n.id} className={`p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex gap-3 transition-colors ${!n.read ? 'bg-blue-50/40' : ''}`} onClick={() => handleNotificationClick(n)}><div className={`mt-0.5 h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${n.type==='sale'?'bg-green-100':n.type==='chat'?'bg-blue-100':n.type==='agenda'?'bg-amber-100':'bg-red-100'}`}>{getNotifIcon(n.type)}</div><div><p className={`text-xs text-slate-800 leading-tight ${!n.read ? 'font-black' : 'font-medium'}`}>{n.text}</p><p className="text-[10px] text-slate-400 mt-1">{n.time}</p></div></div>)) : <div className="p-8 text-center text-xs text-slate-400">Sin notificaciones</div>}</ScrollArea>{notifications.length > 0 && <div className="p-2 border-t border-slate-100 text-center"><Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 w-full" onClick={() => setNotifications(prev => prev.map(n => ({...n, read: true})))}>Marcar todo como leído</Button></div>}</PopoverContent>
                        </Popover>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {viewMode === 'kanban' ? (
                        <div className="w-full h-full bg-slate-100 p-4 overflow-hidden">
                            <OpsKanban operations={filteredOps} onSelectOp={handleCardClick} />
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 h-full">
                            <div className="p-6">
                                {viewMode === 'dashboard' && <><OpsDashboard operations={operations} activeFilter={currentStageFilter} setActiveFilter={setCurrentStageFilter} /><div className="mt-8 border-t border-slate-200 pt-6"><OpsList operations={filteredOps} onSelectOp={handleCardClick} /></div></>}
                                {viewMode === 'metrics' && role === 'admin_god' && <OpsMetrics operations={filteredOps} />}
                                {viewMode === 'agenda' && <OpsAgenda operations={operations} generalTasks={generalTasks} setGeneralTasks={setGeneralTasks} onSelectOp={setSelectedOp} updateOp={updateOp} userName={userName} role={role} />}
                                {['stage_list', 'pool', 'mine'].includes(viewMode) && <OpsList operations={filteredOps} onSelectOp={handleCardClick} />}
                                {viewMode === 'chat' && (<OpsChat currentUser={userName} operations={operations} onViewSale={(op: any) => { setViewMode('pool'); setSelectedOp(op); }} />)}
                                {viewMode === 'database' && <OpsDatabase operations={operations} onSelectOp={handleCardClick} />}
                                {viewMode === 'announcements' && <OpsAnnouncements />} 
                                {viewMode === 'billing' && role === 'admin_god' && <OpsBilling operations={operations} />}
                                {viewMode === 'post_sale' && <OpsPostSale />}
                                {viewMode === 'settings' && <OpsSettings />} 
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </main>

            <OpsModal op={selectedOp} isOpen={!!selectedOp} onClose={()=>setSelectedOp(null)} onUpdateOp={updateOp} currentUser={userName} role={role} onStatusChange={handleStatusChange} onRelease={handleRelease} requestAdvance={requestAdvance} requestBack={requestBack} onSubStateChange={(id: string, s: string) => updateOpInDb(id, { subState: s })} onAddNote={(t:string)=>updateOpInDb(selectedOp!.id, { adminNotes: [{action: t}] })} onSendChat={(t:string)=>console.log("Chat pendiente integración DB", t)} onAddReminder={(id:string, d:string, t:string, n:string, type:any)=>console.log("Reminder pendiente integración DB")} getStatusColor={getStatusColor} getSubStateStyle={getSubStateStyle} />
            
            {/* ... DIALOGS EXISTENTES ... */}
            <Dialog open={!!assigningOp} onOpenChange={(open) => !open && setAssigningOp(null)}><DialogContent className="max-w-[400px] w-full p-0 overflow-hidden border-0 shadow-2xl rounded-2xl gap-0"><div className="bg-slate-900 p-6 relative flex flex-col items-center justify-center text-center"><button onClick={() => setAssigningOp(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={20}/></button><div className="h-12 w-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3 animate-pulse"><ShieldCheck className="h-6 w-6 text-blue-400"/></div><DialogTitle className="text-white text-xl font-black tracking-tight">¿Quién toma el caso?</DialogTitle><DialogDescription className="text-slate-400 text-xs mt-1">Seleccioná una operadora.</DialogDescription></div><div className="p-6 bg-white grid grid-cols-2 gap-4"><div onClick={() => confirmAssignment("Iara")} className="group cursor-pointer border border-slate-200 rounded-xl p-4 flex flex-col items-center hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg transition-all active:scale-95 duration-200"><Avatar className="h-12 w-12 mb-2 border-2 border-white shadow-sm group-hover:scale-110 transition-transform"><AvatarFallback className="bg-purple-600 text-white font-bold">IA</AvatarFallback></Avatar><span className="font-bold text-slate-700 group-hover:text-blue-700">Iara</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin</span></div><div onClick={() => confirmAssignment("Maca")} className="group cursor-pointer border border-slate-200 rounded-xl p-4 flex flex-col items-center hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg transition-all active:scale-95 duration-200"><Avatar className="h-12 w-12 mb-2 border-2 border-white shadow-sm group-hover:scale-110 transition-transform"><AvatarFallback className="bg-pink-600 text-white font-bold">MA</AvatarFallback></Avatar><span className="font-bold text-slate-700 group-hover:text-blue-700">Maca</span><span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Admin</span></div></div></DialogContent></Dialog>
            <Dialog open={!!confirmingAdvance} onOpenChange={(open) => !open && setConfirmingAdvance(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-blue-100 p-3 rounded-full mb-2"><Sparkles className="h-8 w-8 text-blue-600 animate-pulse"/></div><DialogTitle className="text-xl">¡Avanzar Etapa!</DialogTitle><DialogDescription>¿Avanzar caso a la siguiente etapa?</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmAdvanceAction} className="bg-blue-600 hover:bg-blue-700 w-full">Confirmar Avance</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingBack} onOpenChange={(open) => !open && setConfirmingBack(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-orange-100 p-3 rounded-full mb-2"><Undo2 className="h-8 w-8 text-orange-600"/></div><DialogTitle className="text-xl">Retroceder</DialogTitle><DialogDescription>El caso volverá a la etapa anterior.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmBackAction} variant="secondary" className="w-full border-orange-200 text-orange-700">Confirmar Retroceso</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingRelease} onOpenChange={(open) => !open && setConfirmingRelease(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-red-100 p-3 rounded-full mb-2"><Lock className="h-8 w-8 text-red-600"/></div><DialogTitle className="text-xl">Liberar Caso</DialogTitle><DialogDescription>Dejará de estar asignado a vos.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmReleaseAction} variant="destructive" className="w-full">Liberar Ahora</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingManualStatus} onOpenChange={(open) => !open && setConfirmingManualStatus(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-yellow-100 p-3 rounded-full mb-2"><AlertTriangle className="h-8 w-8 text-yellow-600"/></div><DialogTitle className="text-xl">Cambio Manual</DialogTitle><DialogDescription>Estás forzando un cambio de estado.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmManualStatusChange} className="w-full">Confirmar Cambio</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={showCelebration} onOpenChange={setShowCelebration}><DialogContent className="sm:max-w-sm text-center p-8"><DialogHeader><div className="mx-auto bg-green-100 p-4 rounded-full mb-4"><PartyPopper className="h-10 w-10 text-green-600"/></div><DialogTitle className="text-2xl font-black text-green-700">¡FELICITACIONES!</DialogTitle><DialogDescription className="text-lg text-slate-600 mt-2">Venta concretada con éxito.</DialogDescription></DialogHeader><Button onClick={() => setShowCelebration(false)} className="mt-6 w-full bg-green-600 hover:bg-green-700">¡Excelente!</Button></DialogContent></Dialog>

            {/* --- MODAL DE CARGA MANUAL (AHORA CON INSERT A DB) --- */}
            <Dialog open={isManualLoadOpen} onOpenChange={setIsManualLoadOpen}>
                <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-2xl gap-0">
                    <div className="bg-[#1e3a8a] p-6 text-white text-center">
                        <div className="mx-auto bg-white/20 p-3 rounded-full w-fit mb-3"><UserPlus className="h-8 w-8 text-white"/></div>
                        <DialogTitle className="text-xl font-bold">Carga Manual de Operación</DialogTitle>
                        <DialogDescription className="text-blue-200 text-xs">Ingreso administrativo de ventas externas o propias.</DialogDescription>
                    </div>
                    <div className="p-6 bg-white space-y-4">
                        {/* DATOS CLIENTE */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</Label><Input value={manualLoadData.clientName} onChange={e => setManualLoadData({...manualLoadData, clientName: e.target.value})} placeholder="Ej: Juan Pérez" className="h-9 text-slate-900"/></div>
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">DNI / CUIL</Label><Input value={manualLoadData.dni} onChange={e => setManualLoadData({...manualLoadData, dni: e.target.value})} placeholder="Sin puntos" className="h-9 text-slate-900"/></div>
                        </div>
                        {/* DATOS PLAN */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Prepaga</Label><Select value={manualLoadData.prepaga} onValueChange={(v) => setManualLoadData({...manualLoadData, prepaga: v})}><SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Seleccionar"/></SelectTrigger><SelectContent>{Object.keys(PLANES_POR_EMPRESA).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Plan</Label><Select value={manualLoadData.plan} onValueChange={(v) => setManualLoadData({...manualLoadData, plan: v})}><SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Seleccionar"/></SelectTrigger><SelectContent>{((PLANES_POR_EMPRESA as any)[manualLoadData.prepaga] || []).map((p:string) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        
                        <Separator className="bg-slate-100"/>
                        
                        {/* ORIGEN DE VENTA */}
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Building2 size={14}/> Origen de la Venta</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Oficina', 'Iara', 'Otros', 'Vendedor'].map((src) => (
                                    <div key={src} 
                                         className={`border rounded-lg p-2 text-center text-xs font-bold cursor-pointer transition-all ${manualLoadData.source === src ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                                         onClick={() => setManualLoadData({...manualLoadData, source: src})}
                                    >
                                        {src}
                                    </div>
                                ))}
                            </div>
                            
                            {/* SI ELIGEN "Vendedor", MOSTRAR SELECTOR */}
                            {manualLoadData.source === 'Vendedor' && (
                                <div className="pt-2 animate-in slide-in-from-top-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><User size={12}/> Seleccionar Vendedor</Label>
                                    <Select value={manualLoadData.specificSeller} onValueChange={(v) => setManualLoadData({...manualLoadData, specificSeller: v})}>
                                        <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Elegir de la lista..."/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Maca">Maca</SelectItem>
                                            <SelectItem value="Pedro">Pedro</SelectItem>
                                            <SelectItem value="Sofia">Sofia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsManualLoadOpen(false)} className="text-slate-500">Cancelar</Button>
                        <Button className="bg-[#1e3a8a] hover:bg-blue-900 text-white w-32 font-bold shadow-md" onClick={handleCreateManualSale}>Cargar Venta</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}