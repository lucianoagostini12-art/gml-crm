"use client"

import { useState, useEffect } from "react"
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
  Eye, Download, X, AlertTriangle, Send, UserCog
} from "lucide-react"
// NOTA: Se quitaron PLANES_POR_EMPRESA y SUB_STATES del import porque ahora vienen de DB
import { OpStatus, ChatMsg, AuditLog, AdminNote, getStatusColor, getSubStateStyle } from "./data"

// --- COMPONENTES UI INTERNOS ---

function TabTrigger({ value, label, icon }: any) {
    return (
        <TabsTrigger value={value} className="data-[state=active]:border-b-4 data-[state=active]:border-blue-600 rounded-none h-full px-4 gap-2 text-slate-400 text-xs font-black uppercase tracking-widest transition-all flex-1">
            {icon} {label}
        </TabsTrigger>
    )
}

function EditableField({ label, value, onChange, icon, color, prefix, suffix }: any) {
    return (
        <div className="flex flex-col gap-1 items-start w-full group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                {icon} {label}
            </span>
            <div className="relative w-full">
                {prefix && <span className="absolute left-0 bottom-1.5 text-xs text-slate-400 font-bold">{prefix}</span>}
                <Input 
                    className={`text-sm font-medium border-0 border-b border-transparent group-hover:border-slate-200 focus-visible:border-blue-500 focus-visible:ring-0 px-0 h-7 rounded-none transition-all ${color || 'text-slate-800'} ${prefix ? 'pl-4' : ''}`}
                    value={value || ""}
                    onChange={(e) => onChange(e.target.value)}
                />
                {suffix && <span className="absolute right-0 bottom-1.5 text-xs text-slate-400 font-bold">{suffix}</span>}
            </div>
        </div>
    )
}

function FileCard({ file, onPreview, onDownload }: any) {
    return (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:shadow-md transition-all group relative overflow-hidden">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${file.type === 'PDF' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
                {file.type === 'PDF' ? <FileText size={18}/> : <ImageIcon size={18}/>}
            </div>
            
            <div className="overflow-hidden flex-1 flex flex-col justify-center cursor-pointer" onClick={() => onPreview(file)}>
                <p className="text-xs font-bold truncate text-slate-700 group-hover:text-blue-600">{file.name}</p>
                <p className="text-[10px] text-slate-400">{file.size}</p>
            </div>

            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50" onClick={() => onPreview(file)} title="Ver">
                    <Eye size={16}/>
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-green-600 hover:bg-green-50" onClick={() => onDownload(file)} title="Descargar">
                    <Download size={16}/>
                </Button>
            </div>
        </div>
    )
}

function ChatBubble({ user, text, time, isMe, file, onFileClick }: any) {
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-in slide-in-from-bottom-2`}>
            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-[13px] ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-slate-700 rounded-bl-none shadow-sm'}`}>
                {!isMe && <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-tighter">{user}</p>}
                {text}
                {file && (
                    <div onClick={() => onFileClick(file)} className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-black/20 border border-white/20">
                        <ImageIcon size={14}/>
                        <span className="text-[10px] font-bold truncate max-w-[150px]">{file.name}</span>
                    </div>
                )}
            </div>
            <span className="text-[9px] text-slate-400 mt-1 px-1 font-bold">{time}</span>
        </div>
    )
}

// --- MODAL PRINCIPAL ---

