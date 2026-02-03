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

// --- IMPORTAR UTILIDAD DE NOTIFICACIONES ---
import { sendNativeNotification, requestNotificationPermission } from "@/utils/notifications"

// --- COMPONENTES ---
import { Lead, LeadCard } from "./LeadCard"
import { DocConfirmDialog } from "./DocConfirmDialog"
import { LostLeadDialog } from "@/components/seller/LostLeadDialog"
import { WonLeadDialog } from "@/components/seller/WonLeadDialog"
import { QuotationDialog } from "@/components/seller/QuotationDialog"

// ✅ SONIDO PROFESIONAL
const ALARM_SOUND = "https://assets.mixkit.co/active_storage/sfx/2574/2574-preview.mp3"

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

const OVERDUE_HOURS = 72

// --- OVERDUE PRO: usa actividad real (v_lead_activity_rollup) + protege si hay agenda futura (scheduled_for / v_lead_next_touchpoint) ---
const getLeadActivityKey = (lead: any) => {
    // Preferimos actividad real, y caemos a lastUpdate/createdAt para no romper nada.
    return String(lead?.lastActivityAt || lead?.lastUpdate || lead?.createdAt || '')
}

const hasFutureAgenda = (lead: any) => {
    // 1) scheduled_for directo
    if (lead?.scheduled_for) {
        const t = new Date(lead.scheduled_for).getTime()
        if (Number.isFinite(t) && t >= Date.now()) return true
    }
    // 2) view v_lead_next_touchpoint
    if (lead?.has_future_touch && lead?.next_touch_at) {
        const t = new Date(lead.next_touch_at).getTime()
        if (Number.isFinite(t) && t >= Date.now()) return true
    }
    return false
}

