"use client"

import { useEffect, useState } from "react"
// 1. CORRECCIÓN: Importamos la función correcta
import { createClient } from "@/lib/supabase" 
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarClock, Phone, MessageCircle, StickyNote, Wallet, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

// 2. Aceptamos el nombre del usuario real como propiedad
export function AgendasView({ userName }: { userName?: string }) {
    // 3. Iniciamos la conexión a Supabase
    const supabase = createClient()
    
    const [tasks, setTasks] = useState<any[]>([])
    
    // Si no le pasamos nombre, usa "Maca" por defecto para que no se rompa
    const CURRENT_USER = userName || "Maca"

    useEffect(() => { fetchAgenda() }, [CURRENT_USER])

    const fetchAgenda = async () => {
        const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('agent_name', CURRENT_USER)
            .not('scheduled_for', 'is', null)
            .order('scheduled_for', { ascending: true })
        if (data) setTasks(data)
    }

    const handleCompleteTask = async (id: string, currentNotes: string) => {
        const newNotes = (currentNotes || "") + "\n[AGENDA] Llamado realizado/completado."
        await supabase.from('leads').update({
            scheduled_for: null, 
            notes: newNotes,
            last_update: new Date().toISOString()
        }).eq('id', id)
        setTasks(prev => prev.filter(t => t.id !== id))
    }

    const isToday = (dateString: string) => {
        const date = new Date(dateString)
        const today = new Date()
        return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
    }

    const formatTime = (dateString: string) => {
        const date = new Date(dateString)
        const hours = date.getHours().toString().padStart(2, '0')
        const minutes = date.getMinutes().toString().padStart(2, '0')
        return `${hours}:${minutes}`
    }
    
    const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })

    const openWhatsApp = (phone: string, agent: string) => {
        const clean = phone.replace(/[^0-9]/g, '')
        const msg = encodeURIComponent(`Hola! Soy ${agent} de GML Salud. Teníamos agendada una llamada para ahora. ¿Podés hablar?`)
        window.open(`https://wa.me/${clean}?text=${msg}`, '_blank')
    }

    const tasksToday = tasks.filter(t => isToday(t.scheduled_for))
    const tasksFuture = tasks.filter(t => !isToday(t.scheduled_for) && new Date(t.scheduled_for) > new Date())

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto text-slate-900 dark:text-slate-100">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <CalendarClock className="h-6 w-6 text-blue-600" /> Mi Agenda ({CURRENT_USER})
            </h2>

            <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider">📅 Para Hoy ({tasksToday.length})</h3>
                <div className="space-y-4">
                    {tasksToday.length === 0 && <div className="text-slate-400 italic">Nada pendiente para hoy.</div>}
                    {tasksToday.map(task => (
                        <Card key={task.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow dark:bg-slate-900 dark:border-slate-800 dark:border-l-blue-500 overflow-hidden">
                            <CardContent className="p-0"> 
                                <div className="flex items-stretch">
                                    <div className="w-[160px] shrink-0 bg-blue-50 dark:bg-blue-900/20 flex flex-col justify-center items-center border-r border-blue-100 dark:border-slate-800 py-6 px-2">
                                        <span className="text-4xl font-black text-blue-700 dark:text-blue-400 leading-none tracking-tight">
                                            {formatTime(task.scheduled_for)}
                                        </span>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-widest">
                                            HORA
                                        </span>
                                    </div>

                                    <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
                                        <div className="flex justify-between items-start gap-4 mb-2">
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-bold text-lg truncate">{task.name}</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-400 font-mono font-bold flex items-center gap-2 mt-1">
                                                    <Phone className="h-3 w-3" /> {task.phone}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 shrink-0">
                                                <Button size="icon" variant="ghost" className="text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => openWhatsApp(task.phone, task.agent_name)}>
                                                    <MessageCircle className="h-5 w-5" />
                                                </Button>
                                                <Button className="bg-slate-200 text-slate-800 hover:bg-green-100 hover:text-green-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-green-900/30 dark:hover:text-green-400 gap-2 px-4" onClick={() => handleCompleteTask(task.id, task.notes)}>
                                                    <Check className="h-4 w-4" /> Listo
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-xs dark:border-slate-700">{task.status.toUpperCase()}</Badge>
                                            <Badge variant="secondary" className="text-xs dark:bg-slate-800">{task.source}</Badge>
                                        </div>
                                    </div>
                                </div>

                                {(task.observations || task.quoted_price) && (
                                    <div className="bg-slate-50 dark:bg-slate-950/50 p-3 text-sm grid md:grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-800">
                                        {task.quoted_price && (
                                            <div className="flex items-start gap-2">
                                                <Wallet className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-emerald-700 dark:text-emerald-400 truncate">Cotizado: {task.quoted_prepaga}</p>
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-500 truncate">{task.quoted_plan} - ${task.quoted_price}</p>
                                                </div>
                                            </div>
                                        )}
                                        {task.observations && (
                                            <div className="flex items-start gap-2">
                                                <StickyNote className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="font-bold text-slate-700 dark:text-slate-300">Notas:</p>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 truncate">{task.observations}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
            
            <div className="opacity-80">
                <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-400 mb-4 uppercase tracking-wider">🚀 Próximos Días</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {tasksFuture.map(task => (
                        <Card key={task.id} className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                            <CardContent className="p-4">
                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">{formatDate(task.scheduled_for)}</p>
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold">{task.name}</h4>
                                    <p className="text-sm text-blue-600 dark:text-blue-400 font-bold">{formatTime(task.scheduled_for)} hs</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    )
}