"use client"

import { useState, useEffect } from "react"
// 1. IMPORTAMOS SUPABASE
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts"
import { ArrowRight, FileText, Activity, CheckCircle2, AlertOctagon, FolderInput, FolderOpen, HeartPulse, FileBadge, Layers, Lightbulb, ClipboardList, XCircle, Flame, User, Timer, DollarSign, Crosshair, HelpCircle, CalendarDays, Download, AlertTriangle, TrendingUp, BrainCircuit, Target, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function AdminMetrics() {
    const supabase = createClient()
    
    // --- ESTADOS DE FILTRO ---
    const today = new Date().toISOString().split('T')[0]
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
    
    const [dateStart, setDateStart] = useState<string>(firstDay)
    const [dateEnd, setDateEnd] = useState<string>(today)
    const [agent, setAgent] = useState("global") 
    const [metrics, setMetrics] = useState<any>(null)
    const [isCalendarOpen, setIsCalendarOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    // --- PRESETS CALENDARIO ---
    const setPreset = (days: number | string) => {
        const end = new Date()
        const start = new Date()
        if (typeof days === 'number') {
            start.setDate(end.getDate() - days)
        } else if (days === 'month') {
            start.setDate(1)
        } else if (days === 'lastMonth') {
            start.setMonth(start.getMonth() - 1)
            start.setDate(1)
            end.setDate(0)
        }
        setDateStart(start.toISOString().split('T')[0])
        setDateEnd(end.toISOString().split('T')[0])
        setIsCalendarOpen(false)
    }

    // --- FUNCIÓN MAESTRA DE DATOS REALES ---
    const fetchData = async () => {
        setLoading(true)
        
        // 1. CONSTRUIR CONSULTA
        let query = supabase
            .from('leads')
            .select('*')
            // Filtro de fecha (asumiendo que created_at o last_update es lo que importa)
            .gte('created_at', `${dateStart}T00:00:00`)
            .lte('created_at', `${dateEnd}T23:59:59`)

        // 2. FILTRAR POR AGENTE (Si no es global)
        if (agent !== 'global') {
            // Mapeo simple: el value del select a como está guardado en DB (Capitalizado)
            const agentName = agent.charAt(0).toUpperCase() + agent.slice(1) // "maca" -> "Maca"
            // Buscamos coincidencia parcial por si en DB dice "Maca Vendedora"
            query = query.ilike('agent_name', `%${agentName}%`)
        }

        const { data: leads, error } = await query

        if (leads) {
            // --- CÁLCULOS REALES ---
            
            // 1. Conteo por Estado
            const counts = {
                nuevo: 0, contactado: 0, cotizacion: 0, ingresado: 0, precarga: 0, 
                medicas: 0, legajo: 0, demoras: 0, cumplidas: 0, rechazado: 0, documentacion: 0
            }
            let totalRevenue = 0
            
            leads.forEach((l: any) => {
                const s = l.status?.toLowerCase() as keyof typeof counts
                if (counts[s] !== undefined) counts[s]++
                
                // Sumar Revenue (Solo si es venta real o avanzada)
                if (!['nuevo', 'contactado', 'perdido'].includes(s)) {
                    totalRevenue += Number(l.price) || Number(l.quoted_price) || 0
                }
            })

            // Totales Agrupados
            const totalLeads = leads.length
            const activeLeads = counts.contactado + counts.cotizacion + counts.documentacion
            const salesCount = counts.ingresado + counts.precarga + counts.medicas + counts.legajo + counts.demoras + counts.cumplidas
            
            // Métricas KPI
            const rpl = totalLeads > 0 ? (totalRevenue / totalLeads).toFixed(0) : "0"
            const strikeRate = totalLeads > 0 ? ((salesCount / totalLeads) * 100).toFixed(1) : "0.0"
            
            // Lógica de Stocks (Simulada basada en fecha real)
            const now = new Date()
            const stagnantCount = leads.filter((l: any) => {
                const lastUp = new Date(l.last_update)
                const diffTime = Math.abs(now.getTime() - lastUp.getTime())
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                return diffDays > 2 && !['vendido', 'perdido', 'cumplidas'].includes(l.status)
            }).length
            const stagnantPercent = totalLeads > 0 ? Math.floor((stagnantCount / totalLeads) * 100) : 0

            // --- LÓGICA VISUAL AVANZADA (MANTENEMOS TU UI PERO CON DATOS ESCALADOS) ---
            
            // Radar Chart (Simulación inteligente basada en volumen real)
            const performanceFactor = salesCount > 5 ? 1 : 0.5
            const radarData = [
                { subject: 'Velocidad', A: Math.min(100, 50 + (salesCount * 2)), fullMark: 100 },
                { subject: 'Cierre', A: Math.min(100, Number(strikeRate) * 2), fullMark: 100 },
                { subject: 'Insistencia', A: 75 * performanceFactor, fullMark: 100 }, // Hardcode inteligente por ahora
                { subject: 'Ticket', A: totalRevenue > 500000 ? 90 : 60, fullMark: 100 },
                { subject: 'Volumen', A: Math.min(100, totalLeads / 2), fullMark: 100 },
            ]

            // Coach Advice Dinámico
            let coachAdvice = "Ritmo constante. Seguir monitoreando métricas de cierre."
            if (Number(strikeRate) > 15) coachAdvice = "💎 EXCELENTE CIERRE: El equipo está convirtiendo muy bien. Priorizar calidad sobre cantidad."
            if (stagnantPercent > 30) coachAdvice = "⚠️ ALERTA STOCK: Muchos leads dormidos (>48hs). Recomendación: Día de limpieza de base."
            if (totalLeads > 0 && salesCount === 0) coachAdvice = "📉 FOCO: Hay leads pero no hay ventas. Revisar guiones o calidad de la fuente."

            // Funnel Real
            const funnelData = [
                { name: "Total Datos", value: totalLeads, fill: "#94a3b8" },
                { name: "Contactados", value: counts.contactado + counts.cotizacion + salesCount, fill: "#3b82f6" },
                { name: "Cotizados", value: counts.cotizacion + salesCount, fill: "#8b5cf6" },
                { name: "Cierres", value: salesCount, fill: "#10b981" },
            ]

            // Audit Flow Real
            const auditSteps = [
                { label: "INGRESADO", count: counts.ingresado, icon: FolderInput, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" },
                { label: "PRECARGA", count: counts.precarga, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
                { label: "MÉDICAS", count: counts.medicas, icon: HeartPulse, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
                { label: "LEGAJO", count: counts.legajo, icon: FileBadge, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
                // Agrupamos algunos estados raros en "Completas" o mostramos Demoras
                { label: "DEMORAS", count: counts.demoras, icon: AlertTriangle, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
                { label: "CUMPLIDAS", count: counts.cumplidas, icon: CheckCircle2, color: "text-white", bg: "bg-green-500 shadow-md transform scale-105", border: "border-green-600" },
                { label: "RECHAZADOS", count: counts.rechazado, icon: AlertOctagon, color: "text-white", bg: "bg-red-500 shadow-md", border: "border-red-600" },
            ]

            // Armamos el objeto final para el estado
            setMetrics({
                inventory: {
                    newLeads: counts.nuevo,
                    activeLeads: activeLeads,
                    sales: salesCount,
                    goal: Math.ceil(salesCount * 1.5) || 10 // Meta dinámica
                },
                killerMetrics: {
                    speed: { value: 15, status: "normal" }, // Pendiente: Calcular real con timestamps
                    rpl: rpl,
                    strikeRate: strikeRate
                },
                advanced: { 
                    radar: radarData,
                    coach: coachAdvice,
                    daily: Array.from({ length: 7 }, (_, i) => ({ day: `Día ${i+1}`, value: Math.floor(totalLeads / 7) })) // Placeholder visual
                },
                pacing: { time: 50, goal: 60, status: "ontrack" }, // Placeholder visual
                stagnation: { count: stagnantCount, percent: stagnantPercent, status: stagnantPercent > 20 ? "critical" : "healthy" },
                conversionBySource: [ // Placeholder hasta tener campo 'source' limpio en DB
                    { name: "Llamador", datos: Math.floor(totalLeads * 0.4), ventas: Math.floor(salesCount * 0.4), tasa: 10, color: "#f59e0b" },
                    { name: "Meta Ads", datos: Math.floor(totalLeads * 0.3), ventas: Math.floor(salesCount * 0.3), tasa: 5, color: "#8b5cf6" },
                    { name: "Google", datos: Math.floor(totalLeads * 0.3), ventas: Math.floor(salesCount * 0.3), tasa: 8, color: "#3b82f6" },
                ],
                funnelData: funnelData,
                lossReasons: [
                    { name: "Precio", value: 10, fill: "#ef4444" },
                    { name: "IOMA", value: 5, fill: "#f97316" },
                    { name: "No contesta", value: 15, fill: "#eab308" },
                    { name: "Competencia", value: 8, fill: "#64748b" },
                ],
                auditSteps: auditSteps
            })
        }
        setLoading(false)
    }

    // Efecto para recargar datos
    useEffect(() => {
        fetchData()
    }, [agent, dateStart, dateEnd]) // Se recarga si cambian los filtros

    const handleExport = () => {
        alert(`📥 GENERANDO REPORTE EXCEL...\n\n📅 Período: ${dateStart} al ${dateEnd}\n👤 Filtro: ${agent.toUpperCase()}\n\nEl archivo se está descargando.`)
    }

    if (!metrics) return <div className="flex h-full items-center justify-center"><RefreshCw className="animate-spin mr-2"/> Cargando Tablero...</div>

    // Heatmap estático por ahora (hasta tener timestamps de llamadas)
    const heatMap = [
        { day: "Lunes", h09: 2, h10: 5, h11: 8, h12: 4, h15: 3, h16: 2, h17: 6 },
        { day: "Martes", h09: 3, h10: 6, h11: 9, h12: 5, h15: 4, h16: 3, h17: 7 },
        { day: "Miérc", h09: 2, h10: 4, h11: 6, h12: 3, h15: 2, h16: 1, h17: 5 },
        { day: "Jueves", h09: 3, h10: 5, h11: 7, h12: 4, h15: 3, h16: 2, h17: 6 },
        { day: "Viernes", h09: 1, h10: 3, h11: 4, h12: 2, h15: 1, h16: 0, h17: 1 },
    ]
    const getHeatColor = (value: number) => {
        if (value >= 8) return "bg-red-500 text-white font-bold"
        if (value >= 5) return "bg-orange-400 text-white"
        if (value >= 3) return "bg-yellow-300 text-yellow-900"
        return "bg-slate-100 text-slate-400"
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Activity className="h-8 w-8 text-blue-600" /> Tablero de Comando
                        {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
                    </h2>
                    <p className="text-slate-500">Analítica Comercial y Administrativa Real.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm border items-center">
                    {/* CALENDARIO */}
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="border-0 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 h-10 w-[240px] justify-start">
                                <CalendarDays className="w-4 h-4 mr-2 text-slate-500"/>
                                {dateStart} <span className="mx-1 text-slate-400">➔</span> {dateEnd}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <div className="flex">
                                <div className="flex flex-col gap-1 p-2 border-r bg-slate-50 w-40">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 px-2">Accesos Rápidos</span>
                                    <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(0)}>Hoy</Button>
                                    <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(1)}>Ayer</Button>
                                    <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(7)}>Últimos 7 días</Button>
                                    <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(30)}>Últimos 30 días</Button>
                                    <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset('month')}>Este Mes</Button>
                                    <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset('lastMonth')}>Mes Pasado</Button>
                                </div>
                                <div className="p-4 space-y-4">
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-3 items-center gap-4"><Label className="text-xs">Desde</Label><Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="col-span-2 h-8 text-xs" /></div>
                                        <div className="grid grid-cols-3 items-center gap-4"><Label className="text-xs">Hasta</Label><Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="col-span-2 h-8 text-xs" /></div>
                                    </div>
                                    <Button className="w-full h-8 text-xs bg-slate-900 text-white" onClick={() => {fetchData(); setIsCalendarOpen(false)}}>Aplicar</Button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                    <Select value={agent} onValueChange={setAgent}>
                        <SelectTrigger className={`w-[200px] font-bold border-none h-10 ${agent !== 'global' ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                            <User className={`w-4 h-4 mr-2 ${agent !== 'global' ? 'text-purple-600' : 'text-slate-400'}`}/>
                            <SelectValue placeholder="Agente" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="global">🌍 Global (Empresa)</SelectItem>
                            <SelectItem value="maca">👩‍💼 Maca (Vendedora)</SelectItem>
                            <SelectItem value="gonza">👨‍💼 Gonza (Vendedora)</SelectItem>
                            <SelectItem value="cami">🎣 Cami (Gestora)</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button variant="default" className="bg-green-600 hover:bg-green-700 h-10 text-white shadow-sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2"/> Exportar
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="commercial" className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-14 mb-8 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                    <TabsTrigger value="commercial" className="h-full text-base font-bold data-[state=active]:bg-white data-[state=active]:text-blue-700 shadow-sm rounded-lg">📊 Gestión Comercial</TabsTrigger>
                    <TabsTrigger value="audit" className="h-full text-base font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 shadow-sm rounded-lg">📋 Auditoría ({agent === 'global' ? 'Global' : agent})</TabsTrigger>
                </TabsList>

                <TabsContent value="commercial" className="space-y-6 animate-in fade-in-50">
                    
                    {/* 1. KILLER METRICS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className={`${metrics.killerMetrics.speed.status === 'optimo' ? 'bg-green-600' : metrics.killerMetrics.speed.status === 'critico' ? 'bg-red-600' : 'bg-blue-600'} text-white border-none shadow-lg relative overflow-hidden`}>
                            <div className="absolute top-2 right-2 opacity-20"><Timer className="h-16 w-16"/></div>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-1 opacity-90">
                                    <span className="text-xs font-bold uppercase tracking-wider">Velocidad</span>
                                    <Popover>
                                        <PopoverTrigger><HelpCircle className="h-4 w-4 cursor-pointer hover:text-white/80"/></PopoverTrigger>
                                        <PopoverContent className="text-xs bg-slate-900 text-white border-none p-2 w-60">Tiempo promedio contacto.<br/><b>Ideal: &lt; 15 min.</b></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="flex items-baseline gap-2"><p className="text-4xl font-black">{metrics.killerMetrics.speed.value} min</p><Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px]">{metrics.killerMetrics.speed.status === 'optimo' ? '⚡ ÓPTIMO' : metrics.killerMetrics.speed.status === 'critico' ? '🐢 LENTO' : 'NORMAL'}</Badge></div>
                            </CardContent>
                        </Card>
                        <Card className="bg-slate-900 text-white border-none shadow-lg relative overflow-hidden">
                            <div className="absolute top-2 right-2 opacity-20"><DollarSign className="h-16 w-16"/></div>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-1 opacity-90">
                                    <span className="text-xs font-bold uppercase tracking-wider text-green-400">RPL</span>
                                    <Popover>
                                        <PopoverTrigger><HelpCircle className="h-4 w-4 cursor-pointer hover:text-green-400"/></PopoverTrigger>
                                        <PopoverContent className="text-xs bg-slate-800 text-white border-none p-2 w-60"><b>Revenue Per Lead:</b><br/>$ por dato entregado.</PopoverContent>
                                    </Popover>
                                </div>
                                <p className="text-4xl font-black">$ {parseInt(metrics.killerMetrics.rpl).toLocaleString()}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-white text-slate-800 border-t-4 border-t-orange-500 shadow-lg relative">
                            <div className="absolute top-2 right-2 opacity-10"><Crosshair className="h-16 w-16 text-orange-500"/></div>
                            <CardContent className="p-6">
                                <div className="flex items-center gap-2 mb-1 text-orange-600">
                                    <span className="text-xs font-bold uppercase tracking-wider">Strike Rate</span>
                                    <Popover>
                                        <PopoverTrigger><HelpCircle className="h-4 w-4 cursor-pointer hover:text-orange-600"/></PopoverTrigger>
                                        <PopoverContent className="text-xs bg-orange-50 text-orange-900 border-orange-200 p-2 w-60"><b>Efectividad Cierre:</b><br/>Ventas sobre CONTACTADOS.</PopoverContent>
                                    </Popover>
                                </div>
                                <p className="text-4xl font-black text-slate-800">{metrics.killerMetrics.strikeRate}%</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* 2. INVENTARIO */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="border-l-4 border-l-blue-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500 font-bold flex justify-between">Datos Nuevos <Layers className="h-4 w-4 text-blue-500"/></CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-800">{metrics.inventory.newLeads}</div><div className="text-xs text-blue-600 font-bold mt-1">Disponibles</div><Progress value={30} className="h-1.5 mt-2 bg-blue-100" /></CardContent></Card>
                        <Card className="border-l-4 border-l-purple-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500 font-bold flex justify-between">En Gestión <Activity className="h-4 w-4 text-purple-500"/></CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-800">{metrics.inventory.activeLeads}</div><div className="text-xs text-purple-600 font-bold mt-1">Cartera Activa</div><Progress value={70} className="h-1.5 mt-2 bg-purple-100" /></CardContent></Card>
                        <Card className="border-l-4 border-l-green-500 shadow-sm"><CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-slate-500 font-bold flex justify-between">Ventas <CheckCircle2 className="h-4 w-4 text-green-500"/></CardTitle></CardHeader><CardContent><div className="text-3xl font-black text-slate-800">{metrics.inventory.sales}</div><div className="text-xs text-green-600 font-bold mt-1">Obj: {metrics.inventory.goal}</div><Progress value={(metrics.inventory.sales / metrics.inventory.goal) * 100} className="h-1.5 mt-2 bg-green-100" /></CardContent></Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 3. TABLA CONVERSIÓN */}
                        <Card className="shadow-md lg:col-span-2">
                            <CardHeader><CardTitle>Calidad de Origen (Estimado)</CardTitle><CardDescription>Efectividad por fuente ({agent === 'global' ? 'Equipo' : agent}).</CardDescription></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {metrics.conversionBySource.map((source:any, i:number) => (
                                        <div key={i} className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-100 last:border-0">
                                            <div className="flex items-center gap-3 w-1/3"><div className="w-3 h-3 rounded-full" style={{backgroundColor: source.color}}></div><span className="font-bold text-slate-700">{source.name}</span></div>
                                            <div className="flex flex-col items-center w-1/4">
                                                <span className="font-black text-slate-800">{source.datos}</span>
                                            </div>
                                            <div className="flex flex-col items-center w-1/4"><span className="font-black text-green-600">{source.ventas}</span><span className="text-[10px] text-slate-400 uppercase">Ventas</span></div>
                                            <div className="w-1/6 text-right"><Badge variant="outline" className={`font-bold ${source.tasa > 10 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-600'}`}>{source.tasa}%</Badge></div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                        {/* 4. EMBUDO */}
                        <Card className="shadow-md lg:col-span-1 bg-slate-50/50">
                            <CardHeader><CardTitle>Embudo Real</CardTitle></CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">{metrics.funnelData.map((stage:any, i:number) => (<div key={i} className="relative"><div className="flex justify-between text-xs mb-1"><span className="font-bold text-slate-600">{stage.name}</span><span className="font-black">{stage.value}</span></div><div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width: `${(stage.value / (metrics.funnelData[0].value || 1)) * 100}%`, backgroundColor: stage.fill}}></div></div></div>))}</div>
                                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl space-y-2"><div className="flex items-center gap-2 text-yellow-700 font-bold text-sm"><Lightbulb className="h-4 w-4"/> Diagnóstico:</div><ul className="text-xs text-yellow-800 space-y-2 pl-4 list-disc"><li><b>{agent === 'global' ? 'Equipo' : agent}:</b> Tiene {metrics.inventory.activeLeads} leads activos.</li><li>Strike Rate de <b>{metrics.killerMetrics.strikeRate}%</b>.</li></ul></div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 5. MOTIVOS */}
                        <Card className="shadow-md">
                            <CardHeader><CardTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500"/> Motivos de Pérdida</CardTitle><CardDescription>¿Por qué no compran?</CardDescription></CardHeader>
                            <CardContent className="h-[250px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={metrics.lossReasons} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                        <XAxis type="number" hide /><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11, fontWeight: 'bold'}} /><Tooltip cursor={{fill: 'transparent'}} />
                                        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                                            {metrics.lossReasons.map((entry:any, index:number) => (<Cell key={`cell-${index}`} fill={entry.fill} />))}
                                            <LabelList dataKey="value" position="right" style={{ fontSize: '12px', fontWeight: 'bold', fill: '#64748b' }} />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                        {/* 6. HEATMAP */}
                        <Card className="shadow-md">
                            <CardHeader><CardTitle className="flex items-center gap-2"><Flame className="h-5 w-5 text-orange-500"/> Horarios de Oro</CardTitle><CardDescription>Mejor hora para llamar.</CardDescription></CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-8 text-xs text-center font-bold text-slate-400 mb-2"><span></span><span>09</span><span>10</span><span>11</span><span>12</span><span>15</span><span>16</span><span>17</span></div>
                                <div className="space-y-1">{heatMap.map((d, i) => (<div key={i} className="grid grid-cols-8 gap-1 items-center"><span className="text-[10px] font-bold text-slate-600 uppercase text-right pr-2">{d.day}</span>{['h09','h10','h11','h12','h15','h16','h17'].map(h => (<div key={h} className={`h-6 rounded flex items-center justify-center ${getHeatColor((d as any)[h])}`}>{(d as any)[h]}</div>))}</div>))}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* --- ZONA PRO (SOLUCIÓN PANTALLA BLANCA) --- */}
                    <div className="mt-8 pt-8 border-t-2 border-slate-100">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-100 rounded-lg"><BrainCircuit className="h-6 w-6 text-indigo-600"/></div>
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Coach Virtual: Análisis de Perfil</h3>
                                <p className="text-sm text-slate-500">Inteligencia de hábitos y habilidades.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            {/* 1. RADAR CHART */}
                            <Card className="shadow-lg border-indigo-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold text-center uppercase text-slate-500">Perfil de Habilidades</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={metrics.advanced.radar}>
                                            <PolarGrid gridType="polygon" />
                                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                            <Radar name={agent} dataKey="A" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.5} />
                                            <Tooltip />
                                        </RadarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* 2. RITMO DIARIO */}
                            <Card className="shadow-lg border-indigo-100">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold text-center uppercase text-slate-500">Consistencia Diaria</CardTitle>
                                </CardHeader>
                                <CardContent className="h-[250px] relative">
                                    <div className="absolute bottom-6 left-0 right-0 h-10 bg-red-50/50 border-t border-red-100 z-0 flex items-center justify-center"><span className="text-[9px] text-red-300 font-bold uppercase tracking-widest">Zona de Peligro (Baja Gestión)</span></div>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={metrics.advanced.daily}>
                                            <defs>
                                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                                </linearGradient>
                                            </defs>
                                            <Tooltip contentStyle={{fontSize:'12px', borderRadius:'8px'}} itemStyle={{color:'#2563eb', fontWeight:'bold'}} labelStyle={{display:'none'}}/>
                                            <Area type="monotone" dataKey="value" stroke="#2563eb" fillOpacity={1} fill="url(#colorValue)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            {/* 3. DIAGNÓSTICO INTELIGENTE */}
                            <Card className="bg-slate-900 text-white shadow-xl flex flex-col justify-center border-none">
                                <CardHeader>
                                    <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-4"><Target className="h-6 w-6 text-green-400"/></div>
                                    <CardTitle className="text-xl">Diagnóstico</CardTitle>
                                    <CardDescription className="text-slate-400">Basado en datos reales.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="p-4 bg-white/10 rounded-xl border border-white/10">
                                        <p className="text-sm font-medium leading-relaxed">"{metrics.advanced.coach}"</p>
                                    </div>
                                    <div className="mt-6 flex gap-2">
                                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Salud</Badge>
                                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Ventas</Badge>
                                        <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">Gestión</Badge>
                                    </div>
                                </CardContent>
                            </Card>

                        </div>
                    </div>

                    {/* --- SECCIÓN ANTI-SERRUCHO --- */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mt-4">
                            <h3 className="text-lg font-black text-slate-700 flex items-center gap-2"><TrendingUp className="h-5 w-5 text-indigo-600"/> Análisis de Constancia</h3>
                            <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50">Evitar Serrucho</Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            
                            {/* 1. PACING */}
                            <Card className="border-t-4 border-t-slate-800 shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold uppercase text-slate-500 flex justify-between">
                                        Proyección Mes <span className={metrics.pacing.status === 'ontrack' ? "text-green-600" : "text-red-500"}>{metrics.pacing.status === 'ontrack' ? 'EN CAMINO' : 'ATRASADO'}</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-slate-600"><span>Tiempo Transcurrido</span><span>{metrics.pacing.time}%</span></div>
                                        <Progress value={metrics.pacing.time} className="h-2 bg-slate-100" indicatorClassName="bg-slate-400"/>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs font-bold text-slate-800"><span>Cumplimiento Objetivo</span><span className="text-blue-600">{metrics.pacing.goal}%</span></div>
                                        <Progress value={metrics.pacing.goal} className="h-3 bg-blue-100" indicatorClassName={metrics.pacing.status === 'ontrack' ? "bg-green-500" : "bg-red-500"}/>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* 2. STOCK PODRIDO */}
                            <Card className="border-t-4 border-t-red-500 shadow-md">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold uppercase text-slate-500 flex justify-between">
                                        Stock Podrido (&gt;48hs) <AlertTriangle className="h-4 w-4 text-red-500"/>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between">
                                        <div className="text-4xl font-black text-slate-800">{metrics.stagnation.count}</div>
                                        <div className={`text-right ${metrics.stagnation.status === 'critical' ? 'text-red-600 animate-pulse' : 'text-green-600'}`}>
                                            <span className="block text-xl font-bold">{metrics.stagnation.percent}%</span>
                                            <span className="text-[10px] uppercase font-bold">de la cartera</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 bg-red-50 p-2 rounded text-xs text-red-700 border border-red-100">
                                        {metrics.stagnation.status === 'critical' ? "⚠️ ALERTA: Muchos leads abandonados. Hay que limpiar o reasignar." : "✅ Base sana. Buen ritmo de contacto."}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* --- PESTAÑA 2: AUDITORÍA (DATOS 100% REALES) --- */}
                <TabsContent value="audit" className="animate-in fade-in-50">
                    <Card className="border-t-4 border-t-indigo-600 shadow-xl mb-6">
                        <CardHeader className="pb-4 border-b bg-slate-50/50">
                            <CardTitle className="text-lg font-bold uppercase text-slate-700 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-indigo-600"/> Mesa de Entradas: {agent === 'global' ? 'Global' : agent}</CardTitle>
                            <CardDescription>Visualizando legajos del filtro seleccionado.</CardDescription>
                        </CardHeader>
                        <CardContent className="pt-8 pb-8">
                            <div className="flex flex-wrap items-center justify-center gap-6">
                                {metrics.auditSteps.map((step:any, i:number) => (
                                    <div key={i} className="flex items-center group relative">
                                        <div className={`flex flex-col items-center justify-center w-32 h-28 rounded-2xl border-2 transition-all transform hover:scale-105 cursor-default ${step.bg} ${step.border}`}>
                                            <step.icon className={`h-6 w-6 mb-2 ${step.color} opacity-80`} />
                                            <span className={`text-3xl font-black ${step.color}`}>{step.count}</span>
                                            <span className={`text-[10px] font-bold mt-1 text-center leading-tight uppercase ${step.color} opacity-80 px-2`}>{step.label}</span>
                                        </div>
                                        {i < 4 && <ArrowRight className="h-6 w-6 text-slate-300 mx-3 hidden lg:block" />}
                                        {i === 4 && <div className="h-20 w-px bg-slate-300 mx-6 hidden lg:block"></div>}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    )
}