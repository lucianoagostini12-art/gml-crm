"use client"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { 
    Send, Paperclip, Search, MoreVertical, CheckCheck, 
    FileText, X, Smile, Plus, Info, VolumeX, Trash, Users, Trash2 
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

export function OpsChat({ currentUser, operations = [], onViewSale }: any) {
    const supabase = createClient()
    
    // --- ESTADOS ---
    const [msg, setMsg] = useState("")
    const [chats, setChats] = useState<any[]>([])
    const [messages, setMessages] = useState<any[]>([])
    const [activeChatId, setActiveChatId] = useState<number | null>(null)
    
    // UI States
    const [chatSearch, setChatSearch] = useState("")
    const [showMentions, setShowMentions] = useState(false)
    const [mentionQuery, setMentionQuery] = useState("")
    const [attachedSale, setAttachedSale] = useState<any>(null)
    const [showInfo, setShowInfo] = useState(false)
    
    // Crear Sala States
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newChatName, setNewChatName] = useState("")

    // REFS
    const scrollRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 1. CARGAR Y ESCUCHAR SALAS (CHATS)
    const fetchRooms = async () => {
        const { data } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: false })
        if (data) {
            setChats(data)
            // Si se borró el chat activo o no hay ninguno, resetear
            if (activeChatId && !data.find(c => c.id === activeChatId)) {
                setActiveChatId(null)
            }
        }
    }

    useEffect(() => {
        fetchRooms()
        
        // Realtime para LISTA DE CHATS (Crear/Borrar)
        const roomChannel = supabase.channel('rooms_list_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_rooms' }, () => {
                fetchRooms()
            })
            .subscribe()

        return () => { supabase.removeChannel(roomChannel) }
    }, [activeChatId])

    // 2. CARGAR MENSAJES DEL CHAT ACTIVO
    useEffect(() => {
        if (!activeChatId) {
            setMessages([])
            return
        }

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('chat_messages')
                .select('*')
                .eq('room_id', activeChatId)
                .order('created_at', { ascending: true })
                .limit(100)

            if (data) {
                const mapped = data.map((m: any) => ({
                    id: m.id,
                    chatId: m.room_id,
                    user: m.user_name || "Usuario",
                    text: m.text,
                    time: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isMe: m.user_name === currentUser,
                    type: m.type,
                    saleData: m.sale_data,
                    status: "read"
                }))
                setMessages(mapped)
            }
        }

        fetchMessages()

        const msgChannel = supabase
            .channel(`room:${activeChatId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'chat_messages',
                filter: `room_id=eq.${activeChatId}`
            }, (payload) => {
                const newMsgRaw = payload.new as any
                const newMsg = {
                    id: newMsgRaw.id,
                    chatId: newMsgRaw.room_id,
                    user: newMsgRaw.user_name,
                    text: newMsgRaw.text,
                    time: new Date(newMsgRaw.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    isMe: newMsgRaw.user_name === currentUser,
                    type: newMsgRaw.type,
                    saleData: newMsgRaw.sale_data,
                    status: "sent"
                }
                setMessages(prev => [...prev, newMsg])
            })
            .subscribe()

        return () => { supabase.removeChannel(msgChannel) }

    }, [activeChatId, currentUser])

    // SCROLL AUTOMÁTICO
    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" })
    }, [messages, activeChatId])

    // --- ACCIONES ---

    const handleCreateChat = async () => {
        if (!newChatName.trim()) return
        
        const { error } = await supabase.from('chat_rooms').insert({
            name: newChatName,
            type: 'group',
            avatar_seed: newChatName.substring(0, 2).toUpperCase()
        })

        if (!error) {
            setNewChatName("")
            setIsCreateOpen(false)
            // fetchRooms se dispara solo por el realtime
        } else {
            alert("Error al crear grupo")
        }
    }

    const handleDeleteChat = async (id: number, e: any) => {
        e.stopPropagation() // Evitar que seleccione el chat al borrar
        if (!confirm("¿Eliminar este grupo y todos sus mensajes?")) return

        await supabase.from('chat_rooms').delete().eq('id', id)
        if (activeChatId === id) setActiveChatId(null)
    }

    const handleSend = async () => {
        if ((!msg.trim() && !attachedSale) || !activeChatId) return

        const textToSend = msg
        const saleToSend = attachedSale
        
        setMsg("")
        setAttachedSale(null)

        await supabase.from('chat_messages').insert({
            room_id: activeChatId,
            user_name: currentUser,
            text: textToSend,
            type: saleToSend ? 'sale_link' : 'text',
            sale_data: saleToSend || null,
        })
    }

    // --- MENCIONES ---
    const handleInputChange = (e: any) => {
        const val = e.target.value
        setMsg(val)
        
        const lastIndexAt = val.lastIndexOf('@')
        if (lastIndexAt !== -1) {
            const query = val.substring(lastIndexAt + 1)
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
        const lastIndexAt = msg.lastIndexOf('@')
        if (lastIndexAt !== -1) {
            setMsg(msg.substring(0, lastIndexAt))
        }
    }

    const activeChatData = chats.find(c => c.id === activeChatId)
    const mentionOps = operations.filter((o:any) => o.clientName && o.clientName.toLowerCase().includes(mentionQuery.toLowerCase()))

    return (
        <div className="flex h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            <input type="file" ref={fileInputRef} className="hidden" />

            {/* SIDEBAR IZQUIERDO */}
            <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
                    <h3 className="font-black text-slate-800 text-lg">Chats</h3>
                    {/* BOTÓN CREAR GRUPO (+) */}
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => setIsCreateOpen(true)}>
                        <Plus size={20} strokeWidth={3}/>
                    </Button>
                </div>
                
                {/* LISTA DE CHATS DINÁMICA */}
                <ScrollArea className="flex-1 px-2 pt-2">
                    {chats.length === 0 && (
                        <div className="text-center p-4 text-xs text-slate-400">
                            No hay grupos.<br/>Creá uno con el botón +
                        </div>
                    )}
                    {chats.map(chat => (
                        <div 
                            key={chat.id} 
                            onClick={() => setActiveChatId(chat.id)} 
                            className={`group/item p-2 rounded-lg cursor-pointer flex items-center gap-3 mb-1 transition-all ${activeChatId === chat.id ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'hover:bg-slate-100/50'}`}
                        >
                            <Avatar className="h-10 w-10 border border-slate-200">
                                <AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-xs">{chat.avatar_seed}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold truncate">{chat.name}</span>
                                </div>
                                <p className="text-xs text-slate-400 truncate capitalize">{chat.type === 'group' ? 'Grupo' : 'Privado'}</p>
                            </div>
                            
                            {/* BOTÓN BORRAR (Solo visible al hover) */}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                onClick={(e) => handleDeleteChat(chat.id, e)}
                            >
                                <Trash2 size={14} />
                            </Button>
                        </div>
                    ))}
                </ScrollArea>
            </div>

            {/* AREA CENTRAL DE CHAT */}
            <div className="flex-1 flex flex-col bg-[#f0f2f5] relative">
                {activeChatId ? (
                    <>
                        <header className="h-16 border-b border-slate-200 bg-white flex items-center px-6 justify-between shrink-0 z-10 shadow-sm">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 bg-slate-900 text-white font-bold"><AvatarFallback>{activeChatData?.avatar_seed}</AvatarFallback></Avatar>
                                <div>
                                    <h4 className="font-bold text-slate-800">{activeChatData?.name}</h4>
                                    <p className="text-xs text-green-500 font-medium flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Activo</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowInfo(!showInfo)}><MoreVertical size={20}/></Button>
                        </header>

                        <ScrollArea className="flex-1 p-4">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50">
                                    <Smile size={48} strokeWidth={1} className="mb-2"/>
                                    <p className="text-sm">Escribí el primer mensaje...</p>
                                </div>
                            )}
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                                    <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm text-sm ${m.isMe ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 rounded-tl-none'}`}>
                                        {!m.isMe && <p className="text-[10px] font-bold text-orange-500 mb-1">{m.user}</p>}
                                        
                                        {m.type === 'sale_link' ? (
                                            <div className="bg-white/10 p-2 rounded-lg border border-white/20">
                                                <p className="font-black text-[10px] uppercase mb-1 flex items-center gap-1"><FileText size={10}/> Operación Vinculada</p>
                                                <p className="font-bold text-sm">{m.saleData?.clientName}</p>
                                                <Button size="sm" variant="secondary" className="w-full h-7 mt-2 text-[10px] font-bold" onClick={() => onViewSale(m.saleData)}>Ver Detalles</Button>
                                            </div>
                                        ) : <p>{m.text}</p>}
                                        
                                        <div className="text-[9px] text-right mt-1 opacity-70 flex items-center justify-end gap-1">
                                            {m.time} {m.isMe && <CheckCheck size={10}/>}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={scrollRef} />
                        </ScrollArea>

                        {/* MENCIONES POPUP */}
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
                        
                        {/* ATTACHMENT CHIP */}
                        {attachedSale && (
                            <div className="absolute bottom-20 left-6 right-6 bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center justify-between shadow-lg animate-in slide-in-from-bottom-2 z-50">
                                <div className="flex items-center gap-2 text-xs font-bold">
                                    <FileText size={16}/> Adjuntando: {attachedSale.clientName}
                                </div>
                                <X size={16} className="cursor-pointer hover:text-blue-200" onClick={() => setAttachedSale(null)}/>
                            </div>
                        )}

                        {/* INPUT */}
                        <div className="p-4 bg-white border-t border-slate-200 shrink-0 relative z-10">
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                                <Input 
                                    className="border-0 bg-transparent focus-visible:ring-0 shadow-none h-10 py-2.5 px-2 text-slate-700 font-medium" 
                                    placeholder="Escribí un mensaje o usa @ para ventas..." 
                                    value={msg} 
                                    onChange={handleInputChange}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <Button size="icon" className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg h-10 w-10 shadow-sm" onClick={handleSend}><Send size={18}/></Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400">
                        <Users size={64} strokeWidth={1} className="mb-4 text-slate-300"/>
                        <p className="text-lg font-bold">Seleccioná o creá un grupo</p>
                        <p className="text-sm">Para comenzar a chatear con el equipo.</p>
                    </div>
                )}
            </div>

            {/* INFO PANEL */}
            {showInfo && activeChatId && (
                <div className="w-64 border-l border-slate-100 bg-white flex flex-col p-6 animate-in slide-in-from-right-10 shrink-0">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-black text-slate-800">Info</h3><X size={20} className="cursor-pointer text-slate-400" onClick={() => setShowInfo(false)}/></div>
                    <div className="flex flex-col items-center mb-8"><Avatar className="h-20 w-20 bg-slate-900 text-white mb-4"><AvatarFallback className="text-xl font-black">{activeChatData?.avatar_seed}</AvatarFallback></Avatar><h4 className="font-bold text-lg">{activeChatData?.name}</h4></div>
                </div>
            )}

            {/* MODAL CREAR GRUPO */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Crear Nuevo Grupo</DialogTitle>
                        <DialogDescription>Crea una sala de chat para un tema específico.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-2">
                        <Label>Nombre del Grupo</Label>
                        <Input placeholder="Ej: Ventas Junio" value={newChatName} onChange={e => setNewChatName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateChat}>Crear Grupo</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}