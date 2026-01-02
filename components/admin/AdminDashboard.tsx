"use client"

import { useState, useEffect } from "react"
// IMPORTANTE: Ruta corregida según tu VS Code para evitar error 404/Build
import { createClient } from "@/lib/supabase" 
import { LayoutDashboard, Users, Layers, BarChart4, LogOut, Database, Sliders, Activity, CheckCircle2, ShieldAlert, Calculator, LifeBuoy, CalendarDays, Megaphone, Banknote, BookOpen, UserPlus, X, ArrowRight, Sparkles, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

// IMPORTAMOS TUS COMPONENTES
import { AdminLeadFactory } from "@/components/admin/AdminLeadFactory"
import { AdminMetrics } from "@/components/admin/AdminMetrics"
import { AdminTeam } from "@/components/admin/AdminTeam"
import { AdminLogs } from "@/components/admin/AdminLogs"
import { AdminConteo } from "@/components/admin/AdminConteo"
import { AdminPipelineHealth } from "@/components/admin/AdminPipelineHealth"
import { AdminAgendas } from "@/components/admin/AdminAgendas"
import { AdminAnnouncements } from "@/components/admin/AdminAnnouncements"
import { AdminDatabase } from "@/components/admin/AdminDatabase"
import { AdminConfig } from "@/components/admin/AdminConfig"
import { AdminCommissions } from "@/components/admin/AdminCommissions"
import { AdminResources } from "@/components/admin/AdminResources"
import { AdminSetterManager } from "@/components/admin/AdminSetterManager"

// --- COMPONENTE DE VISIÓN GLOBAL (CONEXIÓN REAL) ---
function AdminOverview() {
    const supabase = createClient()
    const [stats, setStats] = useState({ entered: 0, completed: 0, compliance: 0 })
    const [activities, setActivities] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchDashboardData = async () => {
        setLoading(true)
        // Traemos los datos de la tabla 'leads' para unificar la info de todos los roles
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .order('last_update', { ascending: false })

        if (leads) {
            // LÓGICA DE NEGOCIO GML:
            // 1. Ingresadas: Leads que pasaron a gestión comercial (excluimos nuevos, contactados y perdidos)
            const entered = leads.filter(l => 
                !['nuevo', 'contactado', 'perdido'].includes(l.status?.toLowerCase())
            ).length
            
            // 2. Cumplidas: Lo que administración/auditoría ya dio por cerrado
            const completed = leads.filter(l => l.status?.toLowerCase() === 'cumplidas').length
            
            // 3. Tasa: Relación ingresos vs éxitos
            const rate = entered > 0 ? Math.round((completed / entered) * 100) : 0

            setStats({ entered, completed, compliance: rate })

            // MAPEO DEL LIVE FEED
            const recent = leads.slice(0, 15).map((l: any) => ({
                time: l.last_update ? new Date(l.last_update).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--',
                agent: l.agent_name || l.operator || 'Sistema',
                action: `${l.status?.toUpperCase()} - ${l.name}`,
                type: l.status?.toLowerCase() === 'cumplidas' ? 'good' : 
                      l.status?.toLowerCase() === 'perdido' ? 'bad' : 'neutral'
            }))
            setActivities(recent)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchDashboardData()
        
        // SUSCRIPCIÓN REALTIME: Si alguien mueve un lead en cualquier panel, la Torre de Control se actualiza sola
        const channel = supabase.channel('admin_live_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchDashboardData()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    return (
        <div className="p-8 space-y-8 h-full overflow-hidden flex flex-col">
             <div className="flex justify-between items-center">
                 <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                    Torre de Control 📡 
                    {loading && <RefreshCw className="animate-spin h-5 w-5 text-slate-400"/>}
                 </h2>
                 <div className="bg-white dark:bg-slate-900 border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm">
                     <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                     <span className="text-sm font-bold text-slate-600">Sistema Online</span>
                 </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 font-bold uppercase">Ventas Ingresadas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-slate-800 dark:text-white">{stats.entered}</div>
                        <p className="text-xs text-blue-600 font-bold mt-1">Gestión Comercial Pura</p>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/50 dark:bg-green-900/10">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-green-700 dark:text-green-400 font-bold uppercase flex items-center gap-2"><CheckCircle2 className="h-4 w-4"/> Ventas Cumplidas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-green-700 dark:text-green-400">{stats.completed}</div>
                        <p className="text-xs text-green-600 dark:text-green-500 font-bold mt-1">Aprobadas por Admin</p>
                    </CardContent>
                </Card>
                
                <Card className="border-l-4 border-l-purple-500 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-sm text-slate-500 font-bold uppercase">Tasa de Cumplimiento</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-4xl font-black text-purple-600">{stats.compliance}%</div>
                        <p className="text-xs text-slate-500 mt-1">De cada 100 ventas, {stats.compliance} se cobran.</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
                <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-red-500 animate-pulse"/> Actividad en Vivo</h3>
                <Card className="flex-1 bg-slate-900 border-slate-800 text-slate-300 overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex justify-between">
                        <span className="text-xs font-mono text-green-400">● LIVE FEED</span>
                        <span className="text-xs font-mono">Monitoreando Operaciones...</span>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                            {activities.map((act, i) => (
                                <div key={i} className="flex gap-4 items-start animate-in slide-in-from-left-2 duration-300">
                                    <span className="text-xs font-mono text-slate-500 mt-1">{act.time}</span>
                                    <div className="flex-1">
                                        <p className="text-sm">
                                            <span className={`font-bold ${act.agent?.toLowerCase().includes('admin') ? 'text-yellow-400' : 'text-blue-400'}`}>{act.agent}</span>: 
                                            <span className={act.type === 'good' ? 'text-green-400 font-bold ml-2' : act.type === 'bad' ? 'text-red-400 ml-2' : 'text-slate-300 ml-2'}>
                                                {act.action}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </Card>
            </div>
        </div>
    )
}

// --- DASHBOARD PRINCIPAL ---
export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
    const supabase = createClient()
    const [view, setView] = useState('overview')
    const [incomingAlert, setIncomingAlert] = useState<{ section: 'leads' | 'setter', name: string, source: string, time: string } | null>(null)

    useEffect(() => {
        // Alerta Realtime: Si entra un lead nuevo (INSERT), salta el cartel en el GOD MODE
        const channel = supabase.channel('god_mode_alerts')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads' }, (payload) => {
                const newLead = payload.new
                setIncomingAlert({
                    section: 'leads',
                    name: newLead.name || 'Nuevo Prospecto',
                    source: newLead.source || 'MetaAds',
                    time: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                })
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans relative">
            
            {/* --- ALERTA FLOTANTE REAL --- */}
            {incomingAlert && (
                <div className="fixed z-[9999] animate-in slide-in-from-right-full duration-500" style={{ right: '24px', bottom: '24px' }}>
                    <div className="bg-slate-900 text-white rounded-xl shadow-2xl border-l-4 border-l-emerald-500 p-4 w-80 flex flex-col gap-3 relative overflow-hidden">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>
                                <h4 className="font-black text-emerald-400 text-sm tracking-widest uppercase">¡DATO INGRESADO!</h4>
                            </div>
                            <button onClick={() => setIncomingAlert(null)} className="text-slate-500 hover:text-white"><X className="h-4 w-4"/></button>
                        </div>
                        <div>
                            <p className="font-bold text-lg leading-tight text-white">{incomingAlert.name}</p>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                                <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-bold">{incomingAlert.source}</span>
                                <span>• {incomingAlert.time}</span>
                            </p>
                        </div>
                        <Button onClick={() => {setView(incomingAlert.section); setIncomingAlert(null)}} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9">
                            VER AHORA <ArrowRight className="ml-2 h-3 w-3"/>
                        </Button>
                    </div>
                </div>
            )}

            {/* SIDEBAR MANTENIDO IGUAL */}
            <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-2xl z-20">
                <div className="h-16 flex items-center px-6 border-b border-slate-800 font-black text-xl tracking-tighter text-blue-400">
                    GML <span className="text-white ml-1">GOD MODE</span>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <Button variant={view === 'overview' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('overview')}><LayoutDashboard className="h-4 w-4"/> Visión Global</Button>
                    <Button variant={view === 'conteo' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('conteo')}><Calculator className="h-4 w-4 text-indigo-400"/> Conteo (Vivo)</Button>
                    <Button variant={view === 'leads' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('leads')}><Layers className="h-4 w-4 text-orange-400"/> Leads</Button>
                    <Button variant={view === 'setter' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('setter')}><UserPlus className="h-4 w-4 text-pink-400"/> Setter</Button>
                    <Button variant={view === 'agendas' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('agendas')}><CalendarDays className="h-4 w-4 text-blue-500"/> Agendas</Button>
                    <Button variant={view === 'metrics' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('metrics')}><BarChart4 className="h-4 w-4 text-purple-400"/> Analítica</Button>
                    <Button variant={view === 'commissions' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('commissions')}><Banknote className="h-4 w-4 text-green-400"/> Liquidación</Button> 
                    <Button variant={view === 'team' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('team')}><Users className="h-4 w-4 text-blue-400"/> Equipo</Button>
                    <Button variant={view === 'resources' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('resources')}><BookOpen className="h-4 w-4 text-pink-400"/> Recursos</Button> 
                    <Button variant={view === 'logs' ? 'secondary' : 'ghost'} className="w-full justify-start gap-3" onClick={() => setView('logs')}><ShieldAlert className="h-4 w-4 text-red-400"/> Auditoría</Button>
                </nav>
                <div className="p-4 bg-slate-950 border-t border-slate-800">
                    <Button variant="destructive" className="w-full h-8 text-xs" onClick={onLogout}><LogOut className="h-3 w-3 mr-2"/> Cerrar Sesión</Button>
                </div>
            </aside>

            <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
                {view === 'overview' && <AdminOverview />}
                {view === 'conteo' && <AdminConteo />}
                {view === 'leads' && <AdminLeadFactory />}
                {view === 'metrics' && <AdminMetrics />}
                {view === 'health' && <AdminPipelineHealth />}
                {view === 'team' && <AdminTeam />}
                {view === 'logs' && <AdminLogs />}
                {view === 'agendas' && <AdminAgendas />}
                {view === 'announcements' && <AdminAnnouncements />}
                {view === 'database' && <AdminDatabase />}
                {view === 'config' && <AdminConfig />}
                {view === 'commissions' && <AdminCommissions />}
                {view === 'resources' && <AdminResources />}
                {view === 'setter' && <AdminSetterManager />}
            </main>
        </div>
    )
}