export function OpsModal({ 
    op, isOpen, onClose, onRelease, onStatusChange, requestAdvance, requestBack, onPick, 
    onSendChat, onAddNote, onAddReminder, currentUser, role, onUpdateOp, 
    onSubStateChange, getSubStateStyle, getStatusColor,
    globalConfig // <--- RECIBIMOS LA CONFIG REAL DESDE OPSMANAGER
}: any) {
    const supabase = createClient()
    const [activeTab, setActiveTab] = useState("chat")
    const [chatInput, setChatInput] = useState("")
    
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

    // Estado Cambio Vendedora
    const [isSellerChangeOpen, setIsSellerChangeOpen] = useState(false)
    const [newSeller, setNewSeller] = useState("")
    const [sellersList, setSellersList] = useState<any[]>([])

    // Cargar vendedores al abrir
    useEffect(() => {
        if(isOpen) {
            const fetchSellers = async () => {
                const { data } = await supabase.from('profiles').select('full_name').eq('role', 'seller')
                if(data) setSellersList(data)
            }
            fetchSellers()
        }
    }, [isOpen])

    if (!op) return null

    // Archivos Demo (Mientras no tengamos storage real para archivos)
    const demoFiles = [
        { id: 1, name: "DNI_Titular_Frente.jpg", type: "IMG", size: "2.4 MB", url: "https://via.placeholder.com/600x400?text=DNI+Frente" },
        { id: 2, name: "Recibo_Sueldo_Sept.pdf", type: "PDF", size: "1.1 MB", url: "https://via.placeholder.com/600x800?text=PDF+Document" }, 
        { id: 3, name: "Formulario_Alta_Firmado.pdf", type: "PDF", size: "0.5 MB", url: "https://via.placeholder.com/600x800?text=Formulario" },
    ]

    // --- LOGICA DE PLANES REALES DESDE DB ---
    // Usamos globalConfig en lugar de la constante borrada
    const prepagasList = globalConfig?.prepagas || []
    const availablePlans = prepagasList.find((p: any) => p.name === (op.prepaga || "Otra"))?.plans || []
    const subStatesList = globalConfig?.subStates?.[op.status] || []

    const handleSellerChange = () => {
        if(!newSeller) return
        onUpdateOp({...op, seller: newSeller})
        setIsSellerChangeOpen(false)
    }

    const openWhatsApp = () => {
        const cleanPhone = op.phone?.replace(/[^0-9]/g, '') || ""
        window.open(`https://wa.me/${cleanPhone}`, '_blank')
    }

    const handleSaveNote = () => {
        if (!newNoteInput.trim()) return
        onAddNote(newNoteInput)
        setNewNoteInput("")
    }

    const handleSubmitCorrection = () => {
        if (!correctionReason) return
        onStatusChange(op.id, 'rechazado')
        onSendChat(`⚠️ Se solicita corrección: ${correctionReason}. ${correctionComment ? `(${correctionComment})` : ''}`)
        setCorrectionReason("")
        setCorrectionComment("")
        setIsCorrectionOpen(false)
        setActiveTab("chat") 
    }

    const handleDownload = (file: any) => {
        alert(`Descargando archivo: ${file.name}`)
    }

    // Agenda Helpers
    const today = new Date().toISOString().split('T')[0]
    const sortedReminders = [...(op.reminders || [])].sort((a: any, b: any) => new Date(a.date + 'T' + a.time).getTime() - new Date(b.date + 'T' + b.time).getTime())
    const todayReminders = sortedReminders.filter((r: any) => r.date === today)

    const hasEvent = (day: number) => {
        const checkDate = new Date(); 
        checkDate.setDate(day);
        const dateStr = checkDate.toISOString().split('T')[0];
        return op.reminders?.some((r: any) => r.date === dateStr);
    }

    const getReminderIcon = (type: string) => {
        switch(type) {
            case 'call': return <Phone size={14} className="text-blue-600"/>
            case 'meeting': return <Users size={14} className="text-purple-600"/>
            default: return <CheckSquare size={14} className="text-emerald-600"/>
        }
    }

    const getReminderColor = (type: string) => {
        switch(type) {
            case 'call': return 'border-l-blue-500 bg-blue-50/30'
            case 'meeting': return 'border-l-purple-500 bg-purple-50/30'
            default: return 'border-l-emerald-500 bg-emerald-50/30'
        }
    }

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent style={{ maxWidth: '1200px', width: '95%', height: '90vh' }} className="flex flex-col p-0 gap-0 bg-white border-0 shadow-2xl overflow-hidden rounded-2xl text-slate-900">
                    
                    {/* CABECERA */}
                    <DialogHeader className="px-8 py-6 border-b border-slate-100 bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
                        <div className="flex items-center gap-6">
                            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center shadow-md ${op.type==='alta'?'bg-green-100 text-green-600':'bg-purple-600 text-white'}`}>
                                {op.type==='alta' ? <UserPlus size={32}/> : <ArrowRightLeft size={32}/>}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <DialogTitle className="text-3xl font-black text-slate-800 leading-none">{op.clientName}</DialogTitle>
                                    <Button size="sm" className="h-7 bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2 px-3 rounded-full" onClick={openWhatsApp}>
                                        <MessageCircle size={14} className="text-white"/> WhatsApp
                                    </Button>
                                    <Button size="sm" className="h-7 bg-slate-800 hover:bg-slate-700 text-white gap-2 px-3 rounded-full shadow-sm border border-slate-700" onClick={() => setActiveTab("agenda")}>
                                        <Clock size={14} className="text-white"/> Agendar
                                    </Button>
                                </div>
                                <div className="flex items-center gap-3 mt-2">
                                    {/* SELECTOR PREPAGA (REAL) */}
                                    <Select value={op.prepaga} onValueChange={(val) => onUpdateOp({...op, prepaga: val})}>
                                        <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[160px] shadow-sm"><SelectValue placeholder="Prepaga"/></SelectTrigger>
                                        <SelectContent>{prepagasList.map((p: any)=><SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                    
                                    {/* SELECTOR PLAN (REAL) */}
                                    <Select value={op.plan} onValueChange={(val) => onUpdateOp({...op, plan: val})}>
                                        <SelectTrigger className="h-8 text-xs font-bold bg-white border-slate-300 w-[120px] shadow-sm"><SelectValue placeholder="Plan"/></SelectTrigger>
                                        <SelectContent>{availablePlans.map((p:string)=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                                    </Select>

                                    {/* CAMBIO DE VENDEDORA */}
                                    <Popover open={isSellerChangeOpen} onOpenChange={setIsSellerChangeOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-8 gap-2 border-dashed border-slate-300 text-slate-500 hover:text-blue-600 hover:border-blue-300 ml-2">
                                                <UserCog size={14}/> {op.seller || "Sin Vendedor"}
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
                                    
                                    <Badge variant="outline" className="ml-2 bg-slate-100 text-slate-500 font-medium"><CalendarIcon size={12} className="mr-1"/> Ingreso: {op.entryDate}</Badge>
                                </div>
                            </div>
                        </div>

                        {/* ESTADO Y SUB-ESTADO (REAL) */}
                        <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">Etapa:</span>
                                <Select value={op.status} onValueChange={(val) => onStatusChange(op.id, val as OpStatus)}>
                                    <SelectTrigger className={`h-8 w-[140px] text-xs font-bold uppercase tracking-widest ${getStatusColor(op.status)} border-0 focus:ring-0 text-center shadow-sm`}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent align="end">
                                        <SelectItem value="ingresado" className="font-medium text-slate-600">INGRESADO</SelectItem>
                                        <SelectItem value="precarga" className="font-medium text-blue-600">PRECARGA</SelectItem>
                                        <SelectItem value="medicas" className="font-medium text-purple-600">MÉDICAS</SelectItem>
                                        <SelectItem value="legajo" className="font-medium text-yellow-600">LEGAJO</SelectItem>
                                        <SelectItem value="cumplidas" className="font-medium text-emerald-600">CUMPLIDAS</SelectItem>
                                        <div className="border-t my-1"></div>
                                        <SelectItem value="demoras" className="font-black text-amber-600">⚠ DEMORAS</SelectItem>
                                        <SelectItem value="rechazado" className="font-black text-red-600">⛔ RECHAZADO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="flex items-center gap-2">
                                <Select value={op.subState || ""} onValueChange={(val) => onSubStateChange(op.id, val)}>
                                    <SelectTrigger className={`h-9 w-[260px] text-xs font-bold text-right justify-between shadow-sm border-2 ${getSubStateStyle(op.subState)}`}>
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
                                {/* SECCIÓN 1: DATOS TITULAR */}
                                <section className="space-y-5">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-3"><User size={14}/> 1. Datos Titular</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                                        <EditableField label="Nombre Completo" value={op.clientName} onChange={(v: string) => onUpdateOp({...op, clientName: v})} />
                                        <EditableField label="CUIL/CUIT" value={op.dni} onChange={(v: string) => onUpdateOp({...op, dni: v})} />
                                        <EditableField label="Nacimiento" value={op.dob} onChange={(v: string) => onUpdateOp({...op, dob: v})} />
                                        <EditableField label="Email" value={op.email} onChange={(v: string) => onUpdateOp({...op, email: v})} />
                                        <EditableField label="Teléfono" value={op.phone} onChange={(v: string) => onUpdateOp({...op, phone: v})} />
                                        
                                        <div className="col-span-2 pt-1">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 flex items-center gap-1"><MapPin size={10}/> Domicilio</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <Input className="text-xs h-8" placeholder="Calle y Nro" value={op.address_street} onChange={e => onUpdateOp({...op, address_street: e.target.value})} />
                                                <Input className="text-xs h-8" placeholder="Localidad" value={op.address_city} onChange={e => onUpdateOp({...op, address_city: e.target.value})} />
                                                <Input className="text-xs h-8" placeholder="CP" value={op.address_zip} onChange={e => onUpdateOp({...op, address_zip: e.target.value})} />
                                            </div>
                                        </div>
                                    </div>
                                </section>

                                {/* SECCIÓN 2: GRUPO */}
                                <section className="space-y-5">
                                    <div className="flex justify-between items-center border-b pb-3">
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> 2. Grupo Familiar</h4>
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600 hover:bg-blue-50" onClick={() => onUpdateOp({...op, hijos: [...(op.hijos || []), {nombre: "", dni: ""}]})}>
                                            <Plus size={12} className="mr-1"/> Agregar
                                        </Button>
                                    </div>
                                    <div className="p-5 bg-slate-50/80 rounded-xl border border-slate-100">
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <EditableField label="Tipo Afiliación" value={op.affiliation_type} onChange={(v: string) => onUpdateOp({...op, affiliation_type: v})} color="text-purple-600 font-bold" />
                                            <EditableField label="Cápitas Total" value={op.capitas} onChange={(v: any) => onUpdateOp({...op, capitas: v})} />
                                        </div>
                                        <div className="pt-3 border-t border-slate-200 space-y-2">
                                            {op.hijos && op.hijos.length > 0 ? op.hijos.map((h: any, i: number) => (
                                                <div key={i} className="flex gap-2 items-center">
                                                    <Input className="h-7 text-xs bg-white" placeholder="Nombre" value={h.nombre} onChange={(e) => { const newHijos = [...op.hijos!]; newHijos[i].nombre = e.target.value; onUpdateOp({...op, hijos: newHijos}) }}/>
                                                    <Input className="h-7 text-xs bg-white w-24 font-mono" placeholder="DNI" value={h.dni} onChange={(e) => { const newHijos = [...op.hijos!]; newHijos[i].dni = e.target.value; onUpdateOp({...op, hijos: newHijos}) }}/>
                                                </div>
                                            )) : <p className="text-xs text-slate-400 italic">Sin integrantes adicionales.</p>}
                                        </div>
                                    </div>
                                </section>

                                {/* SECCIÓN 3: PAGO Y LABORAL */}
                                <section className="space-y-5">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-3"><Briefcase size={14}/> 3. Laboral & Pago</h4>
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-5">
                                        <EditableField label="Condición" value={op.condicionLaboral} onChange={(v: string) => onUpdateOp({...op, condicionLaboral: v})} />
                                        <EditableField label="CUIT Empleador" value={op.cuitEmpleador} onChange={(v: string) => onUpdateOp({...op, cuitEmpleador: v})} />
                                        <div className="col-span-2 grid grid-cols-2 gap-4 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                                            <EditableField label="Método Pago" value={op.metodoPago} onChange={(v: string) => onUpdateOp({...op, metodoPago: v})} color="text-emerald-700 font-bold" />
                                            <EditableField label="CBU/Tarjeta" value={op.cbu_tarjeta} onChange={(v: string) => onUpdateOp({...op, cbu_tarjeta: v})} />
                                        </div>
                                    </div>
                                </section>

                                {/* SECCIÓN 4: VALORES ECONOMICOS */}
                                <section className="space-y-5 pb-10">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b pb-3"><DollarSign size={14}/> 4. Valores Económicos</h4>
                                    <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
                                        <div className="grid grid-cols-3 gap-6">
                                            <EditableField label="Full Price" value={op.fullPrice || op.price} onChange={(v: string) => onUpdateOp({...op, fullPrice: v})} icon={<DollarSign size={12}/>} prefix="$" color="text-lg font-black text-slate-800" />
                                            <EditableField label="Aportes" value={op.aportes} onChange={(v: string) => onUpdateOp({...op, aportes: v})} icon={<Wallet size={12}/>} prefix="$" color="text-base font-bold text-slate-700" />
                                            <EditableField label="Descuento" value={op.descuento} onChange={(v: string) => onUpdateOp({...op, descuento: v})} icon={<Percent size={12}/>} prefix="$" color="text-base font-bold text-green-600" />
                                        </div>
                                    </div>
                                </section>
                            </div>
                        </ScrollArea>

                        {/* COLUMNA DERECHA (Chat, Notas, etc.) */}
                        <div className="flex-1 flex flex-col bg-slate-50/50 overflow-hidden">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                                <div className="px-8 pt-4 border-b border-slate-100 bg-white">
                                    <TabsList className="bg-transparent h-10 justify-start gap-8 p-0 border-none w-full">
                                        <TabTrigger value="chat" label="Historial & Chat" icon={<MessageSquare size={16}/>} />
                                        <TabTrigger value="notes" label="Notas" icon={<StickyNote size={16}/>} />
                                        <TabTrigger value="files" label="Archivos" icon={<UploadCloud size={16}/>} />
                                        <TabTrigger value="agenda" label="Agenda" icon={<CalendarIcon size={16}/>} />
                                    </TabsList>
                                </div>
                                
                                <div className="flex-1 overflow-hidden">
                                    {/* TAB CHAT */}
                                    <TabsContent value="chat" className="flex-1 flex flex-col h-full m-0 p-0 overflow-hidden text-slate-900">
                                        <ScrollArea className="flex-1 p-8 text-slate-900 bg-slate-50/50">
                                            {/* Historial */}
                                            <div className="space-y-4 mb-6">
                                                {(op.history || []).map((h: AuditLog, i: number) => (
                                                    <div key={i} className="flex gap-3 text-xs text-slate-500 items-center justify-center opacity-60"><span>{h.date}</span> • <span>{h.user} {h.action}</span></div>
                                                ))}
                                            </div>
                                            {/* Mensajes */}
                                            {(op.chat || []).map((msg: ChatMsg, i: number) => <ChatBubble key={i} {...msg} onFileClick={() => {}} />)}
                                        </ScrollArea>
                                        <div className="p-4 bg-white border-t flex gap-3 shadow-lg z-10">
                                            <Input className="h-11 text-sm shadow-sm" placeholder="Escribir mensaje..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && onSendChat(chatInput) && setChatInput("")}/>
                                            <Button size="icon" className="h-11 w-11 bg-blue-600 hover:bg-blue-700 shadow-md" onClick={() => {onSendChat(chatInput); setChatInput("")}}><ArrowRight size={20}/></Button>
                                        </div>
                                    </TabsContent>

                                    {/* TAB NOTAS */}
                                    <TabsContent value="notes" className="flex-1 flex flex-col h-full m-0 p-0 overflow-hidden text-slate-900 bg-yellow-50/30">
                                        <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                            {op.adminNotes && op.adminNotes.length > 0 ? op.adminNotes.map((note: AdminNote, i: number) => (
                                                <div key={i} className="bg-white p-4 rounded-xl shadow-sm border border-yellow-100 relative group">
                                                    {/* FIX: Use only 'text' instead of trying 'action' which does not exist on type AdminNote */}
                                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.text}</p>
                                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-50"><span className="text-[10px] text-slate-400 font-bold uppercase">{note.user || "Sistema"} • {note.date || "Hoy"}</span></div>
                                                </div>
                                            )) : <div className="text-center p-8 text-slate-400 text-xs italic">No hay notas guardadas aún.</div>}
                                        </div>
                                        <div className="p-4 bg-white border-t border-yellow-100">
                                            <Textarea className="min-h-[80px] text-sm bg-slate-50 border-slate-200 resize-none mb-2 focus-visible:ring-yellow-400" placeholder="Escribí una nueva nota..." value={newNoteInput} onChange={(e) => setNewNoteInput(e.target.value)} />
                                            <Button size="sm" className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold" onClick={handleSaveNote}>Guardar Nota</Button>
                                        </div>
                                    </TabsContent>

                                    {/* TAB ARCHIVOS */}
                                    <TabsContent value="files" className="p-8 flex flex-col gap-4 m-0 overflow-y-auto h-full content-start text-slate-900">
                                        <div className="flex justify-between items-center mb-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase">Documentación Cargada</h4>
                                            <Button size="sm" variant="outline" className="h-8 text-xs bg-white text-blue-600 border-blue-200 hover:bg-blue-50"><FileUp size={12} className="mr-1"/> Subir Admin</Button>
                                        </div>
                                        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer group">
                                            <div className="h-12 w-12 bg-slate-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100">
                                                <UploadCloud className="text-slate-400 group-hover:text-blue-500" size={24}/>
                                            </div>
                                            <p className="text-sm font-bold text-slate-600">Arrastrá y soltá archivos aquí</p>
                                            <p className="text-xs text-slate-400 mt-1">o hacé click para explorar (PDF, JPG, PNG)</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-2">
                                            {demoFiles.map((file) => (
                                                <FileCard key={file.id} file={file} onPreview={() => setPreviewFile(file)} onDownload={() => handleDownload(file)}/>
                                            ))}
                                        </div>
                                    </TabsContent>

                                    {/* TAB AGENDA */}
                                    <TabsContent value="agenda" className="flex-1 flex flex-col h-full m-0 p-0 overflow-hidden text-slate-900">
                                        <div className="flex h-full">
                                            <div className="w-[40%] p-6 border-r border-slate-100 overflow-y-auto bg-white">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2"><Plus size={14}/> Agendar Evento</h4>
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-500">Tipo</label>
                                                        <Select value={reminderType} onValueChange={setReminderType}>
                                                            <SelectTrigger className="h-9 text-xs"><SelectValue/></SelectTrigger>
                                                            <SelectContent><SelectItem value="call">📞 Llamada</SelectItem><SelectItem value="meeting">👥 Reunión</SelectItem><SelectItem value="task">✅ Tarea</SelectItem></SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500">Fecha y Hora</label>
                                                            <div className="flex gap-2">
                                                                <Input type="date" className="h-9 text-xs flex-1" value={reminderDate} onChange={e => setReminderDate(e.target.value)}/>
                                                                <Input type="time" className="h-9 text-xs w-24" value={reminderTime} onChange={e => setReminderTime(e.target.value)}/>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <label className="text-[10px] font-bold text-slate-500">Detalle</label>
                                                            <Input placeholder="Ej: Llamar por recibo" value={reminderNote} onChange={e => setReminderNote(e.target.value)}/>
                                                        </div>
                                                    </div>
                                                    <Button size="sm" className="w-full h-10 bg-slate-900 text-white hover:bg-blue-600 transition-colors shadow-lg font-bold mt-4 flex items-center justify-center gap-2" onClick={() => {onAddReminder(op.id, reminderDate, reminderTime, reminderNote, reminderType); setReminderNote("")}}>
                                                        <Save size={16}/> CONFIRMAR AGENDA
                                                    </Button>
                                                </div>
                                                <div className="mt-8 pt-6 border-t border-slate-100">
                                                     <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 text-center">Calendario {new Date().toLocaleString('default', { month: 'long' })}</h4>
                                                     <div className="grid grid-cols-7 gap-1 text-center mb-1">{['D','L','M','M','J','V','S'].map((d, i) => <div key={i} className="text-[10px] text-slate-300 font-bold">{d}</div>)}</div>
                                                     <div className="grid grid-cols-7 gap-1">{[...Array(30)].map((_, i) => (<div key={i} className={`h-6 w-6 flex items-center justify-center rounded-full text-[10px] ${i+1 === new Date().getDate() ? 'bg-blue-600 text-white font-bold' : 'text-slate-500 hover:bg-slate-100'} ${hasEvent(i+1) && !(i+1 === new Date().getDate()) ? 'border border-blue-400 text-blue-600 font-bold' : ''}`}>{i+1}</div>))}</div>
                                                </div>
                                            </div>
                                            <div className="w-[60%] p-6 overflow-y-auto bg-slate-50/50">
                                                <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Línea de Tiempo</h4>
                                                <div className="space-y-8">
                                                    <div className="relative pl-10 border-l-2 border-blue-500">
                                                        <div className="absolute -left-[9px] top-0 h-5 w-5 rounded-full bg-blue-600 border-4 border-white shadow-sm flex items-center justify-center z-10"><div className="h-1.5 w-1.5 bg-white rounded-full"/></div>
                                                        <h5 className="text-xs font-black text-blue-700 mb-3 uppercase tracking-wider leading-none pt-1">Hoy</h5>
                                                        {todayReminders.length > 0 ? todayReminders.map((r: any) => (
                                                            <div key={r.id} className={`bg-white p-3 rounded-lg border-l-4 border shadow-sm mb-2 flex justify-between items-center group hover:shadow-md transition-all ${getReminderColor(r.type)} border-slate-100`}>
                                                                <div><div className="flex items-center gap-2 mb-1">{getReminderIcon(r.type)}<span className="font-black text-slate-700 text-xs">{r.time} hs</span></div><span className="text-xs text-slate-600 font-medium">{r.note}</span></div>
                                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-300 hover:text-green-500"><CheckSquare size={14}/></Button>
                                                            </div>
                                                        )) : <p className="text-[10px] text-slate-400 italic">No hay tareas para hoy.</p>}
                                                    </div>
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
                            
                            {(op.operator === currentUser || role === 'admin_god') && op.status !== 'rechazado' && (
                                <Button variant="outline" className="text-xs font-bold text-red-600 border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300 gap-2" onClick={() => setIsCorrectionOpen(true)}>
                                    <AlertTriangle size={14}/> Solicitar Corrección
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-3">
                            {(op.operator === currentUser || role === 'admin_god') ? (
                                <>
                                    <Button variant="outline" className="h-10 px-6 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-50" onClick={requestBack}><ArrowLeft className="mr-2 h-3 w-3"/> Volver Estado</Button>
                                    {op.status !== 'demoras' && op.status !== 'rechazado' && op.status !== 'cumplidas' && (
                                        <Button className="h-10 px-8 bg-slate-900 hover:bg-blue-600 text-white font-black text-xs tracking-widest shadow-xl transition-all" onClick={requestAdvance}>AVANZAR ETAPA <ArrowRight className="ml-2 h-3 w-3"/></Button>
                                    )}
                                </>
                            ) : !op.operator && (
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
                        <div className="absolute top-4 right-4 z-50">
                            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => setPreviewFile(null)}>
                                <X size={24}/>
                            </Button>
                        </div>
                        <div className="w-full h-[80vh] flex items-center justify-center bg-black/90 p-4">
                            {previewFile.type === 'IMG' ? (
                                <img src={previewFile.url} alt="Preview" className="max-h-full max-w-full object-contain rounded-md shadow-2xl" />
                            ) : (
                                <div className="text-center text-white">
                                    <FileText size={64} className="mx-auto mb-4 text-slate-500"/>
                                    <p className="text-lg font-bold">Vista previa de PDF no disponible en demo.</p>
                                    <Button variant="outline" className="mt-4 border-white text-white hover:bg-white hover:text-black" onClick={() => handleDownload(previewFile)}>Descargar para ver</Button>
                                </div>
                            )}
                        </div>
                        <div className="w-full bg-slate-900 p-4 flex justify-between items-center text-white">
                            <div>
                                <p className="font-bold text-sm">{previewFile.name}</p>
                                <p className="text-xs text-slate-400">{previewFile.size}</p>
                            </div>
                            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleDownload(previewFile)}>
                                <Download size={16} className="mr-2"/> Descargar
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </>
    )
}