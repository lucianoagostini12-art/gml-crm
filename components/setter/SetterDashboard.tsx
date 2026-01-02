"use client"

import { useState, useEffect, useMemo } from "react"
// 1. IMPORTAR SUPABASE
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Calendar as CalendarIcon, Clock, Phone, Linkedin, Facebook, MessageCircle, Plus, Search, Bell, ChevronLeft, ChevronRight, LogOut, CheckSquare, GripVertical, CalendarDays, History, Flame, Snowflake, Archive, XCircle, Send } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export function SetterDashboard() {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    
    // ESTADOS UI
    const [currentDate, setCurrentDate] = useState(today)
    const [viewMonth, setViewMonth] = useState(new Date())
    const [currentTimeLine, setCurrentTimeLine] = useState("")
    const [isCalendarExpanded, setIsCalendarExpanded] = useState(false) 
    const [searchQuery, setSearchQuery] = useState("") 
    const [activeAlert, setActiveAlert] = useState<string | null>(null)

    // ESTADOS DATOS REALES
    const [items, setItems] = useState<any[]>([]) // Leads traídos de DB
    const [selectedItem, setSelectedItem] = useState<any>(null)
    const [draggedItem, setDraggedItem] = useState<any>(null)
    
    // INPUTS
    const [newNoteText, setNewNoteText] = useState("")
    
    // MODALES
    const [isCreateOpen, setIsCreateOpen] = useState(false)
    const [isScheduleOpen, setIsScheduleOpen] = useState(false)
    const [isDiscardOpen, setIsDiscardOpen] = useState(false)
    
    // FORMULARIOS
    const [createData, setCreateData] = useState({ title: "", source: "linkedin", note: "", phone: "" })
    const [manualDate, setManualDate] = useState(currentDate)
    const [manualTime, setManualTime] = useState("10:00")
    const [discardReason, setDiscardReason] = useState("")

    // --- CARGA DE DATOS REALES ---
    const fetchItems = async () => {
        // Traemos leads activos (no vendidos ni perdidos)
        const { data } = await supabase
            .from('leads')
            .select('*')
            .not('status', 'in', '("vendido","perdido")')
            .order('created_at', { ascending: false })
        
        if (data) setItems(data)
    }

    useEffect(() => {
        fetchItems()
        
        // Reloj para línea de tiempo
        const t = setInterval(() => {
            const now = new Date()
            setCurrentTimeLine(now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}))
        }, 60000)
        return () => clearInterval(t)
    }, [])

    // --- FILTROS COMPUTADOS ---
    // Bandeja: Leads sin fecha agendada
    const inboxItems = items.filter(i => 
        !i.scheduled_for && 
        i.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Agenda: Leads con fecha igual a la seleccionada
    const agendaItems = items.filter(i => {
        if (!i.scheduled_for) return false
        const itemDate = new Date(i.scheduled_for).toISOString().split('T')[0]
        return itemDate === currentDate
    }).sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())

    // --- ACCIONES REALES (DB) ---

    // 1. CREAR LEAD
    const handleCreate = async () => {
        if (!createData.title) return
        
        const { error } = await supabase.from('leads').insert({
            name: createData.title,
            source: createData.source,
            phone: createData.phone,
            notes: createData.note ? `[NOTA INICIAL]: ${createData.note}` : '',
            status: 'nuevo',
            created_at: new Date().toISOString(),
            last_update: new Date().toISOString()
        })

        if (!error) {
            fetchItems()
            setIsCreateOpen(false)
            setCreateData({ title: "", source: "linkedin", note: "", phone: "" })
        }
    }

    // 2. REPROGRAMAR (DRAG & DROP O MANUAL)
    const handleReschedule = async (dateStr: string, timeStr: string) => {
        const idToUpdate = selectedItem?.id || draggedItem?.id
        if (!idToUpdate) return

        // Combinar fecha y hora en ISO string
        const isoDateTime = `${dateStr}T${timeStr}:00`

        await supabase.from('leads').update({
            scheduled_for: isoDateTime,
            last_update: new Date().toISOString()
        }).eq('id', idToUpdate)

        fetchItems()
        setIsScheduleOpen(false)
        setDraggedItem(null)
    }

    // 3. DESCARTAR
    const handleDiscard = async () => {
        if (!selectedItem) return
        
        await supabase.from('leads').update({
            status: 'perdido',
            loss_reason: discardReason, // Asegurate de tener esta columna o usá 'notes'
            notes: (selectedItem.notes || '') + `\n[DESCARTADO]: ${discardReason}`,
            last_update: new Date().toISOString()
        }).eq('id', selectedItem.id)

        fetchItems()
        setSelectedItem(null)
        setIsDiscardOpen(false)
    }

    // 4. AGREGAR NOTA
    const addNote = async () => {
        if (!selectedItem || !newNoteText.trim()) return
        
        const newNoteString = (selectedItem.notes || "") + `\n[${new Date().toLocaleDateString()}]: ${newNoteText}`
        
        await supabase.from('leads').update({
            notes: newNoteString,
            last_update: new Date().toISOString()
        }).eq('id', selectedItem.id)

        // Actualizamos localmente rápido
        setSelectedItem({...selectedItem, notes: newNoteString})
        setItems(prev => prev.map(i => i.id === selectedItem.id ? {...i, notes: newNoteString} : i))
        setNewNoteText("")
    }

    // --- UTILS VISUALES ---
    const getSourceIcon = (src: string) => {
        switch(src?.toLowerCase()) {
            case 'linkedin': return <Linkedin className="h-4 w-4 text-blue-700" />
            case 'facebook': return <Facebook className="h-4 w-4 text-indigo-600" />
            default: return <Phone className="h-4 w-4 text-orange-600" />
        }
    }

    // Lógica Drag & Drop
    const onDrop = (e: any, hour: number) => {
        e.preventDefault(); if (!draggedItem) return
        const timeStr = `${hour.toString().padStart(2, '0')}:00`
        handleReschedule(currentDate, timeStr)
    }

    // --- CALENDARIO LOGIC (IGUAL QUE ANTES) ---
    const calendarWeeks = useMemo(() => {
        const year = viewMonth.getFullYear(); 
        const month = viewMonth.getMonth();
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


    return (
        <div className="h-screen bg-slate-100 flex flex-col font-sans overflow-hidden text-slate-900 relative">
            
            {/* HEADER */}
            <header className="bg-white h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-20 shadow-sm min-w-[800px]">
                <div className="flex items-center gap-4">
                    <div className="bg-slate-900 text-white font-black text-xs px-2 py-1 rounded">GML</div>
                    <h1 className="text-lg font-bold text-slate-800">SETTER</h1>
                    <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-200">
                        <Search className="h-3 w-3" />
                        <span className="text-xs font-semibold uppercase">Gestión de Leads</span>
                    </div>
                </div>
                <div className="flex items-center gap-6 flex-shrink-0">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-100 border border-green-300 shadow-sm">
                        <div className="w-2.5 h-2.5 bg-green-600 rounded-full shadow-[0_0_8px_rgba(22,163,74,0.6)]"></div>
                        <span className="text-[11px] font-black text-green-800 tracking-wide">ONLINE</span>
                    </div>
                </div>
            </header>

            {/* MAIN GRID */}
            <div className="flex-1 grid grid-cols-12 overflow-hidden bg-slate-100">
                
                {/* COL 1: BANDEJA */}
                <div className="col-span-3 bg-white border-r border-slate-200 flex flex-col min-w-[280px]">
                    <div className="p-4 border-b border-slate-100 bg-white">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-xs font-black uppercase text-slate-500">Bandeja ({inboxItems.length})</h3>
                            <Button size="icon" variant="ghost" onClick={() => setIsCreateOpen(true)} className="h-7 w-7 hover:bg-slate-50"><Plus className="h-4 w-4"/></Button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2 top-2 h-4 w-4 text-slate-400"/>
                            <Input className="pl-8 h-8 text-xs bg-slate-50 border-slate-200" placeholder="Buscar prospecto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-3 bg-slate-50/50">
                        <div className="space-y-2">
                            {inboxItems.map(item => (
                                <div key={item.id} draggable onDragStart={() => setDraggedItem(item)} onClick={() => setSelectedItem(item)} className={`bg-white p-3 rounded-lg border shadow-sm cursor-grab hover:shadow-md transition-all ${selectedItem?.id === item.id ? 'ring-2 ring-slate-800 border-transparent' : 'border-slate-200'}`}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-bold text-slate-800 text-sm truncate">{item.name}</span>
                                        <div className="p-1 rounded bg-slate-50 text-slate-500">{getSourceIcon(item.source)}</div>
                                    </div>
                                    <p className="text-xs text-slate-500 truncate">{item.notes || "Sin notas"}</p>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* COL 2: AGENDA (Panel Central) */}
                <div className="col-span-5 flex flex-col bg-slate-50 border-r border-slate-200 relative min-w-[400px]">
                    <div className="h-14 border-b border-slate-200 flex items-center justify-between px-4 bg-white z-20 shadow-sm">
                        <div className="flex items-center gap-3">
                            <Button variant={isCalendarExpanded ? "secondary" : "ghost"} size="icon" onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}>
                                <CalendarDays className="h-5 w-5 text-slate-600"/>
                            </Button>
                            <div>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Agenda</p>
                                <h2 className="text-sm font-black text-slate-800 capitalize">
                                    {new Date(currentDate).toLocaleDateString('es-AR', {weekday:'long', day:'numeric'})}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* CALENDARIO POPUP */}
                    {isCalendarExpanded && (
                        <div className="absolute top-14 left-0 w-full bg-white border-b border-slate-200 shadow-xl p-4 z-50 animate-in slide-in-from-top-2">
                             <div className="flex justify-between items-center mb-4 px-2">
                                <Button variant="ghost" size="sm" onClick={() => {const d = new Date(viewMonth); d.setMonth(d.getMonth()-1); setViewMonth(d)}}><ChevronLeft className="h-4 w-4"/></Button>
                                <span className="font-bold text-sm uppercase">{viewMonth.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
                                <Button variant="ghost" size="sm" onClick={() => {const d = new Date(viewMonth); d.setMonth(d.getMonth()+1); setViewMonth(d)}}><ChevronRight className="h-4 w-4"/></Button>
                            </div>
                            <table className="w-full text-center table-fixed">
                                <tbody>
                                    {calendarWeeks.map((week, i) => (
                                        <tr key={i}>
                                            {week.map((d, j) => (
                                                <td key={j} className="p-1">
                                                    {d && (
                                                        <div onClick={() => {setCurrentDate(d.toISOString().split('T')[0]); setIsCalendarExpanded(false)}} className={`h-8 w-8 mx-auto rounded-full flex items-center justify-center text-xs cursor-pointer ${d.toISOString().split('T')[0] === currentDate ? 'bg-slate-800 text-white' : 'hover:bg-slate-100'}`}>
                                                            {d.getDate()}
                                                        </div>
                                                    )}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <ScrollArea className="flex-1 bg-slate-50/50">
                        <div className="relative min-h-[800px] pb-20">
                            {/* Linea de tiempo */}
                            {currentDate === today && (
                                <div className="absolute w-full z-10 pointer-events-none flex items-center" style={{ top: '30%' }}> 
                                    <div className="w-14 text-right pr-2 text-[10px] font-bold text-red-500 bg-white rounded z-20">{currentTimeLine}</div>
                                    <div className="flex-1 h-[1px] bg-red-500"></div>
                                </div>
                            )}

                            {Array.from({length: 13}, (_, i) => i + 8).map(hour => {
                                const hourItems = agendaItems.filter(i => {
                                    const h = new Date(i.scheduled_for).getHours()
                                    return h === hour
                                })
                                return (
                                    <div key={hour} className="flex min-h-[90px] border-b border-slate-200/60 group" onDrop={(e) => onDrop(e, hour)} onDragOver={(e) => e.preventDefault()}>
                                        <div className="w-14 border-r border-slate-200/60 flex justify-center pt-3 bg-slate-100/30 text-xs font-medium text-slate-400">{hour}:00</div>
                                        <div className="flex-1 p-1 space-y-1 group-hover:bg-white/50 transition-colors">
                                            {hourItems.map(item => (
                                                <div key={item.id} draggable onDragStart={() => setDraggedItem(item)} onClick={() => setSelectedItem(item)} 
                                                    className={`pl-2 pr-3 py-2 rounded-lg border shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-all bg-white flex justify-between items-center ${selectedItem?.id === item.id ? 'ring-2 ring-slate-800' : ''}`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <GripVertical className="h-4 w-4 text-slate-300" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-bold px-1.5 rounded bg-slate-100">
                                                                    {new Date(item.scheduled_for).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                                                </span>
                                                                <p className="text-sm font-bold">{item.name}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </ScrollArea>
                </div>

                {/* COL 3: MESA DE TRABAJO */}
                <div className="col-span-4 bg-white shadow-2xl flex flex-col relative z-20 border-l border-slate-200 min-w-[350px]">
                    {selectedItem ? (
                        <>
                            <div className="bg-white p-6 border-b border-slate-100">
                                <div className="flex justify-between items-start mb-4">
                                    <Badge variant="outline" className="uppercase">{selectedItem.source}</Badge>
                                    <Button variant="ghost" size="icon" onClick={() => setSelectedItem(null)}><LogOut className="h-4 w-4 rotate-180 text-slate-400"/></Button>
                                </div>
                                <h2 className="text-2xl font-black text-slate-800 leading-none">{selectedItem.name}</h2>
                                <p className="text-xs text-slate-400 mt-1">ID #{selectedItem.id}</p>

                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <Button className="bg-green-600 hover:bg-green-700 text-white font-bold" onClick={() => window.open(`tel:${selectedItem.phone}`)}>
                                        <Phone className="h-4 w-4 mr-2"/> Llamar
                                    </Button>
                                    <Button variant="outline" className="font-bold text-slate-600" onClick={() => window.open(`https://wa.me/${selectedItem.phone}`, '_blank')}>
                                        <MessageCircle className="h-4 w-4 mr-2 text-green-600"/> WhatsApp
                                    </Button>
                                </div>
                            </div>

                            <ScrollArea className="flex-1 bg-slate-50/50 p-6">
                                {/* Input Nueva Nota */}
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-4">
                                    <Textarea 
                                        value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} 
                                        placeholder="Escribí una nota..." 
                                        className="min-h-[60px] text-sm border-0 resize-none"
                                    />
                                    <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                                        <Button size="sm" className="h-7 bg-slate-900 text-white text-xs" onClick={addNote}>Guardar Nota</Button>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white p-3 rounded-xl border text-sm text-slate-600 whitespace-pre-wrap shadow-sm">
                                        {selectedItem.notes || "Sin historial de notas."}
                                    </div>
                                </div>
                            </ScrollArea>

                            <div className="p-4 bg-white border-t border-slate-100 grid grid-cols-2 gap-2">
                                <Button onClick={() => setIsScheduleOpen(true)} variant="outline" className="col-span-2 border-slate-300 hover:bg-slate-50 text-slate-700 font-bold h-10 shadow-sm">
                                    <CalendarDays className="h-4 w-4 mr-2"/> Reprogramar
                                </Button>
                                <Button onClick={() => setIsDiscardOpen(true)} variant="ghost" className="text-slate-400 hover:text-red-600 hover:bg-red-50 text-xs font-semibold col-span-2">
                                    <Archive className="h-4 w-4 mr-2"/> Descartar
                                </Button>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-10 text-center">
                            <div className="bg-slate-50 p-6 rounded-full mb-4 border border-slate-100"><Search className="h-12 w-12 text-slate-200"/></div>
                            <h3 className="font-bold text-slate-400 text-lg uppercase tracking-wide">Mesa de Trabajo</h3>
                            <p className="text-sm mt-2 max-w-[200px] font-medium">Seleccioná un prospecto para gestionar.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CREAR */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Lead</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1"><Label>Nombre</Label><Input value={createData.title} onChange={(e)=>setCreateData({...createData, title:e.target.value})}/></div>
                        <div className="space-y-1"><Label>Teléfono</Label><Input value={createData.phone} onChange={(e)=>setCreateData({...createData, phone:e.target.value})}/></div>
                        <div className="space-y-1"><Label>Origen</Label>
                            <Select value={createData.source} onValueChange={(v:any)=>setCreateData({...createData, source:v})}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent><SelectItem value="linkedin">LinkedIn</SelectItem><SelectItem value="facebook">Facebook</SelectItem><SelectItem value="llamador">Llamador</SelectItem></SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1"><Label>Nota Inicial</Label><Textarea value={createData.note} onChange={(e)=>setCreateData({...createData, note:e.target.value})}/></div>
                    </div>
                    <DialogFooter className="mt-4"><Button onClick={handleCreate} className="bg-slate-900 text-white">Guardar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

             {/* MODAL REPROGRAMAR */}
             <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader><DialogTitle>Reprogramar</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1"><Label>Fecha</Label><input type="date" className="w-full h-9 border rounded px-2" value={manualDate} onChange={(e)=>setManualDate(e.target.value)}/></div>
                        <div className="space-y-1"><Label>Hora</Label><input type="time" className="w-full h-9 border rounded px-2" value={manualTime} onChange={(e)=>setManualTime(e.target.value)}/></div>
                        <Button className="w-full mt-4 bg-slate-900 text-white" onClick={() => handleReschedule(manualDate, manualTime)}>Confirmar</Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL DESCARTAR */}
            <Dialog open={isDiscardOpen} onOpenChange={setIsDiscardOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Descartar Lead</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <Label>Motivo</Label>
                        <Select onValueChange={setDiscardReason}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent><SelectItem value="no_interesa">No le interesa</SelectItem><SelectItem value="numero_mal">Número mal</SelectItem><SelectItem value="competencia">Tiene otro</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <DialogFooter><Button onClick={handleDiscard} className="bg-red-600 text-white">Confirmar Baja</Button></DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}