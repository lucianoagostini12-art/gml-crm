"use client"
import { useState, useEffect, useMemo, useRef } from "react"
// 1. IMPORTAMOS SUPABASE
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select" 
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Search, Bell, PartyPopper, X, UserPlus, Sparkles, Undo2, Lock, AlertTriangle, Filter, MessageCircle, Clock, Wallet, ShieldCheck, Calendar as CalendarIcon, Trash2, PlusCircle, Building2, User, RefreshCw, Send, Check, ArrowRightLeft, FileCheck, Megaphone, Store } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label" 

// --- IMPORTAR UTILIDAD DE NOTIFICACIONES ---
import { sendNativeNotification, requestNotificationPermission } from "@/utils/notifications"

// DATOS
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
import { OpsHistory } from "./OpsHistory"

// SONIDO DE NOTIFICACIÓN
const ALARM_SOUND = "https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3"

interface OpsManagerProps { role: 'admin_god' | 'admin_common' | 'ops', userName: string }

export function OpsManager({ role, userName }: OpsManagerProps) {
    const supabase = createClient()
    const [sidebarOpen, setSidebarOpen] = useState(true) 
    const [isLoading, setIsLoading] = useState(false)
    const audioRef = useRef<HTMLAudioElement | null>(null)

    // ✅ INICIALIZACIÓN DE AUDIO
    useEffect(() => {
        if (typeof window !== 'undefined') {
            audioRef.current = new Audio(ALARM_SOUND);
        }
    }, [])
    
    // ✅ 1. INICIALIZACIÓN INTELIGENTE
    const [viewMode, setViewMode] = useState<'dashboard' | 'stage_list' | 'pool' | 'mine' | 'kanban' | 'agenda' | 'metrics' | 'chat' | 'database' | 'settings' | 'announcements' | 'billing' | 'post_sale' | 'history'>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            const tab = params.get('tab')
            if (tab) return tab as any
        }
        return 'dashboard'
    })

    // ✅ 2. EFECTO DE PERSISTENCIA
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search)
            if (viewMode === 'dashboard') {
                params.delete('tab')
            } else {
                params.set('tab', viewMode)
            }
            const newUrl = `${window.location.pathname}?${params.toString()}`
            window.history.replaceState(null, '', newUrl)
        }
    }, [viewMode])
    
    const [currentStageFilter, setCurrentStageFilter] = useState<string | null>(null)
    
    // --- ESTADO PRINCIPAL ---
    const [operations, setOperations] = useState<Operation[]>([])
    const [profiles, setProfiles] = useState<any[]>([]) 
    
    // --- CONFIGURACIÓN GLOBAL ---
    const [globalConfig, setGlobalConfig] = useState<{prepagas: any[], subStates: any, origins: string[], postventa: any}>({
        prepagas: [], 
        subStates: {},
        origins: ['Google Ads', 'Meta Ads', 'Instagram', 'Facebook', 'Referido', 'Base de Datos', 'Oficina', 'Vendedor', 'Otro'],
        postventa: {
            financial_status: ['SIN MORA', 'PRE MORA', 'MORA 1', 'MORA 2', 'MORA 3', 'IMPAGO'],
            action_status: ['OK', 'PRESENTACION', 'CAMBIO DE PASS', 'MENSAJE MORA']
        }
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
    
    // --- FILTROS ---
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
    const [toast, setToast] = useState<{msg: string, type: 'success'|'error'|'warning'|'info'} | null>(null)

    // --- CARGA MANUAL ---
    const [isManualLoadOpen, setIsManualLoadOpen] = useState(false)
    const [manualLoadData, setManualLoadData] = useState({
        clientName: "", 
        dni: "", 
        prepaga: "", 
        plan: "", 
        source: "", 
        specificSeller: "",
        type: "alta" 
    })

    // --- NOTIFICACIONES ---
    const [notifications, setNotifications] = useState<any[]>([])
    const [newSaleNotif, setNewSaleNotif] = useState<any>(null)
    const [isBellOpen, setIsBellOpen] = useState(false) 
    const unreadCount = notifications.filter(n => !n.read).length

    // --- LOGOUT ---
    const handleLogout = async () => {
        await supabase.auth.signOut()
        window.location.href = "/" 
    }

    // --- HELPER DE NOTIFICACIONES UNIFICADO ---
    const notifyOPS = (title: string, body: string, type: 'success'|'info'|'warning' = 'info') => {
        // 1. Toast Visual
        showToast(title + ": " + body, type);
        
        // 2. Notificación Nativa del Navegador
        sendNativeNotification(title, body);

        // 3. Sonido
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(e => console.log("Audio blocked:", e));
        }
    }

    const showToast = (msg: string, type: 'success'|'error'|'warning'|'info' = 'success') => { 
        setToast({ msg, type }); 
        setTimeout(() => setToast(null), 5000) 
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
            const o = data.find(c => c.key === 'sales_origins')?.value || ['Google Ads', 'Meta Ads', 'Instagram', 'Facebook', 'Referido', 'Base de Datos', 'Oficina', 'Vendedor', 'Otro']
            const pv = data.find(c => c.key === 'postventa_config')?.value
            
            setGlobalConfig({ 
                prepagas: p, 
                subStates: s, 
                origins: o,
                postventa: pv || {
                    financial_status: ['SIN MORA', 'PRE MORA', 'MORA 1', 'MORA 2', 'MORA 3', 'IMPAGO'],
                    action_status: ['OK', 'PRESENTACION', 'CAMBIO DE PASS', 'MENSAJE MORA']
                }
            })
        }
    }

    // --- NOTIFICACIONES ---
    const fetchNotifications = async () => {
        // Escuchar notificaciones MÍAS, de "OPS" o de "Administración"
        const { data } = await supabase
            .from('notifications')
            .select('*')
            .or(`user_name.eq.${userName},user_name.eq.OPS,user_name.eq.Administración`) 
            .eq('read', false)
            .order('created_at', { ascending: false })
            .limit(20)
        
        if (data) setNotifications(data)
    }

    const markAllRead = async () => {
        const ids = notifications.map(n => n.id)
        setNotifications([]) // Limpiar visualmente
        if (ids.length > 0) {
            await supabase.from('notifications').update({ read: true }).in('id', ids)
        }
        showToast("Notificaciones limpiadas", 'success');
    }

    const handleNotificationClick = async (n: any) => {
        if (!n.read) {
            setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))
            await supabase.from('notifications').update({ read: true }).eq('id', n.id)
        }
        
        if (n.lead_id) {
            // Intentar encontrar la operación en la memoria local
            let targetOp = operations.find(o => o.id === n.lead_id)
            
            // Si no está (ej: recién vendida y no refrescada), buscarla en DB
            if (!targetOp) {
                const { data } = await supabase.from('leads').select('*').eq('id', n.lead_id).single()
                if (data) {
                    targetOp = { ...data, id: data.id, clientName: data.name, status: data.status } as any
                }
            }

            if (targetOp) {
                setViewMode('pool'); // Ir a la vista general para ver el modal tranquilo
                setSelectedOp(targetOp);
                setIsBellOpen(false);
            }
        }
    }

    // === FETCH OPERATIONS ===
    const fetchOperations = async () => {
        setIsLoading(true)
        
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
                let safeChat: any[] = [];
                try {
                    let rawComments = op.comments;
                    if (typeof rawComments === 'string') {
                        try { rawComments = JSON.parse(rawComments); } catch (e) { rawComments = [] }
                    }
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
                    created_at: op.created_at,
                    lastUpdate: op.last_update ? new Date(op.last_update).toLocaleDateString() : "Hoy",
                    type: op.type || "alta",
                    phone: op.phone || "",
                    chat: safeChat,
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
                    billing_portfolio_override: op.billing_portfolio_override,
                    fecha_alta: op.fecha_alta,
                    fecha_ingreso: op.fecha_ingreso,
                    post_sale_action: op.post_sale_action,
                    post_sale_status: op.post_sale_status
                }
            })
            setOperations(mappedOps)
        }
        setIsLoading(false)
    }

    useEffect(() => {
        // 1. Pedir permiso al cargar
        requestNotificationPermission();

        fetchProfiles()
        fetchPermissions()
        fetchSystemConfig() 
        fetchOperations()
        fetchNotifications() 
        
        // --- ⚡ EL OÍDO BIÓNICO DE OPS ⚡ ---
        const channel = supabase.channel('ops-realtime-manager-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (payload) => {
                const newData = payload.new as any
                const oldData = payload.old as any

                // 1. DETECTOR DE VENTA NUEVA (INSERT o UPDATE a vendido/ingresado)
                if (
                    (payload.eventType === 'INSERT' && (newData.status === 'vendido' || newData.status === 'ingresado')) ||
                    (payload.eventType === 'UPDATE' && (newData.status === 'vendido' || newData.status === 'ingresado') && oldData?.status !== newData.status)
                ) {
                    setNewSaleNotif({ client: newData.name, plan: newData.plan, seller: newData.agent_name })
                    notifyOPS("¡Venta Nueva! 🚀", `${newData.agent_name} ingresó a ${newData.name}`, 'success');
                }

                // 2. DETECTOR DE CAMBIO DE ESTADO (Para flujo)
                if (payload.eventType === 'UPDATE' && oldData && newData.status !== oldData.status && newData.status !== 'ingresado' && newData.status !== 'vendido') {
                    // Ignoramos movimientos previos a la venta (nuevo->contactado)
                    if (['precarga', 'medicas', 'legajo', 'cumplidas', 'rechazado', 'demoras'].includes(newData.status)) {
                        notifyOPS("Movimiento de Estado", `${newData.name} pasó a ${newData.status.toUpperCase()}`);
                    }
                }

                // 3. DETECTOR DE NOTAS NUEVAS (Evitar notificarse a uno mismo)
                if (payload.eventType === 'UPDATE' && oldData && newData.notes !== oldData.notes) {
                     // Solo avisar si la nota no contiene el timestamp actual (algo rudimentario pero funcional)
                     // O simplemente avisar genérico
                     notifyOPS("Nueva Nota 📝", `Se agregó información en ${newData.name}`);
                }

                // 4. DETECTOR DE POSVENTA
                if (payload.eventType === 'UPDATE' && oldData && (newData.post_sale_action !== oldData.post_sale_action || newData.post_sale_status !== oldData.post_sale_status)) {
                    notifyOPS("Novedad Posventa 🛠️", `${newData.name}: ${newData.post_sale_action} (${newData.post_sale_status})`, 'warning');
                }

                // 5. DETECTOR DE CHATS (Analizando el JSON de comments)
                if (payload.eventType === 'UPDATE' && oldData) {
                    const oldComments = typeof oldData.comments === 'string' ? JSON.parse(oldData.comments || '[]') : (oldData.comments || []);
                    const newComments = typeof newData.comments === 'string' ? JSON.parse(newData.comments || '[]') : (newData.comments || []);
                    
                    if (newComments.length > oldComments.length) {
                        const lastMsg = newComments[newComments.length - 1];
                        // Si el mensaje NO es mío, avisar
                        if (lastMsg.author !== userName) {
                            notifyOPS("Nuevo Mensaje 💬", `${lastMsg.author}: ${lastMsg.text}`, 'info');
                        }
                    }
                }
                
                // Refrescar lista visual
                fetchOperations() 
            })
            // Escuchar tabla notifications para alertas directas
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
                // Filtro: Si es para MÍ, o para OPS, o para ADMIN (si soy admin)
                const target = payload.new.user_name;
                if (target === userName || target === 'OPS' || (role.includes('admin') && target === 'Administración')) {
                    setNotifications(prev => [payload.new, ...prev])
                    notifyOPS("Nueva Notificación 🔔", payload.new.title || "Tenés un mensaje nuevo.");
                }
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'system_config' }, () => {
                fetchPermissions()
                fetchSystemConfig() 
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])


    const uniqueSellers = useMemo(() => Array.from(new Set(operations.map(o => o.seller).filter(Boolean))), [operations])
    
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
        
        if (viewMode === 'mine') {
            if (op.operator !== userName) return false
            if (['cumplidas', 'rechazado'].includes(op.status)) return false 
        }

        if (viewMode === 'pool' && (op.operator || ['cumplidas','rechazado'].includes(op.status))) return false
        
        if (filterStatus !== 'all' && op.status !== filterStatus) return false
        if (filterSubState !== 'all' && op.subState !== filterSubState) return false
        if (filterSeller !== 'all' && op.seller !== filterSeller) return false
        if (dateFilter.start && op.entryDate < dateFilter.start) return false
        if (dateFilter.end && op.entryDate > dateFilter.end) return false
        return true
    })

    const updateOpInDb = async (id: string, updates: any) => {
        const currentOp = operations.find(o => o.id === id)
        if (!currentOp) return

        const uiUpdates = { ...updates }
        if (updates.sub_state !== undefined) uiUpdates.subState = updates.sub_state
        if (updates.agent_name !== undefined) uiUpdates.seller = updates.agent_name
        if (updates.name !== undefined) uiUpdates.clientName = updates.name
        
        setOperations(prev => prev.map(o => o.id === id ? { ...o, ...uiUpdates } : o))
        
        const dbUpdates: any = {}
        const isDiff = (valA: any, valB: any) => JSON.stringify(valA) !== JSON.stringify(valB)

        if (uiUpdates.status && uiUpdates.status !== currentOp.status) dbUpdates.status = uiUpdates.status
        
        const newSub = uiUpdates.subState !== undefined ? uiUpdates.subState : uiUpdates.sub_state
        if (newSub !== undefined && newSub !== currentOp.subState) dbUpdates.sub_state = newSub

        const newSeller = uiUpdates.seller || uiUpdates.agent_name
        if (newSeller && newSeller !== currentOp.seller && !["Desconocido", "Sin Asignar"].includes(newSeller)) {
            dbUpdates.agent_name = newSeller
        }

        const newName = uiUpdates.clientName || uiUpdates.name
        if (newName && newName !== currentOp.clientName && newName !== "Sin Nombre") {
            dbUpdates.name = newName
        }

        if (uiUpdates.prepaga && uiUpdates.prepaga !== currentOp.prepaga && !["Sin Asignar", "Desconocido"].includes(uiUpdates.prepaga)) {
            dbUpdates.prepaga = uiUpdates.prepaga
        }

        if (uiUpdates.plan && uiUpdates.plan !== currentOp.plan && !["-", "Sin Asignar"].includes(uiUpdates.plan)) {
            dbUpdates.plan = uiUpdates.plan
        }

        if (uiUpdates.reminders !== undefined && isDiff(uiUpdates.reminders, currentOp.reminders)) dbUpdates.reminders = uiUpdates.reminders
        if (uiUpdates.hijos !== undefined && isDiff(uiUpdates.hijos, currentOp.hijos)) dbUpdates.family_members = uiUpdates.hijos
        if (uiUpdates.adminNotes !== undefined && isDiff(uiUpdates.adminNotes, currentOp.adminNotes)) dbUpdates.admin_notes = uiUpdates.adminNotes

        if (uiUpdates.operator !== undefined && uiUpdates.operator !== currentOp.operator) dbUpdates.operator = uiUpdates.operator 
        if (uiUpdates.dni !== undefined && uiUpdates.dni !== currentOp.dni && uiUpdates.dni !== "S/D") dbUpdates.dni = uiUpdates.dni
        if (uiUpdates.email !== undefined && uiUpdates.email !== currentOp.email) dbUpdates.email = uiUpdates.email
        if (uiUpdates.phone !== undefined && uiUpdates.phone !== currentOp.phone) dbUpdates.phone = uiUpdates.phone
        
        if (uiUpdates.address_street !== undefined && uiUpdates.address_street !== currentOp.address_street) dbUpdates.address_street = uiUpdates.address_street
        if (uiUpdates.address_city !== undefined && uiUpdates.address_city !== currentOp.address_city) dbUpdates.address_city = uiUpdates.address_city
        if (uiUpdates.address_zip !== undefined && uiUpdates.address_zip !== currentOp.address_zip) dbUpdates.address_zip = uiUpdates.address_zip
        
        if (uiUpdates.fullPrice !== undefined && uiUpdates.fullPrice !== currentOp.fullPrice) dbUpdates.full_price = uiUpdates.fullPrice
        if (uiUpdates.aportes !== undefined && uiUpdates.aportes !== currentOp.aportes) dbUpdates.aportes = uiUpdates.aportes
        if (uiUpdates.descuento !== undefined && uiUpdates.descuento !== currentOp.descuento) dbUpdates.descuento = uiUpdates.descuento

        if (uiUpdates.fecha_alta !== undefined) dbUpdates.fecha_alta = uiUpdates.fecha_alta
        if (uiUpdates.fecha_ingreso !== undefined) dbUpdates.fecha_ingreso = uiUpdates.fecha_ingreso

        if (Object.keys(dbUpdates).length === 0) return

        dbUpdates.last_update = new Date().toISOString()

        const { error } = await supabase.from('leads').update(dbUpdates).eq('id', id)
        
        if (error) {
            console.error("Error actualizando:", error)
            showToast("Error al guardar cambios en DB", "error")
        }
    }

    const updateOp = (newOp: Operation) => { 
        updateOpInDb(newOp.id, newOp)
        if (selectedOp && selectedOp.id === newOp.id) setSelectedOp(newOp); 
    }

    const handleSendChat = async (text: string) => {
        if (!selectedOp) return
        const newMsg = { text, author: userName, date: new Date().toISOString(), role: 'ops' }
        
        const { data: currentData } = await supabase.from('leads').select('comments').eq('id', selectedOp.id).single()
        
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

    // --- ACCIONES ---
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

    // --- CARGA MANUAL ---
    const handleCreateManualSale = async () => {
        if (!manualLoadData.clientName || !manualLoadData.dni) return;

        const { error } = await supabase.from('leads').insert({
            name: manualLoadData.clientName, 
            dni: manualLoadData.dni, 
            plan: manualLoadData.plan || "Base", 
            prepaga: manualLoadData.prepaga || "Generica",
            status: "ingresado", 
            sub_state: "Carga Manual", 
            agent_name: manualLoadData.specificSeller || "Admin", 
            created_at: new Date().toISOString(), 
            last_update: new Date().toISOString(), 
            type: manualLoadData.type, 
            source: manualLoadData.source || "Manual Admin" 
        })

        if (!error) {
            setIsManualLoadOpen(false)
            setManualLoadData({ clientName: "", dni: "", prepaga: "", plan: "", source: "", specificSeller: "", type: "alta" }) 
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
                                    {unreadCount > 0 && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 hover:text-red-500" onClick={markAllRead}>Limpiar Todo</Button>}
                                </div>
                                <div className="max-h-[300px] overflow-y-auto">
                                    {notifications.length === 0 ? <div className="p-4 text-center text-xs text-slate-400">Sin novedades.</div> : 
                                        notifications.map((n) => (
                                            <div 
                                                key={n.id} 
                                                onClick={() => handleNotificationClick(n)} 
                                                className={`p-3 border-b hover:bg-slate-50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/50' : ''}`}
                                            >
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
                        <div className="w-full h-full bg-slate-100 p-4 overflow-hidden">
                            <OpsKanban 
                                operations={filteredOps} 
                                profiles={profiles} 
                                onSelectOp={handleCardClick} 
                                onStatusChange={(id: string, newStatus: string) => updateOpInDb(id, { status: newStatus })} 
                            />
                        </div>
                    ) : (
                        <ScrollArea className="flex-1 h-full">
                            <div className="p-6">
                                {viewMode === 'dashboard' && <><OpsDashboard operations={operations} activeFilter={currentStageFilter} setActiveFilter={setCurrentStageFilter} /><div className="mt-8 border-t border-slate-200 pt-6"><OpsList operations={filteredOps} onSelectOp={handleCardClick} updateOp={updateOp} globalConfig={globalConfig} /></div></>}
                                
                                {['stage_list', 'pool', 'mine'].includes(viewMode) && <OpsList operations={filteredOps} onSelectOp={handleCardClick} updateOp={updateOp} globalConfig={globalConfig} />}
                                
                                {viewMode === 'metrics' && (role === 'admin_god' || permissions.accessMetrics) && <OpsMetrics />}
                                {viewMode === 'billing' && (role === 'admin_god' || permissions.accessBilling) && <OpsBilling />}
                                
                                {viewMode === 'post_sale' && (role === 'admin_god' || permissions.accessPostSale) && <OpsPostSale globalConfig={globalConfig} />}
                                
                                {viewMode === 'settings' && (role === 'admin_god' || permissions.editSettings) && <OpsSettings />}
                                
                                {viewMode === 'agenda' && <OpsAgenda operations={operations} generalTasks={generalTasks} setGeneralTasks={setGeneralTasks} onSelectOp={setSelectedOp} updateOp={updateOp} userName={userName} role={role} />}
                                {viewMode === 'chat' && (<OpsChat currentUser={userName} operations={operations} onViewSale={(op: any) => { setViewMode('pool'); setSelectedOp(op); }} />)}
                                {viewMode === 'database' && <OpsDatabase operations={filteredOps} onSelectOp={handleCardClick} />}
                                {viewMode === 'announcements' && <OpsAnnouncements />} 
                                {viewMode === 'history' && role === 'admin_god' && <OpsHistory />} 
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
            
            {/* --- MODAL ASIGNAR OPERADOR (ESTÉTICA PREMIUM MEJORADA) --- */}
            <Dialog open={!!assigningOp} onOpenChange={(open) => !open && setAssigningOp(null)}>
                <DialogContent className="max-w-[600px] w-full p-0 overflow-hidden border-0 shadow-2xl rounded-3xl gap-0 bg-slate-50">
                    <div className="bg-slate-900 p-8 relative flex flex-col items-center justify-center text-center overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-400 via-slate-900 to-slate-900"></div>
                        <button onClick={() => setAssigningOp(null)} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors z-20"><X size={20}/></button>
                        <div className="relative z-10 h-16 w-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-900/50 rotate-3">
                            <ShieldCheck className="h-8 w-8 text-white"/>
                        </div>
                        <DialogTitle className="relative z-10 text-white text-2xl font-black tracking-tight">Asignar Responsable</DialogTitle>
                        <DialogDescription className="relative z-10 text-blue-200 text-sm mt-1 font-medium">Seleccioná quien gestionará este caso.</DialogDescription>
                    </div>

                    <div className="p-8 bg-slate-50 grid grid-cols-2 gap-4 max-h-[450px] overflow-y-auto">
                        {adminUsers.length > 0 ? adminUsers.map((u) => (
                            <div 
                                key={u.id} 
                                onClick={() => confirmAssignment(u.full_name || u.email)} 
                                className="group relative cursor-pointer bg-white border border-slate-200 hover:border-blue-500/50 rounded-2xl p-4 flex items-center gap-4 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 active:scale-[0.98]"
                            >
                                <div className="relative shrink-0">
                                    <Avatar className="h-14 w-14 border-2 border-slate-100 shadow-sm group-hover:border-blue-100 transition-colors">
                                        <AvatarImage src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.email}`} className="object-cover h-full w-full" />
                                        <AvatarFallback className="bg-slate-800 text-white font-bold">{u.full_name?.[0] || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="absolute bottom-0 right-0 h-3.5 w-3.5 bg-green-500 border-2 border-white rounded-full"></div>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-slate-700 text-sm group-hover:text-blue-700 truncate transition-colors">
                                        {u.full_name || 'Usuario'}
                                    </span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full w-fit mt-1 ${u.role === 'admin_god' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {u.role === 'admin_god' ? 'Admin' : 'Operador'}
                                    </span>
                                </div>
                                <div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-[-10px] group-hover:translate-x-0 text-blue-500">
                                    <Check size={18} strokeWidth={3} />
                                </div>
                            </div>
                        )) : (
                            <div className="col-span-2 flex flex-col items-center justify-center py-10 opacity-50">
                                <User className="h-10 w-10 mb-2"/>
                                <p className="text-sm font-medium">No hay operadores disponibles.</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isManualLoadOpen} onOpenChange={setIsManualLoadOpen}>
                <DialogContent className="max-w-lg p-0 overflow-hidden border-0 shadow-2xl rounded-2xl gap-0">
                    <div className="bg-[#1e3a8a] p-6 text-white text-center transition-colors duration-300">
                        <div className="mx-auto bg-white/20 p-3 rounded-full w-fit mb-3">
                            {manualLoadData.type === 'alta' ? <FileCheck className="h-8 w-8 text-white"/> : <ArrowRightLeft className="h-8 w-8 text-white"/>}
                        </div>
                        <DialogTitle className="text-xl font-bold">Carga Manual de Operación</DialogTitle>
                        <DialogDescription className="text-white/70 text-xs">
                            {manualLoadData.type === 'alta' ? 'Ingreso de Venta Nueva' : 'Ingreso de Traspaso (Pass)'}
                        </DialogDescription>
                    </div>
                    
                    <div className="p-6 bg-white space-y-5">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => setManualLoadData({...manualLoadData, type: 'alta'})} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${manualLoadData.type === 'alta' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>✨ Alta Nueva</button>
                            <button onClick={() => setManualLoadData({...manualLoadData, type: 'pass'})} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${manualLoadData.type === 'pass' ? 'bg-white text-purple-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>🔄 Pass</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">Nombre Completo</Label><Input value={manualLoadData.clientName} onChange={e => setManualLoadData({...manualLoadData, clientName: e.target.value})} placeholder="Ej: Juan Pérez" className="h-9 text-slate-900"/></div>
                            <div className="space-y-1"><Label className="text-xs font-bold text-slate-500 uppercase">DNI / CUIL</Label><Input value={manualLoadData.dni} onChange={e => setManualLoadData({...manualLoadData, dni: e.target.value})} placeholder="Sin puntos" className="h-9 text-slate-900"/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Prepaga</Label>
                                <Select value={manualLoadData.prepaga} onValueChange={(v) => setManualLoadData({...manualLoadData, prepaga: v})}>
                                    <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                                    <SelectContent>{globalConfig.prepagas.map((p: any) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase">Plan</Label>
                                <Select value={manualLoadData.plan} onValueChange={(v) => setManualLoadData({...manualLoadData, plan: v})}>
                                    <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                                    <SelectContent>{(() => { const selectedPrepagaData = globalConfig.prepagas.find((p: any) => p.name === manualLoadData.prepaga); return (selectedPrepagaData?.plans || []).map((plan: string) => (<SelectItem key={plan} value={plan}>{plan}</SelectItem>)); })()}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Separator className="bg-slate-100"/>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Megaphone size={12}/> Origen del Dato</Label>
                                <Select value={manualLoadData.source} onValueChange={(v) => setManualLoadData({...manualLoadData, source: v})}>
                                    <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Ej: Google Ads..."/></SelectTrigger>
                                    <SelectContent>{globalConfig.origins.map((src) => (<SelectItem key={src} value={src}>{src}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><User size={12}/> Vendedor Responsable</Label>
                                <Select value={manualLoadData.specificSeller} onValueChange={(v) => setManualLoadData({...manualLoadData, specificSeller: v})}>
                                    <SelectTrigger className="h-9 text-slate-900"><SelectValue placeholder="Elegir..."/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Oficina" className="font-bold text-blue-700 bg-blue-50/50 mb-1"><Store size={14} className="inline mr-2"/>Oficina</SelectItem>
                                        <SelectItem value="Iara" className="font-bold text-purple-700 bg-purple-50/50 mb-1">iara</SelectItem>
                                        <SelectItem value="Otros" className="font-bold text-slate-700 bg-slate-50/50 mb-1">Otros</SelectItem>
                                        <div className="h-px bg-slate-200 my-1"></div>
                                        {sellerUsers.map(s => <SelectItem key={s.id} value={s.full_name || s.email}>{s.full_name || s.email}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
                        <Button variant="ghost" onClick={() => setIsManualLoadOpen(false)} className="text-slate-500">Cancelar</Button>
                        <Button className="bg-[#1e3a8a] hover:bg-blue-900 text-white w-32 font-bold shadow-md transition-colors" onClick={handleCreateManualSale}>{manualLoadData.type === 'alta' ? 'Cargar Venta' : 'Cargar Pass'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!confirmingAdvance} onOpenChange={(open) => !open && setConfirmingAdvance(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-blue-100 p-3 rounded-full mb-2"><Sparkles className="h-8 w-8 text-blue-600 animate-pulse"/></div><DialogTitle className="text-xl">¡Avanzar Etapa!</DialogTitle><DialogDescription>¿Avanzar caso a la siguiente etapa?</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmAdvanceAction} className="bg-blue-600 hover:bg-blue-700 w-full">Confirmar Avance</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingBack} onOpenChange={(open) => !open && setConfirmingBack(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-orange-100 p-3 rounded-full mb-2"><Undo2 className="h-8 w-8 text-orange-600"/></div><DialogTitle className="text-xl">Retroceder</DialogTitle><DialogDescription>El caso volverá a la etapa anterior.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmBackAction} variant="secondary" className="w-full border-orange-200 text-orange-700">Confirmar Retroceso</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingRelease} onOpenChange={(open) => !open && setConfirmingRelease(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-red-100 p-3 rounded-full mb-2"><Lock className="h-8 w-8 text-red-600"/></div><DialogTitle className="text-xl">Liberar Caso</DialogTitle><DialogDescription>Dejará de estar asignado a vos.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmReleaseAction} variant="destructive" className="w-full">Liberar Ahora</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={!!confirmingManualStatus} onOpenChange={(open) => !open && setConfirmingManualStatus(null)}><DialogContent className="sm:max-w-sm text-center p-6"><DialogHeader><div className="mx-auto bg-yellow-100 p-3 rounded-full mb-2"><AlertTriangle className="h-8 w-8 text-yellow-600"/></div><DialogTitle className="text-xl">Cambio Manual</DialogTitle><DialogDescription>Estás forzando un cambio de estado.</DialogDescription></DialogHeader><DialogFooter className="sm:justify-center mt-4"><Button onClick={confirmManualStatusChange} className="w-full">Confirmar Cambio</Button></DialogFooter></DialogContent></Dialog>
            <Dialog open={showCelebration} onOpenChange={setShowCelebration}><DialogContent className="sm:max-w-sm text-center p-8"><DialogHeader><div className="mx-auto bg-green-100 p-4 rounded-full mb-4"><PartyPopper className="h-10 w-10 text-green-600"/></div><DialogTitle className="text-2xl font-black text-green-700">¡FELICITACIONES!</DialogTitle><DialogDescription className="text-lg text-slate-600 mt-2">Venta concretada con éxito.</DialogDescription></DialogHeader><Button onClick={() => setShowCelebration(false)} className="mt-6 w-full bg-green-600 hover:bg-green-700">¡Excelente!</Button></DialogContent></Dialog>
        </div>
    )
}