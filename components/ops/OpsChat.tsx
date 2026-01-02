"use client"
import { useState, useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
// CORREGIDO: AGREGADO "Users" AQUI
import { 
    Send, Paperclip, Mic, Search, MoreVertical, Check, CheckCheck, 
    FileText, X, Smile, Plus, Info, VolumeX, Trash, Phone, Users 
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function OpsChat({ currentUser, operations = [], onViewSale }: any) {
    // --- ESTADOS ---
    const [msg, setMsg] = useState("")
    const [activeChat, setActiveChat] = useState<number>(1)
    const [chatSearch, setChatSearch] = useState("")
    const [showMentions, setShowMentions] = useState(false)
    const [mentionQuery, setMentionQuery] = useState("")
    const [attachedSale, setAttachedSale] = useState<any>(null)
    const [showInfo, setShowInfo] = useState(false)

    // REFS
    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // DATA CHATS
    const [chats, setChats] = useState([
        { id: 1, name: "Equipo de Ventas", type: "group", unread: 0, lastMsg: "Maca: Ingresé la de Pérez", avatar: "EQ" },
        { id: 2, name: "Administración", type: "group", unread: 3, lastMsg: "Falta cargar el legajo...", avatar: "AD" },
        { id: 3, name: "Maca (Ventas)", type: "dm", status: "online", avatar: "MA" },
    ])

    const [messages, setMessages] = useState<any[]>([
        { id: 1, chatId: 1, user: "Maca", text: "Chicos, buen día. ¿Alguien vio el caso de Roberto?", time: "09:00", isMe: false, type: "text" },
        { id: 3, chatId: 1, user: currentUser, text: "Ahí me fijo, dame un segundo.", time: "09:05", isMe: true, type: "text", status: "read" },
    ])

    // EFECTO SCROLL
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages, activeChat, showMentions])

    const activeChatData = chats.find(c => c.id === activeChat) || chats[0]

    // FUNCIONES
    const handleSend = () => {
        if (!msg.trim() && !attachedSale) return
        const newMsg = {
            id: Date.now(),
            chatId: activeChat,
            user: currentUser,
            text: msg,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isMe: true,
            type: attachedSale ? "sale_link" : "text",
            saleData: attachedSale || undefined,
            status: "sent"
        }
        setMessages(prev => [...prev, newMsg])
        setMsg("")
        setAttachedSale(null)
    }

    const handleInputChange = (e: any) => {
        const val = e.target.value
        setMsg(val)
        
        // Detectar @ para menciones
        const lastIndexAt = val.lastIndexOf('@')
        if (lastIndexAt !== -1) {
            const query = val.substring(lastIndexAt + 1)
            // Mostramos si no hay espacios (está escribiendo el nombre)
            if (!query.includes(' ')) {
                setShowMentions(true)
                setMentionQuery(query)
                return
            }
        }
        setShowMentions(false)
    }

    const handleSelectSale = (op: any) => {
        setAttachedSale(op)
        setShowMentions(false)
        // Limpiamos el texto de búsqueda del input visualmente
        const lastIndexAt = msg.lastIndexOf('@')
        if (lastIndexAt !== -1) {
            setMsg(msg.substring(0, lastIndexAt))
        }
    }

    const safeOperations = Array.isArray(operations) ? operations : []
    const mentionOps = safeOperations.filter((o:any) => 
        o.clientName && o.clientName.toLowerCase().includes(mentionQuery.toLowerCase())
    )

    return (
        <div className="flex h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e:any) => {
                const file = e.target.files[0]
                if(file) setMessages(prev => [...prev, { id: Date.now(), chatId: activeChat, user: currentUser, text: `Archivo: ${file.name}`, time: "10:00", isMe: true, type: "text" }])
            }} />

            {/* SIDEBAR IZQUIERDO */}
            <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
                    <h3 className="font-black text-slate-800 text-lg">Mensajes</h3>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50">
                                <Plus size={20} strokeWidth={3}/>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 p-2" align="start">
                            <p className="text-[10px] font-bold text-slate-400 uppercase p-2">Nuevo Chat</p>
                            <button className="w-full flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg text-sm font-medium"><Avatar className="h-6 w-6"><AvatarFallback className="text-[8px] bg-slate-800 text-white">MA</AvatarFallback></Avatar> Maca (Ventas)</button>
                            <button className="w-full flex items-center gap-3 p-2 hover:bg-slate-100 rounded-lg text-sm font-medium"><Avatar className="h-6 w-6"><AvatarFallback className="text-[8px] bg-slate-800 text-white">IA</AvatarFallback></Avatar> Iara (Admin)</button>
                            <div className="h-[1px] bg-slate-100 my-2" />
                            <button className="w-full flex items-center gap-2 p-2 hover:bg-blue-50 text-blue-600 rounded-lg text-sm font-bold"><Users size={16}/> Crear Grupo</button>
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="p-3">
                    <div className="relative group">
                         <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10"><Search className="h-4 w-4 text-slate-400/80 group-focus-within:text-blue-500 transition-colors" strokeWidth={2}/></div>
                        <Input className="pl-10 h-9 bg-white border-slate-200 focus:bg-white" placeholder="Buscar..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)}/>
                    </div>
                </div>
                <ScrollArea className="flex-1 px-2">
                    {chats.map(chat => (
                        <div key={chat.id} onClick={() => setActiveChat(chat.id)} className={`p-2 rounded-lg cursor-pointer flex items-center gap-3 mb-1 transition-all ${activeChat === chat.id ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-100/50'}`}>
                            <Avatar className="h-10 w-10 border border-slate-200"><AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-xs">{chat.avatar}</AvatarFallback></Avatar>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center"><span className="text-sm font-bold truncate">{chat.name}</span></div>
                                <p className="text-xs text-slate-400 truncate">{chat.lastMsg || 'Sin mensajes'}</p>
                            </div>
                        </div>
                    ))}
                </ScrollArea>
            </div>

            {/* AREA CENTRAL DE CHAT */}
            <div className="flex-1 flex flex-col bg-[#f0f2f5] relative">
                <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between shrink-0 z-10 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 bg-slate-900 text-white font-bold"><AvatarFallback>{activeChatData?.avatar}</AvatarFallback></Avatar>
                        <div><h4 className="font-bold text-slate-800">{activeChatData?.name}</h4><p className="text-xs text-green-500 font-medium">En línea</p></div>
                    </div>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-800"><MoreVertical size={20}/></Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-1" align="end">
                            <button onClick={() => setShowInfo(!showInfo)} className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded text-sm"><Info size={16}/> Info del grupo</button>
                            <button className="w-full flex items-center gap-2 p-2 hover:bg-slate-100 rounded text-sm"><VolumeX size={16}/> Silenciar</button>
                            <div className="h-[1px] bg-slate-100 my-1" />
                            <button onClick={() => setMessages([])} className="w-full flex items-center gap-2 p-2 hover:bg-red-50 text-red-600 rounded text-sm"><Trash size={16}/> Vaciar chat</button>
                        </PopoverContent>
                    </Popover>
                </header>

                <ScrollArea className="flex-1 p-4">
                    {messages.filter(m => m.chatId === activeChat).map((m, idx) => (
                        <div key={m.id} className={`flex ${m.isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                            <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${m.isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none'}`}>
                                {m.type === 'sale_link' ? (
                                    <div className="bg-white/10 p-2 rounded-lg border border-white/20">
                                        <p className="font-black text-[10px] uppercase mb-1">Operación Vinculada</p>
                                        <p className="font-bold text-sm">{m.saleData?.clientName}</p>
                                        <Button size="sm" variant="secondary" className="w-full h-7 mt-2 text-[10px] font-bold" onClick={() => onViewSale(m.saleData)}>Ver Detalles</Button>
                                    </div>
                                ) : <p>{m.text}</p>}
                                <div className="text-[9px] text-right mt-1 opacity-70 flex items-center justify-end gap-1">{m.time} {m.isMe && <CheckCheck size={10}/>}</div>
                            </div>
                        </div>
                    ))}
                    <div ref={scrollRef} />
                </ScrollArea>

                {/* --- MENU FLOTANTE DE MENCIONES (POSICION CORREGIDA) --- */}
                {/* Ahora está fuera del div del footer para no depender de él */}
                {showMentions && (
                    <div className="absolute bottom-24 left-4 w-72 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in zoom-in-95 duration-150">
                        <div className="bg-slate-50 px-3 py-2 border-b text-[10px] font-bold text-slate-500 uppercase">Mencionar Venta</div>
                        <ScrollArea className="max-h-48">
                            {mentionOps.length > 0 ? mentionOps.map((op:any) => (
                                <div key={op.id} onClick={() => handleSelectSale(op)} className="px-3 py-2 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b last:border-0 transition-colors">
                                    <div className="h-8 w-8 bg-slate-100 rounded flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">{op.clientName?.charAt(0)}</div>
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-bold text-slate-800 truncate">{op.clientName}</p>
                                        <p className="text-[10px] text-slate-400">{op.dni}</p>
                                    </div>
                                </div>
                            )) : <div className="p-4 text-center text-xs text-slate-400">Sin coincidencias</div>}
                        </ScrollArea>
                    </div>
                )}
                
                {/* CHIP DE VENTA ADJUNTA (SUPERIOR AL INPUT) */}
                {attachedSale && (
                    <div className="absolute bottom-20 left-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2 z-50">
                        <div className="flex items-center gap-2 text-xs font-bold">
                            <FileText size={16}/> Adjuntando: {attachedSale.clientName}
                        </div>
                        <X size={16} className="cursor-pointer hover:text-blue-200" onClick={() => setAttachedSale(null)}/>
                    </div>
                )}

                {/* --- INPUT FOOTER --- */}
                <div className="p-4 bg-white border-t border-slate-200 shrink-0 relative z-10">
                    <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                        <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} className="text-slate-400 hover:text-slate-600"><Paperclip size={20}/></Button>
                        <Input 
                            className="border-0 bg-transparent focus-visible:ring-0 shadow-none h-10 py-2.5 px-2 text-slate-700 font-medium" 
                            placeholder="Escribí un mensaje o usa @ para ventas..." 
                            value={msg} 
                            onChange={handleInputChange}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                        />
                        <Popover>
                            <PopoverTrigger asChild><Button variant="ghost" size="icon" className="text-slate-400 hover:text-yellow-500"><Smile size={20}/></Button></PopoverTrigger>
                            <PopoverContent className="w-80 p-0 shadow-xl border-slate-200" align="end" side="top">
                                <div className="bg-slate-50 px-3 py-2 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase">Emojis</div>
                                <div className="grid grid-cols-8 gap-1 p-2 max-h-48 overflow-y-auto custom-scrollbar">
                                    {['👍','😂','🔥','❤️','🎉','😭','🤔','👀','✅','❌','👋','💪','😅','🙌','😎','😡','🙏','✨','💩','👻','💀','🫶','🤝','🫡','🫠','🥸','🥹','🤯','🤡','🥳','😴','🤢','🤐','🤒','🤕','🤑','🤠','😈','👿','👹','👺'].map((e, i) => (
                                        <button key={i} onClick={() => setMsg(prev => prev + e)} className="text-xl hover:bg-slate-100 p-1.5 rounded-md transition-colors flex items-center justify-center aspect-square">{e}</button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Button size="icon" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 w-10 shadow-sm" onClick={handleSend}><Send size={18}/></Button>
                    </div>
                </div>
            </div>

            {/* PANEL INFO (DERECHO) */}
            {showInfo && (
                <div className="w-64 border-l border-slate-100 bg-white flex flex-col p-6 animate-in slide-in-from-right-10 shrink-0">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-black text-slate-800">Info</h3><X size={20} className="cursor-pointer text-slate-400" onClick={() => setShowInfo(false)}/></div>
                    <div className="flex flex-col items-center mb-8"><Avatar className="h-20 w-20 bg-slate-900 text-white mb-4"><AvatarFallback className="text-xl font-black">{activeChatData?.avatar}</AvatarFallback></Avatar><h4 className="font-bold text-lg">{activeChatData?.name}</h4><Badge className="mt-2 bg-blue-100 text-blue-600 border-0 uppercase text-[10px]">Grupo</Badge></div>
                </div>
            )}
        </div>
    )
}