"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  User, MapPin, Briefcase, StickyNote, ArrowLeft, ArrowRight, 
  Phone, UploadCloud, MessageSquare, Calendar as CalendarIcon, 
  FileUp, MessageCircle, UserPlus, ArrowRightLeft, Plus, ImageIcon, 
  Users, CheckSquare, Save, Clock, FileText, DollarSign, Wallet, Percent,
  Eye, Download, X, AlertTriangle, Send, UserCog, CalendarDays, Loader2, 
  Check, Trash2, Megaphone, Key, ShieldCheck, ShieldAlert
} from "lucide-react"
import { getStatusColor, getSubStateStyle } from "./data"

// --- CACHE SIMPLE PARA ORIGENES (evita refetch constante y escala mejor) ---
const ___OPS_ORIGINS_CACHE_TTL_MS = 10 * 60 * 1000
let __opsOriginsCache: { values: string[]; fetchedAt: number } | null = null

// --- COMPONENTES UI INTERNOS ---

function TabTrigger({ value, label, icon }: any) {
    return (
        <TabsTrigger value={value} className="data-[state=active]:border-b-4 data-[state=active]:border-blue-600 rounded-none h-full px-4 gap-2 text-slate-400 text-xs font-black uppercase tracking-widest transition-all flex-1">
            {icon} {label}
        </TabsTrigger>
    )
}

function EditableField({ label, value, onBlur, onChange, icon, color, prefix, suffix, type="text" }: any) {
    const [localValue, setLocalValue] = useState(value || "")
    
    useEffect(() => { 
        if (value !== undefined && value !== null) {
            setLocalValue(value)
        }
    }, [value])

    // ✅ LÓGICA AGREGADA: Pegado inteligente de fechas
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (type === 'date') {
            e.preventDefault();
            const text = e.clipboardData.getData('text');
            // Detecta 24/03/1998 o 24-03-1998
            const match = text.match(/^(\d{2})[\/-](\d{2})[\/-](\d{4})$/);
            if (match) {
                const [_, day, month, year] = match;
                const isoDate = `${year}-${month}-${day}`;
                setLocalValue(isoDate);
                if (onChange) onChange(isoDate);
                if (onBlur) onBlur(isoDate);
            }
        }
    };

    return (
        <div className="flex flex-col gap-1 items-start w-full group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                {icon} {label}
            </span>
            <div className="relative w-full">
                {prefix && <span className="absolute left-0 bottom-1.5 text-xs text-slate-400 font-bold">{prefix}</span>}
                <Input 
                    type={type}
                    className={`text-sm font-medium border-0 border-b border-transparent group-hover:border-slate-200 focus-visible:border-blue-500 focus-visible:ring-0 px-0 h-7 rounded-none transition-all ${color || 'text-slate-800'} ${prefix ? 'pl-4' : ''}`}
                    value={localValue}
                    onPaste={handlePaste} // ✅ Conectado
                    onChange={(e) => { 
                        setLocalValue(e.target.value)
                        if(onChange) onChange(e.target.value) 
                    }}
                    onBlur={() => onBlur && onBlur(localValue)}
                />
                {suffix && <span className="absolute right-0 bottom-1.5 text-xs text-slate-400 font-bold">{suffix}</span>}
            </div>
        </div>
    )
}

function FileCard({ file, onPreview, onDownload, onDelete }: any) {
    const isImg = file.type === 'IMG' || (file.name && file.name.match(/\.(jpg|jpeg|png|webp|gif)$/i))
    const size = file.metadata?.size ? `${(file.metadata.size / 1024 / 1024).toFixed(2)} MB` : "Doc"

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all group relative overflow-hidden">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${!isImg ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {!isImg ? <FileText size={18}/> : <ImageIcon size={18}/>}
            </div>
            
            <div className="overflow-hidden flex-1 flex flex-col justify-center cursor-pointer" onClick={() => onPreview(file)}>
                <p className="text-xs font-bold truncate text-slate-700 group-hover:text-blue-600">{file.name}</p>
                <p className="text-[10px] text-slate-400">{size}</p>
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => onPreview(file)} title="Ver">
                    <Eye size={16}/>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50" onClick={() => onDownload(file)} title="Descargar">
                    <Download size={16}/>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => onDelete(file)} title="Eliminar">
                    <Trash2 size={16}/>
                </Button>
            </div>
        </div>
    )
}

function ChatBubble({ user, text, time, isMe }: any) {
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-in slide-in-from-bottom-2`}>
            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-[13px] ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-slate-700 rounded-bl-none shadow-sm'}`}>
                {!isMe && <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-tighter">{user}</p>}
                {text}
            </div>
            <span className="text-[9px] text-slate-400 mt-1 px-1 font-bold">{time}</span>
        </div>
    )
}

// --- MODAL PRINCIPAL ---

