"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase"
import {
    DndContext, DragOverlay, pointerWithin, KeyboardSensor, PointerSensor,
    useSensor, useSensors, DragEndEvent, useDroppable,
    closestCorners,
    rectIntersection
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
// ✅ Íconos seguros
import { ArchiveX, Trophy, BellRing, AlertOctagon, Skull, MessageCircle, Phone, CheckCircle2, Clock, AlertTriangle } from "lucide-react" 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

// --- COMPONENTES ---
import { Lead, LeadCard } from "./LeadCard"
import { DocConfirmDialog } from "./DocConfirmDialog"
import { LostLeadDialog } from "@/components/seller/LostLeadDialog"
import { WonLeadDialog } from "@/components/seller/WonLeadDialog" 
import { QuotationDialog } from "@/components/seller/QuotationDialog"

const ALARM_SOUND = "https://assets.mixkit.co/active_storage/sfx/933/933-preview.mp3"

const ACTIVE_COLUMNS = [
    { id: "nuevo", title: "Sin Trabajar 📥", color: "bg-slate-100 dark:bg-[#18191A] border dark:border-[#3E4042]" },
    { id: "contactado", title: "En Contacto 📞", color: "bg-blue-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
    { id: "cotizacion", title: "Cotización 💲", color: "bg-yellow-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
    { id: "documentacion", title: "Documentación 📂", color: "bg-purple-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
]

const sortLeadsLogic = (a: Lead, b: Lead) => {
    const now = new Date().getTime();
    const aSched = a.scheduled_for ? new Date(a.scheduled_for).getTime() : null;
    const bSched = b.scheduled_for ? new Date(b.scheduled_for).getTime() : null;
    if (aSched && bSched) return aSched - bSched;
    if (aSched && aSched <= now) return -1;
    if (bSched && bSched <= now) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

const isLeadOverdue = (lastUpdateStr: string, status: string) => {
    if (!['cotizacion', 'contactado'].includes(status)) return false;
    const lastUpdate = new Date(lastUpdateStr);
    const now = new Date();
    const diffHours = Math.ceil(Math.abs(now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60));
    return diffHours > 72;
}

function SortableItem({ lead, onClick, onCallIncrement, onOmniClick, onResolveAgenda }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
    
    const style: React.CSSProperties = { 
        transform: CSS.Transform.toString(transform), 
        transition, 
        opacity: isDragging ? 0.3 : 1,
        touchAction: 'none'
    }
    
    if (isDragging && style.transform) {
        style.transform += " scale(1.05)";
    }

    const isUrgent = lead.scheduled_for && new Date(lead.scheduled_for) <= new Date()
    const isOverdue = isLeadOverdue(lead.lastUpdate, lead.status)
    const isZombie = (lead as any).warning_sent === true

    return (
        <div id={`lead-${lead.id}`} ref={setNodeRef} style={style} {...attributes} {...listeners} 
            onClick={() => onClick(lead)} 
            className={`rounded-xl relative transition-all duration-500 ease-in-out 
            ${isUrgent ? "ring-4 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse border-red-500 bg-red-50/10" : ""}
            ${isOverdue ? "ring-4 ring-yellow-400 border-yellow-300 shadow-[0_0_15px_rgba(250,204,21,0.5)] animate-pulse" : ""}
            ${isZombie ? "ring-4 ring-red-600 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.6)] animate-pulse bg-red-50" : ""}`}>
            
            {isUrgent && (
                <div 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        onResolveAgenda(lead); 
                    }} 
                    className="absolute -top-3 -left-3 bg-red-600 hover:bg-red-500 text-white p-2 rounded-full z-50 shadow-xl border-2 border-white animate-bounce cursor-pointer hover:scale-110 transition-transform group"
                    title="Click para desactivar alarma"
                >
                    <BellRing className="h-5 w-5 fill-white" />
                </div>
            )}
            
            {isOverdue && !isZombie && (
                <div className="absolute -top-3 -right-3 bg-yellow-500 text-white p-1.5 rounded-full z-50 shadow-lg border-2 border-white animate-bounce">
                    <AlertOctagon className="h-4 w-4" />
                </div>
            )}
            
            {isZombie && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full z-50 shadow-2xl border-2 border-white animate-bounce flex items-center gap-2">
                    <Skull className="h-4 w-4" /> <span className="text-[10px] font-black uppercase">Recupero</span>
                </div>
            )}
            
            <LeadCard lead={lead} onCallIncrement={() => onCallIncrement(lead.id)} onOmniClick={() => onOmniClick(lead.id)} />
        </div>
    )
}

function KanbanColumn({ col, leads, onClickLead, onCallIncrement, onOmniClick, onResolveAgenda }: any) {
    const { setNodeRef } = useDroppable({ id: col.id })
    return (
        <div ref={setNodeRef} className={`min-w-[300px] w-[300px] flex flex-col rounded-xl ${col.color} h-full max-h-full border shadow-sm`}>
            {/* Header Fijo */}
            <div className="flex justify-between items-center p-4 pb-2 text-slate-700 shrink-0 bg-inherit rounded-t-xl z-10">
                <h3 className="font-black text-xs uppercase tracking-wider">{col.title}</h3>
                <span className="bg-white text-[10px] font-black px-2 py-1 rounded-full shadow-sm border">{leads.length}</span>
            </div>
            {/* Contenido Scrolleable */}
            <div className="flex-1 overflow-y-auto p-4 pt-2 custom-scrollbar">
                <SortableContext items={leads.map((l: any) => l.id)} strategy={verticalListSortingStrategy}>
                    <div className="flex flex-col gap-4 pb-4">
                        {leads.map((lead: any) => (
                            <SortableItem key={lead.id} lead={lead} onClick={() => onClickLead(lead)} onCallIncrement={onCallIncrement} onOmniClick={onOmniClick} onResolveAgenda={onResolveAgenda} />
                        ))}
                    </div>
                </SortableContext>
            </div>
        </div>
    )
}

function DropZone({ id, children, className }: any) {
    const { setNodeRef, isOver } = useDroppable({ id })
    return <div ref={setNodeRef} className={`${className} transition-all duration-300 ${isOver ? 'scale-110 ring-4 ring-white shadow-2xl opacity-100' : 'opacity-80'}`}>{children}</div>
}

export function KanbanBoard({ userName, onLeadClick }: { userName?: string, onLeadClick?: (id: string) => void }) {
    const supabase = createClient()
    const [leads, setLeads] = useState<Lead[]>([])
    const [activeId, setActiveId] = useState<string | null>(null)
    const [alarmLead, setAlarmLead] = useState<Lead | null>(null)
    const [leadProcessingId, setLeadProcessingId] = useState<string | null>(null)
    const [ignoredAlarmIds, setIgnoredAlarmIds] = useState<string[]>([])

    // Dialogs
    const [showConfirmCall, setShowConfirmCall] = useState<Lead | null>(null) 
    const [isLostDialogOpen, setIsLostDialogOpen] = useState(false)
    const [isWonDialogOpen, setIsWonDialogOpen] = useState(false)
    const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false)
    const [isDocConfirmOpen, setIsDocConfirmOpen] = useState(false)
    const [overdueLead, setOverdueLead] = useState<Lead | null>(null)
    const [zombieLead, setZombieLead] = useState<Lead | null>(null)
    
    // Comunicado Urgente
    const [urgentMessage, setUrgentMessage] = useState<string | null>(null)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const CURRENT_USER = userName || "Maca"

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

    const mapLeads = (data: any[]) => data.map((item: any) => ({
        id: item.id, name: item.name, phone: item.phone, source: item.source, status: item.status.toLowerCase(),
        lastUpdate: item.last_update || item.created_at, createdAt: item.created_at, agent: item.agent_name,
        calls: item.calls || 0, quoted_prepaga: item.quoted_prepaga, quoted_plan: item.quoted_plan, quoted_price: item.quoted_price, notes: item.notes || '',
        scheduled_for: item.scheduled_for, intent: item.intent || 'medium', prepaga: item.prepaga, observations: item.observations, capitas: item.capitas,
        warning_sent: item.warning_sent 
    }))

    const fetchLeads = async () => {
        const visibleStatuses = ['nuevo', 'contactado', 'cotizacion', 'documentacion'];
        const { data } = await supabase.from('leads').select('*').eq('agent_name', CURRENT_USER).in('status', visibleStatuses) 
        if (data) setLeads(mapLeads(data))
    }

    const checkUrgentMessage = async () => {
        const { data } = await supabase.from('profiles').select('urgent_message').eq('full_name', CURRENT_USER).single()
        if (data?.urgent_message) setUrgentMessage(data.urgent_message)
    }

    const dismissUrgentMessage = async () => {
        await supabase.from('profiles').update({ urgent_message: null }).eq('full_name', CURRENT_USER)
        setUrgentMessage(null)
    }

    const customCollisionDetection = (args: any) => {
        const pointerCollisions = pointerWithin(args);
        if (pointerCollisions.length > 0) return pointerCollisions;
        const intersections = rectIntersection(args);
        if (intersections.length > 0) {
            const overId = intersections[0].id;
            if (leads.some(l => l.id === overId)) {
                const lead = leads.find(l => l.id === overId);
                if (lead) return [{ id: lead.status }];
            }
        }
        return closestCorners(args);
    };

    // --- STOP AUDIO HELPER ---
    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }

    useEffect(() => {
        fetchLeads()
        checkUrgentMessage()

        // Canal de Leads (Cambios)
        const channel = supabase.channel('kanban_realtime_vfinal')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `agent_name=eq.${CURRENT_USER}` }, (payload) => {
                const newData = payload.new as any;
                
                // Notificaciones Inteligentes
                if (payload.eventType === 'INSERT') {
                    if (newData && !['perdido', 'vendido', 'rechazado', 'cumplidas', 'ingresado'].includes(newData.status)) {
                        const newLead = mapLeads([newData])[0]
                        setLeads(prev => [newLead, ...prev])
                        toast.success(`¡Nuevo Lead! ${newData.name}`, { 
                            description: "Hacé click para ver detalles", 
                            action: { label: "Ver", onClick: () => onLeadClick && onLeadClick(newData.id) } 
                        })
                    }
                } else if (payload.eventType === 'UPDATE') {
                    if (newData) {
                        const updated = mapLeads([newData])[0]
                        
                        if (['ingresado', 'precarga', 'medicas', 'legajo', 'cumplidas', 'vendido'].includes(updated.status)) {
                             toast.info(`¡Movimiento en Venta! ${updated.name}`, { description: `Pasó a: ${updated.status.toUpperCase()}` })
                        }

                        if (['perdido', 'vendido', 'rechazado', 'cumplidas', 'ingresado'].includes(updated.status)) {
                            setLeads(prev => prev.filter(l => l.id !== updated.id))
                        } else {
                            setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))
                        }
                    }
                }
            })
            .subscribe()
        
        // Canal de Mensajes (Admin/Ops)
        const chatChannel = supabase.channel('kanban_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_messages' }, async (payload) => {
                const msg = payload.new as any
                if (msg.target_role === 'seller' || msg.sender === 'Supervisión' || msg.sender === 'Administración') {
                    const { data: leadData } = await supabase.from('leads').select('agent_name, name').eq('id', msg.lead_id).single()
                    if (leadData && leadData.agent_name === CURRENT_USER) {
                        toast.message(`Mensaje de ${msg.sender}`, {
                            description: `${leadData.name}: ${msg.text.substring(0, 30)}...`,
                            action: { label: "Responder", onClick: () => onLeadClick && onLeadClick(msg.lead_id) } 
                        })
                    }
                }
            })
            .subscribe()

        // Canal de Comunicados (Profiles)
        const profileChannel = supabase.channel('kanban_profile_updates')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `full_name=eq.${CURRENT_USER}` }, (payload) => {
                const newData = payload.new as any
                if(newData.urgent_message) setUrgentMessage(newData.urgent_message)
            })
            .subscribe()

        if (typeof window !== 'undefined') { 
            audioRef.current = new Audio(ALARM_SOUND); 
            audioRef.current.loop = true; 
        }
        
        return () => { 
            supabase.removeChannel(channel);
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(profileChannel);
            stopAudio();
        }
    }, [CURRENT_USER])

    // MONITOR AGENDA
    useEffect(() => {
        const checkAgendas = () => {
            const now = new Date();
            const urgentLead = leads.find(l => l.scheduled_for && new Date(l.scheduled_for) <= now && !ignoredAlarmIds.includes(l.id));
            if (urgentLead && !alarmLead && !showConfirmCall) {
                setAlarmLead(urgentLead);
            }
        };
        const intervalId = setInterval(checkAgendas, 15000); 
        checkAgendas(); 
        return () => clearInterval(intervalId);
    }, [leads, alarmLead, showConfirmCall, ignoredAlarmIds]);

    // AUDIO MANAGER
    useEffect(() => {
        const shouldPlay = !!zombieLead || !!alarmLead || !!overdueLead;
        if (shouldPlay && audioRef.current) {
            audioRef.current.volume = 0.5;
            audioRef.current.play().catch(() => {});
        } else {
            stopAudio();
        }
    }, [zombieLead, alarmLead, overdueLead]);

    useEffect(() => { const found = leads.find((l: any) => l.warning_sent === true); if (found) setZombieLead(found); }, [leads]);
    useEffect(() => { const found = leads.find(l => isLeadOverdue(l.lastUpdate, l.status)); if (found && !found.warning_sent) setOverdueLead(found); }, [leads]);

    const logHistory = async (leadId: string, fromStatus: string, toStatus: string) => {
        await supabase.from('lead_status_history').insert({
            lead_id: leadId, agent_name: CURRENT_USER, from_status: fromStatus, to_status: toStatus, changed_at: new Date().toISOString()
        })
    }

    const handleCallIncrement = async (leadId: string) => {
        const lead = leads.find(l => l.id === leadId); if (!lead) return
        const newCallCount = lead.calls + 1
        const timestamp = new Date().toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' })
        const updatedNotes = (lead.notes || "") + (lead.notes ? "|||" : "") + `SEP_NOTE|${timestamp}|SISTEMA|Llamada realizada #${newCallCount}`
        let newStatus = lead.status
        const isBurned = newCallCount >= 7 && (lead.status === 'nuevo' || lead.status === 'contactado')
        if (isBurned) newStatus = 'perdido'
        if (isBurned) setLeads(prev => prev.filter(l => l.id !== leadId))
        else setLeads(prev => prev.map(l => l.id === leadId ? { ...l, calls: newCallCount, notes: updatedNotes } : l))
        await supabase.from('leads').update({ calls: newCallCount, notes: updatedNotes, status: newStatus.toLowerCase(), last_update: new Date().toISOString(), loss_reason: isBurned ? 'Dato quemado' : null }).eq('id', leadId)
        if (isBurned) logHistory(leadId, lead.status, 'perdido')
    }

    const handleOmniClick = (leadId: string) => {
        const lead = leads.find(l => l.id === leadId); if (!lead) return
        const omniUrl = localStorage.getItem("omni_url")
        if (!omniUrl) { alert("⚠️ No tenés configurado tu link de OmniLeads."); return }
        const cleanPhone = lead.phone.replace(/[^0-9]/g, '')
        navigator.clipboard.writeText(cleanPhone)
        window.open(omniUrl, '_blank')
    }

    const handleCompleteAgenda = async () => {
        if (!showConfirmCall) return;
        const leadId = showConfirmCall.id;
        stopAudio(); 
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, scheduled_for: undefined } : l))
        setShowConfirmCall(null);
        setAlarmLead(null); 
        await supabase.from('leads').update({ scheduled_for: null, last_update: new Date().toISOString() }).eq('id', leadId)
    }

    const handleManageNow = () => {
        if (!alarmLead) return;
        stopAudio(); 
        setIgnoredAlarmIds(prev => [...prev, alarmLead.id])
        if (onLeadClick) onLeadClick(alarmLead.id);
        setAlarmLead(null);
    }

    // ✅ FUNCIÓN DE APLAZAR (RESTAURADA)
    const handleSnooze = async () => {
        if (!alarmLead) return;
        stopAudio();
        const leadId = alarmLead.id;
        const newTime = new Date(new Date().getTime() + 10 * 60000).toISOString();
        
        // Actualizar localmente
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, scheduled_for: newTime } : l));
        setAlarmLead(null); 
        
        // Actualizar en DB
        await supabase.from('leads').update({ scheduled_for: newTime, last_update: new Date().toISOString() }).eq('id', leadId);
        toast.success("Alarma aplazada 10 minutos 💤");
    }

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event; 
        setActiveId(null); 
        if (!over) return
        const activeLead = leads.find(l => l.id === active.id); if (!activeLead) return
        if (over.id === 'zone-perdido') { setLeadProcessingId(active.id as string); setIsLostDialogOpen(true); return }
        if (over.id === 'zone-vendido') { setLeadProcessingId(active.id as string); setIsWonDialogOpen(true); return }
        let overCol = over.id as string
        const leadTarget = leads.find(l => l.id === overCol); if (leadTarget) overCol = leadTarget.status;
        const colIdx = (id: string) => ACTIVE_COLUMNS.findIndex(c => c.id === id)
        const isTryingToGoBack = colIdx(overCol) < colIdx(activeLead.status);
        if (['cotizacion', 'documentacion'].includes(activeLead.status) && isTryingToGoBack) return;
        if (overCol && overCol !== activeLead.status && ACTIVE_COLUMNS.some(c => c.id === overCol)) {
            if (overCol === 'cotizacion') { setLeadProcessingId(active.id as string); setIsQuoteDialogOpen(true); return }
            if (overCol === 'documentacion') { setLeadProcessingId(active.id as string); setIsDocConfirmOpen(true); return }
            setLeads(prev => prev.map(l => l.id === active.id ? { ...l, status: overCol } : l))
            await supabase.from('leads').update({ status: overCol.toLowerCase(), last_update: new Date().toISOString() }).eq('id', active.id)
            logHistory(active.id as string, activeLead.status, overCol)
        }
    }

    const sortLeads = (columnId: string) => leads.filter(l => l.status === columnId).sort(sortLeadsLogic)
    const activeLeadForOverlay = activeId ? leads.find(l => l.id === activeId) : null;

    return (
        <div className="flex flex-col h-full relative overflow-hidden bg-slate-50/50">
            {/* SIN TOOLBAR - LIMPIO */}

            <DndContext sensors={sensors} collisionDetection={customCollisionDetection} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
                <div className="flex-1 flex gap-6 overflow-x-auto p-8 h-full items-start">
                    {ACTIVE_COLUMNS.map((col) => (
                        <KanbanColumn 
                            key={col.id} 
                            col={col} 
                            leads={sortLeads(col.id)} 
                            onClickLead={(l: any) => { if (onLeadClick) onLeadClick(l.id); }} 
                            onCallIncrement={handleCallIncrement} 
                            onOmniClick={handleOmniClick} 
                            onResolveAgenda={(l: Lead) => { 
                                stopAudio();
                                setShowConfirmCall(l);
                            }} 
                        />
                    ))}
                </div>
                {activeId && (<div className="fixed bottom-10 left-0 right-0 flex justify-center gap-12 z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-10 px-4"><DropZone id="zone-perdido" className="pointer-events-auto flex flex-col items-center justify-center w-64 h-32 rounded-3xl bg-white/90 backdrop-blur-md border-4 border-red-200 shadow-2xl"><ArchiveX className="h-10 w-10 text-red-600 mb-2" /> <span className="font-black uppercase tracking-tighter text-red-600">Perdido</span></DropZone><DropZone id="zone-vendido" className="pointer-events-auto flex flex-col items-center justify-center w-64 h-32 rounded-3xl bg-white/90 backdrop-blur-md border-4 border-emerald-200 shadow-2xl"><Trophy className="h-10 w-10 text-emerald-600 mb-2" /> <span className="font-black uppercase tracking-tighter text-emerald-600">¡Venta Lograda! 🚀</span></DropZone></div>)}
                
                <DragOverlay>
                    {activeId && activeLeadForOverlay ? (
                        <div className="cursor-grabbing rotate-3 scale-105 transition-transform duration-200 shadow-2xl opacity-90">
                            <LeadCard lead={activeLeadForOverlay} />
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>
            
            {/* ... DIALOGS (Lost, Won, Quote, Doc) SIN CAMBIOS ... */}
            <LostLeadDialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen} onConfirm={async (reason, notes) => { const leadId = leadProcessingId; setLeads(prev => prev.filter(l => l.id !== leadId)); setIsLostDialogOpen(false); if(leadId) { const oldLead = leads.find(l => l.id === leadId); await supabase.from('leads').update({ status: 'perdido', loss_reason: reason, notes: (oldLead?.notes || "") + `\n[PERDIDO]: ${notes}`, last_update: new Date().toISOString() }).eq('id', leadId); if(oldLead) logHistory(leadId, oldLead.status, 'perdido') } }} />
            <WonLeadDialog open={isWonDialogOpen} onOpenChange={setIsWonDialogOpen} onConfirm={async (data: any) => { const leadId = leadProcessingId; if (!leadId) return; const { files, ...leadData } = data; const oldLead = leads.find(l => l.id === leadId); setLeads(prev => prev.filter(l => l.id !== leadId)); setIsWonDialogOpen(false); const payload: any = { status: 'vendido', last_update: new Date().toISOString(), quoted_price: leadData.price ? Number(leadData.price) : 0, quoted_prepaga: leadData.prepaga || null, quoted_plan: leadData.plan || null, notes: leadData.notes ? (oldLead?.notes || "") + `\n[VENTA]: ${leadData.notes}` : oldLead?.notes }; if (leadData.afiliado_number) payload.afiliado_number = leadData.afiliado_number; if (leadData.cuit) payload.cuit = leadData.cuit; if (leadData.aporte) payload.aporte = leadData.aporte; if (leadData.derivacion_aportes) payload.derivacion_aportes = leadData.derivacion_aportes; if (leadData.cant_capitas) payload.cant_capitas = Number(leadData.cant_capitas); const { error } = await supabase.from('leads').update(payload).eq('id', leadId); if (error) { console.error("Error confirmando venta:", error); alert("Hubo un error al guardar. Verificá los campos numéricos."); } else if (oldLead) { logHistory(leadId, oldLead.status, 'vendido') } }} />
            <QuotationDialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen} onConfirm={async (data: any) => { const leadId = leadProcessingId; if(!leadId) return; const oldLead = leads.find(l => l.id === leadId); setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'cotizacion', quoted_prepaga: data.prepaga, quoted_plan: data.plan, quoted_price: data.price } : l)); setIsQuoteDialogOpen(false); await supabase.from('leads').update({ status: 'cotizacion', quoted_prepaga: data.prepaga, quoted_plan: data.plan, quoted_price: data.price, last_update: new Date().toISOString() }).eq('id', leadId); if(oldLead) logHistory(leadId, oldLead.status, 'cotizacion') }} onCancel={() => setIsQuoteDialogOpen(false)} />
            <DocConfirmDialog open={isDocConfirmOpen} onOpenChange={setIsDocConfirmOpen} onConfirm={async () => { const leadId = leadProcessingId; if(!leadId) return; const oldLead = leads.find(l => l.id === leadId); setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'documentacion' } : l)); setIsDocConfirmOpen(false); await supabase.from('leads').update({ status: 'documentacion' }).eq('id', leadId); if(oldLead) logHistory(leadId, oldLead.status, 'documentacion') }} onCancel={() => setIsDocConfirmOpen(false)} />

            {/* ALERTA ZOMBIE */}
            <Dialog open={!!zombieLead} onOpenChange={() => { setZombieLead(null); stopAudio(); }}>
                <DialogContent className="border-4 border-red-500 max-w-md shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-in zoom-in duration-300 bg-white" aria-describedby="zombie-desc">
                    <DialogHeader className="text-center"><div className="mx-auto bg-red-100 p-4 rounded-full mb-4 w-fit border-2 border-red-500 animate-pulse"><Skull className="h-10 w-10 text-red-600" /></div><DialogTitle className="text-3xl font-black text-red-600 uppercase tracking-tight">¡ALERTA DE SUPERVISIÓN!</DialogTitle><DialogDescription id="zombie-desc" className="text-lg text-slate-700 mt-2 font-bold">El lead <span className="text-xl bg-red-100 px-2 rounded text-red-800">{zombieLead?.name}</span> lleva más de 72hs inactivo.</DialogDescription></DialogHeader>
                    <div className="flex flex-col gap-3 mt-4"><Button className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black text-lg gap-2 shadow-lg" onClick={() => window.open(`https://wa.me/${zombieLead?.phone}?text=Hola! Te escribo para retomar tu consulta.`, '_blank')}><MessageCircle size={24} fill="currentColor" /> RECUPERAR AHORA</Button><Button variant="outline" className="w-full h-10 text-slate-400" onClick={() => { setZombieLead(null); stopAudio(); }}>Entendido, lo gestionaré.</Button></div>
                </DialogContent>
            </Dialog>
            
            {/* ALERTA VENCIDO */}
            <Dialog open={!!overdueLead && !zombieLead} onOpenChange={() => { setOverdueLead(null); stopAudio(); }}>
                <DialogContent className="border-4 border-yellow-400 max-w-md shadow-2xl animate-in zoom-in duration-300" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} aria-describedby="overdue-desc">
                    <DialogHeader className="text-center"><div className="mx-auto bg-yellow-100 p-4 rounded-full mb-4 w-fit border-2 border-yellow-400"><AlertOctagon className="h-10 w-10 text-yellow-600 animate-pulse" /></div><DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">¡COTIZACIÓN VENCIDA!</DialogTitle><DialogDescription id="overdue-desc" className="text-base text-slate-600 mt-2 font-medium">Pasaron más de 72 horas sin novedades con <br /><span className="text-xl font-bold text-slate-900 bg-yellow-200 px-2 rounded">{overdueLead?.name}</span></DialogDescription></DialogHeader>
                    <div className="flex flex-col gap-3 mt-4"><Button className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold text-lg gap-2" onClick={() => window.open(`https://wa.me/${overdueLead?.phone}?text=Hola`, '_blank')}><MessageCircle size={24} fill="currentColor" /> Enviar WhatsApp Ya</Button><Button variant="outline" className="w-full h-12 border-2 border-slate-200" onClick={() => { setOverdueLead(null); stopAudio(); }}>Ignorar por ahora</Button></div>
                </DialogContent>
            </Dialog>

            {/* ✅ 1. POP-UP PROFESIONAL DE ALARMA + SNOOZE */}
            <Dialog open={!!alarmLead} onOpenChange={(open) => !open && handleManageNow()}>
                <DialogContent className="max-w-[400px] border-0 shadow-2xl p-0 overflow-hidden bg-white" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} aria-describedby="alarm-desc">
                    
                    <div className="bg-[#1e3a8a] p-6 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-cyan-300"></div>
                        <div className="bg-white/10 p-3 rounded-full w-fit mx-auto mb-3 backdrop-blur-sm animate-[pulse_2s_infinite]">
                            <Clock className="h-8 w-8 text-white" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-white tracking-wide">RECORDATORIO DE AGENDA</DialogTitle>
                        <DialogDescription id="alarm-desc" className="text-blue-100 text-xs mt-1">Tenés una llamada programada ahora.</DialogDescription>
                    </div>

                    <div className="p-6 text-center">
                        <Avatar className="h-20 w-20 mx-auto mb-4 border-4 border-slate-50 shadow-md">
                            <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${alarmLead?.name}`} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-2xl">{alarmLead?.name?.[0]}</AvatarFallback>
                        </Avatar>
                        
                        <h2 className="text-2xl font-black text-slate-800 mb-1">{alarmLead?.name}</h2>
                        <div className="flex items-center justify-center gap-2 text-slate-500 text-sm mb-6 bg-slate-50 py-1 px-3 rounded-full w-fit mx-auto">
                            <Phone size={14} /> {alarmLead?.phone}
                        </div>

                        <div className="flex flex-col gap-3">
                            <Button 
                                onClick={handleManageNow} 
                                className="w-full h-12 text-md font-bold bg-[#1e3a8a] hover:bg-blue-900 text-white rounded-xl shadow-lg transition-all active:scale-[0.98]"
                            >
                                GESTIONAR AHORA
                            </Button>
                            {/* ✅ BOTÓN SNOOZE (APLAZAR) - CON ÍCONO CLOCK SEGURO */}
                            <Button 
                                onClick={handleSnooze}
                                variant="outline"
                                className="w-full h-10 border-slate-200 text-slate-500 hover:text-blue-600 gap-2"
                            >
                                <Clock size={16}/> Aplazar 10 minutos
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ✅ 2. DIÁLOGO DE CONFIRMACIÓN (Al tocar la campanita roja) */}
            <Dialog open={!!showConfirmCall} onOpenChange={() => setShowConfirmCall(null)}>
                <DialogContent className="sm:max-w-md border-0 shadow-2xl bg-white rounded-2xl" aria-describedby="confirm-desc">
                    <DialogHeader className="text-center pb-2 pt-4">
                        <div className="mx-auto bg-green-50 p-4 rounded-full w-fit mb-3 ring-8 ring-green-50/50">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <DialogTitle className="text-2xl font-black text-slate-800">¿Gestión Realizada?</DialogTitle>
                        <DialogDescription id="confirm-desc" className="text-slate-500 font-medium px-4">
                            Si ya llamaste a <span className="text-slate-900 font-bold">{showConfirmCall?.name}</span>, confirmalo para limpiar la alerta.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-1 gap-3 p-4">
                        <Button onClick={handleCompleteAgenda} className="w-full h-14 bg-green-600 hover:bg-green-700 text-white font-bold text-lg rounded-xl shadow-md transition-all active:scale-[0.98]">
                            ✅ SÍ, YA LLAMÉ
                        </Button>
                        <Button onClick={() => setShowConfirmCall(null)} variant="ghost" className="w-full h-10 text-slate-400 hover:text-slate-600 hover:bg-slate-50 font-medium">
                            Todavía no (Mantener Alarma)
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ✅ 3. COMUNICADO URGENTE (BLOQUEANTE) */}
            <Dialog open={!!urgentMessage} onOpenChange={() => {}}>
                <DialogContent className="bg-red-600 border-none text-white max-w-lg shadow-[0_0_100px_rgba(220,38,38,0.5)]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <div className="flex flex-col items-center text-center p-6 gap-4">
                        <div className="bg-white/20 p-4 rounded-full animate-bounce">
                            <AlertTriangle size={48} className="text-white"/>
                        </div>
                        <DialogTitle className="text-3xl font-black uppercase tracking-widest">Comunicado Urgente</DialogTitle>
                        <p className="text-lg font-medium leading-relaxed bg-white/10 p-6 rounded-xl w-full border border-white/20">
                            {urgentMessage}
                        </p>
                        <Button onClick={dismissUrgentMessage} className="bg-white text-red-600 hover:bg-red-50 font-black w-full h-12 text-lg shadow-lg mt-4">
                            ENTENDIDO
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}