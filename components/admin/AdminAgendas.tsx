"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Clock, ArrowRightLeft, CheckSquare, AlertCircle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"

export function AdminAgendas() {
    const [selectedAgent, setSelectedAgent] = useState("all")
    const [targetAgent, setTargetAgent] = useState("")
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]) // Fecha hoy por defecto
    const [selectedTasks, setSelectedTasks] = useState<string[]>([])

    const AGENTS = ["Maca", "Gonza", "Sofi", "Lucas", "Brenda", "Cami"]

    // DATOS SIMULADOS (Incluyen fecha)
    const tasks = [
        { id: '1', date: '2025-12-17', time: '09:00', lead: 'Juan Perez', type: 'Llamado', status: 'vencido', agent: 'Maca', note: 'Primer contacto' },
        { id: '2', date: '2025-12-17', time: '10:30', lead: 'Maria Garcia', type: 'Seguimiento', status: 'pendiente', agent: 'Maca', note: 'Ver si leyó cotización' },
        { id: '3', date: '2025-12-18', time: '11:00', lead: 'Carlos Diaz', type: 'Cierre', status: 'pendiente', agent: 'Gonza', note: 'Pide link de pago' }, // Mañana
    ]

    // FILTRO DOBLE: FECHA + AGENTE
    const filteredTasks = tasks.filter(t => {
        const matchAgent = selectedAgent === 'all' || t.agent === selectedAgent
        const matchDate = t.date === selectedDate
        return matchAgent && matchDate
    })

    const handleReassign = () => { alert(`✅ Tareas reasignadas a ${targetAgent}`); setSelectedTasks([]) }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div><h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2"><CalendarDays className="h-8 w-8 text-blue-600" /> Supervisión de Agendas</h2><p className="text-slate-500">Control de cumplimiento diario.</p></div>
                
                {/* FILTROS HEADER */}
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
                    <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-fit font-bold text-slate-600" />
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <Select value={selectedAgent} onValueChange={setSelectedAgent}><SelectTrigger className="w-[150px] border-none shadow-none"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">👀 Todas</SelectItem>{AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b bg-slate-50 dark:bg-slate-900/50 flex flex-row justify-between items-center">
                    <CardTitle className="text-sm font-bold uppercase text-slate-500">Tareas del {selectedDate}</CardTitle>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 mr-1">{selectedTasks.length} selecc.</span>
                        <Select value={targetAgent} onValueChange={setTargetAgent}><SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Pasar a..." /></SelectTrigger><SelectContent>{AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
                        <Button size="sm" variant="secondary" className="h-8" onClick={handleReassign} disabled={selectedTasks.length === 0}><ArrowRightLeft className="h-3 w-3 mr-2"/> Reasignar</Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox /></TableHead><TableHead>Hora</TableHead><TableHead>Responsable</TableHead><TableHead>Lead</TableHead><TableHead>Actividad</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {filteredTasks.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-slate-400">No hay tareas para esta fecha.</TableCell></TableRow> : 
                            filteredTasks.map((task) => (
                                <TableRow key={task.id} className={task.status === 'vencido' ? 'bg-red-50' : ''}>
                                    <TableCell><Checkbox checked={selectedTasks.includes(task.id)} /></TableCell>
                                    <TableCell className="font-mono font-bold text-slate-600">{task.time}</TableCell>
                                    <TableCell><Badge variant="outline" className="bg-white">{task.agent}</Badge></TableCell>
                                    <TableCell><p className="font-bold text-sm">{task.lead}</p><p className="text-xs text-slate-500">{task.note}</p></TableCell>
                                    <TableCell className="text-xs font-bold uppercase text-slate-500">{task.type}</TableCell>
                                    <TableCell>{task.status === 'vencido' ? <Badge variant="destructive">Vencido</Badge> : <Badge variant="secondary">Pendiente</Badge>}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}