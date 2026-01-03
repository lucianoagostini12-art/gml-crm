"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase" // Cliente para tareas generales
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar as CalendarIcon, Plus, Phone, MessageCircle, StickyNote, ChevronLeft, ChevronRight, CheckSquare, Save, User, Users, Clock, RefreshCw, Zap, Trash2, CheckCircle2 } from "lucide-react"
import { Reminder, Operation } from "./data"

export function OpsAgenda({ operations, generalTasks, setGeneralTasks, onSelectOp, updateOp, userName, role }: any) {
    const supabase = createClient()
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

    // --- CARGAR TAREAS GENERALES (REALES) ---
    useEffect(() => {
        fetchGeneralTasks()
    }, [])

    const fetchGeneralTasks = async () => {
        const { data } = await supabase.from('team_tasks').select('*').eq('done', false)
        if (data) {
            // Mapeamos al formato Reminder
            const mapped = data.map((t: any) => ({
                id: t.id.toString(),
                date: t.date,
                time: t.time || "00:00",
                note: t.note,
                type: t.type,
                assignee: t.assignee,
                done: t.done
            }))
            setGeneralTasks(mapped)
        }
    }

    // --- FUNCIONES AUXILIARES ---
    const getDaysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    const getFirstDayOfMonth = (date: Date) => {
        const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        return day === 0 ? 6 : day - 1; 
    }
    const changeMonth = (offset: number) => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + offset)))

    // --- DATOS UNIFICADOS (Clientes + Generales) ---
    const getAllReminders = () => {
        let all: {op: Operation | null, r: Reminder}[] = []
        // Tareas de clientes (vienen en operations)
        operations.forEach((op: Operation) => { 
            (op.reminders || []).forEach(r => { if(!r.done) all.push({op, r}) }) 
        })
        // Tareas generales (vienen de team_tasks)
        generalTasks.forEach((r: Reminder) => { if(!r.done) all.push({op: null, r}) })
        
        return all.sort((a, b) => new Date(a.r.date + 'T' + (a.r.time || '00:00')).getTime() - new Date(b.r.date + 'T' + (b.r.time || '00:00')).getTime())
    }
    
    const allReminders = getAllReminders()
    const todayStr = new Date().toISOString().split('T')[0]
    
    const tasksToday = allReminders.filter(x => x.r.date === todayStr)
    const tasksOverdue = allReminders.filter(x => x.r.date < todayStr)
    const tasksFuture = allReminders.filter(x => x.r.date > todayStr)
    
    const getVisibleTasks = () => {
        if(agendaTypeFilter === 'today') return tasksToday
        if(agendaTypeFilter === 'overdue') return tasksOverdue
        return tasksFuture
    }
    const visibleAgendaTasks = getVisibleTasks()

    // --- ACCIONES REALES ---
    
    // 1. COMPLETAR TAREA
    const handleComplete = async (task: {op: Operation | null, r: Reminder}, e: any) => {
        e.stopPropagation()
        if (task.op) {
            // Tarea de Cliente: Actualizamos el array de reminders del lead
            const newReminders = task.op.reminders.map(r => r.id === task.r.id ? { ...r, done: true } : r)
            await updateOp({ ...task.op, reminders: newReminders }) // Esto ya llama a Supabase en el padre
        } else {
            // Tarea General: Update en team_tasks
            await supabase.from('team_tasks').update({ done: true }).eq('id', task.r.id)
            fetchGeneralTasks()
        }
    }

    // 2. SNOOZE (Patear para mañana)
    const handleSnooze = async (task: {op: Operation | null, r: Reminder}, e: any) => {
        e.stopPropagation();
        const currentDate = new Date(task.r.date);
        currentDate.setDate(currentDate.getDate() + 1);
        const nextDayStr = currentDate.toISOString().split('T')[0];
        
        if (task.op) {
            const updatedReminder = { ...task.r, date: nextDayStr };
            const newReminders = task.op.reminders.map(r => r.id === task.r.id ? updatedReminder : r);
            await updateOp({ ...task.op, reminders: newReminders });
        } else {
            await supabase.from('team_tasks').update({ date: nextDayStr }).eq('id', task.r.id)
            fetchGeneralTasks()
        }
    }

    // 3. GUARDAR NUEVA TAREA
    const handleSaveTask = async () => {
        if (!newTaskNote) return

        if(newTaskOpId === 'general') {
            // Guardar en tabla team_tasks
            const { error } = await supabase.from('team_tasks').insert({
                date: newTaskDate,
                time: newTaskTime || "09:00",
                note: newTaskNote,
                type: newTaskType,
                assignee: newTaskAssignee,
                done: false
            })
            if (!error) fetchGeneralTasks()
        } else { 
            // Guardar en lead existente
            const op = operations.find((x:any) => x.id === newTaskOpId); 
            if(op) {
                const newR: Reminder = {
                    id: Date.now().toString(), 
                    date: newTaskDate, 
                    time: newTaskTime || "09:00", 
                    note: newTaskNote, 
                    type: newTaskType as any, 
                    done: false, 
                    assignee: newTaskAssignee
                }
                // Actualizamos a través del padre que ya tiene la lógica de updateOpInDb
                await updateOp({...op, reminders: [...(op.reminders || []), newR]})
            } 
        }
        setIsTaskModalOpen(false); setNewTaskNote(""); setNewTaskTime("")
    }

    const handleDayClick = (dateStr: string) => {
        setNewTaskDate(dateStr)
        setIsTaskModalOpen(true)
    }

    // --- RENDERIZADO CALENDARIO ---
    const getLoadColor = (count: number, isToday: boolean) => {
        if (count === 0) return isToday ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400';
        if (count <= 3) return 'bg-green-100 text-green-700 font-black';
        if (count <= 6) return 'bg-yellow-100 text-yellow-700 font-black';
        return 'bg-red-100 text-red-600 font-black border border-red-200';
    }

    const renderCalendarGrid = () => {
        const totalDays = getDaysInMonth(viewDate)
        const firstDay = getFirstDayOfMonth(viewDate)
        const days = Array.from({ length: totalDays }, (_, i) => i + 1)
        
        const emptyCells = Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="bg-slate-50/50 border-r border-b border-slate-200 min-h-[120px]" />
        ))

        const dayCells = days.map((day) => {
            const dateStr = `${viewDate.getFullYear()}-${String(viewDate.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const dayTasks = allReminders.filter(x => x.r.date === dateStr)
            const isToday = dateStr === todayStr
            const loadClass = getLoadColor(dayTasks.length, isToday)

            return (
                <div key={`day-${day}`} 
                     onClick={() => handleDayClick(dateStr)}
                     className={`min-h-[140px] p-2 border-r border-b border-slate-200 flex flex-col gap-1 cursor-pointer transition-all group bg-white hover:bg-blue-50/20 relative`}>
                    <div className="flex justify-between items-start">
                        <span className={`text-xs h-7 w-7 flex items-center justify-center rounded-full ${loadClass}`}>{day}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={14} className="text-blue-400"/></div>
                    </div>
                    
                    <div className="flex-1 flex flex-col gap-1 overflow-hidden mt-1">
                        {dayTasks.map((t, idx) => (
                            <div key={idx} onClick={(e)=>{e.stopPropagation(); t.op && onSelectOp(t.op)}} 
                                 className={`text-[9px] px-1.5 py-0.5 rounded border truncate font-bold flex items-center gap-1.5 shadow-sm hover:scale-105 transition-transform cursor-pointer
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

        const totalCells = emptyCells.length + dayCells.length
        const finalEmptyCells = Array.from({ length: (7 - (totalCells % 7)) % 7 }).map((_, i) => (
            <div key={`final-${i}`} className="bg-slate-50/50 border-r border-b border-slate-200 min-h-[120px]" />
        ))

        return (
            <div className="w-full border-t border-l border-slate-200" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d,i) => (
                    <div key={i} className="text-center py-3 text-xs font-black text-slate-400 uppercase bg-slate-50 border-b border-r border-slate-200 tracking-widest">{d}</div>
                ))}
                {emptyCells}{dayCells}{finalEmptyCells}
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
                            {visibleAgendaTasks.length === 0 && <div className="p-8 text-center text-slate-400 text-xs">No hay tareas pendientes.</div>}
                            {visibleAgendaTasks.map((task, i) => {
                                const {op, r} = task
                                return (
                                <div key={i} className="p-4 hover:bg-slate-50 flex items-start gap-4 cursor-pointer group transition-colors">
                                    <div onClick={(e) => handleComplete(task, e)} className={`mt-1 h-9 w-9 rounded-full flex items-center justify-center border cursor-pointer hover:bg-green-100 transition-colors ${r.type==='call'?'bg-blue-50 border-blue-100 text-blue-600':'bg-purple-50 border-purple-100 text-purple-600'}`}>
                                        <CheckCircle2 size={18} className="text-slate-300 hover:text-green-600"/>
                                    </div>
                                    <div className="flex-1" onClick={() => op && onSelectOp(op)}>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                    {op ? op.clientName : "★ Tarea General"}
                                                    {r.type === 'call' && <Badge variant="outline" className="text-[9px] h-4 px-1">Llamado</Badge>}
                                                </h4>
                                                <p className="text-xs text-slate-600 mt-1">{r.note}</p>
                                                {r.assignee && r.assignee !== userName && <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded mt-1 inline-block font-bold">Asignado a: {r.assignee}</span>}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[10px] font-bold text-slate-400">{r.time}</span>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-300 hover:text-orange-500 hover:bg-orange-50" onClick={(e) => handleSnooze(task, e)} title="Pasar a mañana"><Zap size={12}/></Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )})}
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