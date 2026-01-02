"use client"

import { useState, useEffect, useRef } from "react"
// import { supabase } from "@/lib/supabase" // COMENTADO PORQUE NO HAY BACKEND AÚN
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
    Calendar, DollarSign, FileText, CheckCircle2, XCircle, AlertTriangle, 
    Clock, MessageSquare, Send, User, MapPin, Paperclip, Smile, 
    MoreVertical, Info, VolumeX, Trash, CheckCheck, X, Users, 
    StickyNote, UploadCloud, Calendar as CalendarIcon, FileUp
} from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// --- DATOS MOCK (SIMULACIÓN DE BASE DE DATOS) ---
const MOCK_SALES = [
    {
        id: "1024",
        name: "Roberto Gómez",
        prepaga: "Sancor",
        plan: "3000B",
        value: 45000,
        admin_status: "ingresado",
        sub_status: "Datos Cargados",
        last_update: new Date().toISOString(),
        dni: "22.123.456",
        dob: "1985-05-10",
        phone: "11-2233-4455",
        email: "roberto@gmail.com",
        domicilio: "Av. Corrientes 1234",
        localidad: "CABA",
        capitas: 3,
        tipoGrupo: "Matrimonio + Hijo",
        chat: [
            { user: "Maca", text: "Acabo de cargar la venta, avisen si falta algo.", time: "09:00", isMe: true, read_by_agent: true },
            { user: "Administración", text: "Recibido Maca. En un rato lo auditamos.", time: "09:15", isMe: false, read_by_agent: true }
        ],
        adminNotes: []
    },
    {
        id: "1025",
        name: "Lucía Pérez",
        prepaga: "Galeno",
        plan: "220",
        value: 32000,
        admin_status: "rechazado", // EJEMPLO RECHAZADO
        sub_status: "Falta Documentación",
        last_update: new Date().toISOString(),
        dni: "30.987.654",
        dob: "1990-11-20",
        phone: "11-9988-7766",
        email: "lucia.p@hotmail.com",
        domicilio: "Calle Falsa 123",
        localidad: "Lanús",
        capitas: 1,
        tipoGrupo: "Individual",
        chat: [
            { user: "Maca", text: "Envío DNI.", time: "10:00", isMe: true, read_by_agent: true },
            { user: "Administración", text: "Maca, la foto del DNI se ve borrosa. Por favor subila de nuevo.", time: "10:30", isMe: false, read_by_agent: false } // MENSAJE NO LEIDO
        ],
        adminNotes: [
            { id: 1, text: "La foto del frente no se distingue el número de trámite.", user: "Admin", date: "Hoy 10:30" }
        ]
    }
]

// --- COMPONENTES UI INTERNOS ---

function TabTrigger({ value, label, icon }: any) {
    return (
        <TabsTrigger value={value} className="data-[state=active]:border-b-4 data-[state=active]:border-blue-600 rounded-none h-full px-4 gap-2 text-slate-400 text-xs font-black uppercase tracking-widest transition-all flex-1">
            {icon} {label}
        </TabsTrigger>
    )
}

function ReadOnlyField({ label, value, icon, color, prefix }: any) {
    return (
        <div className="flex flex-col gap-1 items-start w-full group">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                {icon} {label}
            </span>
            <div className={`w-full border-b border-slate-200 py-1 text-sm font-medium ${color || 'text-slate-700'}`}>
                {prefix && <span className="text-slate-400 mr-1">{prefix}</span>}
                {value || "-"}
            </div>
        </div>
    )
}

function ChatBubble({ user, text, time, isMe, type }: any) {
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-in slide-in-from-bottom-2`}>
            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-[13px] shadow-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-slate-700 rounded-bl-none'}`}>
                {!isMe && <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-tighter">Administración</p>}
                {type === 'file' ? (
                    <div className="flex items-center gap-2 italic">
                        <Paperclip size={14}/> <span>Archivo: <b>{text}</b></span>
                    </div>
                ) : text}
            </div>
            <div className="flex items-center gap-1 mt-1 px-1">
                <span className="text-[9px] text-slate-400 font-bold">{time}</span>
                {isMe && <CheckCheck size={10} className="text-blue-400"/>}
            </div>
        </div>
    )
}

// --- HELPERS ---
const getAdminStatus = (status: string) => {
    switch (status?.toLowerCase()) {
        case 'ingresado': return { label: 'INGRESADO', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <Clock className="w-3 h-3"/> };
        case 'rechazado': return { label: 'RECHAZADO', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle className="w-3 h-3"/> };
        default: return { label: 'EN PROCESO', color: 'bg-slate-100 text-slate-700 border-slate-200', icon: <Clock className="w-3 h-3"/> };
    }
}

