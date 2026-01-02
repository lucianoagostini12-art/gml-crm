"use client"
import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarIcon, Plus, Phone, MessageCircle, StickyNote, ChevronLeft, ChevronRight, CheckSquare, Save, User, Users, Clock, RefreshCw, Zap } from "lucide-react"
import { Reminder, Operation } from "./data"

export function OpsAgenda({ operations, generalTasks, setGeneralTasks, onSelectOp, updateOp, userName, role }: any) {
    const [viewDate, setViewDate] = useState(new Date())
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
    const [agendaTypeFilter, setAgendaTypeFilter] = useState<'today' | 'overdue' | 'future'>('today')

    // Tarea Form
    const [newTaskOpId, setNewTaskOpId] = useState("general")
    const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0])
    const [newTaskTime, setNewTaskTime] = useState("")
    const [newTaskNote, setNewTaskNote] = useState("")
    const [newTaskType, setNewTaskType] = useState("call")
    const [newTaskAssignee, setNewTaskAssignee] = useState(userName)

    // --- FUNCIONES AUXILIARES ---
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    
    const getFirstDayOfMonth = (date: Date) => {
        const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return day === 0 ? 6 : day - 1; // Lunes = 0
    }

    const changeMonth = (offset: number) => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + offset)))

    // --- DATOS ---
    const getAllReminders = () => {
        let all: {op: Operation | null, r: Reminder}[] = []
        operations.forEach((op: Operation) => { op.reminders.forEach(r => { if(!r.done) all.push({op, r}) }) })
        generalTasks.forEach((r: Reminder) => { if(!r.done) all.push({op: null, r}) })
        return all.sort((a, b) => new Date(a.r.date + 'T' + a.r.time).getTime() - new Date(b.r.date + 'T' + b.r.time).getTime())
    }
    const allReminders = getAllReminders()
    const todayStr = new Date().toISOString().split('T')[0]
    
    // Filtros
    const tasksToday = allReminders.filter(x => x.r.date === todayStr)
    const tasksOverdue = allReminders.filter(x => x.r.date < todayStr)
    const tasksFuture = allReminders.filter(x => x.r.date > todayStr)
    
    const getVisibleTasks = () => {
        if(agendaTypeFilter === 'today') return tasksToday
        if(agendaTypeFilter === 'overdue') return tasksOverdue
        return tasksFuture
    }
    const visibleAgendaTasks = getVisibleTasks()

    // --- ACCIONES RAPIDAS (IDEAS IMPLEMENTADAS) ---
    
    // 1. SNOOZE (Patear para mañana)
    const handleSnooze = (task: {op: Operation | null, r: Reminder}, e: any) => {
        e.stopPropagation();
        const currentDate = new Date(task.r.date);
        currentDate.setDate(currentDate.getDate() + 1); // +1 Dia
        const nextDayStr = currentDate.toISOString().split('T')[0];
        
        const updatedReminder = { ...task.r, date: nextDayStr };
        
        if (task.op) {
            // Actualizar en operacion
            const newReminders = task.op.reminders.map(r => r.id === task.r.id ? updatedReminder : r);
            updateOp({ ...task.op, reminders: newReminders });
        } else {
            // Actualizar en general
            setGeneralTasks((prev: Reminder[]) => prev.map(r => r.id === task.r.id ? updatedReminder : r));
        }
    }

    const handleSaveTask = () => {
        const r: Reminder = {id:Date.now().toString(), date:newTaskDate, time:newTaskTime, note:newTaskNote, type:newTaskType as any, done:false, assignee:newTaskAssignee}
        if(newTaskOpId==='general') setGeneralTasks((prev:any)=>[...prev, r])
        else { const o = operations.find((x:any)=>x.id===newTaskOpId); if(o) updateOp({...o, reminders:[...o.reminders, r]}) }
        setIsTaskModalOpen(false); setNewTaskNote(""); setNewTaskTime("")
    }

    const handleDayClick = (dateStr: string) => {
        setNewTaskDate(dateStr)
        setIsTaskModalOpen(true)
    }

    // --- RENDERIZADO CALENDARIO (GRILLA) ---
    // Logica de "Semáforo" para carga de trabajo
    const getLoadColor = (count: number, isToday: boolean) => {
        if (count === 0) return isToday ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400';
        if (count <= 3) return 'bg-green-100 text-green-700 font-black'; // Tranqui
        if (count <= 6) return 'bg-yellow-100 text-yellow-700 font-black'; // Ocupado
        return 'bg-red-100 text-red-600 font-black border border-red-200'; // Saturado
    }

    const renderCalendarGrid = () => {
        const totalDays = getDaysInMonth(viewDate)
        const firstDay = getFirstDayOfMonth(viewDate)
        const days = Array.from({ length: totalDays }, (_, i) => i + 1)
        
        // Celdas vacias previas
        const emptyCells = Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-50/50 border-r border-b border-slate-200 min-h-[120px]" />
        ))

        // Celdas de dias
        const dayCells = days.map((day) => {
            const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayTasks = allReminders.filter(x => x.r.date === dateStr)
            const isToday = dateStr === todayStr
            const loadClass = getLoadColor(dayTasks.length, isToday)

            return (
                <div key={`day-${day}`} 
                     onClick={() => handleDayClick(dateStr)}
                     className={`
                        min-h-[140px] p-2 border-r border-b border-slate-200 flex flex-col gap-1 cursor-pointer transition-all group
                        bg-white hover:bg-blue-50/20 relative
                     `}>
                    <div className="flex justify-between items-start">
                        <span className={`text-xs h-7 w-7 flex items-center justify-center rounded-full ${loadClass}`}>
                            {day}
                        </span>
                        {/* Indicador rapido de nueva tarea al hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus size={14} className="text-blue-400"/>
                        </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1">
                        {dayTasks.map((t, idx) => (
                            <div key={idx} onClick={(e)=>{e.stopPropagation(); t.op && onSelectOp(t.op)}} 
                                 className={`text-[9px] px-1.5 py-0.5 rounded border truncate font-bold flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform
                                 ${t.r.type === 'call' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                                   t.r.type === 'whatsapp' ? 'bg-green-50 text-green-700 border-green-100' : 
                                   'bg-purple-50 text-purple-700 border-purple-100'}
                                 `}>
                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${t.r.type==='call'?'bg-blue-500':t.r.type==='whatsapp'?'bg-green-500':'bg-purple-500'}`}/>
                                <span className="truncate">{t.r.time} {t.op ? t.op.clientName : t.r.note}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )
        })

        // Relleno final
        const totalCells = emptyCells.length + dayCells.length
        const finalEmptyCells = Array.from({ length: (7 - (totalCells % 7)) % 7 }).map((_, i) => (
            <div key={`final-${i}`} className="bg-slate-50/50 border-r border-b border-slate-200 min-h-[120px]" />
        ))

        // FORZAMOS GRILLA ESTILO EXCEL CON INLINE STYLES PARA QUE NO SE ROMPA NUNCA
        return (
            <div className="w-full border-t border-l border-slate-200" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d,i) => (
                    <div key={i} className="text-center py-3 text-xs font-black text-slate-400 uppercase bg-slate-50 border-b border-r border-slate-200 tracking-widest">{d}</div>
                ))}
                {emptyCells}
                {dayCells}
                {finalEmptyCells}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Agenda</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                        <RefreshCw size={12} className="text-green-500"/> Sincronizado
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setIsCalendarOpen(true)}><CalendarIcon size={16} className="mr-2"/> Calendario Mensual</Button>
                    <Button className="bg-slate-900 text-white" onClick={() => {setNewTaskDate(todayStr); setIsTaskModalOpen(true)}}><Plus size={16} className="mr-2"/> Nueva Tarea</Button>
                </div>
            </div>
            
            <div className="flex gap-6 h-full overflow-hidden">
                {/* LISTA LATERAL */}
                <div className="w-[280px] flex flex-col gap-4 shrink-0 overflow-y-auto">
                    <div onClick={() => setAgendaTypeFilter('today')} className={`p-5 bg-white rounded-xl shadow-sm border border-slate-100 cursor-pointer transition-all hover:shadow-md ${agendaTypeFilter==='today'?'ring-2 ring-blue-500':''}`}>
                        <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-black text-slate-400">HOY</h4><Badge variant="secondary" className="bg-blue-50 text-blue-600">{tasksToday.length}</Badge></div>
                        <div className="text-3xl font-black text-slate-800">{tasksToday.length}</div>
                    </div>
                    <div onClick={() => setAgendaTypeFilter('overdue')} className={`p-5 bg-white rounded-xl shadow-sm border border-slate-100 cursor-pointer transition-all hover:shadow-md ${agendaTypeFilter==='overdue'?'ring-2 ring-red-500':''}`}>
                        <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-black text-red-400">VENCIDAS</h4><Badge variant="secondary" className="bg-red-50 text-red-600">{tasksOverdue.length}</Badge></div>
                        <div className="text-3xl font-black text-red-600">{tasksOverdue.length}</div>
                    </div>
                    <div onClick={() => setAgendaTypeFilter('future')} className={`p-5 bg-white rounded-xl shadow-sm border border-slate-100 cursor-pointer transition-all hover:shadow-md ${agendaTypeFilter==='future'?'ring-2 ring-slate-400':''}`}>
                         <div className="flex justify-between items-center mb-2"><h4 className="text-xs font-black text-slate-400">PRÓXIMAS</h4><Badge variant="secondary" className="bg-slate-100 text-slate-600">{tasksFuture.length}</Badge></div>
                        <div className="text-3xl font-black text-slate-700">{tasksFuture.length}</div>
                    </div>
                </div>

                {/* LISTA PRINCIPAL */}
                <Card className="flex-1 border-slate-200 shadow-sm bg-white flex flex-col overflow-hidden rounded-xl">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center"><h3 className="font-bold text-slate-700 text-sm uppercase">Lista: <span className="text-blue-600">{agendaTypeFilter === 'today' ? 'Hoy' : agendaTypeFilter === 'overdue' ? 'Vencidas' : 'Próximas'}</span></h3></div>
                    <ScrollArea className="flex-1 p-0">
                        <div className="divide-y divide-slate-50">
                            {visibleAgendaTasks.length === 0 && <div className="p-8 text-center text-slate-400 text-xs">No hay tareas.</div>}
                            {visibleAgendaTasks.map(({op, r}, i) => (
                                <div key={i} onClick={() => op && onSelectOp(op)} className="p-4 hover:bg-slate-50 flex items-start gap-4 cursor-pointer group">
                                    <div className={`mt-1 h-9 w-9 rounded-full flex items-center justify-center border ${r.type==='call'?'bg-blue-50 border-blue-100 text-blue-600':'bg-green-50 border-green-100 text-green-600'}`}>{r.type==='call'?<Phone size={16}/>:<MessageCircle size={16}/>}</div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800">{op ? op.clientName : "General"}</h4>
                                                <p className="text-xs text-slate-600 mt-1">{r.note}</p>
                                                {/* ASIGNACION VISIBLE */}
                                                {r.assignee && r.assignee !== userName && <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded mt-1 inline-block font-bold">Asignado a: {r.assignee}</span>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-bold text-slate-400">{r.time}</span>
                                                {/* BOTON SNOOZE (IDEA IMPLEMENTADA) */}
                                                <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-300 hover:text-orange-500 hover:bg-orange-50" onClick={(e) => handleSnooze({op, r}, e)} title="Pasar a mañana">
                                                    <Zap size={12}/>
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            </div>

            {/* MODAL CALENDARIO */}
            <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                <DialogContent className="max-w-[98vw] h-[95vh] flex flex-col p-0 overflow-hidden bg-white">
                    <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between shrink-0 bg-white">
                        <DialogTitle className="text-3xl font-black capitalize text-slate-800">{viewDate.toLocaleString('es-ES',{month:'long', year:'numeric'})}</DialogTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}><ChevronLeft/></Button>
                            <Button variant="outline" size="sm" onClick={() => changeMonth(1)}><ChevronRight/></Button>
                        </div>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-4 bg-white">
                        {renderCalendarGrid()}
                    </div>
                </DialogContent>
            </Dialog>

            {/* MODAL NUEVA TAREA */}
            <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
                <DialogContent className="sm:max-w-sm"><DialogHeader><DialogTitle>Nueva Tarea</DialogTitle></DialogHeader>
                   <div className="grid gap-4 py-4">
                        <Select value={newTaskOpId} onValueChange={setNewTaskOpId}><SelectTrigger><SelectValue placeholder="Cliente (Opcional)"/></SelectTrigger><SelectContent><SelectItem value="general">★ Tarea General</SelectItem>{operations.map((o:any)=><SelectItem key={o.id} value={o.id}>{o.clientName}</SelectItem>)}</SelectContent></Select>
                        <div className="flex gap-2"><Input type="date" value={newTaskDate} onChange={e=>setNewTaskDate(e.target.value)}/><Input type="time" value={newTaskTime} onChange={e=>setNewTaskTime(e.target.value)}/></div>
                        
                        {/* SELECTOR DE ASIGNACIÓN (SOLO ADMIN) */}
                        {role === 'admin_god' && (
                            <div className="p-3 bg-yellow-50/50 border border-yellow-100 rounded-lg space-y-1">
                                <label className="text-[10px] font-black text-yellow-700 uppercase flex items-center gap-1"><Users size={12}/> Asignar Responsable</label>
                                <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                                    <SelectTrigger className="bg-white border-yellow-200 h-8 text-xs font-bold text-slate-700"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={userName}>👤 A mí ({userName})</SelectItem>
                                        <SelectItem value="Maca">👩‍💼 Maca</SelectItem>
                                        <SelectItem value="Iara">👩‍💼 Iara</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Nota</label>
                        <Input placeholder="Ej: Llamar..." value={newTaskNote} onChange={e=>setNewTaskNote(e.target.value)}/></div>
                        <Button onClick={handleSaveTask} className="w-full bg-slate-900 text-white font-bold hover:bg-blue-600">Guardar Tarea</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}