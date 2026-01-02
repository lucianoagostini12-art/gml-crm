"use client"

import { useState, useEffect, useMemo } from "react"
// IMPORTANTE: Ruta de importación corregida
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Phone, Linkedin, Facebook, MessageCircle, Plus, Search, ChevronLeft, ChevronRight, LogOut, GripVertical, CalendarDays, Archive, RefreshCw, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"

const supabase = createClient()

export function SetterDashboard() {
    const today = new Date().toISOString().split('T')[0]
    
    // ESTADOS UI
    const [currentDate, setCurrentDate] = useState(today)
    const [viewMonth, setViewMonth] = useState(new Date())
    const [currentTimeLine, setCurrentTimeLine] = useState("")
    const [isCalendarExpanded, setIsCalendarExpanded] = useState(false) 
    const [searchQuery, setSearchQuery] = useState("") 

    // ESTADOS DATOS REALES
    const [items, setItems] = useState<any[]>([]) 
    const [loading, setLoading] = useState(true)
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [draggedItem, setDraggedItem] = useState<any>(null)
    
    // INPUTS Y MODALES
    const [newNoteText, setNewNoteText] = useState("")
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    
    const [createData, setCreateData] = useState({ title: "", source: "linkedin", note: "", phone: "" })
    const [manualDate, setManualDate] = useState(currentDate)
    const [manualTime, setManualTime] = useState("10:00")
    const [discardReason, setDiscardReason] = useState("")

    // --- CARGA DE DATOS REALES ---
    const fetchItems = async () => {
        setLoading(true)
        // Traemos leads que no estén cerrados (vendidos/perdidos)
        const { data } = await supabase
            .from('leads')
            .select('*')
            .not('status', 'in', '("vendido","perdido")')
            .order('created_at', { ascending: false })
        
        if (data) setItems(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchItems()
        const channel = supabase.channel('setter_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchItems())
            .subscribe()
            
        const t = setInterval(() => {
            setCurrentTimeLine(new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))
        }, 60000)
        
        return () => {
            clearInterval(t)
            supabase.removeChannel(channel)
        }
    }, [])

    // --- FILTROS COMPUTADOS ---
    const inboxItems = items.filter(i => 
        !i.scheduled_for && 
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const agendaItems = items.filter(i => {
        if (!i.scheduled_for) return false
        return i.scheduled_for.startsWith(currentDate)
    }).sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())

    // --- ACCIONES DB ---
    const handleCreate = async () => {
        if (!createData.title) return
        const { error } = await supabase.from('leads').insert({
            name: createData.title,
            source: createData.source,
            phone: createData.phone,
            notes: createData.note ? `[NOTA INICIAL]: ${createData.note}` : '',
            status: 'nuevo',
            last_update: new Date().toISOString()
        })
        if (!error) {
            setIsCreateOpen(false)
            setCreateData({ title: "", source: "linkedin", note: "", phone: "" })
        }
    }

    const handleReschedule = async (dateStr: string, timeStr: string) => {
        const idToUpdate = selectedItem?.id || draggedItem?.id
        if (!idToUpdate) return
        const isoDateTime = `${dateStr}T${timeStr}:00`

        await supabase.from('leads').update({
            scheduled_for: isoDateTime,
            last_update: new Date().toISOString()
        }).eq('id', idToUpdate)

        setIsScheduleOpen(false)
        setDraggedItem(null)
    }

    const handleDiscard = async () => {
        if (!selectedItem) return
        await supabase.from('leads').update({
            status: 'perdido',
            notes: (selectedItem.notes || '') + `\n[DESCARTADO]: ${discardReason}`,
            last_update: new Date().toISOString()
        }).eq('id', selectedItem.id)
        setSelectedItem(null)
        setIsDiscardOpen(false)
    }

    const addNote = async () => {
        if (!selectedItem || !newNoteText.trim()) return
        const newNoteString = (selectedItem.notes || "") + `\n[${new Date().toLocaleDateString()}]: ${newNoteText}`
        await supabase.from('leads').update({
            notes: newNoteString,
            last_update: new Date().toISOString()
        }).eq('id', selectedItem.id)
        setNewNoteText("")
    }

    // --- UTILS ---
    const getSourceIcon = (src: string) => {
        switch(src?.toLowerCase()) {
            case 'linkedin': return <Linkedin className="h-4 w-4 text-blue-700" />
            case 'facebook': return <Facebook className="h-4 w-4 text-indigo-600" />
            default: return <Phone className="h-4 w-4 text-orange-600" />
        }
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
                {/* BANDEJA */}
                <div className="col-span-3 bg-white border-r border-slate-200 flex flex-col">
                    <div className="p-4 border-b bg-white">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-black uppercase text-slate-500 tracking-tighter">Bandeja de Entrada ({inboxItems.length})</h3>
                            <Button size="icon" variant="ghost" onClick={() => setIsCreateOpen(true)} className="h-7 w-7"><Plus className="h-4 w-4"/></Button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400"/>
                            <Input className="pl-8 h-8 text-xs bg-slate-50" placeholder="Buscar..." value={searchQuery} onChange={(e)=>setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-3 bg-slate-50/50">
                        <div className="space-y-2">
                            {inboxItems.map(item => (
                                <div key={item.id} draggable onDragStart={() => setDraggedItem(item)} onClick={() => setSelectedItem(item)} 
                                    className={`bg-white p-3 rounded-lg border shadow-sm cursor-grab transition-all ${selectedItem?.id === item.id ? 'ring-2 ring-slate-800' : 'border-slate-200'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-800 text-sm truncate">{item.name}</span>
                                        {getSourceIcon(item.source)}
                                    </div>
                                    <p className="text-[11px] text-slate-500 truncate">{item.notes?.split('\n')[0] || "Sin historial"}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* AGENDA */}
                <div className="col-span-5 flex flex-col bg-slate-50 border-r relative">
                    <div className="h-14 border-b bg-white flex items-center justify-between px-4 z-20">
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="icon" onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}><CalendarDays className="h-5 w-5 text-slate-600"/></Button>
                            <h2 className="text-sm font-black text-slate-800 capitalize">
                                {new Date(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric', month:'long'})}
                            </h2>
                        </div>
                    </div>

                    {isCalendarExpanded && (
                        <div className="absolute top-14 left-0 w-full bg-white border-b shadow-xl p-4 z-50">
                             <div className="flex justify-between items-center mb-4">
                                <Button variant="ghost" size="sm" onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()-1)))}><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="font-bold text-sm uppercase">{viewMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
                                <Button variant="ghost" size="sm" onClick={() => setViewMonth(new Date(viewMonth.setMonth(viewMonth.getMonth()+1)))}><ChevronRight className="h-4 w-4"/></Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {calendarWeeks.flat().map((d, i) => d && (
                                    <div key={i} onClick={() => {setCurrentDate(d.toISOString().split('T')[0]); setIsCalendarExpanded(false)}} 
                                        className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center text-xs cursor-pointer ${d.toISOString().split('T')[0] === currentDate ? 'bg-slate-800 text-white' : 'hover:bg-slate-100'}`}>
                                        {d.getDate()}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <ScrollArea className="flex-1">
                        <div className="relative min-h-[800px]">
                            {Array.from({length: 13}, (_, i) => i + 8).map(hour => {
                                const hourItems = agendaItems.filter(i => new Date(i.scheduled_for).getHours() === hour)
                                return (
                                    <div key={hour} className="flex min-h-[90px] border-b group" onDrop={(e) => {e.preventDefault(); handleReschedule(currentDate, `${hour}:00`)}} onDragOver={(e)=>e.preventDefault()}>
                                        <div className="w-14 border-r flex justify-center pt-3 text-[10px] font-bold text-slate-400">{hour}:00</div>
                                        <div className="flex-1 p-2 space-y-1">
                                            {hourItems.map(item => (
                                                <div key={item.id} onClick={() => setSelectedItem(item)} className="p-2 rounded-lg border bg-white shadow-sm cursor-pointer hover:ring-1 ring-slate-400">
                                                    <p className="text-xs font-bold truncate">{item.name}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ScrollArea>
                </div>

                {/* MESA DE TRABAJO */}
                <div className="col-span-4 bg-white flex flex-col border-l">
                    {selectedItem ? (
                        <>
                            <div className="p-6 border-b">
                                <Badge className="mb-2 uppercase text-[10px]">{selectedItem.source}</Badge>
                                <h2 className="text-2xl font-black text-slate-800">{selectedItem.name}</h2>
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <Button className="bg-slate-900 text-white font-bold" onClick={() => window.open(`tel:${selectedItem.phone}`)}>LLAMAR</Button>
                                    <Button variant="outline" className="font-bold" onClick={() => window.open(`https://wa.me/${selectedItem.phone}`)}>WHATSAPP</Button>
                                </div>
                            </div>
                            <ScrollArea className="flex-1 p-6 bg-slate-50/30">
                                <div className="bg-white p-3 rounded-xl border shadow-sm mb-4">
                                    <Textarea value={newNoteText} onChange={(e)=>setNewNoteText(e.target.value)} placeholder="Escribir avance..." className="min-h-[80px] border-0 resize-none text-sm"/>
                                    <Button size="sm" className="w-full mt-2 bg-slate-800 text-white text-xs h-8" onClick={addNote}>GUARDAR NOTA</Button>
                                </div>
                                <div className="p-4 bg-white rounded-xl border text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                    {selectedItem.notes || "No hay registros previos."}
                                </div>
                            </ScrollArea>
                            <div className="p-4 border-t grid grid-cols-2 gap-2 bg-white">
                                <Button onClick={() => setIsScheduleOpen(true)} variant="outline" className="col-span-2 font-bold h-11 border-slate-300">AGENDAR / REPROGRAMAR</Button>
                                <Button onClick={() => setIsDiscardOpen(true)} variant="ghost" className="col-span-2 text-slate-400 hover:text-red-600 text-xs">DESCARTAR PROSPECTO</Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                            <Search className="h-12 w-12 mb-4 opacity-20"/>
                            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Mesa de Trabajo Libre</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALES MANTENIENDO ESTÉTICA */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Prospecto</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <Input placeholder="Nombre Completo" value={createData.title} onChange={(e)=>setCreateData({...createData, title:e.target.value})}/>
                        <Input placeholder="Teléfono" value={createData.phone} onChange={(e)=>setCreateData({...createData, phone:e.target.value})}/>
                        <Select value={createData.source} onValueChange={(v)=>setCreateData({...createData, source:v})}>
                            <SelectTrigger><SelectValue placeholder="Origen"/></SelectTrigger>
                            <SelectContent><SelectItem value="linkedin">LinkedIn</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="llamador">Llamador</SelectItem></SelectContent>
                        </Select>
                        <Textarea placeholder="Comentario inicial..." value={createData.note} onChange={(e)=>setCreateData({...createData, note:e.target.value})}/>
                    </div>
                    <Button onClick={handleCreate} className="w-full bg-slate-900 text-white mt-4">CREAR LEAD</Button>
                </DialogContent>
            </Dialog>

             <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Agendar Seguimiento</DialogTitle></DialogHeader>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="date" className="h-10 border rounded px-2" value={manualDate} onChange={(e)=>setManualDate(e.target.value)}/>
                        <input type="time" className="h-10 border rounded px-2" value={manualTime} onChange={(e)=>setManualTime(e.target.value)}/>
                    </div>
                    <Button className="w-full mt-4 bg-slate-900 text-white" onClick={() => handleReschedule(manualDate, manualTime)}>CONFIRMAR CITA</Button>
                </DialogContent>
            </Dialog>

            <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Descartar Lead</DialogTitle></DialogHeader>
                    <Select onValueChange={setDiscardReason}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar motivo..." /></SelectTrigger>
                        <SelectContent><SelectItem value="no_interesa">No le interesa</SelectItem><SelectItem value="numero_mal">Número erróneo</SelectItem><SelectItem value="competencia">Ya tiene cobertura</SelectItem></SelectContent>
                    </Select>
                    <Button onClick={handleDiscard} className="w-full mt-4 bg-red-600 text-white">CONFIRMAR BAJA DEFINITIVA</Button>
                </DialogContent>
            </Dialog>
        </div>
    )
}