export function MySalesView() {
    const [sales, setSales] = useState<any[]>(MOCK_SALES) // USAMOS DATOS MOCK
    const [month, setMonth] = useState(new Date().getMonth().toString())
    const [selectedSale, setSelectedSale] = useState<any>(null)
    const [activeTab, setActiveTab] = useState("chat")
    const [chatMsg, setChatMsg] = useState("")
    
    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const CURRENT_USER = "Maca"

    // Scroll automático
    useEffect(() => {
        if (selectedSale && scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" })
        }
    }, [selectedSale?.chat, activeTab])

    // --- LÓGICA DE APERTURA (SIMULADA) ---
    const handleOpenSale = (sale: any) => {
        // Al abrir, marcamos los mensajes como leídos localmente
        const updatedChat = sale.chat.map((m: any) => 
            !m.isMe ? { ...m, read_by_agent: true } : m
        )
        
        const updatedSale = { ...sale, chat: updatedChat }
        
        // Actualizamos estado general y modal
        setSales(prev => prev.map(s => s.id === sale.id ? updatedSale : s))
        setSelectedSale(updatedSale)
    }

    const sendMessage = (type = 'text', content = chatMsg) => {
        if (!content.trim() || !selectedSale) return
        
        const newMessage = {
            user: CURRENT_USER,
            text: content,
            time: format(new Date(), "HH:mm"),
            isMe: true,
            type,
            read_by_agent: true
        }
        
        const updatedChat = [...selectedSale.chat, newMessage]
        const updatedSale = { ...selectedSale, chat: updatedChat }

        // Actualizamos todo localmente
        setSales(prev => prev.map(s => s.id === selectedSale.id ? updatedSale : s))
        setSelectedSale(updatedSale)
        setChatMsg("")
        
        // SIMULACIÓN DE RESPUESTA AUTOMÁTICA (Para que veas que funciona)
        setTimeout(() => {
            const replyMsg = {
                user: "Administración",
                text: "Recibido, gracias.",
                time: format(new Date(), "HH:mm"),
                isMe: false,
                read_by_agent: true // Ya estoy viendo el chat, así que lo leo al toque
            }
            const chatWithReply = [...updatedChat, replyMsg]
            const saleWithReply = { ...selectedSale, chat: chatWithReply }
            setSales(prev => prev.map(s => s.id === selectedSale.id ? saleWithReply : s))
            setSelectedSale(saleWithReply)
        }, 2000)
    }

    const handleFileUpload = (e: any) => {
        const file = e.target.files[0]
        if (file) sendMessage('file', file.name)
    }

    const priceFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto text-slate-900">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2">
                        <DollarSign className="h-6 w-6 text-green-600" /> Mis Ventas
                    </h2>
                    <p className="text-slate-500 text-sm">Modo Demo Interactivo</p>
                </div>
            </div>

            {/* LISTADO DE TARJETAS */}
            <div className="grid gap-4">
                {sales.map((sale) => {
                    const adminStatus = getAdminStatus(sale.admin_status)
                    const unreadCount = sale.chat.filter((m: any) => !m.isMe && !m.read_by_agent).length
                    const isRejected = sale.admin_status === 'rechazado'
                    
                    return (
                        <Card key={sale.id} onClick={() => handleOpenSale(sale)} className={`cursor-pointer hover:shadow-lg transition-all border-l-4 border-l-green-500 relative ${isRejected ? 'bg-red-50/50 border-l-red-500 ring-1 ring-red-200' : 'bg-white'}`}>
                            {unreadCount > 0 && <span className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-bounce z-10">{unreadCount}</span>}
                            {isRejected && <span className="absolute -top-2 left-4 px-2 py-0.5 bg-red-100 text-red-600 text-[9px] font-bold uppercase rounded border border-red-200 shadow-sm flex items-center gap-1"><AlertTriangle size={10}/> Requiere Atención</span>}
                            
                            <CardContent className="p-4 flex justify-between items-center">
                                <div>
                                    <h4 className="font-bold text-lg">{sale.name} <Badge variant="secondary" className="text-[10px] ml-2">{sale.prepaga}</Badge></h4>
                                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-1"><CalendarIcon size={12}/> {format(new Date(sale.last_update), "d 'MMM'", { locale: es })} • <span className="text-blue-600 font-bold bg-blue-50 px-2 rounded">{sale.sub_status}</span></span>
                                </div>
                                <div className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-xs font-bold ${adminStatus.color}`}>{adminStatus.icon} {adminStatus.label}</div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>

            {/* MODAL DETALLE */}
            <Dialog open={!!selectedSale} onOpenChange={() => setSelectedSale(null)}>
                <DialogContent style={{ maxWidth: '1200px', width: '95%', height: '90vh' }} className="flex flex-col p-0 gap-0 bg-white border-0 shadow-2xl overflow-hidden rounded-2xl text-slate-900">
                    <DialogTitle className="sr-only">Detalle</DialogTitle>
                    
                    {/* CABECERA MODAL */}
                    <div className="px-8 py-6 border-b bg-slate-50/50 flex justify-between items-center shrink-0">
                        <div className="flex items-center gap-6">
                            <Avatar className="h-16 w-16 bg-slate-200 border-2 border-white shadow-md"><AvatarFallback className="text-xl font-black">{selectedSale?.name.substring(0,2)}</AvatarFallback></Avatar>
                            <div>
                                <h2 className="text-3xl font-black text-slate-800">{selectedSale?.name}</h2>
                                <div className="flex gap-2 mt-2"><Badge className="bg-slate-800">{selectedSale?.prepaga}</Badge><Badge variant="outline" className="bg-white">{selectedSale?.plan}</Badge></div>
                            </div>
                        </div>
                        <div className="text-right">
                            <Badge className={`h-8 px-4 text-xs font-bold uppercase tracking-widest ${getAdminStatus(selectedSale?.admin_status).color}`}>{getAdminStatus(selectedSale?.admin_status).label}</Badge>
                            <div className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded border border-blue-100 mt-2">{selectedSale?.sub_status}</div>
                        </div>
                    </div>

                    <div className="flex-1 flex overflow-hidden">
                        {/* COLUMNA IZQ: DATOS (SOLO LECTURA) */}
                        <ScrollArea className="w-[55%] border-r border-slate-100 bg-white shrink-0">
                            <div className="p-8 space-y-8">
                                <section className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex gap-2"><User size={14}/> Datos Personales</h4>
                                    <div className="grid grid-cols-2 gap-6">
                                        <ReadOnlyField label="DNI" value={selectedSale?.dni}/>
                                        <ReadOnlyField label="Teléfono" value={selectedSale?.phone}/>
                                        <ReadOnlyField label="Email" value={selectedSale?.email}/>
                                        <ReadOnlyField label="Domicilio" value={selectedSale?.domicilio} icon={<MapPin size={10}/>}/>
                                    </div>
                                </section>
                                <section className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b pb-2 flex gap-2"><DollarSign size={14}/> Económicos</h4>
                                    <ReadOnlyField label="Valor Mensual" value={priceFormatter.format(selectedSale?.value || 0)} color="text-xl font-black text-green-600"/>
                                </section>
                            </div>
                        </ScrollArea>

                        {/* COLUMNA DER: CHAT INTERACTIVO */}
                        <div className="flex-1 flex flex-col bg-slate-50/50">
                            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                                <div className="px-8 pt-4 border-b bg-white"><TabsList className="bg-transparent h-10 w-full justify-start gap-8"><TabTrigger value="chat" label="Chat Admin" icon={<MessageSquare size={16}/>} /><TabTrigger value="files" label="Archivos" icon={<UploadCloud size={16}/>} /></TabsList></div>
                                
                                <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 overflow-hidden">
                                    <ScrollArea className="flex-1 p-8 bg-[#e5ddd5]" style={{ backgroundImage: "url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')", backgroundBlendMode: 'overlay' }}>
                                        <div className="space-y-4">
                                            {selectedSale?.chat.map((msg: any, i: number) => <ChatBubble key={i} {...msg} />)}
                                            <div ref={scrollRef}/>
                                        </div>
                                    </ScrollArea>
                                    <div className="p-4 bg-white border-t flex gap-3 shadow-lg z-10">
                                        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Paperclip size={20}/></Button>
                                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload}/>
                                        <Input className="h-11" placeholder="Escribí un mensaje..." value={chatMsg} onChange={e=>setChatMsg(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendMessage()}/>
                                        <Button size="icon" className="h-11 w-11 bg-blue-600 hover:bg-blue-700" onClick={() => sendMessage()}><Send size={20}/></Button>
                                    </div>
                                </TabsContent>

                                <TabsContent value="files" className="p-8 flex flex-col gap-4 m-0 h-full">
                                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-blue-50 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                                        <UploadCloud className="text-slate-400 mb-2" size={32}/>
                                        <p className="text-sm font-bold text-slate-600">Subir Archivos</p>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}