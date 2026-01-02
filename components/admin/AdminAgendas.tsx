"use client"

import { useState, useEffect } from "react"
// IMPORTANTE: Ruta de importación corregida para evitar errores de despliegue
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, ArrowRightLeft, Loader2 } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export function AdminAgendas() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [tasks, setTasks] = useState<any[]>([])
    const [selectedAgent, setSelectedAgent] = useState("all")
    const [targetAgent, setTargetAgent] = useState("")
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [selectedTasks, setSelectedTasks] = useState<string[]>([])

    const AGENTS = ["Maca", "Gonza", "Sofi", "Lucas", "Brenda", "Cami"]

    // --- CARGA DE DATOS REALES ---
    const fetchAgendas = async () => {
        setLoading(true)
        // Buscamos leads que tengan fecha de agenda programada
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .not('scheduled_for', 'is', null)
            .order('scheduled_for', { ascending: true })

        if (data) {
            // Mapeamos los datos para que coincidan con la estructura visual de tu tabla
            const mappedTasks = data.map(l => {
                const schedDate = new Date(l.scheduled_for)
                return {
                    id: l.id,
                    date: schedDate.toISOString().split('T')[0],
                    time: schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    lead: l.name,
                    agent: l.agent_name || "Sin asignar",
                    status: schedDate < new Date() && l.status !== 'cumplidas' ? 'vencido' : 'pendiente',
                    note: l.notes?.split('\n').pop() || "Sin notas adicionales"
                }
            })
            setTasks(mappedTasks)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchAgendas()
        const channel = supabase.channel('agendas_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchAgendas())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    // --- FILTRO REAL (FECHA + AGENTE) ---
    const filteredTasks = tasks.filter(t => {
        const matchAgent = selectedAgent === 'all' || t.agent === selectedAgent
        const matchDate = t.date === selectedDate
        return matchAgent && matchDate
    })

    // --- ACCIÓN DE REASIGNACIÓN REAL EN DB ---
    const handleReassign = async () => {
        if (!targetAgent || selectedTasks.length === 0) return
        
        const { error } = await supabase
            .from('leads')
                .update({ 
                    agent_name: targetAgent,
                    last_update: new Date().toISOString()
                })
                .in('id', selectedTasks)

        if (!error) {
            alert(`✅ ${selectedTasks.length} tareas reasignadas a ${targetAgent}`)
            setSelectedTasks([])
            setTargetAgent("")
            fetchAgendas()
        }
    }

    const toggleSelectTask = (id: string) => {
        setSelectedTasks(prev => 
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        )
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <CalendarDays className="h-8 w-8 text-blue-600" /> Supervisión de Agendas
                    </h2>
                    <p className="text-slate-500 font-medium">Control de cumplimiento diario en tiempo real.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
                    <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-fit font-bold text-slate-600 border-none shadow-none" />
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                        <SelectTrigger className="w-[150px] border-none shadow-none font-bold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">👀 Todas</SelectItem>
                            {AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="shadow-lg border-none">
                <CardHeader className="pb-3 border-b bg-slate-50/50 flex flex-row justify-between items-center">
                    <CardTitle className="text-xs font-bold uppercase text-slate-500 tracking-widest">
                        Tareas del {selectedDate} {loading && <Loader2 className="inline ml-2 h-3 w-3 animate-spin"/>}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 mr-1 uppercase">{selectedTasks.length} seleccionadas</span>
                        <Select value={targetAgent} onValueChange={setTargetAgent}>
                            <SelectTrigger className="w-[160px] h-8 text-xs font-bold"><SelectValue placeholder="Pasar a..." /></SelectTrigger>
                            <SelectContent>{AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" variant="secondary" className="h-8 font-bold text-xs" onClick={handleReassign} disabled={selectedTasks.length === 0 || !targetAgent}>
                            <ArrowRightLeft className="h-3 w-3 mr-2"/> Reasignar
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/30">
                                <TableHead className="w-[50px] pl-6"></TableHead>
                                <TableHead className="font-bold text-xs uppercase text-slate-400">Hora</TableHead>
                                <TableHead className="font-bold text-xs uppercase text-slate-400">Responsable</TableHead>
                                <TableHead className="font-bold text-xs uppercase text-slate-400">Lead / Notas</TableHead>
                                <TableHead className="font-bold text-xs uppercase text-slate-400 text-center">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredTasks.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-20 text-slate-400 font-medium italic">
                                        No hay tareas programadas para esta fecha.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTasks.map((task) => (
                                    <TableRow key={task.id} className={`${task.status === 'vencido' ? 'bg-red-50/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                                        <TableCell className="pl-6">
                                            <Checkbox 
                                                checked={selectedTasks.includes(task.id)} 
                                                onCheckedChange={() => toggleSelectTask(task.id)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono font-bold text-slate-600">{task.time}</TableCell>
                                        <TableCell><Badge variant="outline" className="bg-white font-bold shadow-sm">{task.agent}</Badge></TableCell>
                                        <TableCell>
                                            <p className="font-bold text-sm text-slate-800">{task.lead}</p>
                                            <p className="text-[11px] text-slate-500 italic truncate max-w-[300px]">{task.note}</p>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {task.status === 'vencido' ? 
                                                <Badge variant="destructive" className="animate-pulse">Vencido</Badge> : 
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-slate-200">Pendiente</Badge>
                                            }
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}