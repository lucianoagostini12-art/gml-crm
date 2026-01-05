"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Linkedin, Facebook, Plus, Search, ChevronLeft, ChevronRight, CalendarDays, RefreshCw, Loader2, Globe, Megaphone } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export function SetterDashboard() {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    
    // UI STATES
    const [currentDate, setCurrentDate] = useState(today)
    const [viewMonth, setViewMonth] = useState(new Date())
    const [isCalendarExpanded, setIsCalendarExpanded] = useState(false) 
    const [searchQuery, setSearchQuery] = useState("") 

    // DATA STATES
    const [items, setItems] = useState<any[]>([]) 
    const [loading, setLoading] = useState(true)
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [draggedItem, setDraggedItem] = useState<any>(null)
    const [userId, setUserId] = useState<string | null>(null)
    
    // CONFIG STATES (Desde Supabase)
    const [origins, setOrigins] = useState<string[]>([]) 
    
    // MODALS & FORMS
    const [newNoteText, setNewNoteText] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    
    const [createData, setCreateData] = useState({ title: "", source: "Linkedin", note: "", phone: "" })
    const [manualDate, setManualDate] = useState(currentDate)
    const [manualTime, setManualTime] = useState("10:00")
    const [discardReason, setDiscardReason] = useState("")

    // --- 1. CARGA INICIAL DE DATOS Y CONFIGURACIÓN ---
    useEffect(() => {
        const getUser = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (user) setUserId(user.id)
        }
        getUser()
        fetchConfig()
        fetchItems()

        // Escuchar cambios en leads Y en mensajes para actualizar el chat en tiempo real
        const channel = supabase.channel('setter_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchItems())
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_messages' }, () => fetchItems())
            .subscribe()
            
        return () => { supabase.removeChannel(channel) }
    }, [])

    const fetchConfig = async () => {
        const { data } = await supabase.from('system_config').select('*').eq('key', 'sales_origins').single()
        if (data) setOrigins(data.value || ["Linkedin", "Facebook", "Instagram", "Llamador"])
    }

    const fetchItems = async () => {
        setLoading(true)
        
        // 1. Traemos los leads
        const { data: leadsData, error } = await supabase
            .from('leads')
            .select(`
                *,
                lead_messages (
                    created_at,
                    content,
                    sender_role
                )
            `)
            .not('status', 'in', '("vendido","perdido")') // Filtramos vendidos/perdidos
            .order('created_at', { ascending: false })
        
        if (leadsData) {
            const mappedItems = leadsData.map((i: any) => {
                // Mapeamos los mensajes de la tabla lead_messages al formato string que usa tu UI
                // Ordenamos por fecha para que el chat tenga sentido
                const messages = i.lead_messages || []
                const sortedMessages = messages.sort((a:any, b:any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                const notesString = sortedMessages.map((m:any) => `[${new Date(m.created_at).toLocaleDateString()} ${m.sender_role || 'Sist'}]: ${m.content}`).join('\n')

                return {
                    id: i.id,
                    name: i.name,
                    source: i.source,
                    phone: i.phone,
                    notes: notesString, 
                    scheduled_for: i.scheduled_for,
                    status: i.status
                }
            })
            setItems(mappedItems)
            
            // Si hay un item seleccionado, lo refrescamos para ver los chats nuevos al instante
            if (selectedItem) {
                const updatedSelected = mappedItems.find(item => item.id === selectedItem.id)
                if (updatedSelected) setSelectedItem(updatedSelected)
            }
        }
        setLoading(false)
    }

    // --- HELPER PARA MÉTRICAS (CRUCIAL PARA ADMIN) ---
    const logHistory = async (leadId: string, newStatus: string) => {
        if (!userId) return
        await supabase.from('lead_status_history').insert({
            lead_id: leadId,
            status: newStatus,
            changed_by: userId,
            created_at: new Date().toISOString()
        })
    }

    // --- FILTROS COMPUTADOS ---
    const inboxItems = useMemo(() => items.filter(i => 
        !i.scheduled_for && 
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
    ), [items, searchQuery])

    const agendaItems = useMemo(() => items.filter(i => {
        if (!i.scheduled_for) return false
        return i.scheduled_for.startsWith(currentDate)
    }).sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime()), [items, currentDate])

    // --- ACCIONES DB ---
    const handleCreate = async () => {
        if (!createData.title) return
        
        // 1. Crear el Lead
        const { data: newLead, error } = await supabase.from('leads').insert({
            name: createData.title,
            source: createData.source,
            phone: createData.phone,
            status: 'nuevo',
            type: 'prospecto',
            last_update: new Date().toISOString()
        }).select().single()

        if (!error && newLead) {
            // 2. Si hay nota inicial, agregarla a lead_messages
            if (createData.note) {
                await supabase.from('lead_messages').insert({
                    lead_id: newLead.id,
                    content: createData.note,
                    sender_role: 'setter',
                    created_at: new Date().toISOString()
                })
            }
            // 3. Registrar en Historial (Para Métricas de Ingreso)
            await logHistory(newLead.id, 'nuevo')

            setIsCreateOpen(false)
            setCreateData({ title: "", source: "Linkedin", note: "", phone: "" })
            fetchItems() // Refrescar manual por seguridad
        }
    }

    const handleReschedule = async (dateStr: string, timeStr: string) => {
        const idToUpdate = selectedItem?.id || draggedItem?.id
        if (!idToUpdate) return
        const isoDateTime = `${dateStr}T${timeStr}:00`

        // Actualizar Lead
        const { error } = await supabase.from('leads').update({
            scheduled_for: isoDateTime,
            status: 'contactado', // El setter "Contacta" y agenda
            last_update: new Date().toISOString()
        }).eq('id', idToUpdate)

        if (!error) {
            // Métricas: Contar como 'contactado'
            await logHistory(idToUpdate, 'contactado')
            
            setIsScheduleOpen(false)
            setDraggedItem(null)
            fetchItems()
        }
    }

    const handleDiscard = async () => {
        if (!selectedItem) return
        
        // 1. Agregar el motivo como mensaje final
        await supabase.from('lead_messages').insert({
            lead_id: selectedItem.id,
            content: `[DESCARTADO]: ${discardReason}`,
            sender_role: 'setter',
            created_at: new Date().toISOString()
        })

        // 2. Actualizar estado a perdido
        const { error } = await supabase.from('leads').update({
            status: 'perdido',
            last_update: new Date().toISOString()
        }).eq('id', selectedItem.id)

        if (!error) {
            // Métricas: Contar como 'perdido'
            await logHistory(selectedItem.id, 'perdido')

            setSelectedItem(null)
            setIsDiscardOpen(false)
            fetchItems()
        }
    }

    const addNote = async () => {
        if (!selectedItem || !newNoteText.trim()) return
        
        // Insertar en la tabla real de mensajes
        const { error } = await supabase.from('lead_messages').insert({
            lead_id: selectedItem.id,
            content: newNoteText,
            sender_role: 'setter', // O 'system' si prefieres
            created_at: new Date().toISOString()
        })

        if (!error) {
            // Feedback inmediato (simulado hasta que el realtime dispare)
            setSelectedItem((prev: any) => ({
                ...prev,
                notes: (prev.notes || '') + `\n[${new Date().toLocaleDateString()} Setter]: ${newNoteText}`
            }))
            setNewNoteText("")
            // FetchItems se disparará solo por el realtime subscription
        }
    }

    // --- UTILS (Visuales sin cambios) ---
    const getSourceIcon = (src: string) => {
        const s = src?.toLowerCase() || ""
        if (s.includes('linkedin')) return <Linkedin className="h-4 w-4 text-blue-700" />
        if (s.includes('facebook') || s.includes('meta')) return <Facebook className="h-4 w-4 text-blue-600" />
        if (s.includes('instagram')) return <Megaphone className="h-4 w-4 text-pink-600" />
        if (s.includes('web') || s.includes('google')) return <Globe className="h-4 w-4 text-green-600" />
        return <Phone className="h-4 w-4 text-orange-600" />
    }

    const calendarWeeks = useMemo(() => {
        const year = viewMonth.getFullYear(); const month = viewMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); 
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const weeks = []; let week = [];
        for (let i = 0; i < firstDay; i++) week.push(null);
        for (let day = 1; day <= daysInMonth; day++) {
            week.push(new Date(year, month, day));
            if (week.length === 7) { weeks.push(week); week = []; }
        }
        if (week.length > 0) { while (week.length < 7) week.push(null); weeks.push(week); }
        return weeks;
    }, [viewMonth]);

    if (loading && items.length === 0) return <div className="h-screen flex items-center justify-center bg-slate-100"><Loader2 className="animate-spin h-10 w-10 text-slate-400"/></div>

    return (
        <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden text-slate-900 relative">
            <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white font-black text-xs px-2 py-1 rounded">GML</div>
                    <h1 className="text-lg font-bold text-slate-800">SETTER MODE</h1>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400"/>}
                </div>
                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 border border-green-300">
                    <div className="w-2.5 h-2.5 bg-green-600 rounded-full animate-pulse"></div>
                    <span className="text-[11px] font-black text-green-800">SISTEMA VIVO</span>
                </div>
            </header>

            <div className="flex-1 grid grid-cols-12 overflow-hidden">
                {/* BANDEJA DE ENTRADA (LEADS SIN AGENDAR) */}
                <div className="col-span-3 bg-white border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b bg-white">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-tighter">Bandeja de Entrada ({inboxItems.length})</h3>
                            <Button size="icon" variant="ghost" onClick={() => setIsCreateOpen(true)} className="h-7 w-7"><Plus className="h-4 w-4"/></Button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400"/>
                            <Input className="pl-8 h-8 text-xs bg-slate-50" placeholder="Buscar por nombre..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-3 bg-slate-50/50">
                        <div className="space-y-2">
                            {inboxItems.map(item => (
                                <div key={item.id} draggable onDragStart={() => setDraggedItem(item)} onClick={() => setSelectedItem(item)} 
                                    className={`bg-white p-3 rounded-lg border shadow-sm cursor-grab transition-all ${selectedItem?.id === item.id ? 'ring-2 ring-slate-800 border-slate-800' : 'border-slate-200 hover:border-slate-300'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-800 text-sm truncate">{item.name}</span>
                                        {getSourceIcon(item.source)}
                                    </div>
                                    <p className="text-[10px] text-slate-400 truncate mt-1">{item.phone}</p>
                                </div>
                            ))}
                            {inboxItems.length === 0 && <p className="text-center text-xs text-slate-400 mt-10">No hay leads pendientes.</p>}
                        </div>
                    </ScrollArea>
                </div>

                {/* AGENDA CENTRAL */}
                <div className="col-span-5 flex flex-col bg-slate-50 border-r relative">
                    <div className="h-14 border-b bg-white flex items-center justify-between px-4 z-20">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}><CalendarDays className="h-5 w-5 text-slate-600"/></Button>
                            <h2 className="text-sm font-black text-slate-800 capitalize">
                                {new Date(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long'})}
                            </h2>
                        </div>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setCurrentDate(today)}>Hoy</Button>
                    </div>

                    {isCalendarExpanded && (
                        <div className="absolute top-14 left-0 w-full bg-white border-b shadow-xl p-4 z-50 animate-in slide-in-from-top-5">
                             <div className="flex justify-between items-center mb-4">
                                <Button variant="ghost" size="sm" onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()-1)))}><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="font-bold text-sm uppercase">{viewMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
                                <Button variant="ghost" size="sm" onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()+1)))}><ChevronRight className="h-4 w-4"/></Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {['D','L','M','M','J','V','S'].map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-400">{d}</div>)}
                                {calendarWeeks.flat().map((d, i) => d ? (
                                    <div key={i} onClick={() => {setCurrentDate(d.toISOString().split('T')[0]); setIsCalendarExpanded(false)}} 
                                        className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors ${d.toISOString().split('T')[0] === currentDate ? 'bg-slate-900 text-white font-bold' : 'hover:bg-slate-100 text-slate-600'}`}>
                                        {d.getDate()}
                                    </div>
                                ) : <div key={i}></div>)}
                            </div>
                        </div>
                    )}

                    <ScrollArea className="flex-1">
                        <div className="relative min-h-[800px] bg-white">
                            {Array.from({length: 13}, (_, i) => i + 8).map(hour => {
                                const hourItems = agendaItems.filter(i => new Date(i.scheduled_for).getHours() === hour)
                                const isDragTarget = draggedItem !== null
                                return (
                                    <div key={hour} 
                                        className={`flex min-h-[90px] border-b group transition-colors ${isDragTarget ? 'hover:bg-blue-50/50' : ''}`}
                                        onDrop={(e) => {e.preventDefault(); handleReschedule(currentDate, `${String(hour).padStart(2,'0')}:00`)}} 
                                        onDragOver={(e)=>e.preventDefault()}
                                    >
                                        <div className="w-14 border-r flex justify-center pt-3 text-[10px] font-bold text-slate-400 bg-slate-50/30">{hour}:00</div>
                                        <div className="flex-1 p-2 space-y-1">
                                            {hourItems.map(item => (
                                                <div key={item.id} onClick={() => setSelectedItem(item)} className="p-2 rounded-lg border bg-blue-50/50 border-blue-100 shadow-sm cursor-pointer hover:ring-1 ring-blue-400">
                                                    <div className="flex justify-between">
                                                        <p className="text-xs font-bold text-blue-900 truncate">{item.name}</p>
                                                        <span className="text-[10px] text-blue-400 font-mono">{new Date(item.scheduled_for).getMinutes() === 0 ? "00" : new Date(item.scheduled_for).getMinutes()} min</span>
                                                    </div>
                                                    <p className="text-[10px] text-blue-600 truncate mt-0.5">{item.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ScrollArea>
                </div>

                {/* MESA DE TRABAJO (DETALLE) */}
                <div className="col-span-4 bg-white flex flex-col border-l">
                    {selectedItem ? (
                        <>
                            <div className="p-6 border-b bg-slate-50/50">
                                <Badge className="mb-2 uppercase text-[10px] bg-white border-slate-200 text-slate-600 hover:bg-white">{selectedItem.source}</Badge>
                                <h2 className="text-2xl font-black text-slate-800 leading-tight">{selectedItem.name}</h2>
                                <p className="text-sm text-slate-500 font-mono mt-1">{selectedItem.phone}</p>
                                <div className="grid grid-cols-2 gap-3 mt-5">
                                    <Button className="bg-slate-900 text-white font-bold h-10 shadow-lg hover:bg-slate-800" onClick={() => window.open(`tel:${selectedItem.phone}`)}>
                                        <Phone className="mr-2 h-4 w-4"/> LLAMAR
                                    </Button>
                                    <Button variant="outline" className="font-bold h-10 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800" onClick={() => window.open(`https://wa.me/${selectedItem.phone.replace(/[^0-9]/g, '')}`, '_blank')}>
                                        WHATSAPP
                                    </Button>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-6">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
                                    <Textarea value={newNoteText} onChange={(e)=>setNewNoteText(e.target.value)} placeholder="Escribir avance o resultado..." className="min-h-[80px] border-0 resize-none text-sm focus-visible:ring-0 p-0"/>
                                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                                        <Button size="sm" className="bg-blue-600 text-white text-xs h-8 px-4 font-bold" onClick={addNote}>GUARDAR</Button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Historial</h4>
                                    <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed font-mono bg-slate-50 p-4 rounded-lg border border-slate-100">
                                        {selectedItem.notes || "Sin registros previos."}
                                    </div>
                                </div>
                            </ScrollArea>
                            <div className="p-4 border-t grid grid-cols-2 gap-3 bg-white">
                                <Button onClick={() => setIsScheduleOpen(true)} variant="outline" className="col-span-2 font-bold h-11 border-slate-300 hover:bg-slate-50">
                                    <CalendarDays className="mr-2 h-4 w-4"/> REPROGRAMAR CITA
                                </Button>
                                <Button onClick={() => setIsDiscardOpen(true)} variant="ghost" className="col-span-2 text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs h-9">
                                    DESCARTAR PROSPECTO
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Search className="h-8 w-8 text-slate-300"/>
                            </div>
                            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Seleccioná un lead para trabajar</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CREAR */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Prospecto</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <Input placeholder="Nombre Completo" value={createData.title} onChange={(e)=>setCreateData({...createData, title:e.target.value})}/>
                        <Input placeholder="Teléfono" value={createData.phone} onChange={(e)=>setCreateData({...createData, phone:e.target.value})}/>
                        <Select value={createData.source} onValueChange={(v)=>setCreateData({...createData, source:v})}>
                            <SelectTrigger><SelectValue placeholder="Origen"/></SelectTrigger>
                            <SelectContent>
                                {origins.length > 0 ? origins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>) : <SelectItem value="Linkedin">Linkedin</SelectItem>}
                            </SelectContent>
                        </Select>
                        <Textarea placeholder="Comentario inicial..." value={createData.note} onChange={(e)=>setCreateData({...createData, note:e.target.value})}/>
                    </div>
                    <Button onClick={handleCreate} className="w-full bg-slate-900 text-white mt-2">CREAR LEAD</Button>
                </DialogContent>
            </Dialog>

            {/* MODAL AGENDAR */}
             <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Agendar Seguimiento</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Fecha</label>
                            <input type="date" className="w-full h-10 border rounded px-2 text-sm" value={manualDate} onChange={(e)=>setManualDate(e.target.value)}/>
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500">Hora</label>
                            <input type="time" className="w-full h-10 border rounded px-2 text-sm" value={manualTime} onChange={(e)=>setManualTime(e.target.value)}/>
                        </div>
                    </div>
                    <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold" onClick={() => handleReschedule(manualDate, manualTime)}>CONFIRMAR CITA</Button>
                </DialogContent>
            </Dialog>

            {/* MODAL DESCARTAR */}
            <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle className="text-red-600">Descartar Lead</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Select onValueChange={setDiscardReason}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="No le interesa">No le interesa</SelectItem>
                                <SelectItem value="Número erróneo">Número erróneo</SelectItem>
                                <SelectItem value="Ya tiene cobertura">Ya tiene cobertura</SelectItem>
                                <SelectItem value="Fuera de zona">Fuera de zona</SelectItem>
                                <SelectItem value="Precio alto">Precio alto</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleDiscard} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold">CONFIRMAR BAJA DEFINITIVA</Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}