const isLeadOverdue = (lead: any) => {
    const status = String(lead?.status || '').toLowerCase()
    if (!['cotizacion', 'contactado'].includes(status)) return false

    // Si hay agenda futura, no tiene sentido alertar cotización vencida
    if (hasFutureAgenda(lead)) return false

    const lastUpdateStr = getLeadActivityKey(lead)
    if (!lastUpdateStr) return false

    const lastUpdate = new Date(lastUpdateStr)
    const now = new Date()
    const diffHours = Math.ceil(Math.abs(now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60))
    return diffHours > OVERDUE_HOURS
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
    const isOverdue = isLeadOverdue(lead)
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
    const [ackZombieIds, setAckZombieIds] = useState<string[]>([])
    const [ackOverdue, setAckOverdue] = useState<Record<string, string>>({})

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
    const [announcementId, setAnnouncementId] = useState<number | null>(null)

    const audioRef = useRef<HTMLAudioElement | null>(null)
    const CURRENT_USER = userName || "Maca"
    const [currentUserId, setCurrentUserId] = useState<string | null>(null)

    // --- ACK LOCAL DE ALERTA ZOMBIE (para que no vuelva a molestar con el pop-up) ---
    const ZOMBIE_ACK_STORAGE_KEY = `kanban_zombie_ack:${CURRENT_USER}`
    const OVERDUE_ACK_STORAGE_KEY = `kanban_overdue_ack:${CURRENT_USER}`

    // --- USER ID (para announcement_reads, que usa auth.users) ---
    useEffect(() => {
        let alive = true
            ; (async () => {
                const { data, error } = await supabase.auth.getUser()
                if (!alive) return
                if (error) {
                    console.warn('[KanbanBoard] supabase.auth.getUser error', error)
                    return
                }
                setCurrentUserId(data?.user?.id ?? null)
            })()
        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = localStorage.getItem(ZOMBIE_ACK_STORAGE_KEY)
            if (!raw) { setAckZombieIds([]); return }
            const parsed = JSON.parse(raw)
            setAckZombieIds(Array.isArray(parsed) ? parsed : [])
        } catch {
            setAckZombieIds([])
        }
    }, [ZOMBIE_ACK_STORAGE_KEY])

    // --- ACK LOCAL DE ALERTA VENCIDO (para que no vuelva a molestar con el pop-up) ---
    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            const raw = localStorage.getItem(OVERDUE_ACK_STORAGE_KEY)
            if (!raw) { setAckOverdue({}); return }
            const parsed = JSON.parse(raw)
            setAckOverdue(parsed && typeof parsed === 'object' ? parsed : {})
        } catch {
            setAckOverdue({})
        }
    }, [OVERDUE_ACK_STORAGE_KEY])

    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            localStorage.setItem(OVERDUE_ACK_STORAGE_KEY, JSON.stringify(ackOverdue))
        } catch { }
    }, [ackOverdue, OVERDUE_ACK_STORAGE_KEY])


    useEffect(() => {
        if (typeof window === 'undefined') return
        try {
            localStorage.setItem(ZOMBIE_ACK_STORAGE_KEY, JSON.stringify(ackZombieIds))
        } catch { }
    }, [ackZombieIds, ZOMBIE_ACK_STORAGE_KEY])

    const acknowledgeZombie = (leadId?: string | null) => {
        if (!leadId) return
        setAckZombieIds(prev => (prev.includes(leadId) ? prev : [...prev, leadId]))
    }

    const isOverdueAcked = (lead: any) => {
        const id = lead?.id
        if (!id) return false
        const key = getLeadActivityKey(lead)
        return ackOverdue[id] === key
    }

    const acknowledgeOverdue = (lead?: any | null) => {
        const id = lead?.id
        if (!id) return
        const key = getLeadActivityKey(lead)
        setAckOverdue(prev => ({ ...prev, [id]: key }))
    }
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))

    const mapLeads = (data: any[]) => data.map((item: any) => ({
        id: item.id, name: item.name, phone: item.phone, source: item.source, status: item.status.toLowerCase(),
        lastUpdate: item.last_update || item.created_at, createdAt: item.created_at, agent: item.agent_name,
        calls: item.calls || 0, quoted_prepaga: item.quoted_prepaga, quoted_plan: item.quoted_plan, quoted_price: item.quoted_price, notes: item.notes || '',
        scheduled_for: item.scheduled_for, intent: item.intent || 'medium', prepaga: item.prepaga, observations: item.observations, capitas: item.capitas,
        warning_sent: item.warning_sent,
        // ✅ NUEVO: Campos de Sofía IA
        chat_source: item.chat_source,
        ai_labels: item.ai_labels || [],
        // Campos extra (no rompen LeadCard):
        lastActivityAt: item.last_activity_at || item.lastActivityAt,
        has_future_touch: item.has_future_touch,
        next_touch_at: item.next_touch_at
    }))

    // --- ENRIQUECER LEADS (actividad real + touchpoint futuro) ---
    const enrichLeads = async (base: any[]) => {
        const ids = (base || []).map(l => l?.id).filter(Boolean)
        if (ids.length === 0) return base

        const [rollRes, touchRes] = await Promise.all([
            supabase.from('v_lead_activity_rollup').select('lead_id,last_activity_at').in('lead_id', ids),
            supabase.from('v_lead_next_touchpoint').select('lead_id,has_future_touch,next_touch_at').in('lead_id', ids),
        ])

        const rollMap = new Map((rollRes.data ?? []).map((r: any) => [r.lead_id, r.last_activity_at]))
        const touchMap = new Map((touchRes.data ?? []).map((t: any) => [t.lead_id, t]))

        return (base || []).map((l: any) => {
            const lastActivityAt = rollMap.get(l.id) || l.lastActivityAt
            const touch = touchMap.get(l.id)
            return {
                ...l,
                lastActivityAt: lastActivityAt || l.lastActivityAt,
                has_future_touch: touch?.has_future_touch ?? l.has_future_touch,
                next_touch_at: touch?.next_touch_at ?? l.next_touch_at,
            }
        })
    }


    const fetchLeads = async () => {
        const visibleStatuses = ['nuevo', 'contactado', 'cotizacion', 'documentacion'];
        const { data } = await supabase.from('leads').select('*').eq('agent_name', CURRENT_USER).in('status', visibleStatuses)
        if (data) {
            const mapped = mapLeads(data)
            const enriched = await enrichLeads(mapped)
            setLeads(enriched)
        }
    }

    const checkUrgentMessage = async () => {
        // 1) Traer el ultimo comunicado bloqueante
        const { data: ann, error: annErr } = await supabase
            .from('announcements')
            .select('*')
            .eq('is_blocking', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

        if (annErr) {
            console.warn('[KanbanBoard] checkUrgentMessage announcements error', annErr)
            return
        }
        if (!ann) return

        // 2) Ver si ya fue leido por este usuario (announcement_reads usa user_id)
        const uid = currentUserId
        if (!uid) return

        const { data: read, error: readErr } = await supabase
            .from('announcement_reads')
            .select('id')
            .eq('announcement_id', ann.id)
            .eq('user_id', uid)
            .limit(1)
            .maybeSingle()

        if (readErr) {
            console.warn('[KanbanBoard] checkUrgentMessage reads error', readErr)
            return
        }

        if (!read) {
            setUrgentMessage(ann.message)
            setAnnouncementId(ann.id)
        }
    }

    const dismissUrgentMessage = async () => {
        if (announcementId) {
            const uid = currentUserId
            if (uid) {
                const { error } = await supabase
                    .from('announcement_reads')
                    .upsert(
                        { announcement_id: announcementId, user_id: uid, read_at: new Date().toISOString() },
                        { onConflict: 'announcement_id,user_id' }
                    )
                if (error) console.warn('[KanbanBoard] dismissUrgentMessage upsert error', error)
            }
        }
        setUrgentMessage(null)
        setAnnouncementId(null)
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

    const stopAudio = () => {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    }

    // ✅ EFECTO BLINDADO DE NOTIFICACIONES
    useEffect(() => {
        requestNotificationPermission();
        fetchLeads()

        // --- 1. CANAL DE LEADS (Solo mis datos) ---
        const leadsChannel = supabase.channel('kanban_leads_vfinal')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `agent_name=eq.${CURRENT_USER}` }, async (payload) => {
                const newData = payload.new as any;
                const oldData = payload.old as any;

                // A) NUEVO DATO EN 'SIN TRABAJAR' (Req #1)
                if (payload.eventType === 'INSERT' && newData.status === 'nuevo') {
                    let newLead = mapLeads([newData])[0]
                    try { newLead = (await enrichLeads([newLead]))[0] } catch { }
                    setLeads(prev => [newLead, ...prev])

                    const title = "¡Nuevo Lead! 📥";
                    const body = `Te asignaron a ${newData.name}.`;

                    // Notificación Completa (Toast + Nativa + Sonido)
                    sendNativeNotification(title, body);
                    toast.success(title, { description: body, action: { label: "Ver", onClick: () => onLeadClick && onLeadClick(newData.id) } })

                    // ✅ GUARDAR EN DB PARA LA CAMPANITA
                    await supabase.from('notifications').insert({
                        user_name: CURRENT_USER,
                        title: title,
                        body: body,
                        type: 'lead_assigned',
                        lead_id: newData.id,
                        read: false
                    });
                }

                // B) CAMBIO DE ESTADO EN MYSALESVIEW (Req #4)
                if (payload.eventType === 'UPDATE' && newData) {
                    let updated = mapLeads([newData])[0]
                    try { updated = (await enrichLeads([updated]))[0] } catch { }

                    // Si sigue en el tablero, actualizarlo
                    if (['nuevo', 'contactado', 'cotizacion', 'documentacion'].includes(updated.status)) {
                        setLeads(prev => {
                            const exists = prev.some(l => l.id === updated.id)
                            return exists ? prev.map(l => l.id === updated.id ? updated : l) : [updated, ...prev]
                        })
                    } else {
                        // Si se fue a otra etapa (vendido, perdido, etc), sacarlo
                        setLeads(prev => prev.filter(l => l.id !== updated.id))
                    }

                    // DETECTOR DE CAMBIO DE ESTADO (De Legajo a Medicas, etc)
                    const opsStages = ['precarga', 'medicas', 'legajo', 'demoras', 'cumplidas', 'rechazado', 'vendido'];

                    if (oldData && newData.status !== oldData.status && opsStages.includes(newData.status)) {
                        const title = "Movimiento en Venta 🔄";
                        const body = `${newData.name} pasó a: ${newData.status.toUpperCase()}`;

                        sendNativeNotification(title, body);
                        toast.info(title, { description: body })

                        // ✅ GUARDAR EN DB PARA LA CAMPANITA
                        await supabase.from('notifications').insert({
                            user_name: CURRENT_USER,
                            title: title,
                            body: body,
                            type: 'lead_stage_change',
                            lead_id: newData.id,
                            read: false
                        });
                    }
                }
            })
            .subscribe()

        // --- 2. CANAL DE CHATS (Req #2) ---
        const chatChannel = supabase.channel('kanban_messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_messages' }, async (payload) => {
                const msg = payload.new as any

                // Solo si NO soy yo quien mandó el mensaje
                if (msg.sender !== CURRENT_USER) {
                    // Verificar si el lead es mío (Doble chequeo)
                    const { data: leadData } = await supabase.from('leads').select('agent_name, name').eq('id', msg.lead_id).single()

                    if (leadData && leadData.agent_name === CURRENT_USER) {
                        const title = `Mensaje de ${msg.sender} 💬`;
                        const body = `${leadData.name}: ${msg.text}`;

                        sendNativeNotification(title, body);
                        toast.message(title, { description: body, action: { label: "Responder", onClick: () => onLeadClick && onLeadClick(msg.lead_id) } })

                        // ✅ GUARDAR EN DB PARA LA CAMPANITA
                        await supabase.from('notifications').insert({
                            user_name: CURRENT_USER,
                            title: title,
                            body: body,
                            type: 'chat_message',
                            lead_id: msg.lead_id,
                            read: false
                        });
                    }
                }
            })
            .subscribe()

        // --- 3. CANAL DE NOTIFICACIONES ADMIN (Req #3) ---
        const notifChannel = supabase.channel('kanban_notifications_direct')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_name=eq.${CURRENT_USER}` }, (payload) => {
                const n = payload.new as any;
                const autoTypes = ['lead_assigned', 'lead_stage_change', 'chat_message'];

                if (!autoTypes.includes(n.type)) {
                    sendNativeNotification(n.title, n.body);
                    toast.info(n.title, { description: n.body });
                }
            })
            .subscribe()

        // ANUNCIOS GLOBALES
        const announcementsChannel = supabase.channel('kanban_announcements')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
                const newData = payload.new as any
                if (newData.is_blocking) {
                    setUrgentMessage(newData.message)
                    setAnnouncementId(newData.id)
                    sendNativeNotification("⚠️ Comunicado Urgente", newData.message);
                }
            })
            .subscribe()

        if (typeof window !== 'undefined') {
            audioRef.current = new Audio(ALARM_SOUND);
            audioRef.current.loop = true;
        }

        return () => {
            supabase.removeChannel(leadsChannel);
            supabase.removeChannel(chatChannel);
            supabase.removeChannel(notifChannel);
            supabase.removeChannel(announcementsChannel);
            stopAudio();
        }
    }, [CURRENT_USER])

    // Chequeo de comunicado bloqueante cuando ya tenemos el user_id
    useEffect(() => {
        if (!currentUserId) return
        checkUrgentMessage()
    }, [currentUserId, CURRENT_USER])

    // MONITOR AGENDA
    useEffect(() => {
        const checkAgendas = () => {
            const now = new Date();
            const urgentLead = leads.find(l => l.scheduled_for && new Date(l.scheduled_for) <= now && !ignoredAlarmIds.includes(l.id));
            if (urgentLead && !alarmLead && !showConfirmCall) {
                setAlarmLead(urgentLead);
                sendNativeNotification("⏰ ¡Llamada Programada!", `Tenés que llamar a ${urgentLead.name} ahora.`);
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
            audioRef.current.play().catch(() => { });
        } else {
            stopAudio();
        }
    }, [zombieLead, alarmLead, overdueLead]);

    useEffect(() => {
        const found = leads.find((l: any) => l.warning_sent === true && !ackZombieIds.includes(l.id));
        if (found) setZombieLead(found);
        else setZombieLead(null);
    }, [leads, ackZombieIds]);
    useEffect(() => {
        // ALERTA VENCIDO PRO:
        // - Se basa en actividad real (lastActivityAt) y NO molesta si hay agenda futura.
        // - Además, si el usuario la cerró para ese mismo "ciclo" de actividad, no vuelve a aparecer.
        const found = leads.find((l: any) => isLeadOverdue(l) && !l.warning_sent && !isOverdueAcked(l));
        if (found) setOverdueLead(found);
        else setOverdueLead(null);
    }, [leads, ackOverdue]);

    const logHistory = async (leadId: string, fromStatus: string, toStatus: string) => {
        await supabase.from('lead_status_history').insert({
            lead_id: leadId, agent_name: CURRENT_USER, from_status: fromStatus, to_status: toStatus, changed_at: new Date().toISOString()
        })
    }

    const handleCallIncrement = async (leadId: string) => {
        const lead = leads.find(l => l.id === leadId); if (!lead) return
        const newCallCount = lead.calls + 1
        const now = new Date()
        const timestamp = now.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
        const updatedNotes = (lead.notes || "") + (lead.notes ? "|||" : "") + `SEP_NOTE|${timestamp}|SISTEMA|Llamada realizada #${newCallCount}`
        let newStatus = lead.status
        const isBurned = newCallCount >= 7 && (lead.status === 'nuevo' || lead.status === 'contactado')
        if (isBurned) newStatus = 'perdido'
        if (isBurned) setLeads(prev => prev.filter(l => l.id !== leadId))
        else setLeads(prev => prev.map(l => l.id === leadId ? { ...l, calls: newCallCount, notes: updatedNotes } : l))
        await supabase.from('leads').update({ calls: newCallCount, notes: updatedNotes, status: newStatus.toLowerCase(), last_update: new Date().toISOString(), loss_reason: isBurned ? 'Dato quemado' : null }).eq('id', leadId)
        if (isBurned) logHistory(leadId, lead.status, 'perdido')

        // ✅ MENSAJE AUTOMÁTICO EN PRIMERA LLAMADA (solo leads de Sofia, dentro de ventana de 24hs)
        if (lead.chat_source === 'sofia_ai' && newCallCount === 1 && lead.phone) {
            try {
                // Verificar si estamos dentro de la ventana de 24hs de Meta
                const lastUpdate = new Date(lead.last_update || lead.created_at).getTime()
                const now = Date.now()
                const hoursElapsed = (now - lastUpdate) / (1000 * 60 * 60)

                if (hoursElapsed <= 24) {
                    const { sendManualWhatsAppMessage } = await import('@/app/actions/send-whatsapp')
                    const nombreVendedora = lead.agent_name || 'una asesora'
                    const mensaje = `💬 ¡Hola! Te está intentando llamar *${nombreVendedora}* para darte la info que pediste 📞\n\n¿En qué momento te queda más cómodo que te contactemos? 😊`

                    await sendManualWhatsAppMessage(lead.phone, mensaje)
                    console.log(`✅ Mensaje de primera llamada enviado a ${lead.name}`)
                    toast.success("Mensaje enviado al cliente")
                } else {
                    console.log(`⚠️ No se envió mensaje a ${lead.name}: fuera de ventana de 24hs (${hoursElapsed.toFixed(1)}hs)`)
                }
            } catch (err) {
                console.error(`❌ Error enviando mensaje de primera llamada:`, err)
            }
        }
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

    const handleSnooze = async () => {
        if (!alarmLead) return;
        stopAudio();
        const leadId = alarmLead.id;
        const newTime = new Date(new Date().getTime() + 10 * 60000).toISOString();
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, scheduled_for: newTime } : l));
        setAlarmLead(null);
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
            if (overCol === 'cotizacion') {
                const hasQuote = (activeLead.quoted_price && activeLead.quoted_price > 0) || activeLead.quoted_plan
                if (!hasQuote) {
                    setLeadProcessingId(active.id as string);
                    setIsQuoteDialogOpen(true);
                    return
                }
            }

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

            {/* ... DIALOGS ... */}
            <LostLeadDialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen} onConfirm={async (reason, notes) => { const leadId = leadProcessingId; setLeads(prev => prev.filter(l => l.id !== leadId)); setIsLostDialogOpen(false); if (leadId) { const oldLead = leads.find(l => l.id === leadId); await supabase.from('leads').update({ status: 'perdido', loss_reason: reason, notes: (oldLead?.notes || "") + `\n[PERDIDO]: ${notes}`, last_update: new Date().toISOString() }).eq('id', leadId); if (oldLead) logHistory(leadId, oldLead.status, 'perdido') } }} />

            {/* ✅ FIX REAL (restaurado): guardamos EXACTO lo que manda WonLeadDialog */}
            <WonLeadDialog
                open={isWonDialogOpen}
                onOpenChange={setIsWonDialogOpen}
                leadId={leadProcessingId || ""}
                onConfirm={async (data: any) => {
                    const leadId = leadProcessingId
                    if (!leadId) return

                    const nowIso = new Date().toISOString()

                    // Helpers seguros
                    const toNum = (v: any) => {
                        if (v === null || v === undefined || v === "") return 0
                        const n = Number(v)
                        return Number.isFinite(n) ? n : 0
                    }
                    const stripUndef = (obj: any) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

                    const { files, source, origen_dato, utm_source, utm_medium, utm_campaign, utm_content, utm_term, ...leadData } = (data || {})
                    const oldLead = leads.find(l => l.id === leadId)

                    // UI local: lo sacamos del tablero (va a Ops)
                    setLeads(prev => prev.filter(l => l.id !== leadId))
                    setIsWonDialogOpen(false)

                    // Base: no inventamos columnas, guardamos lo que viene del dialog
                    const payloadBase: any = {
                        ...leadData,
                        last_update: nowIso,
                    }

                    // quoted_* visual
                    const qPrice = payloadBase.full_price != null ? toNum(payloadBase.full_price) : (payloadBase.quoted_price != null ? toNum(payloadBase.quoted_price) : 0)
                    const qPrep = payloadBase.prepaga ?? payloadBase.quoted_prepaga ?? null
                    const qPlan = payloadBase.plan ?? payloadBase.quoted_plan ?? null

                    const payload: any = {
                        ...payloadBase,
                        quoted_price: qPrice,
                        quoted_prepaga: qPrep,
                        quoted_plan: qPlan,

                        // Normalizamos números si vinieran como string
                        full_price: payloadBase.full_price != null ? toNum(payloadBase.full_price) : undefined,
                        aportes: payloadBase.aportes != null ? toNum(payloadBase.aportes) : undefined,
                        descuento: payloadBase.descuento != null ? toNum(payloadBase.descuento) : undefined,
                        total_a_pagar: payloadBase.total_a_pagar != null ? toNum(payloadBase.total_a_pagar) : undefined,
                        capitas: payloadBase.capitas != null ? Math.max(0, parseInt(String(payloadBase.capitas), 10) || 0) : undefined,
                    }

                    // Notes: apendizamos sin romper
                    if (leadData?.notes) {
                        const prev = (oldLead?.notes || "").toString()
                        payload.notes = prev ? `${prev}\n${leadData.notes}` : leadData.notes
                    }

                    const finalPayload = stripUndef(payload)

                    const { error } = await supabase.from('leads').update(finalPayload).eq('id', leadId)

                    if (error) {
                        console.error("Error confirmando venta:", error)
                        // ✅ MOSTRAR EL ERROR REAL (así dejamos de adivinar)
                        alert(`Hubo un error al guardar: ${error.message}`)
                    } else if (oldLead) {
                        const toStatus = (finalPayload.status || 'ingresado').toString()
                        logHistory(leadId, oldLead.status, toStatus)
                    }
                }}
            />


            <QuotationDialog
                open={isQuoteDialogOpen}
                onOpenChange={setIsQuoteDialogOpen}
                onConfirm={async (data: any) => {
                    const leadId = leadProcessingId
                    if (!leadId) return

                    const oldLead = leads.find(l => l.id === leadId)

                    // ✅ Normalizar precio (soporta "136.900" / "136,900" / "136900")
                    const cleaned = String(data?.price ?? "")
                        .replace(/\s/g, "")
                        .replace(/\./g, "")
                        .replace(/,/g, ".")
                    const price = Number(cleaned)
                    if (!Number.isFinite(price) || price <= 0) {
                        toast.error("Precio inválido. Revisá la cotización.")
                        return
                    }

                    // 1) Resolver si esta cotización debe ser la principal
                    //    Si el lead no tiene quoted_* aún, la hacemos principal para mantener consistencia (LeadCard + LeadDetail)
                    const shouldBeMain =
                        !(oldLead?.quoted_price && oldLead.quoted_price > 0) && !oldLead?.quoted_plan

                    if (shouldBeMain) {
                        // Si había cotizaciones previas, bajamos cualquier main para no duplicar principales
                        await supabase.from("quotes").update({ is_main: false }).eq("lead_id", leadId)
                    }

                    // 2) Insertar en historial de cotizaciones (LeadDetail lee desde 'quotes')
                    const { error: qErr } = await supabase.from("quotes").insert({
                        lead_id: leadId,
                        prepaga: data.prepaga,
                        plan: data.plan,
                        price,
                        is_main: shouldBeMain,
                    })
                    if (qErr) {
                        console.warn("[KanbanBoard] insert quote error", qErr)
                        // No frenamos el flujo, pero avisamos
                        toast.error("No pude guardar la cotización en el historial.")
                    }

                    // 3) Actualizar lead (para LeadCard y para que deje de bloquear el paso a Cotización)
                    setLeads(prev =>
                        prev.map(l =>
                            l.id === leadId
                                ? {
                                    ...l,
                                    status: "cotizacion",
                                    ...(shouldBeMain
                                        ? { quoted_prepaga: data.prepaga, quoted_plan: data.plan, quoted_price: price }
                                        : {}),
                                }
                                : l
                        )
                    )
                    setIsQuoteDialogOpen(false)

                    const updatePayload: any = { status: "cotizacion", last_update: new Date().toISOString() }
                    if (shouldBeMain) {
                        updatePayload.quoted_prepaga = data.prepaga
                        updatePayload.quoted_plan = data.plan
                        updatePayload.quoted_price = price
                    }

                    await supabase.from("leads").update(updatePayload).eq("id", leadId)

                    if (oldLead) logHistory(leadId, oldLead.status, "cotizacion")
                }}
                onCancel={() => setIsQuoteDialogOpen(false)}
            />
            <DocConfirmDialog open={isDocConfirmOpen} onOpenChange={setIsDocConfirmOpen} onConfirm={async () => { const leadId = leadProcessingId; if (!leadId) return; const oldLead = leads.find(l => l.id === leadId); setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'documentacion' } : l)); setIsDocConfirmOpen(false); await supabase.from('leads').update({ status: 'documentacion' }).eq('id', leadId); if (oldLead) logHistory(leadId, oldLead.status, 'documentacion') }} onCancel={() => setIsDocConfirmOpen(false)} />

            {/* ALERTA ZOMBIE */}
            <Dialog open={!!zombieLead} onOpenChange={() => { acknowledgeZombie(zombieLead?.id); setZombieLead(null); stopAudio(); }}>
                <DialogContent className="border-4 border-red-500 max-w-md shadow-[0_0_50px_rgba(220,38,38,0.5)] animate-in zoom-in duration-300 bg-white" aria-describedby="zombie-desc">
                    <DialogHeader className="text-center"><div className="mx-auto bg-red-100 p-4 rounded-full mb-4 w-fit border-2 border-red-500 animate-pulse"><Skull className="h-10 w-10 text-red-600" /></div><DialogTitle className="text-3xl font-black text-red-600 uppercase tracking-tight">¡ALERTA DE SUPERVISIÓN!</DialogTitle><DialogDescription id="zombie-desc" className="text-lg text-slate-700 mt-2 font-bold">El lead <span className="text-xl bg-red-100 px-2 rounded text-red-800">{zombieLead?.name}</span> lleva más de 72hs inactivo.</DialogDescription></DialogHeader>
                    <div className="flex flex-col gap-3 mt-4"><Button className="w-full h-14 bg-red-600 hover:bg-red-700 text-white font-black text-lg gap-2 shadow-lg" onClick={() => { acknowledgeZombie(zombieLead?.id); window.open(`https://wa.me/${zombieLead?.phone}?text=Hola! Te escribo para retomar tu consulta.`, '_blank'); }}><MessageCircle size={24} fill="currentColor" /> RECUPERAR AHORA</Button><Button variant="outline" className="w-full h-10 text-slate-400" onClick={() => { acknowledgeZombie(zombieLead?.id); setZombieLead(null); stopAudio(); }}>Entendido, lo gestionaré.</Button></div>
                </DialogContent>
            </Dialog>

            {/* ALERTA VENCIDO */}
            <Dialog open={!!overdueLead && !zombieLead} onOpenChange={() => { acknowledgeOverdue(overdueLead); setOverdueLead(null); stopAudio(); }}>
                <DialogContent className="border-4 border-yellow-400 max-w-md shadow-2xl animate-in zoom-in duration-300" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()} aria-describedby="overdue-desc">
                    <DialogHeader className="text-center"><div className="mx-auto bg-yellow-100 p-4 rounded-full mb-4 w-fit border-2 border-yellow-400"><AlertOctagon className="h-10 w-10 text-yellow-600 animate-pulse" /></div><DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">¡COTIZACIÓN VENCIDA!</DialogTitle><DialogDescription id="overdue-desc" className="text-base text-slate-600 mt-2 font-medium">Pasaron más de 72 horas sin novedades con <br /><span className="text-xl font-bold text-slate-900 bg-yellow-200 px-2 rounded">{overdueLead?.name}</span></DialogDescription></DialogHeader>
                    <div className="flex flex-col gap-3 mt-4"><Button className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold text-lg gap-2" onClick={() => { acknowledgeOverdue(overdueLead); window.open(`https://wa.me/${overdueLead?.phone}?text=Hola`, '_blank'); }}><MessageCircle size={24} fill="currentColor" /> Enviar WhatsApp Ya</Button><Button variant="outline" className="w-full h-12 border-2 border-slate-200" onClick={() => { acknowledgeOverdue(overdueLead); setOverdueLead(null); stopAudio(); }}>Ignorar por ahora</Button></div>
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
                            <Button
                                onClick={handleSnooze}
                                variant="outline"
                                className="w-full h-10 border-slate-200 text-slate-500 hover:text-blue-600 gap-2"
                            >
                                <Clock size={16} /> Aplazar 10 minutos
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ✅ 2. DIÁLOGO DE CONFIRMACIÓN */}
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

            {/* ✅ 3. COMUNICADO URGENTE */}
            <Dialog open={!!urgentMessage} onOpenChange={() => { }}>
                <DialogContent className="bg-red-600 border-none text-white max-w-lg shadow-[0_0_100px_rgba(220,38,38,0.5)]" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
                    <div className="flex flex-col items-center text-center p-6 gap-4">
                        <div className="bg-white/20 p-4 rounded-full animate-bounce">
                            <AlertTriangle size={48} className="text-white" />
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
