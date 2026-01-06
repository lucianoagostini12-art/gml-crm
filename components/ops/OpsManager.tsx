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
import { Search, Bell, PartyPopper, X, UserPlus, Sparkles, Undo2, Lock, AlertTriangle, Filter, MessageCircle, Clock, Wallet, ShieldCheck, Calendar as CalendarIcon, Trash2, PlusCircle, Building2, User, RefreshCw, Send, Check } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label" 

// DATOS (Sin datos fake)
import { Operation, OpStatus, Reminder, getStatusColor, getSubStateStyle, FLOW_STATES, ChatMsg } from "./data"

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

interface OpsManagerProps { role: 'admin_god' | 'admin_common' | 'ops', userName: string }

export function OpsManager({ role, userName }: OpsManagerProps) {
    const supabase = createClient()
    const [sidebarOpen, setSidebarOpen] = useState(true) 
    const [isLoading, setIsLoading] = useState(false)
    
    // VIEW MODE
    const [viewMode, setViewMode] = useState<'dashboard' | 'stage_list' | 'pool' | 'mine' | 'kanban' | 'agenda' | 'metrics' | 'chat' | 'database' | 'settings' | 'announcements' | 'billing' | 'post_sale'>('dashboard')
    
    const [currentStageFilter, setCurrentStageFilter] = useState<string | null>(null)
    
    // --- ESTADO PRINCIPAL ---
    const [operations, setOperations] = useState<Operation[]>([])
    const [profiles, setProfiles] = useState<any[]>([]) 
    
    // --- CONFIGURACIÓN GLOBAL (Planes y Estados desde DB) ---
    const [globalConfig, setGlobalConfig] = useState<{prepagas: any[], subStates: any}>({
        prepagas: [], 
        subStates: {}
    })

    // --- PERMISOS DINÁMICOS ---
    const [permissions, setPermissions] = useState({
        accessMetrics: false, 
        accessBilling: false, 
        accessPostSale: true,
        editSettings: false,
        exportData: true,
        deleteSales: false,
        assignCases: true
    })

    const [selectedOp, setSelectedOp] = useState<Operation | null>(null)
    const [searchTerm, setSearchTerm] = useState("")
    
    // --- FILTROS POTENTES ---
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

    // --- NOTIFICACIONES REALES (CONECTADAS A DB) ---
    const [notifications, setNotifications] = useState<any[]>([])
    const [newSaleNotif, setNewSaleNotif] = useState<any>(null)
    const [isBellOpen, setIsBellOpen] = useState(false) 
    const unreadCount = notifications.filter(n => !n.read).length

    // --- LOGOUT REAL ---
    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = "/" // Redirige al login limpio
    }

    // --- CARGA DE DATOS ---
    const fetchProfiles = async () => {
        const { data } = await supabase.from('profiles').select('*')
        if (data) setProfiles(data)
    }

    const fetchPermissions = async () => {
        if (role === 'admin_god') return 
        const { data } = await supabase.from('system_config').select('value').eq('key', 'ops_permissions').single()
        if (data) setPermissions(data.value)
    }

    const fetchSystemConfig = async () => {
        const { data } = await supabase.from('system_config').select('*')
        if (data) {
            const p = data.find(c => c.key === 'prepagas_plans')?.value || []
            const s = data.find(c => c.key === 'workflow_substates')?.value || {}
            setGlobalConfig({ prepagas: p, subStates: s })
        }
    }

    // --- CARGA DE NOTIFICACIONES (REAL) ---
    const fetchNotifications = async () => {
        // Traemos las notificaciones para este usuario o globales si es admin
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_name', userName) // Opcional: Si quieres que Ops vea todo, quita este filtro
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(20)
        
        if (data) setNotifications(data)
    }

    const markAllRead = async () => {
        const ids = notifications.map(n => n.id)
        setNotifications([]) // UI update rapido
        if (ids.length > 0) {
            await supabase.from('notifications').update({ read: true }).in('id', ids)
        }
    }

    // === AQUÍ ESTÁ LA CORRECCIÓN CRÍTICA EN FETCHOPERATIONS ===
    const fetchOperations = async () => {
        setIsLoading(true)
        
        // 1. SOLUCIÓN ERROR 400: Filtro con Array explícito
        const opsStatuses = [
            'ingresado', 'precarga', 'medicas', 'legajo', 'demoras', 
            'cumplidas', 'rechazado', 'vendido'
        ];

        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .in('status', opsStatuses)
            .order('last_update', { ascending: false })

        if (error) {
            console.error("Error fetching ops:", error)
            showToast("Error de conexión con la base de datos", "error")
        }

        if (data) {
            const mappedOps: any = data.map((op: any) => {
                
                // 2. SOLUCIÓN CRASH DE PANTALLA (TypeError: .map is not a function)
                let safeChat: any[] = [];
                try {
                    let rawComments = op.comments;
                    if (typeof rawComments === 'string') {
                        // Intentamos parsear si es string
                        try { rawComments = JSON.parse(rawComments); } catch (e) { rawComments = [] }
                    }
                    // Si después de parsear es un array, lo usamos. Si no, array vacío.
                    if (Array.isArray(rawComments)) {
                        safeChat = rawComments.map((c: any) => ({
                            message: c.text || "",
                            user: c.author || "Sistema",
                            time: c.date ? new Date(c.date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : "-",
                            isMe: c.author === userName
                        }));
                    }
                } catch (err) {
                    console.warn("Error parseando chat para ID:", op.id);
                    safeChat = [];
                }

                // 3. SOLUCIÓN DATOS FANTASMA (Normalización)
                return {
                    id: op.id,
                    clientName: op.name || "Sin Nombre",
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
                    chat: safeChat, // USAMOS EL CHAT SEGURO
                    adminNotes: op.admin_notes || [], 
                    reminders: (op.reminders || []).map((r: any) => ({
                        id: r.id, text: r.text, date: r.date, completed: r.completed
                    })),
                    history: op.notes ? [{ date: "Info", user: "Sistema", action: op.notes }] : [],
                    daysInStatus: 0,
                    origen: op.source || "Dato",
                    cuit: op.cuit,
                    dob: op.dob,
                    email: op.email,
                    address_street: op.address_street,
                    address_city: op.address_city,
                    address_zip: op.address_zip,
                    hijos: op.family_members || [],
                    condicionLaboral: op.labor_condition,
                    cuitEmpleador: op.employer_cuit,
                    metodoPago: op.payment_method,
                    cbu_tarjeta: op.cbu_card,
                    fullPrice: op.full_price,
                    aportes: op.aportes,
                    descuento: op.descuento,
                    billing_approved: op.billing_approved,
                    billing_period: op.billing_period,
                    billing_price_override: op.billing_price_override,
                    billing_portfolio_override: op.billing_portfolio_override
                }
            })
            setOperations(mappedOps)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        fetchProfiles()
        fetchPermissions()
        fetchSystemConfig() 
        fetchOperations()
        fetchNotifications() 
        
        // --- REALTIME ---
        const channel = supabase.channel('ops-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
                
                // CORRECCIÓN REALTIME: Casting a 'any' para evitar error de Build en Vercel
                const newData = payload.new as any

                // Solo refrescamos si es un cambio relevante para Ops
                if (newData && ['ingresado','vendido','precarga','medicas','legajo','demoras','cumplidas','rechazado'].includes(newData.status)) {
                    if(payload.eventType === 'INSERT' && (newData.status === 'vendido' || newData.status === 'ingresado')) {
                        setNewSaleNotif({ client: newData.name, plan: newData.plan, seller: newData.agent_name })
                    }
                    fetchOperations() 
                }
            })
            // Escuchar Notificaciones
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                if (payload.new.user_name === userName || role === 'admin_god') {
                    setNotifications(prev => [payload.new, ...prev])
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, () => {
                fetchPermissions()
                fetchSystemConfig() 
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])


    // --- HELPERS FILTROS ---
    const uniqueSellers = useMemo(() => Array.from(new Set(operations.map(o => o.seller).filter(Boolean))), [operations])
    
    // --- LÓGICA DE FILTRADO UNIFICADA ---
    const filteredOps = operations.filter(op => {
        if (searchTerm) {
            const term = searchTerm.toLowerCase()
            const matchName = op.clientName?.toLowerCase().includes(term)
            const matchDni = op.dni?.includes(term)
            const matchSeller = op.seller?.toLowerCase().includes(term)
            const matchPlan = op.plan?.toLowerCase().includes(term)
            if (!matchName && !matchDni && !matchSeller && !matchPlan) return false
        }
        if (viewMode === 'dashboard' && currentStageFilter && op.status !== currentStageFilter) return false
        if (viewMode === 'stage_list' && currentStageFilter && op.status !== currentStageFilter) return false
        if (viewMode === 'mine' && op.operator !== userName) return false
        // FILTRO DE PILETA: Oculta si ya tiene operador o si está cumplido/rechazado
        if (viewMode === 'pool' && (op.operator || ['cumplidas','rechazado'].includes(op.status))) return false
        
        if (filterStatus !== 'all' && op.status !== filterStatus) return false
        if (filterSubState !== 'all' && op.subState !== filterSubState) return false
        if (filterSeller !== 'all' && op.seller !== filterSeller) return false
        if (dateFilter.start && op.entryDate < dateFilter.start) return false
        if (dateFilter.end && op.entryDate > dateFilter.end) return false
        return true
    })

    const showToast = (msg: string, type: 'success'|'error'|'warning' = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 5000) }

    // --- UPDATE SUPABASE (Centralizado y REPARADO) ---
    const updateOpInDb = async (id: string, updates: any) => {
        // 1. NORMALIZACIÓN PARA LA UI (CamelCase)
        const uiUpdates = { ...updates }
        if (updates.sub_state !== undefined) uiUpdates.subState = updates.sub_state
        if (updates.agent_name !== undefined) uiUpdates.seller = updates.agent_name
        if (updates.name !== undefined) uiUpdates.clientName = updates.name
        
        // 2. ACTUALIZACIÓN VISUAL (Optimista)
        setOperations(prev => prev.map(o => o.id === id ? { ...o, ...uiUpdates } : o))
        
        // 3. PREPARACIÓN PARA DB (SnakeCase)
        const dbUpdates: any = {}
        if (uiUpdates.status) dbUpdates.status = uiUpdates.status
        if (uiUpdates.subState !== undefined) dbUpdates.sub_state = uiUpdates.subState
        else if (uiUpdates.sub_state !== undefined) dbUpdates.sub_state = uiUpdates.sub_state
        
        if (uiUpdates.seller !== undefined) dbUpdates.agent_name = uiUpdates.seller
        else if (uiUpdates.agent_name !== undefined) dbUpdates.agent_name = uiUpdates.agent_name

        if (uiUpdates.clientName !== undefined) dbUpdates.name = uiUpdates.clientName
        else if (uiUpdates.name !== undefined) dbUpdates.name = uiUpdates.name

        // Campos directos
        if (uiUpdates.operator !== undefined) dbUpdates.operator = uiUpdates.operator 
        if (uiUpdates.reminders) dbUpdates.reminders = uiUpdates.reminders
        if (uiUpdates.dni) dbUpdates.dni = uiUpdates.dni
        if (uiUpdates.email) dbUpdates.email = uiUpdates.email
        if (uiUpdates.phone) dbUpdates.phone = uiUpdates.phone
        if (uiUpdates.prepaga) dbUpdates.prepaga = uiUpdates.prepaga
        if (uiUpdates.plan) dbUpdates.plan = uiUpdates.plan
        if (uiUpdates.address_street) dbUpdates.address_street = uiUpdates.address_street
        if (uiUpdates.address_city) dbUpdates.address_city = uiUpdates.address_city
        if (uiUpdates.address_zip) dbUpdates.address_zip = uiUpdates.address_zip
        if (uiUpdates.hijos) dbUpdates.family_members = uiUpdates.hijos
        if (uiUpdates.fullPrice) dbUpdates.full_price = uiUpdates.fullPrice
        if (uiUpdates.aportes) dbUpdates.aportes = uiUpdates.aportes
        if (uiUpdates.descuento) dbUpdates.descuento = uiUpdates.descuento
        if (uiUpdates.adminNotes) dbUpdates.admin_notes = uiUpdates.adminNotes

        dbUpdates.last_update = new Date().toISOString()

        const { error } = await supabase.from('leads').update(dbUpdates).eq('id', id)
        
        if (error) {
            console.error("Error actualizando:", error)
            showToast("Error al guardar cambios en DB", "error")
            fetchOperations() 
        }
    }

    const updateOp = (newOp: Operation) => { 
        updateOpInDb(newOp.id, newOp)
        if (selectedOp && selectedOp.id === newOp.id) setSelectedOp(newOp); 
    }

    const handleSendChat = async (text: string) => {
        if (!selectedOp) return
        const newMsg = { text, author: userName, date: new Date().toISOString(), role: 'ops' }
        
        // Fetch comments actuales con seguridad
        const { data: currentData } = await supabase.from('leads').select('comments').eq('id', selectedOp.id).single()
        
        // Aseguramos que sea array
        let existingComments = currentData?.comments;
        if (typeof existingComments === 'string') {
             try { existingComments = JSON.parse(existingComments) } catch(e) { existingComments = [] }
        }
        if (!Array.isArray(existingComments)) existingComments = [];

        const updatedComments = [...existingComments, newMsg]
        const { error } = await supabase.from('leads').update({ comments: updatedComments, last_update: new Date().toISOString() }).eq('id', selectedOp.id)
        
        if (!error) {
            const uiMsg: any = { 
                message: text,
                text: text,
                user: userName, 
                time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}), 
                isMe: true 
            }
            setSelectedOp(prev => prev ? {...prev, chat: [...prev.chat, uiMsg]} : null)
        } else {
            showToast("Error al enviar mensaje", "error")
        }
    }

    const handleAddReminder = async (id: string, date: string, time: string, note: string, type: 'call'|'doc'|'payment') => {
        const op = operations.find(o => o.id === id)
        if (!op) return
        const newReminder = { id: Date.now(), text: note, date: `${date} ${time}`, type, completed: false }
        const updatedReminders = [...(op.reminders || []), newReminder]
        await updateOpInDb(id, { reminders: updatedReminders })
        showToast("Recordatorio guardado", "success")
    }

    const handleCardClick = (op: Operation) => { 
        if (op.status === 'ingresado' && !op.operator && (role === 'admin_god' || permissions.assignCases)) { 
            setAssigningOp(op) 
        } else { 
            setSelectedOp(op) 
        } 
    }

    // --- LÓGICA DE ASIGNACIÓN + AUTO APERTURA ---
    const confirmAssignment = async (operator: string) => { 
        if (!assigningOp) return; 
        await updateOpInDb(assigningOp.id, { operator })
        const updatedOp = { ...assigningOp, operator: operator }
        setAssigningOp(null); 
        setSelectedOp(updatedOp); 
        showToast(`👍 Asignado a ${operator} y abierto.`, 'success'); 
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

    // --- CARGA MANUAL (Ahora usa Prepagas Reales de DB) ---
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
        }
    }

    const adminUsers = profiles.filter(p => ['admin_god', 'admin_common', 'ops'].includes(p.role))
    const sellerUsers = profiles.filter(p => p.role === 'seller')

    const getSearchPlaceholder = () => {
        switch(viewMode) {
            case 'database': return "Buscador Histórico (DNI, Nombre, Vendedor)..."
            case 'pool': return "Buscar en Pileta..."
            case 'mine': return "Buscar en mis casos..."
            default: return "Buscar operación..."
        }
    }

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-[#0F1115] overflow-hidden font-sans relative">
            {toast && <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[9999] animate-in slide-in-from-top-5 pointer-events-none"><div className="bg-slate-900/95 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">{toast.msg}</div></div>}

            {/* NOTIFICACIÓN VENTA FLOTANTE */}
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

            <OpsSidebar 
                open={sidebarOpen} 
                setOpen={setSidebarOpen} 
                viewMode={viewMode} 
                setViewMode={setViewMode} 
                role={role} 
                currentStage={currentStageFilter} 
                setStage={setCurrentStageFilter}
                permissions={permissions}
                currentUser={{ 
                    name: userName, 
                    avatar: profiles.find(p => p.full_name === userName)?.avatar_url || "" 
                }} 
                onLogout={handleLogout} 
            />

            <main className="flex-1 flex flex-col min-w-0 bg-slate-100 relative text-slate-900 h-full">
                <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-20">
                    <div className="flex items-center gap-8">
                        <h2 className="text-lg font-bold text-slate-700 capitalize min-w-[100px] flex items-center gap-2">
                            {viewMode.replace('_', ' ')}
                             <Button variant="ghost" size="icon" onClick={fetchOperations} title="Recargar"><RefreshCw className={`h-4 w-4 text-slate-400 ${isLoading ? 'animate-spin' : ''}`}/></Button>
                        </h2>
                        <div className="relative group w-[380px]">
                            <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10"><Search className="h-5 w-5 text-slate-400/80" strokeWidth={2}/></div>
                            <Input 
                                className="pl-10 w-full bg-slate-50 border-slate-200 h-9 focus:bg-white transition-all font-medium" 
                                placeholder={getSearchPlaceholder()} 
                                value={searchTerm} 
                                onChange={e=>setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* 🔔 CAMPANITA REALTIME */}
                        <Popover open={isBellOpen} onOpenChange={setIsBellOpen}>
                            <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="relative">
                                    <Bell className="h-5 w-5 text-slate-500" />
                                    {unreadCount > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-0" align="end">
                                <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                                    <span className="text-xs font-bold text-slate-600">Notificaciones</span>
                                    {unreadCount > 0 && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600" onClick={markAllRead}>Marcar leídas</Button>}
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {notifications.length === 0 ? <div className="p-4 text-center text-xs text-slate-400">Sin novedades.</div> : 
                                        notifications.map((n) => (
                                            <div key={n.id} className={`p-3 border-b hover:bg-slate-50 transition-colors ${!n.read ? 'bg-blue-50/50' : ''}`}>
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-1 h-2 w-2 rounded-full ${!n.read ? 'bg-blue-500' : 'bg-slate-300'}`}></div>
                                                    <div>
                                                        <h5 className="text-xs font-bold text-slate-800">{n.title}</h5>
                                                        <p className="text-[10px] text-slate-500 mt-0.5">{n.body}</p>
                                                        <span className="text-[9px] text-slate-400 mt-1 block">{new Date(n.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Button className="bg-[#1e3a8a] hover:bg-blue-900 text-white gap-2 h-9 shadow-md px-4 flex animate-in zoom-in duration-300" onClick={() => setIsManualLoadOpen(true)}>
                            <PlusCircle className="h-4 w-4" /> <span className="hidden md:inline">Nueva Op.</span>
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {viewMode === 'kanban' ? (
                        <div className="w-full h-full bg-slate-100 p-4 overflow-hidden"><OpsKanban operations={filteredOps} onSelectOp={handleCardClick} /></div>
                    ) : (
                        <ScrollArea className="flex-1 h-full">
                            <div className="p-6">
                                {viewMode === 'dashboard' && <><OpsDashboard operations={operations} activeFilter={currentStageFilter} setActiveFilter={setCurrentStageFilter} /><div className="mt-8 border-t border-slate-200 pt-6"><OpsList operations={filteredOps} onSelectOp={handleCardClick} updateOp={updateOp} globalConfig={globalConfig} /></div></>}
                                
                                {['stage_list', 'pool', 'mine'].includes(viewMode) && <OpsList operations={filteredOps} onSelectOp={handleCardClick} updateOp={updateOp} globalConfig={globalConfig} />}
                                
                                {viewMode === 'metrics' && (role === 'admin_god' || permissions.accessMetrics) && <OpsMetrics />}
                                {viewMode === 'billing' && (role === 'admin_god' || permissions.accessBilling) && <OpsBilling />}
                                {viewMode === 'post_sale' && (role === 'admin_god' || permissions.accessPostSale) && <OpsPostSale />}
                                {viewMode === 'settings' && (role === 'admin_god' || permissions.editSettings) && <OpsSettings />}
                                
                                {viewMode === 'agenda' && <OpsAgenda operations={operations} generalTasks={generalTasks} setGeneralTasks={setGeneralTasks} onSelectOp={setSelectedOp} updateOp={updateOp} userName={userName} role={role} />}
                                {viewMode === 'chat' && (<OpsChat currentUser={userName} operations={operations} onViewSale={(op: any) => { setViewMode('pool'); setSelectedOp(op); }} />)}
                                {viewMode === 'database' && <OpsDatabase operations={filteredOps} onSelectOp={handleCardClick} />}
                                {viewMode === 'announcements' && <OpsAnnouncements />} 
                            </div>
                        </ScrollArea>
                    )}
                </div>
            </main>

            {/* --- MODAL DETALLE OPERACIÓN --- */}
            <OpsModal 
                op={selectedOp} 
                isOpen={!!selectedOp} 
                onClose={()=>setSelectedOp(null)} 
                onUpdateOp={updateOp}
                currentUser={userName} 
                role={role} 
                onStatusChange={handleStatusChange} 
                onRelease={handleRelease} 
                requestAdvance={requestAdvance} 
                requestBack={requestBack} 
                onPick={() => { if(selectedOp) confirmAssignment(userName) }}
                onSubStateChange={(id: string, s: string) => updateOpInDb(id, { subState: s })} 
                onAddNote={(t:string)=>updateOpInDb(selectedOp!.id, { adminNotes: [{action: t, date: new Date().toLocaleDateString(), user: userName}] })} 
                onSendChat={handleSendChat} 
                onAddReminder={handleAddReminder} 
                getStatusColor={getStatusColor} 
                getSubStateStyle={getSubStateStyle}
                globalConfig={globalConfig}
            />
            
            {/* --- MODAL ASIGNAR OPERADOR --- */}
            <Dialog open={!!assigningOp} onOpenChange={(open) => !open && setAssigningOp(null)}>
                <DialogContent className="max-w-[500px] w-full p-0 overflow-hidden border-0 shadow-2xl rounded-2xl gap-0">
                    <div className="bg-slate-900 p-6 relative flex flex-col items-center justify-center text-center">
                        <button onClick={() => setAssigningOp(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
                        <div className="h-12 w-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-3 animate-pulse"><ShieldCheck className="h-6 w-6 text-blue-400"/></div>
                        <DialogTitle className="text-white text-xl font-black tracking-tight">¿Quién toma el caso?</DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs mt-1">Seleccioná un operador/a del equipo.</DialogDescription>
                    </div>
                    <div className="p-6 bg-white grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto">
                        {adminUsers.length > 0 ? adminUsers.map((u) => (
                            <div key={u.id} onClick={() => confirmAssignment(u.full_name || u.email)} className="group cursor-pointer border border-slate-200 rounded-xl p-4 flex flex-col items-center hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg transition-all active:scale-95 duration-200">
                                <Avatar className="h-12 w-12 mb-2 border-2 border-white shadow-sm group-hover:scale-110 transition-transform">
                                    <AvatarImage src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`} />
                                    <AvatarFallback className="bg-purple-600 text-white font-bold">{u.full_name?.[0] || 'U'}</AvatarFallback>
                                </Avatar>
                                <span className="font-bold text-slate-700 group-hover:text-blue-700 text-sm truncate w-full text-center">{u.full_name || 'Usuario'}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{u.role === 'admin_god' ? 'GOD' : 'OPS'}</span>
                            </div>
                        )) : (
                            <p className="col-span-3 text-center text-sm text-slate-500 py-4">No hay operadores disponibles.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- MODAL DE CARGA MANUAL (Ahora con Planes Reales) --- */}
            <Dialog open={isManualLoadOpen} onOpenChange={setIsManualLoadOpen}>
                <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-2xl gap-0">
                    <div className="bg-[#1e3a8a] p-6 text-white text-center">
                        <div className="mx-auto bg-white/20 p-3 rounded-full w-fit mb-3"><UserPlus className="h-8 w-8 text-white"/></div>
                        <DialogTitle className="text-xl font-bold">Carga Manual de Operación</DialogTitle>
                        <DialogDescription className="text-blue-200 text-xs">Ingreso administrativo de ventas externas o propias.</DialogDescription>
                    </div>
                    <div className="p-6 bg-white space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</Label><Input value={manualLoadData.clientName} onChange={e => setManualLoadData({...manualLoadData, clientName: e.target.value})} placeholder="Ej: Juan Pérez" className="h-9 text-slate-900"/></div>
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">DNI / CUIL</Label><Input value={manualLoadData.dni} onChange={e => setManualLoadData({...manualLoadData, dni: e.target.value})} placeholder="Sin puntos" className="h-9 text-slate-900"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Prepaga</Label>
                                {/* SELECTOR REAL DESDE GLOBAL CONFIG */}
                                <Select value={manualLoadData.prepaga} onValueChange={(v) => setManualLoadData({...manualLoadData, prepaga: v})}>
                                    <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                                    <SelectContent>
                                        {globalConfig.prepagas.map((p: any) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Plan</Label>
                                {/* SELECTOR REAL DEPENDIENTE DE PREPAGA */}
                                <Select value={manualLoadData.plan} onValueChange={(v) => setManualLoadData({...manualLoadData, plan: v})}>
                                    <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                            const selectedPrepagaData = globalConfig.prepagas.find((p: any) => p.name === manualLoadData.prepaga);
                                            return (selectedPrepagaData?.plans || []).map((plan: string) => (
                                                <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                                            ));
                                        })()}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <Separator className="bg-slate-100"/>
                        
                        <div className="space-y-3">
                            <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2"><Building2 size={14}/> Origen de la Venta</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {['Oficina', 'Iara', 'Otros', 'Vendedor'].map((src) => (
                                    <div key={src} className={`border rounded-lg p-2 text-center text-xs font-bold cursor-pointer transition-all ${manualLoadData.source === src ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`} onClick={() => setManualLoadData({...manualLoadData, source: src})}>{src}</div>
                                ))}
                            </div>
                            
                            {manualLoadData.source === 'Vendedor' && (
                                <div className="pt-2 animate-in slide-in-from-top-2">
                                    <Label className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><User size={12}/> Seleccionar Vendedor</Label>
                                    <Select value={manualLoadData.specificSeller} onValueChange={(v) => setManualLoadData({...manualLoadData, specificSeller: v})}>
                                        <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Elegir de la lista..."/></SelectTrigger>
                                        <SelectContent>
                                            {sellerUsers.map(s => <SelectItem key={s.id} value={s.full_name || s.email}>{s.full_name || s.email}</SelectItem>)}
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

            {/* DIÁLOGOS DE CONFIRMACIÓN (Sin cambios) */}
            <Dialog open={!!confirmingAdvance} onOpenChange={(open) => !open && setConfirmingAdvance(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-blue-100 p-3 rounded-full mb-2"><Sparkles className="h-8 w-8 text-blue-600 animate-pulse"/></div><DialogTitle className="text-xl">¡Avanzar Etapa!</DialogTitle><DialogDescription>¿Avanzar caso a la siguiente etapa?</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmAdvanceAction} className="bg-blue-600 hover:bg-blue-700 w-full">Confirmar Avance</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingBack} onOpenChange={(open) => !open && setConfirmingBack(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-orange-100 p-3 rounded-full mb-2"><Undo2 className="h-8 w-8 text-orange-600"/></div><DialogTitle className="text-xl">Retroceder</DialogTitle><DialogDescription>El caso volverá a la etapa anterior.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmBackAction} variant="secondary" className="w-full border-orange-200 text-orange-700">Confirmar Retroceso</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingRelease} onOpenChange={(open) => !open && setConfirmingRelease(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-red-100 p-3 rounded-full mb-2"><Lock className="h-8 w-8 text-red-600"/></div><DialogTitle className="text-xl">Liberar Caso</DialogTitle><DialogDescription>Dejará de estar asignado a vos.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmReleaseAction} variant="destructive" className="w-full">Liberar Ahora</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingManualStatus} onOpenChange={(open) => !open && setConfirmingManualStatus(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-yellow-100 p-3 rounded-full mb-2"><AlertTriangle className="h-8 w-8 text-yellow-600"/></div><DialogTitle className="text-xl">Cambio Manual</DialogTitle><DialogDescription>Estás forzando un cambio de estado.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmManualStatusChange} className="w-full">Confirmar Cambio</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={showCelebration} onOpenChange={setShowCelebration}><DialogContent className="sm:max-w-sm text-center p-8"><DialogHeader><div className="mx-auto bg-green-100 p-4 rounded-full mb-4"><PartyPopper className="h-10 w-10 text-green-600"/></div><DialogTitle className="text-2xl font-black text-green-700">¡FELICITACIONES!</DialogTitle><DialogDescription className="text-lg text-slate-600 mt-2">Venta concretada con éxito.</DialogDescription></DialogHeader><Button onClick={() => setShowCelebration(false)} className="mt-6 w-full bg-green-600 hover:bg-green-700">¡Excelente!</Button></DialogContent></Dialog>
        </div>
    )
}