export function OpsModal({ 
    op, isOpen, onClose, onRelease, onStatusChange, requestAdvance, requestBack, onPick, 
    onAddNote, onAddReminder, currentUser, role, onUpdateOp, 
    onMarkSeen,
    onSubStateChange, getSubStateStyle, getStatusColor,
    globalConfig 
}: any) {
    const supabase = createClient()
    const [activeTab, setActiveTab] = useState("chat")
    const [chatInput, setChatInput] = useState("")
    
    // --- ESTADO LOCAL MAESTRO (BLINDAJE DE DATOS) ---
    const [localOp, setLocalOp] = useState<any>(null)

    // Estados de Datos Externos
    const [realDocs, setRealDocs] = useState<any[]>([])
    const [realChat, setRealChat] = useState<any[]>([])
    const [realHistory, setRealHistory] = useState<any[]>([])

    // ✅ ESTADO DE PRESENCIA
    const [otherEditors, setOtherEditors] = useState<string[]>([])
    
    // Estados UX
    const [isUploading, setIsUploading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)

    // Estados Agenda
    const [reminderDate, setReminderDate] = useState("")
    const [reminderTime, setReminderTime] = useState("")
    const [reminderNote, setReminderNote] = useState("")
    const [reminderType, setReminderType] = useState<string>("call")
    
    const [newNoteInput, setNewNoteInput] = useState("")
    const [previewFile, setPreviewFile] = useState<any>(null)

    // Estados Corrección
    const [isCorrectionOpen, setIsCorrectionOpen] = useState(false)
    const [correctionReason, setCorrectionReason] = useState("")
    const [correctionComment, setCorrectionComment] = useState("")

    const [isSellerChangeOpen, setIsSellerChangeOpen] = useState(false)
    const [newSeller, setNewSeller] = useState("")
    const [sellersList, setSellersList] = useState<any[]>([])

    // ✅ Orígenes dinámicos desde Supabase (toma todo lo que exista hoy y a futuro)
    const [dbOrigins, setDbOrigins] = useState<string[]>([])
    const [isLoadingOrigins, setIsLoadingOrigins] = useState(false)
    const [originsError, setOriginsError] = useState<string | null>(null)

    const fileInputRef = useRef<HTMLInputElement>(null)

    // ✅ Origen real (marketing): mostrar SIEMPRE lo que está guardado.
    // Nota: priorizamos `source` (campo existente). Si tu tabla tiene `origen_dato`, lo tomamos como fallback.
    const currentOriginValue = useMemo(() => {
        const raw = (localOp?.source ?? localOp?.origen_dato ?? "") as any
        return (raw ?? "").toString()
    }, [localOp?.source, localOp?.origen_dato])

    // ✅ Lista de orígenes future-proof: mezcla config + DB + valor actual (para que jamás quede vacío)
    const originsList = useMemo(() => {
        const configOrigins = (globalConfig?.origins || []) as string[]
        const raw = [...configOrigins, ...dbOrigins, currentOriginValue]
        const cleaned = raw
            .map((s) => (s ?? "").toString().trim())
            .filter((s) => s.length > 0)
        return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))
    }, [globalConfig?.origins, dbOrigins, currentOriginValue])

    const STATE_SEQUENCE = ['ingresado', 'precarga', 'medicas', 'legajo', 'cumplidas']
    const STATE_LABELS: Record<string, string> = {
        'ingresado': 'INGRESADO',
        'precarga': 'PRECARGA',
        'medicas': 'MÉDICAS',
        'legajo': 'LEGAJO',
        'cumplidas': 'CUMPLIDA',
        'demoras': 'DEMORAS',
        'rechazado': 'RECHAZADO'
    }

    // --- CARGA INICIAL (PURGA DE ESTADO) ---
    useEffect(() => {
        if(isOpen && op?.id) {
            setLocalOp(null) // Purga inmediata
            setOtherEditors([]) // Reset de editores
            fetchFullData(op.id)
            
            // ✅ LÓGICA DE PRESENCIA
            const channel = supabase.channel(`ops_room_${op.id}`)

            channel
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_messages', filter: `lead_id=eq.${op.id}` }, (payload) => {
                    setRealChat(prev => [...prev, payload.new])
                })
                .on('presence', { event: 'sync' }, () => {
                    const newState = channel.presenceState()
                    const users: string[] = []
                    
                    for (const key in newState) {
                        const state: any = newState[key]
                        if (state && state.length > 0) {
                            state.forEach((s: any) => {
                                if (s.user && s.user !== currentUser) {
                                    users.push(s.user)
                                }
                            })
                        }
                    }
                    setOtherEditors([...new Set(users)])
                })
                .subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') {
                        await channel.track({
                            user: currentUser || 'Anon',
                            online_at: new Date().toISOString(),
                        })
                    }
                })

            return () => { 
                channel.unsubscribe()
            }
        }
    }, [isOpen, op?.id])

    // ✅ Limpieza de badge de CHAT: al abrir el modal (ya estás "viendo" el chat)
    useEffect(() => {
        if (isOpen && localOp?.id) {
            markSeen('chat')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, localOp?.id])

    // ✅ Limpieza de badge de DOCS: cuando entrás al tab "archivos" (no hace falta abrir uno por uno)
    useEffect(() => {
        if (isOpen && localOp?.id && activeTab === 'files') {
            markSeen('docs')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, isOpen, localOp?.id])

    // ✅ Limpieza de badge de DOCS: cuando abrís/previeweás un archivo
    useEffect(() => {
        if (isOpen && localOp?.id && previewFile) {
            markSeen('docs')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [previewFile])
 

    const fetchFullData = async (leadId: string) => {
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', leadId).single()
        
        if (leadData) {
            setLocalOp(leadData) 
        } else {
            setLocalOp(op)
        }

        fetchRealDocs(leadId)
        fetchRealChat(leadId)
        fetchRealHistory(leadId)
        fetchSellers()
        fetchOriginsDistinct()
    }

    const fetchRealDocs = async (leadId: string) => {
        const { data } = await supabase.from('lead_documents').select('*').eq('lead_id', leadId).order('uploaded_at', { ascending: false })
        if(data) setRealDocs(data)
    }
    const fetchRealChat = async (leadId: string) => {
        const { data } = await supabase.from('lead_messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true })
        if(data) setRealChat(data)
    }
    const fetchRealHistory = async (leadId: string) => {
        const { data } = await supabase.from('lead_status_history').select('*').eq('lead_id', leadId).order('changed_at', { ascending: true })
        if(data) setRealHistory(data)
    }
    const fetchSellers = async () => {
        const { data } = await supabase.from('profiles').select('full_name')
        if (data) {
            setSellersList(data)
        }
    }


    // ✅ Orígenes: cargar todos los valores existentes en Supabase (hoy y a futuro)
    const fetchOriginsDistinct = async () => {
        const now = Date.now()
        if (__opsOriginsCache && (now - __opsOriginsCache.fetchedAt) < ___OPS_ORIGINS_CACHE_TTL_MS) {
            setDbOrigins(__opsOriginsCache.values)
            return
        }

        if (isLoadingOrigins) return
        setIsLoadingOrigins(true)
        try {
            // 1) RPC ideal (recomendado). Si no existe, cae al fallback.
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_distinct_lead_sources')
            if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
                const values = rpcData
                    .map((r: any) => (typeof r === 'string' ? r : (r?.source ?? r?.value ?? r?.lead_source ?? '')))
                    .map((s: any) => (s ?? '').toString().trim())
                    .filter((s: string) => s.length > 0)

                const uniqueSorted = Array.from(new Set(values))
                    .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

                __opsOriginsCache = { values: uniqueSorted, fetchedAt: now }
                setDbOrigins(uniqueSorted)
                return
            }

            // 2) Fallback compatible: paginar y deduplicar en front
            const pageSize = 1000
            const maxPages = 200 // hasta 200k filas como techo
            const found = new Set<string>()

            for (let page = 0; page < maxPages; page++) {
                const from = page * pageSize
                const to = from + pageSize - 1

                const { data, error } = await supabase
                    .from('leads')
                    .select('source')
                    .not('source', 'is', null)
                    .range(from, to)

                if (error) break
                if (!data || data.length === 0) break

                for (const row of data as any[]) {
                    const s = (row?.source ?? '').toString().trim()
                    if (s) found.add(s)
                }

                if (data.length < pageSize) break
            }

            const uniqueSorted = Array.from(found)
                .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }))

            __opsOriginsCache = { values: uniqueSorted, fetchedAt: now }
            setDbOrigins(uniqueSorted)
        } finally {
            setIsLoadingOrigins(false)
        }
    }


    // ✅ NUEVO: Función auxiliar para enviar notificaciones (campanita/toast)
    const inferEventType = (title: string, body: string) => {
        const t = (title || "").toLowerCase()
        const b = (body || "").toLowerCase()
        if (t.includes("mensaje") || t.includes("chat") || b.includes("mensaje")) return "chat_venta"
        if (t.includes("document") || t.includes("archivo") || b.includes("archivo")) return "archivo_subido"
        if (t.includes("venta") && (t.includes("cumplida") || t.includes("ingres"))) return "venta_ingresada"
        if (t.includes("estado") || b.includes("estado")) return "cambio_estado"
        if (t.includes("nota") || b.includes("nota")) return "opschat"
        return "generic"
    }

    const sendNotification = async (
        targetUser: string,
        title: string,
        body: string,
        type: 'info' | 'alert' | 'success',
        eventType?: string
    ) => {
        if (!targetUser || targetUser === "Sin Asignar" || targetUser === currentUser) return

        const event_type = (eventType || inferEventType(title, body)) as string

        await supabase.from('notifications').insert({
            user_name: targetUser,
            title,
            body,
            type,
            event_type,
            read: false,
            lead_id: localOp.id,
            created_at: new Date().toISOString()
        })
    }

    // ✅ Seen markers: limpia badges (chat/docs) al abrir la pestaña
    const markSeen = async (kind: 'chat' | 'docs') => {
        if (!localOp?.id || !currentUser) return
        const nowIso = new Date().toISOString()

        const payload: any = { lead_id: localOp.id, user_name: currentUser }
        if (kind === 'chat') payload.last_seen_chat_at = nowIso
        if (kind === 'docs') payload.last_seen_docs_at = nowIso

        const { error } = await supabase
            .from('ops_lead_seen')
            .upsert(payload, { onConflict: 'lead_id,user_name' })

        if (error) console.error('markSeen error', error)

        // Limpieza instantánea en la lista (sin esperar roundtrip)
        if (typeof onMarkSeen === 'function') onMarkSeen(localOp.id, kind)
    }

    // --- MOTOR DE GUARDADO INTELIGENTE ---
    const updateField = async (field: string, value: any) => {
        if (!localOp) return

        setIsSaving(true)
        setLocalOp((prev: any) => ({ ...prev, [field]: value }))
        onUpdateOp({ ...localOp, [field]: value }) 

        const { error } = await supabase.from('leads').update({ [field]: value }).eq('id', localOp.id)
        
        if (error) {
            console.error(`Error guardando ${field}:`, error)
        }
        
        setTimeout(() => setIsSaving(false), 500)
    }

    // ✅ Guardado de origen future-proof:
    // - Siempre guardamos en `source` (es el campo real que ya existe y usa el CRM).
    // - Si en tu schema existe `origen_dato`, lo mantenemos sincronizado para no perder compatibilidad.
    const setOriginValue = async (val: string) => {
        await updateField('source', val)
        if (localOp && Object.prototype.hasOwnProperty.call(localOp, 'origen_dato')) {
            await updateField('origen_dato', val)
        }
    }

    // ✅ FUNCIÓN PARA CAMBIAR ENTRE ALTA Y PASS AL CLICKEAR ICONO
    const toggleSaleType = async () => {
        if (!localOp) return
        // ✅ IMPORTANTÍSIMO:
        // `source` es el ORIGEN real del lead (Meta/Google/etc.). No se debe pisar para marcar PASS.
        // PASS se marca por `type='pass'` (y/o `sub_state='auditoria_pass'`), y OPS lo interpreta así.
        const nextType = (localOp.type === 'pass') ? 'alta' : 'pass'
        await updateField('type', nextType)
    }

    // --- NAVEGACIÓN ESTADOS ---
    const getNextState = () => {
        if (!localOp) return null
        const currentIndex = STATE_SEQUENCE.indexOf(localOp.status)
        if (currentIndex !== -1 && currentIndex < STATE_SEQUENCE.length - 1) {
            return STATE_SEQUENCE[currentIndex + 1]
        }
        return null
    }

    const getPrevState = () => {
        if (!localOp) return null
        if (localOp.status === 'rechazado') return 'ingresado'
        const currentIndex = STATE_SEQUENCE.indexOf(localOp.status)
        if (currentIndex > 0) {
            return STATE_SEQUENCE[currentIndex - 1]
        }
        return null
    }

    const handleAdvanceStage = async () => {
        const next = getNextState()
        if (next) {
            await updateField('sub_state', null)
            await updateField('status', next)
            requestAdvance()
            
            // ✅ NOTIFICACIÓN: Venta Cumplida
            if (next === 'cumplidas') {
                // Notificar al Vendedor
                if (localOp.agent_name) {
                    sendNotification(localOp.agent_name, "🎉 Venta Cumplida", `¡Felicitaciones! La venta de ${localOp.name} fue aprobada.`, "success")
                }
            }
        }
    }

    const handleBackStage = async () => {
        const prev = getPrevState()
        if (prev) {
            await updateField('status', prev)
            requestBack()
        }
    }

    // --- OTROS HANDLERS ---
    const handleSellerChange = async () => {
        if(!newSeller) return
        await updateField('agent_name', newSeller)
        sendNotification(newSeller, "👤 Nueva Asignación", `Te asignaron la venta de ${localOp.name}`, "info")
        setIsSellerChangeOpen(false)
    }

    const forceDownload = async (file: any) => {
        const { data, error } = await supabase.storage.from('lead-documents').download(file.file_path)
        if (error) { alert("Error al descargar archivo."); return }
        const url = window.URL.createObjectURL(data)
        const a = document.createElement('a')
        a.href = url
        a.download = file.name || "documento"
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
    }

    const handleDeleteFile = async (file: any) => {
        if(!confirm("¿Estás seguro de eliminar este archivo? No se puede deshacer.")) return

        const { error: storageErr } = await supabase.storage.from('lead-documents').remove([file.file_path])
        if (storageErr) {
            alert("Error al borrar del almacenamiento")
            return
        }

        const { error: dbErr } = await supabase.from('lead_documents').delete().eq('id', file.id)
        if (dbErr) {
            alert("Error al borrar registro de base de datos")
            return
        }

        fetchRealDocs(localOp.id)
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return
        setIsUploading(true)
        const bucket = "lead-documents"
        try {
            for (const file of Array.from(files)) {
                const safeName = file.name.replace(/[^\w.\-]+/g, "_")
                const path = `${op.id}/${Date.now()}_${safeName}`
                const { error: upErr } = await supabase.storage.from(bucket).upload(path, file)
                if (upErr) throw upErr
                const { error: insErr } = await supabase.from('lead_documents').insert({
                    lead_id: op.id,
                    type: file.type.includes('image') ? 'IMG' : 'PDF',
                    file_path: path,
                    name: file.name,
                    uploaded_at: new Date().toISOString(),
                    status: 'uploaded',
                    uploaded_by: currentUser || "System"
                })
                if (insErr) throw insErr
            }
            await fetchRealDocs(localOp.id)
            
            // Notificar si se suben archivos (opcional pero util)
            if (localOp.operator && localOp.operator !== currentUser) {
                sendNotification(localOp.operator, "📎 Documentación", `${currentUser} subió archivos a ${localOp.name}`, "info")
            }

        } catch (error: any) {
            alert(`Error: ${error.message}`)
        } finally {
            setIsUploading(false)
            if(fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    const sendChatMessage = async () => {
        if(!chatInput.trim()) return
        const msg = {
            lead_id: op.id,
            sender: currentUser || "Administración",
            text: chatInput,
            target_role: 'seller',
            created_at: new Date().toISOString()
        }
        setRealChat(prev => [...prev, msg])
        setChatInput("")
        await supabase.from('lead_messages').insert(msg)
        
        // Notificar chat
        if (localOp.agent_name && localOp.agent_name !== currentUser) {
             sendNotification(localOp.agent_name, "💬 Nuevo Mensaje", `Mensaje de ${currentUser} en ${localOp.name}`, "info")
        }
    }

    const handleSubmitCorrection = async () => {
        if (!correctionReason) return
        await updateField('status', 'rechazado')
        onStatusChange(op.id, 'rechazado') 
        
        const reasonText = `⚠️ Se solicita corrección: ${correctionReason}. ${correctionComment ? `(${correctionComment})` : ''}`
        const msg = {
            lead_id: op.id,
            sender: currentUser || "Administración",
            text: reasonText,
            target_role: 'seller',
            created_at: new Date().toISOString()
        }
        setRealChat(prev => [...prev, msg])
        await supabase.from('lead_messages').insert(msg)

        // Notificar rechazo
        if (localOp.agent_name) {
            sendNotification(localOp.agent_name, "⚠️ Venta Rechazada", `Motivo: ${correctionReason}. Revisar urgente.`, "alert")
        }

        setCorrectionReason("")
        setCorrectionComment("")
        setIsCorrectionOpen(false)
        setActiveTab("chat") 
    }

    const handleSaveNote = async () => {
        if (!newNoteInput.trim()) return
        const timestamp = new Date().toLocaleString('es-AR')
        const noteEntry = `ADMIN_NOTE|${timestamp}|${currentUser || 'Admin'}|${newNoteInput}`
        const currentNotes = localOp.notes || ""
        const updatedNotes = currentNotes ? `${currentNotes}|||${noteEntry}` : noteEntry
        await updateField('notes', updatedNotes)
        
        // ✅ NOTIFICACIÓN: Nota agregada
        // ⛔ SE ELIMINÓ LA NOTIFICACIÓN AL VENDEDOR (agent_name) PARA QUE SOLO LE LLEGUE A OPS

        // 2. Si yo NO soy el operador asignado, notificar al operador
        if (localOp.operator && localOp.operator !== currentUser) {
             sendNotification(localOp.operator, "📝 Nota Interna", `${currentUser} agregó una nota en ${localOp.name}`, "info")
        }

        setNewNoteInput("")
    }

    const handlePreview = (file: any) => {
        const { data } = supabase.storage.from('lead-documents').getPublicUrl(file.file_path)
        if(data?.publicUrl) setPreviewFile({ ...file, url: data.publicUrl })
    }

    if (!localOp) return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="h-[90vh] flex items-center justify-center">
                <DialogTitle className="sr-only">Cargando...</DialogTitle>
                <Loader2 className="animate-spin h-10 w-10 text-blue-500" />
            </DialogContent>
        </Dialog>
    )

    const prepagasList = globalConfig?.prepagas || []
    const availablePlans = prepagasList.find((p: any) => p.name === (localOp.prepaga || "Otra"))?.plans || []
    const subStatesList = globalConfig?.subStates?.[localOp.status] || []
    // `originsList` se calcula con useMemo arriba (config + DB + valor actual)

    const nextStateLabel = getNextState() ? STATE_LABELS[getNextState()!] : 'FINALIZAR'
    const prevStateLabel = getPrevState() ? STATE_LABELS[getPrevState()!] : 'ANTERIOR'

    const today = new Date().toISOString().split('T')[0]
    const sortedReminders = [...(localOp.reminders || [])].sort((a: any, b: any) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())
    const todayReminders = sortedReminders.filter((r: any) => r.date === today)
    
    const getReminderColor = (type: string) => {
        switch(type) {
            case 'call': return 'border-l-blue-500 bg-blue-50/30'
            case 'meeting': return 'border-l-purple-500 bg-purple-50/30'
            default: return 'border-l-emerald-500 bg-emerald-50/30'
        }
    }
    const getReminderIcon = (type: string) => {
        switch(type) {
            case 'call': return <Phone size={14} className="text-blue-600"/>
            case 'meeting': return <Users size={14} className="text-purple-600"/>
            default: return <CheckSquare size={14} className="text-emerald-600"/>
        }
    }

    // Identificar si es PASS o ALTA para colorear
    const isPass = localOp.type === 'pass' || localOp.sub_state === 'auditoria_pass'

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                {/* ✅ STYLE INLINE ORIGINAL RESTAURADO */}
                <DialogContent style={{ maxWidth: '1200px', width: '95%', height: '90vh' }} 
                    className="flex flex-col p-0 gap-0 bg-white border-0 shadow-2xl overflow-hidden rounded-2xl text-slate-900"
                    // ⛔ Eliminé onPointerDownOutside y onEscapeKeyDown para que puedas cerrar con click afuera/ESC
                >
                                        <DialogTitle className="sr-only">Detalle de operación</DialogTitle>
{/* ✅ BARRA DE PRESENCIA AGREGADA COMO PRIMER HIJO DEL FLEX (NO FLOTANTE, NO ABSOLUTE) */}
                    {otherEditors.length > 0 ? (
                        <div className="bg-red-500 border-b border-red-600 py-1 px-4 text-center text-xs font-black text-white flex items-center justify-center gap-2 animate-pulse">
                            <ShieldAlert size={14} className="animate-bounce"/> 
                            ¡CUIDADO! {otherEditors.join(', ')} TAMBIÉN ESTÁ EDITANDO
                        </div>
                    ) : (
                        <div className="bg-emerald-50 border-b border-emerald-100 py-1 px-4 text-center text-xs font-bold text-emerald-700 flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                            <ShieldCheck size={12}/> Editando como: {currentUser} (Modo Seguro)
                        </div>
                    )}

                    {/* CABECERA (El resto del código sigue igual) */}
                    <DialogHeader className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-6">
                            
                            {/* ✅ ICONO CLICKABLE PARA CAMBIAR TIPO ALTA <-> PASS */}
                            <div 
                                onClick={toggleSaleType}
                                className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-md cursor-pointer hover:scale-105 transition-transform active:scale-95 ${
                                isPass ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
                            }`} title="Click para cambiar tipo (Alta/Pass)">
                                {isPass ? <ArrowRightLeft size={32}/> : <UserPlus size={32}/>}
                            </div>

                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <DialogTitle className="text-3xl font-black text-slate-800 leading-none">{localOp.name || "Sin Nombre"}</DialogTitle>
                                    <Button size="sm" className="h-7 bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 px-3 rounded-full" onClick={() => window.open(`https://wa.me/${localOp.phone?.replace(/[^0-9]/g, '')}`, '_blank')}>
                                        <MessageCircle size={14} className="text-white"/> WhatsApp
                                    </Button>
                                    <Button size="sm" className="h-7 bg-slate-800 hover:bg-slate-700 text-white gap-2 px-3 rounded-full shadow-sm border border-slate-700" onClick={() => setActiveTab("agenda")}>
                                        <Clock size={14} className="text-white"/> Agendar
                                    </Button>
                                    {isSaving && <Badge variant="outline" className="text-xs border-blue-200 text-blue-600 animate-pulse bg-blue-50"><Loader2 className="w-3 h-3 mr-1 animate-spin"/> Guardando...</Badge>}
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    <Select value={localOp.prepaga} onValueChange={(val) => updateField('prepaga', val)}>
                                        <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[160px] shadow-sm"><SelectValue placeholder="Prepaga"/></SelectTrigger>
                                        <SelectContent>{prepagasList.map((p: any)=><SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    
                                    <Select value={localOp.plan} onValueChange={(val) => updateField('plan', val)}>
                                        <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[120px] shadow-sm"><SelectValue placeholder="Plan"/></SelectTrigger>
                                        <SelectContent>{availablePlans.map((p:string)=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                    </Select>

                                    {/* Origen de Datos (SIEMPRE muestra el valor real y lista todo lo existente hoy y a futuro) */}
                                    <Select value={currentOriginValue} onValueChange={(val) => setOriginValue(val)}>
                                        <SelectTrigger className="h-8 text-xs bg-white border-slate-300 w-[220px] shadow-sm text-slate-500">
                                            <Megaphone size={12} className="mr-2"/>
                                            <SelectValue placeholder={isLoadingOrigins ? "Cargando orígenes..." : "Origen"}/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {originsList.map((o: string) => (
                                                <SelectItem key={o} value={o}>{o}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <Popover open={isSellerChangeOpen} onOpenChange={setIsSellerChangeOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 gap-2 border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 ml-2">
                                                <UserCog size={14}/> {localOp.agent_name || "Sin Vendedor"}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-56 p-3">
                                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Reasignar Venta</p>
                                            <Select value={newSeller} onValueChange={setNewSeller}>
                                                <SelectTrigger className="h-8 text-xs mb-2"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                <SelectContent>
                                                    {sellersList.map((s:any) => <SelectItem key={s.full_name} value={s.full_name}>{s.full_name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                            <Button size="sm" className="w-full bg-blue-600 text-white h-7 text-xs" onClick={handleSellerChange}>Confirmar Cambio</Button>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                        </div>

                        {/* ESTADO Y SUB-ESTADO */}
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Etapa:</span>
                                <Select value={localOp.status} onValueChange={(val) => { 
                                    updateField('sub_state', null); 
                                    updateField('status', val); 
                                }}>
                                    <SelectTrigger className={`h-8 w-[140px] text-xs font-bold uppercase tracking-widest ${getStatusColor(localOp.status)} border-0 focus:ring-0 text-center shadow-sm`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="ingresado">INGRESADO</SelectItem>
                                        <SelectItem value="precarga">PRECARGA</SelectItem>
                                        <SelectItem value="medicas">MÉDICAS</SelectItem>
                                        <SelectItem value="legajo">LEGAJO</SelectItem>
                                        <SelectItem value="cumplidas">CUMPLIDAS</SelectItem>
                                        <div className="border-t my-1"></div>
                                        <SelectItem value="demoras">⚠ DEMORAS</SelectItem>
                                        <SelectItem value="rechazado">⛔ RECHAZADO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Select value={localOp.sub_state || ""} onValueChange={(val) => updateField('sub_state', val)}>
                                    <SelectTrigger className={`h-9 w-[260px] text-xs font-bold text-right justify-between shadow-sm border-2 ${getSubStateStyle(localOp.sub_state)}`}>
                                        <SelectValue placeholder="Estado..." />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        {subStatesList.map((s: string)=><SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </DialogHeader>

                    <div className="flex-1 flex overflow-hidden">
                        <ScrollArea style={{ width: '55%' }} className="border-r border-slate-100 bg-white shrink-0">
                            <div className="p-8 space-y-10">
                                
                                <section className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <EditableField 
                                        label="Fecha Ingreso" 
                                        type="date" 
                                        value={localOp.fecha_ingreso || localOp.created_at?.split('T')[0]} 
                                        onBlur={(v: string) => updateField('fecha_ingreso', v)} 
                                        icon={<CalendarDays size={14}/>}
                                    />
                                    <EditableField 
                                        label="Fecha Alta" 
                                        type="date" 
                                        value={localOp.fecha_alta} 
                                        onBlur={(v: string) => updateField('fecha_alta', v)} 
                                        icon={<CheckSquare size={14}/>}
                                        color="text-emerald-700 font-bold"
                                    />
                                </section>

                                <section className="space-y-5">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-3"><User size={14}/> 1. Datos Titular</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                        <EditableField label="Nombre Completo" value={localOp.name} onBlur={(v: string) => updateField('name', v)} />
                                        <EditableField label="CUIL/CUIT" value={localOp.dni} onBlur={(v: string) => updateField('dni', v)} />
                                        <EditableField label="Nacimiento" type="date" value={localOp.dob} onBlur={(v: string) => updateField('dob', v)} />
                                        <EditableField label="Email" value={localOp.email} onBlur={(v: string) => updateField('email', v)} />
                                        <EditableField label="Teléfono" value={localOp.phone} onBlur={(v: string) => updateField('phone', v)} />
                                        
                                        <div className="col-span-2 pt-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><MapPin size={10}/> Domicilio</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                <Input className="text-xs h-8" placeholder="Provincia" value={localOp.province || ""} onBlur={e => updateField('province', e.target.value)} onChange={e => setLocalOp({...localOp, province: e.target.value})} />
                                                <Input className="text-xs h-8" placeholder="Calle y Nro" value={localOp.address_street || ""} onBlur={e => updateField('address_street', e.target.value)} onChange={e => setLocalOp({...localOp, address_street: e.target.value})} />
                                                <Input className="text-xs h-8" placeholder="Localidad" value={localOp.address_city || ""} onBlur={e => updateField('address_city', e.target.value)} onChange={e => setLocalOp({...localOp, address_city: e.target.value})} />
                                                <Input className="text-xs h-8" placeholder="CP" value={localOp.address_zip || ""} onBlur={e => updateField('address_zip', e.target.value)} onChange={e => setLocalOp({...localOp, address_zip: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-5">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> 2. Grupo Familiar</h4>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 hover:bg-blue-50" onClick={() => updateField('hijos', [...(localOp.hijos || []), {nombre: "", dni: ""}])}>
                                            <Plus size={12} className="mr-1"/> Agregar
                                        </Button>
                                    </div>
                                    <div className="p-5 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div className="flex flex-col gap-1 w-full">
                                                <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">Tipo Afiliación</span>
                                                <Select value={localOp.tipo_afiliacion} onValueChange={(val) => updateField('tipo_afiliacion', val)}>
                                                    <SelectTrigger className="h-8 text-xs font-bold bg-white"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Individual">Individual</SelectItem>
                                                        <SelectItem value="Matrimonio / Grupo">Matrimonio / Grupo</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {/* ✅ CORRECCIÓN CÁPITAS: Convertir a número */}
                                            <EditableField label="Cápitas Total" value={localOp.capitas} onBlur={(v: any) => updateField('capitas', v === "" ? 0 : parseInt(v))} />
                                        </div>
                                        <div className="pt-3 border-t border-slate-200 space-y-2">
                                            {localOp.hijos && localOp.hijos.length > 0 ? localOp.hijos.map((h: any, i: number) => (
                                                <div key={i} className="flex gap-2 items-center group">
                                                    <Input className="h-7 text-xs bg-white" placeholder="Nombre" value={h.nombre} 
                                                        onChange={(e) => { const newHijos = [...localOp.hijos]; newHijos[i].nombre = e.target.value; setLocalOp({...localOp, hijos: newHijos}) }}
                                                        onBlur={() => updateField('hijos', localOp.hijos)}
                                                    />
                                                    <Input className="h-7 text-xs bg-white w-24 font-mono" placeholder="DNI" value={h.dni} 
                                                        onChange={(e) => { const newHijos = [...localOp.hijos]; newHijos[i].dni = e.target.value; setLocalOp({...localOp, hijos: newHijos}) }}
                                                        onBlur={() => updateField('hijos', localOp.hijos)}
                                                    />
                                                    {/* Botón Eliminar Integrante */}
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-300 hover:text-red-600 hover:bg-red-50" 
                                                        onClick={() => {
                                                            const newHijos = localOp.hijos.filter((_:any, index: number) => index !== i);
                                                            updateField('hijos', newHijos);
                                                        }}
                                                    >
                                                        <Trash2 size={12}/>
                                                    </Button>
                                                </div>
                                            )) : <p className="text-xs text-slate-400 italic">Sin integrantes adicionales.</p>}
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-5">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-3"><Briefcase size={14}/> 3. Laboral & Pago</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                        <div className="flex flex-col gap-1 w-full">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Condición</span>
                                            <div className="flex items-center gap-2">
                                                <Select value={localOp.condicion_laboral || ""} onValueChange={(v) => updateField('condicion_laboral', v)}>
                                                    <SelectTrigger className="h-7 text-sm font-medium border-0 border-b rounded-none px-0 flex-1"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="Obligatorio">Obligatorio</SelectItem>
                                                        <SelectItem value="Voluntario">Voluntario</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {!!localOp.condicion_laboral && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-slate-300 hover:text-red-600 hover:bg-red-50"
                                                        title="Limpiar"
                                                        onClick={async () => {
                                                            // Limpieza premium: vuelve a vacío y limpia dependencias
                                                            await updateField('condicion_laboral', "")
                                                            await updateField('cuit_empleador', "")
                                                            await updateField('clave_fiscal', "")
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ✅ NUEVO: Condición Laboral (Empleado / Monotributo) */}
                                        <div className="flex flex-col gap-1 w-full">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Situación</span>
                                            <div className="flex items-center gap-2">
                                                <Select value={localOp.labor_condition || ""} onValueChange={async (v) => {
                                                    await updateField('labor_condition', v)
                                                    // Si cambia a algo que no sea monotributo, limpiamos categoría para evitar basura oculta
                                                    if (v !== 'monotributo') {
                                                        await updateField('monotributo_category', "")
                                                    }
                                                }}>
                                                    <SelectTrigger className="h-7 text-sm font-medium border-0 border-b rounded-none px-0 flex-1"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="empleado">Empleado</SelectItem>
                                                        <SelectItem value="monotributo">Monotributista</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {!!localOp.labor_condition && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-slate-300 hover:text-red-600 hover:bg-red-50"
                                                        title="Limpiar"
                                                        onClick={async () => {
                                                            await updateField('labor_condition', "")
                                                            await updateField('monotributo_category', "")
                                                        }}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>

                                        {/* ✅ NUEVO: Categoría Monotributo (solo si corresponde) */}
                                        {localOp.labor_condition === 'monotributo' && (
                                            <div className="flex flex-col gap-1 w-full">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">Categoría Monotributo</span>
                                                <div className="flex items-center gap-2">
                                                    <Select value={localOp.monotributo_category || ""} onValueChange={(v) => updateField('monotributo_category', v)}>
                                                        <SelectTrigger className="h-7 text-sm font-medium border-0 border-b rounded-none px-0 flex-1"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="A">A</SelectItem>
                                                            <SelectItem value="B">B</SelectItem>
                                                            <SelectItem value="C">C</SelectItem>
                                                            <SelectItem value="D">D</SelectItem>
                                                            <SelectItem value="E">E</SelectItem>
                                                            <SelectItem value="F">F</SelectItem>
                                                            <SelectItem value="G">G</SelectItem>
                                                            <SelectItem value="H">H</SelectItem>
                                                            <SelectItem value="I">I</SelectItem>
                                                            <SelectItem value="J">J</SelectItem>
                                                            <SelectItem value="K">K</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {!!localOp.monotributo_category && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-slate-300 hover:text-red-600 hover:bg-red-50"
                                                            title="Limpiar"
                                                            onClick={async () => {
                                                                await updateField('monotributo_category', "")
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {!!localOp.condicion_laboral && localOp.condicion_laboral !== 'Voluntario' && (
                                            <>
                                                <EditableField label="CUIT Empleador" value={localOp.cuit_empleador} onBlur={(v: string) => updateField('cuit_empleador', v)} />
                                                {/* ✅ Clave Fiscal */}
                                                <EditableField label="Clave Fiscal" value={localOp.clave_fiscal} onBlur={(v: string) => updateField('clave_fiscal', v)} icon={<Key size={12}/>}/>
                                            </>
                                        )}
                                        
                                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                            {/* ✅ Selector de Método de Pago SIN EFECTIVO */}
                                            <div className="flex flex-col gap-1 w-full">
                                                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">Método de Pago</span>
                                                <div className="flex items-center gap-2">
                                                    <Select value={localOp.metodo_pago || ""} onValueChange={async (v) => {
                                                        await updateField('metodo_pago', v)
                                                        // Si el método queda vacío, limpiamos el número para evitar datos colgados
                                                        if (!v) {
                                                            await updateField('cbu_tarjeta', "")
                                                        }
                                                    }}>
                                                        <SelectTrigger className="h-7 text-sm font-bold text-emerald-800 border-0 border-b rounded-none px-0 bg-transparent flex-1"><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="CBU">CBU (Débito)</SelectItem>
                                                            <SelectItem value="Tarjeta">Tarjeta Crédito</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    {!!localOp.metodo_pago && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-emerald-300 hover:text-red-600 hover:bg-red-50"
                                                            title="Limpiar"
                                                            onClick={async () => {
                                                                await updateField('metodo_pago', "")
                                                                await updateField('cbu_tarjeta', "")
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <EditableField label="N° CBU / Tarjeta" value={localOp.cbu_tarjeta} onBlur={(v: string) => updateField('cbu_tarjeta', v)} />
                                        </div>
                                    </div>
                                </section>

                                <section className="space-y-5 pb-10">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-3"><DollarSign size={14}/> 4. Valores Económicos</h4>
                                    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="grid grid-cols-4 gap-4">
                                            {/* ✅ CORRECCIÓN PRECIOS: Convertir a float antes de enviar */}
                                            <EditableField label="Full Price" value={localOp.full_price} onBlur={(v: string) => updateField('full_price', v === "" ? 0 : parseFloat(v))} icon={<DollarSign size={12}/>} prefix="$" color="text-base font-bold text-slate-700" />
                                            <EditableField label="Aportes" value={localOp.aportes} onBlur={(v: string) => updateField('aportes', v === "" ? 0 : parseFloat(v))} icon={<Wallet size={12}/>} prefix="$" color="text-base font-bold text-slate-700" />
                                            <EditableField label="Descuento" value={localOp.descuento} onBlur={(v: string) => updateField('descuento', v === "" ? 0 : parseFloat(v))} icon={<Percent size={12}/>} prefix="$" color="text-base font-bold text-green-600" />
                                            <EditableField label="Total a Pagar" value={localOp.total_a_pagar} onBlur={(v: string) => updateField('total_a_pagar', v === "" ? 0 : parseFloat(v))} icon={<DollarSign size={12}/>} prefix="$" color="text-lg font-black text-slate-900" />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </ScrollArea>

                        {/* COLUMNA DERECHA */}
                        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col h-full">
                                <div className="px-8 pt-4 border-b border-slate-100 bg-white">
                                    <TabsList className="bg-transparent h-10 justify-start gap-8 p-0 border-none w-full">
                                        <TabTrigger value="chat" label="Historial & Chat" icon={<MessageSquare size={16}/>} />
                                        <TabTrigger value="notes" label="Notas" icon={<StickyNote size={16}/>} />
                                        <TabTrigger value="files" label="Archivos" icon={<UploadCloud size={16}/>} />
                                        <TabTrigger value="agenda" label="Agenda" icon={<CalendarIcon size={16}/>} />
                                    </TabsList>
                                </div>
                                
                                <div className="flex-1 overflow-hidden relative">
                                    <TabsContent value="chat" className="flex flex-col h-full m-0 p-0 overflow-hidden text-slate-900 absolute inset-0">
                                        <ScrollArea className="flex-1 p-8 text-slate-900 bg-slate-50/50 min-h-0">
                                            <div className="space-y-4 mb-6">
                                                {realHistory.map((h: any, i: number) => (
                                                    <div key={i} className="flex gap-3 text-xs text-slate-500 items-center justify-center opacity-60">
                                                        <span>{new Date(h.changed_at).toLocaleDateString()}</span> • 
                                                        <span className="font-bold text-slate-700">{h.agent_name || 'Sistema'}:</span> 
                                                        <span>{h.from_status} ➝ {h.to_status}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {realChat.length === 0 ? <p className="text-center text-xs text-slate-400 mt-10">Inicio del chat.</p> : 
                                                realChat.map((msg: any, i: number) => (
                                                    <ChatBubble key={i} text={msg.text} user={msg.sender} time={new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} isMe={msg.sender === (currentUser || "Administración")} />
                                                ))
                                            }
                                        </ScrollArea>
                                        <div className="p-4 bg-white border-t flex gap-3 shadow-lg z-20 shrink-0">
                                            <Input className="h-11 text-sm shadow-sm" placeholder="Escribir mensaje..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendChatMessage()}/>
                                            <Button size="icon" className="h-11 w-11 bg-blue-600 hover:bg-blue-700 shadow-md" onClick={sendChatMessage}><ArrowRight size={20}/></Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="notes" className="flex flex-col h-full m-0 p-0 overflow-hidden text-slate-900 bg-yellow-50/30 absolute inset-0">
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                            {localOp.notes && localOp.notes.split('|||').map((noteStr: string, i: number) => {
                                                const parts = noteStr.split('|')
                                                const text = parts.length > 2 ? parts.slice(3).join('|') : noteStr
                                                const user = parts[2] || "Sistema"
                                                const date = parts[1] || ""
                                                if(!text) return null
                                                return (
                                                    <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 relative group">
                                                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{text}</p>
                                                        <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50"><span className="text-[10px] text-slate-400 font-bold uppercase">{user} • {date}</span></div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                        <div className="p-4 bg-white border-t border-yellow-100 shrink-0">
                                            <Textarea className="min-h-[80px] text-sm bg-slate-50 border-slate-200 resize-none mb-2 focus-visible:ring-yellow-400" placeholder="Escribí una nueva nota..." value={newNoteInput} onChange={(e) => setNewNoteInput(e.target.value)} />
                                            <Button size="sm" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold" onClick={handleSaveNote}>Guardar Nota</Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="files" className="flex flex-col h-full m-0 p-8 gap-4 overflow-y-auto text-slate-900 absolute inset-0">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase">Documentación ({realDocs.length})</h4>
                                            <Button size="sm" variant="outline" className="h-8 text-xs bg-white text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => fileInputRef.current?.click()}>
                                                <FileUp size={12} className="mr-1"/> Subir Admin
                                            </Button>
                                        </div>
                                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer group relative" onClick={() => fileInputRef.current?.click()}>
                                            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100">
                                                <UploadCloud className="text-slate-400 group-hover:text-blue-500" size={24}/>
                                            </div>
                                            <p className="text-sm font-bold text-slate-600">{isUploading ? "Subiendo..." : "Arrastrá y soltá archivos aquí"}</p>
                                            <p className="text-xs text-slate-400 mt-1">o hacé click para explorar (PDF, JPG, PNG)</p>
                                        </div>
                                        <div className="flex flex-col gap-3 mt-2 pb-10">
                                            {realDocs.map((file) => (
                                                <FileCard 
                                                    key={file.id} 
                                                    file={file} 
                                                    onPreview={handlePreview} 
                                                    onDownload={() => forceDownload(file)}
                                                    onDelete={handleDeleteFile} // Pasar función de borrado
                                                />
                                            ))}
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="agenda" className="flex flex-col h-full m-0 p-0 overflow-hidden text-slate-900 absolute inset-0">
                                        <div className="flex flex-col h-full p-8 bg-slate-50/50">
                                            
                                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 shrink-0">
                                                <h4 className="text-sm font-bold text-slate-600 uppercase mb-5 flex items-center gap-2 border-b pb-3">
                                                    <Plus size={16} className="text-blue-600"/> Nuevo Evento
                                                </h4>
                                                
                                                <div className="flex flex-col gap-5">
                                                    <div className="grid grid-cols-2 gap-6">
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Tipo de Evento</label>
                                                            <Select value={reminderType} onValueChange={setReminderType}>
                                                                <SelectTrigger className="h-10 text-sm"><SelectValue/></SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="call">📞 Llamada</SelectItem>
                                                                    <SelectItem value="meeting">👥 Reunión</SelectItem>
                                                                    <SelectItem value="task">✅ Tarea</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Fecha y Hora</label>
                                                            <div className="flex gap-3">
                                                                <Input type="date" className="h-10 text-sm flex-1" value={reminderDate} onChange={e => setReminderDate(e.target.value)}/>
                                                                <Input type="time" className="h-10 text-sm w-32" value={reminderTime} onChange={e => setReminderTime(e.target.value)}/>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-[1fr_200px] gap-6 items-end">
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-slate-500 uppercase">Nota / Detalle</label>
                                                            <Input className="h-10 text-sm" placeholder="Ej: Confirmar pago del recibo..." value={reminderNote} onChange={e => setReminderNote(e.target.value)}/>
                                                        </div>
                                                        <Button className="h-10 bg-slate-900 text-white hover:bg-blue-600 font-bold shadow-md w-full" onClick={() => {onAddReminder(op.id, reminderDate, reminderTime, reminderNote, reminderType); setReminderNote("")}}>
                                                            <Save size={16} className="mr-2"/> GUARDAR
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto pr-2">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-xs font-bold text-slate-400 uppercase">Próximos Eventos</h4>
                                                    <Badge variant="outline" className="bg-white">Hoy: {todayReminders.length}</Badge>
                                                </div>
                                                
                                                <div className="space-y-3 pl-4 border-l-2 border-slate-200 ml-3">
                                                    {todayReminders.length > 0 ? todayReminders.map((r: any) => (
                                                        <div key={r.id} className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm relative group hover:shadow-md transition-all ${getReminderColor(r.type).replace('border-l-', 'border-l-4 ')}`}>
                                                            <div className="absolute -left-[21px] top-4 h-3 w-3 rounded-full bg-slate-400 border-2 border-white group-hover:bg-blue-500 transition-colors"></div>
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1">
                                                                        {getReminderIcon(r.type)}
                                                                        <span className="font-black text-slate-700 text-sm">{r.time} hs</span>
                                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">{r.type === 'call' ? 'Llamada' : r.type === 'meeting' ? 'Reunión' : 'Tarea'}</span>
                                                                    </div>
                                                                    <p className="text-sm text-slate-600 font-medium">{r.note}</p>
                                                                </div>
                                                                <Button size="sm" variant="ghost" className="h-8 w-8 text-slate-300 hover:text-green-500 hover:bg-green-50 rounded-full">
                                                                    <CheckSquare size={18}/>
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )) : (
                                                        <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                                                            <CalendarIcon className="mx-auto mb-2 opacity-20" size={32}/>
                                                            <p className="text-xs">No hay eventos programados para hoy.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>
                                </div>
                            </Tabs>
                        </div>
                    </div>

                    <DialogFooter className="px-8 py-5 border-t bg-white sm:justify-between gap-3 shrink-0 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.05)] z-20">
                        <div className="flex gap-3">
                            <Button variant="ghost" className="text-xs font-bold text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={onRelease}>Liberar Caso</Button>
                            {(localOp.operator === currentUser || role === 'admin_god') && localOp.status !== 'rechazado' && (
                                <Button variant="outline" className="text-xs font-bold text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 gap-2" onClick={() => setIsCorrectionOpen(true)}>
                                    <AlertTriangle size={14}/> Solicitar Corrección
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {(localOp.operator === currentUser || role === 'admin_god') ? (
                                <>
                                    {getPrevState() && (
                                        <Button variant="outline" className="h-10 px-6 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-50" onClick={handleBackStage}>
                                            <ArrowLeft className="mr-2 h-3 w-3"/> Volver a {prevStateLabel}
                                        </Button>
                                    )}
                                    {localOp.status !== 'demoras' && localOp.status !== 'rechazado' && localOp.status !== 'cumplidas' && getNextState() && (
                                        <Button className="h-10 px-8 bg-slate-900 hover:bg-blue-600 text-white font-black text-xs tracking-widest shadow-xl transition-all" onClick={handleAdvanceStage}>
                                            AVANZAR A {nextStateLabel} <ArrowRight className="ml-2 h-3 w-3"/>
                                        </Button>
                                    )}
                                </>
                            ) : !localOp.operator && (
                                <Button className="h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs tracking-widest shadow-xl transition-all" onClick={onPick}>✋ Tomar Caso</Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL CORRECCIÓN */}
            <Dialog open={isCorrectionOpen} onOpenChange={setIsCorrectionOpen}>
                <DialogContent className="max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-black text-red-600 flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5"/> Solicitar Corrección
                        </DialogTitle>
                        <DialogDescription>Cambiará el estado a <b>RECHAZADO</b>.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <Select value={correctionReason} onValueChange={setCorrectionReason}>
                            <SelectTrigger><SelectValue placeholder="Motivo..."/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="DNI Ilegible">DNI Ilegible</SelectItem>
                                <SelectItem value="Falta Documentación">Falta Documentación</SelectItem>
                                <SelectItem value="Datos Incorrectos">Datos Incorrectos</SelectItem>
                                <SelectItem value="Otro">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                        <Textarea placeholder="Comentario opcional..." value={correctionComment} onChange={e => setCorrectionComment(e.target.value)}/>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCorrectionOpen(false)}>Cancelar</Button>
                        <Button className="bg-red-600 text-white" disabled={!correctionReason} onClick={handleSubmitCorrection}>Enviar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* VISOR DE ARCHIVOS */}
            {previewFile && (
                <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
                    <DialogContent className="max-w-4xl bg-black border-slate-800 p-0 overflow-hidden flex flex-col justify-center items-center shadow-2xl">
                                                <DialogTitle className="sr-only">Vista previa de archivo</DialogTitle>
<div className="absolute top-4 right-4 z-50">
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setPreviewFile(null)}>
                                <X size={24}/>
                            </Button>
                        </div>
                        <div className="w-full h-[80vh] flex items-center justify-center bg-black/90 p-4">
                            {previewFile.type === 'IMG' || (previewFile.name && previewFile.name.match(/\.(jpg|jpeg|png|webp|gif)$/i)) ? (
                                <img src={previewFile.url} alt="Preview" className="max-h-full max-w-full object-contain rounded-md shadow-2xl" />
                            ) : (
                                <div className="text-center text-white">
                                    <FileText size={64} className="mx-auto mb-4 text-slate-500"/>
                                    <p className="text-lg font-bold">Vista previa de PDF no disponible en demo.</p>
                                    <Button variant="outline" className="mt-4 border-white text-white hover:bg-white hover:text-black" onClick={() => forceDownload(previewFile)}>Descargar para ver</Button>
                                </div>
                            )}
                        </div>
                        <div className="w-full bg-slate-900 p-4 flex justify-between items-center text-white">
                            <div>
                                <p className="font-bold text-sm">{previewFile.name}</p>
                                <p className="text-xs text-slate-400">{(previewFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => forceDownload(previewFile)}>
                                <Download size={16} className="mr-2"/> Descargar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}
