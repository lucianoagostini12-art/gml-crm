"use client"
import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
    Send, Plus, MoreVertical, CheckCheck,
    FileText, X, Smile, Trash2, Users
} from "lucide-react"
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
    const [showMentions, setShowMentions] = useState(false)
    const [mentionQuery, setMentionQuery] = useState("")
    const [attachedSale, setAttachedSale] = useState<any>(null)
    const [showInfo, setShowInfo] = useState(false)

    // Crear Sala States
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [newChatName, setNewChatName] = useState("")

    // REFS
    const scrollRef = useRef<HTMLDivElement>(null)

    // 1. CARGAR Y ESCUCHAR SALAS (CHATS)
    const fetchRooms = async () => {
        const { data } = await supabase.from('chat_rooms').select('*').order('created_at', { ascending: false })
        if (data) {
            setChats(data)
            if (activeChatId && !data.find(c => c.id === activeChatId)) {
                setActiveChatId(null)
            }
        }
    }

    useEffect(() => {
        fetchRooms()
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
                    time: new Date(m.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
                    isMe: m.user_name === currentUser,
                    type: m.type,
                    saleData: m.sale_data,
                    status: "read"
                }))
                setMessages(mapped)
            }
        }

        fetchMessages()

        // SUSCRIPCIÓN REALTIME (Escuchar mensajes de OTROS)
        const msgChannel = supabase
            .channel(`chat_room:${activeChatId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages',
                filter: `room_id=eq.${activeChatId}`
            }, (payload) => {
                const newMsgRaw = payload.new as any
                // Evitamos procesar el mensaje si ya lo tenemos (porque lo insertamos nosotros manualmente)
                setMessages(prev => {
                    if (prev.some(m => m.id === newMsgRaw.id)) return prev

                    const newMsg = {
                        id: newMsgRaw.id,
                        chatId: newMsgRaw.room_id,
                        user: newMsgRaw.user_name,
                        text: newMsgRaw.text,
                        time: new Date(newMsgRaw.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
                        isMe: newMsgRaw.user_name === currentUser,
                        type: newMsgRaw.type,
                        saleData: newMsgRaw.sale_data,
                        status: "sent"
                    }
                    return [...prev, newMsg]
                })
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
        } else {
            alert("Error al crear grupo")
        }
    }

    const handleDeleteChat = async (id: number, e: any) => {
        e.stopPropagation()
        if (!confirm("¿Eliminar este grupo y todos sus mensajes?")) return

        await supabase.from('chat_rooms').delete().eq('id', id)
        if (activeChatId === id) setActiveChatId(null)
    }

    // ✅ ENVÍO DE MENSAJE (CORREGIDO PARA ACTUALIZACIÓN INSTANTÁNEA)
    const handleSend = async () => {
        if ((!msg.trim() && !attachedSale) || !activeChatId) return

        const textToSend = msg
        const saleToSend = attachedSale

        setMsg("")
        setAttachedSale(null)

        // 1. INSERTAMOS Y PEDIMOS EL DATO DE VUELTA (.select().single())
        const { data, error } = await supabase.from('chat_messages').insert({
            room_id: activeChatId,
            user_name: currentUser,
            text: textToSend,
            type: saleToSend ? 'sale_link' : 'text',
            sale_data: saleToSend || null,
        }).select().single()

        if (error) {
            console.error("Error enviando mensaje:", error)
            return
        }

        // 2. ✅ ACTUALIZAMOS EL ESTADO LOCAL MANUALMENTE (Para no esperar el Realtime)
        if (data) {
            const myNewMsg = {
                id: data.id,
                chatId: data.room_id,
                user: data.user_name,
                text: data.text,
                time: new Date(data.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }),
                isMe: true, // Es mío
                type: data.type,
                saleData: data.sale_data,
                status: "sent"
            }

            setMessages(prev => {
                // Doble chequeo por si el Realtime fue más rápido que el .select()
                if (prev.some(m => m.id === myNewMsg.id)) return prev
                return [...prev, myNewMsg]
            })
        }

        // 3. Notificaciones a otros (Menciones)
        if (textToSend.includes("@")) {
            const mentionedUser = textToSend.split("@")[1]?.split(" ")[0];
            if (mentionedUser && mentionedUser !== currentUser) {
                await supabase.from('notifications').insert({
                    user_name: mentionedUser,
                    title: `💬 Mención en Chat`,
                    body: `${currentUser} te mencionó: "${textToSend.substring(0, 30)}..."`,
                    type: 'info',
                    read: false
                })
            }
        }
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
    const mentionOps = operations.filter((o: any) => o.clientName && o.clientName.toLowerCase().includes(mentionQuery.toLowerCase()))

    return (
        <div className="flex h-[calc(100vh-10rem)] w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">

            {/* SIDEBAR IZQUIERDO */}
            <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
                <div className="p-4 flex justify-between items-center bg-white border-b border-slate-100 shrink-0">
                    <h3 className="font-black text-slate-800 text-lg">Chats</h3>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50" onClick={() => setIsCreateOpen(true)}>
                        <Plus size={20} strokeWidth={3} />
                    </Button>
                </div>

                <ScrollArea className="flex-1 px-2 pt-2">
                    {chats.length === 0 && (
                        <div className="text-center p-4 text-xs text-slate-400">
                            No hay grupos.<br />Creá uno con el botón +
                        </div>
                    )}
                    {chats.map(chat => (
                        <div
                            key={chat.id}
                            onClick={() => setActiveChatId(chat.id)}
                            className={`group/item p-3 rounded-lg cursor-pointer flex items-center gap-3 mb-1 transition-all ${activeChatId === chat.id ? 'bg-white shadow-md ring-1 ring-slate-200 z-10' : 'hover:bg-slate-200/50'}`}
                        >
                            <Avatar className="h-10 w-10 border border-slate-200">
                                <AvatarFallback className="bg-slate-200 text-slate-600 font-bold text-xs">{chat.avatar_seed}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 overflow-hidden">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold truncate text-slate-700">{chat.name}</span>
                                </div>
                                <p className="text-[10px] text-slate-400 truncate capitalize font-medium">{chat.type === 'group' ? 'Grupo General' : 'Privado'}</p>
                            </div>

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
                                    <p className="text-xs text-green-500 font-medium flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> En línea</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setShowInfo(!showInfo)}><MoreVertical size={20} /></Button>
                        </header>

                        <ScrollArea className="flex-1 p-6">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 min-h-[300px]">
                                    <Smile size={48} strokeWidth={1} className="mb-2" />
                                    <p className="text-sm font-medium">Escribí el primer mensaje...</p>
                                </div>
                            )}
                            {messages.map((m) => (
                                <div key={m.id} className={`flex ${m.isMe ? 'justify-end' : 'justify-start'} mb-3`}>
                                    <div className={`max-w-[70%] px-4 py-3 rounded-2xl shadow-sm text-sm ${m.isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-slate-700 rounded-bl-none'}`}>
                                        {!m.isMe && <p className="text-[10px] font-black text-orange-500 mb-1 uppercase tracking-wider">{m.user}</p>}

                                        {m.type === 'sale_link' ? (
                                            <div className="bg-white/10 p-3 rounded-lg border border-white/20 mt-1">
                                                <p className="font-black text-[10px] uppercase mb-2 flex items-center gap-1 opacity-80"><FileText size={10} /> Operación Vinculada</p>
                                                <p className="font-bold text-sm mb-2">{m.saleData?.clientName}</p>
                                                <Button size="sm" variant="secondary" className="w-full h-7 text-[10px] font-bold bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => onViewSale(m.saleData)}>Ver Detalles</Button>
                                            </div>
                                        ) : <p className="leading-relaxed">{m.text}</p>}

                                        <div className={`text-[9px] text-right mt-1 flex items-center justify-end gap-1 ${m.isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                            {m.time} {m.isMe && <CheckCheck size={12} />}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={scrollRef} />
                        </ScrollArea>

                        {/* MENCIONES POPUP */}
                        {showMentions && (
                            <div className="absolute bottom-24 left-4 w-80 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden z-[100] animate-in zoom-in-95 duration-150">
                                <div className="bg-slate-50 px-3 py-2 border-b text-[10px] font-bold text-slate-500 uppercase">Mencionar Venta</div>
                                <ScrollArea className="max-h-60">
                                    {mentionOps.length > 0 ? mentionOps.map((op: any) => (
                                        <div key={op.id} onClick={() => handleSelectSale(op)} className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center gap-3 border-b last:border-0 transition-colors">
                                            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">{op.clientName?.charAt(0)}</div>
                                            <div className="overflow-hidden">
                                                <p className="text-xs font-bold text-slate-800 truncate">{op.clientName}</p>
                                                <p className="text-[10px] text-slate-400 font-mono">{op.dni}</p>
                                            </div>
                                        </div>
                                    )) : <div className="p-4 text-center text-xs text-slate-400">Sin coincidencias...</div>}
                                </ScrollArea>
                            </div>
                        )}

                        {/* ATTACHMENT CHIP */}
                        {attachedSale && (
                            <div className="absolute bottom-24 left-6 right-6 bg-blue-600 text-white px-4 py-3 rounded-xl flex items-center justify-between shadow-xl animate-in slide-in-from-bottom-4 z-50">
                                <div className="flex items-center gap-3 text-xs font-bold">
                                    <div className="bg-white/20 p-1.5 rounded-lg"><FileText size={16} /></div>
                                    <span>Adjuntando: {attachedSale.clientName}</span>
                                </div>
                                <X size={18} className="cursor-pointer hover:text-blue-200" onClick={() => setAttachedSale(null)} />
                            </div>
                        )}

                        {/* INPUT */}
                        <div className="p-4 bg-white border-t border-slate-200 shrink-0 relative z-10">
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all shadow-sm">
                                <Input
                                    className="border-0 bg-transparent focus-visible:ring-0 shadow-none h-11 py-2.5 px-4 text-slate-700 font-medium placeholder:text-slate-400"
                                    placeholder="Escribí un mensaje o usa @ para citar una venta..."
                                    value={msg}
                                    onChange={handleInputChange}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                />
                                <Button size="icon" className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11 w-11 shadow-sm shrink-0 transition-all active:scale-95" onClick={handleSend}><Send size={20} /></Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                        <div className="bg-slate-200 p-6 rounded-full mb-6 animate-in zoom-in duration-300"><Users size={48} strokeWidth={1.5} className="text-slate-400" /></div>
                        <h3 className="text-xl font-black text-slate-700 mb-2">¡Hola {currentUser}!</h3>
                        <p className="text-sm max-w-xs">Seleccioná un grupo de la izquierda o creá uno nuevo para comenzar a chatear con el equipo.</p>
                    </div>
                )}
            </div>

            {/* INFO PANEL */}
            {showInfo && activeChatId && (
                <div className="w-72 border-l border-slate-100 bg-white flex flex-col p-6 animate-in slide-in-from-right-10 shrink-0 shadow-xl z-20">
                    <div className="flex justify-between items-center mb-10"><h3 className="font-black text-slate-800">Info del Grupo</h3><X size={20} className="cursor-pointer text-slate-400 hover:text-slate-600" onClick={() => setShowInfo(false)} /></div>
                    <div className="flex flex-col items-center mb-8">
                        <Avatar className="h-24 w-24 bg-slate-900 text-white mb-4 border-4 border-slate-50 shadow-lg"><AvatarFallback className="text-3xl font-black">{activeChatData?.avatar_seed}</AvatarFallback></Avatar>
                        <h4 className="font-bold text-xl text-slate-800 text-center leading-tight">{activeChatData?.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 uppercase font-bold tracking-widest">Grupo Activo</p>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-100">
                        <Button variant="outline" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 border-red-100" onClick={(e) => handleDeleteChat(activeChatId, e)}>
                            <Trash2 size={16} className="mr-2" /> Eliminar Grupo
                        </Button>
                    </div>
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