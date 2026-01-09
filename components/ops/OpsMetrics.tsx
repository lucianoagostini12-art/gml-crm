"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ArrowUpRight, TrendingUp, AlertCircle, Target, Users, Trophy, AlertTriangle, Clock, Filter, X, Calendar, RefreshCw, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

// COLORES PARA GRAFICOS
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// --- COMPONENTE INTERNO DE TOOLTIP (SIN DEPENDENCIAS EXTERNAS) ---
// Esto soluciona el error "Module not found"
const InfoTooltip = ({ text }: { text: string }) => {
    const [isVisible, setIsVisible] = useState(false)
    return (
        <div className="relative inline-flex items-center ml-1.5 align-middle group">
            <HelpCircle 
                className="h-3.5 w-3.5 text-slate-400 cursor-help hover:text-blue-500 transition-colors" 
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            />
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] leading-tight rounded shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                    {text}
                    {/* Flechita abajo del tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
    )
}

interface OpsMetricsProps {
    onApplyFilter?: (type: string, value: string) => void;
}

export function OpsMetrics({ onApplyFilter }: OpsMetricsProps) {
    const supabase = createClient()

    // --- ESTADO DE DATOS Y FILTRO ---
    const [operations, setOperations] = useState<any[]>([]) 
    const [loading, setLoading] = useState(true)
    
    // Iniciar con el mes actual por defecto para no mostrar "historia antigua"
    const [dateRange, setDateRange] = useState({ 
        start: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], // Primer día del mes
        end: new Date().toISOString().split('T')[0] // Hoy
    })
    
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    // --- CONEXIÓN A SUPABASE ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // Traemos datos.
            const { data, error } = await supabase
                .from('leads')
                .select('*')
            
            if (data) {
                const mappedData = data.map((l: any) => ({
                    id: l.id,
                    entryDate: l.created_at,        // Fecha ingreso (string ISO)
                    status: l.status,               
                    origen: l.source,               
                    seller: l.agent_name,           
                    lastUpdate: l.last_update,
                    prepaga: l.prepaga || l.quoted_prepaga || 'Sin Dato', 
                    plan: l.plan || l.quoted_plan || 'General' 
                }))
                setOperations(mappedData)
            }
            setLoading(false)
        }

        fetchData()
    }, [])

    // --- 1. PROCESAMIENTO DE DATOS (LÓGICA CORREGIDA) ---
    const { 
        filteredCount, 
        totalOps, 
        cumplidas, 
        tasaExito, 
        dataOrigen, 
        dataPrepagas, 
        topPlanes, 
        bottleneckData, 
        sellerData, 
        dataAging, 
        velocidadPromedio,
        rejectedCount
    } = useMemo(() => {
        
        // 1. FILTRO DE FECHAS ROBUSTO
        let filteredOps = operations
        
        if (dateRange.start) {
            // Convertimos a timestamp (inicio del día 00:00:00)
            // Agregamos "T00:00:00" para asegurar que la comparación sea correcta
            const startDateStr = dateRange.start.includes("T") ? dateRange.start : `${dateRange.start}T00:00:00`
            const startDate = new Date(startDateStr).getTime()
            
            filteredOps = filteredOps.filter(o => new Date(o.entryDate).getTime() >= startDate)
        }
        
        if (dateRange.end) {
            // Convertimos a timestamp (fin del día 23:59:59)
            const endDateStr = dateRange.end.includes("T") ? dateRange.end : `${dateRange.end}T23:59:59`
            const endDate = new Date(endDateStr).getTime()
            
            filteredOps = filteredOps.filter(o => new Date(o.entryDate).getTime() <= endDate)
        }

        // 2. CALCULAR MÉTRICAS
        const total = filteredOps.length
        
        // Filtrar estados finales correctos
        const closed = filteredOps.filter((o:any) => o.status === 'cumplidas').length
        const rejected = filteredOps.filter((o:any) => o.status === 'rechazado').length 
        
        const rate = total > 0 ? ((closed / total) * 100).toFixed(1) : "0"

        // A. ORIGEN
        const originMap: Record<string, {name: string, ingresado: number, cumplido: number}> = {}
        filteredOps.forEach((op: any) => {
            const source = op.origen || "Desconocido"
            if (!originMap[source]) originMap[source] = { name: source, ingresado: 0, cumplido: 0 }
            originMap[source].ingresado += 1
            if (op.status === 'cumplidas') originMap[source].cumplido += 1
        })
        const _dataOrigen = Object.values(originMap).sort((a,b) => b.ingresado - a.ingresado).slice(0, 5)

        // B. PREPAGA
        const prepagasCount: any = {}
        filteredOps.forEach((op:any) => {
            if (op.status !== 'rechazado') { 
                const p = op.prepaga || 'Otros'
                prepagasCount[p] = (prepagasCount[p] || 0) + 1
            }
        })
        const _dataPrepagas = Object.keys(prepagasCount).map(key => ({
            name: key, value: prepagasCount[key]
        })).sort((a:any,b:any) => b.value - a.value)

        // C. TOP PLANES
        const planMap: Record<string, { prepaga: string, plan: string, ventas: number, ok: number }> = {}
        filteredOps.forEach((op: any) => {
            const key = `${op.prepaga}-${op.plan}`
            if(!planMap[key]) planMap[key] = { prepaga: op.prepaga || '?', plan: op.plan || '?', ventas: 0, ok: 0 }
            planMap[key].ventas += 1
            if(op.status === 'cumplidas') planMap[key].ok += 1
        })
        const _topPlanes = Object.values(planMap)
            .filter(p => p.ventas > 0)
            .map(p => ({ ...p, efectividad: Math.round((p.ok / p.ventas) * 100) }))
            .sort((a,b) => b.ok - a.ok)
            .slice(0, 5)

        // D. CUELLO DE BOTELLA
        const activeStatuses = ['ingresado', 'precarga', 'medicas', 'legajo', 'demoras']
        const _bottleneckData = activeStatuses.map(status => ({
            name: status.charAt(0).toUpperCase() + status.slice(1),
            cantidad: filteredOps.filter((o:any) => o.status === status).length
        }))

        // E. RANKING VENDEDORES
        const sellers = Array.from(new Set(filteredOps.map((o:any) => o.seller).filter(Boolean)))
        const _sellerData = sellers.map(seller => {
            const ops = filteredOps.filter((o:any) => o.seller === seller)
            const totalS = ops.length
            const okS = ops.filter((o:any) => o.status === 'cumplidas').length
            const rateS = totalS > 0 ? ((okS / totalS) * 100).toFixed(0) : "0"
            return { name: seller || "Sin Asignar", total: totalS, ok: okS, rate: rateS }
        }).sort((a:any, b:any) => b.ok - a.ok).slice(0, 5)

        // F. AGING DE STOCK
        const now = new Date()
        const agingBuckets = { '< 7 días': 0, '7-15 días': 0, '15-30 días': 0, '> 30 días': 0 }
        
        filteredOps.filter((o:any) => !['cumplidas','rechazado', 'vendido'].includes(o.status)).forEach((op:any) => {
            const entry = new Date(op.entryDate)
            const diffTime = now.getTime() - entry.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            
            if (diffDays < 7) agingBuckets['< 7 días']++
            else if (diffDays <= 15) agingBuckets['7-15 días']++
            else if (diffDays <= 30) agingBuckets['15-30 días']++
            else agingBuckets['> 30 días']++
        })

        const _dataAging = [
            { name: '< 7 días', cantidad: agingBuckets['< 7 días'], color: '#10b981' },
            { name: '7-15 días', cantidad: agingBuckets['7-15 días'], color: '#f59e0b' },
            { name: '15-30 días', cantidad: agingBuckets['15-30 días'], color: '#f97316' },
            { name: '> 30 días', cantidad: agingBuckets['> 30 días'], color: '#ef4444' },
        ]

        // G. VELOCIDAD PROMEDIO
        let totalDays = 0
        const closedOps = filteredOps.filter((o:any) => o.status === 'cumplidas')
        
        closedOps.forEach((op:any) => {
            const start = new Date(op.entryDate)
            const end = op.lastUpdate ? new Date(op.lastUpdate) : new Date()
            const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
            totalDays += diff
        })
        const _velocidad = closedOps.length > 0 ? (totalDays / closedOps.length).toFixed(1) : "0"

        return {
            filteredCount: total,
            totalOps: total,
            cumplidas: closed,
            tasaExito: rate,
            dataOrigen: _dataOrigen,
            dataPrepagas: _dataPrepagas,
            topPlanes: _topPlanes,
            bottleneckData: _bottleneckData,
            sellerData: _sellerData,
            dataAging: _dataAging,
            velocidadPromedio: _velocidad,
            rejectedCount: rejected
        }
    }, [operations, dateRange]) 

    const handleFilter = (type: string, val: string) => {
        if(onApplyFilter) onApplyFilter(type, val)
    }

    const hasActiveFilter = dateRange.start || dateRange.end

    if (loading && operations.length === 0) {
        return <div className="h-96 flex items-center justify-center text-slate-400 gap-2"><RefreshCw className="animate-spin h-5 w-5"/> Cargando Operaciones...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            
            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center">
                        Métricas Operativas 
                        <InfoTooltip text="Panel de control para analizar el rendimiento del equipo y el flujo de ventas." />
                    </h2>
                    <p className="text-xs text-slate-500">
                        {hasActiveFilter 
                            ? `Analizando ${filteredCount} operaciones del ${new Date(dateRange.start).toLocaleDateString()} al ${new Date(dateRange.end).toLocaleDateString()}.` 
                            : `Mostrando todo el historial (${operations.length} totales).`}
                    </p>
                </div>
                
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant={hasActiveFilter ? "secondary" : "outline"} size="sm" className={`gap-2 text-xs font-bold border-slate-300 ${hasActiveFilter ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-600'}`}>
                            <Filter size={14}/> {hasActiveFilter ? 'Filtro Activo' : 'Filtrar Fecha'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-4" align="end">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm flex items-center gap-2"><Calendar size={16}/> Rango de Fechas</h4>
                                {hasActiveFilter && (
                                    <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500 px-2" onClick={() => setDateRange({start:"", end:""})}>
                                        <X size={12} className="mr-1"/> Borrar
                                    </Button>
                                )}
                            </div>
                            <div className="grid gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Desde</Label>
                                    <Input type="date" className="h-8 text-xs" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500 uppercase">Hasta</Label>
                                    <Input type="date" className="h-8 text-xs" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} />
                                </div>
                            </div>
                            <Button className="w-full h-8 text-xs bg-slate-900 text-white" onClick={() => setIsFilterOpen(false)}>Aplicar</Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            {/* --- KPI CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm hover:border-blue-300 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">
                            Total Ingresos <InfoTooltip text="Cantidad total de ventas ingresadas en el período seleccionado."/>
                        </CardTitle>
                        <Users className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{totalOps}</div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center">
                            <ArrowUpRight className="h-3 w-3 text-green-500 mr-1"/> En período seleccionado
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">
                            Efectividad <InfoTooltip text="Porcentaje de ventas que llegaron al estado CUMPLIDA sobre el total ingresado."/>
                        </CardTitle>
                        <Target className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{tasaExito}%</div>
                        <p className="text-xs text-slate-400 mt-1">Ratio Cierre Global</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">
                            En Proceso <InfoTooltip text="Ventas que están activas en el flujo (ni rechazadas ni cumplidas) actualmente."/>
                        </CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{bottleneckData.reduce((acc, curr) => acc + curr.cantidad, 0)}</div>
                        <p className="text-xs text-slate-400 mt-1">Operaciones activas</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm hover:border-red-300 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">
                            Rechazos <InfoTooltip text="Cantidad de ventas que fueron marcadas como RECHAZADO en este período."/>
                        </CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{rejectedCount}</div>
                        <p className="text-xs text-slate-400 mt-1">Ventas caídas</p>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 1: ORIGENES Y PREPAGAS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Performance por Origen <InfoTooltip text="Muestra de dónde vienen los datos y cuántos de cada fuente se terminan cerrando."/>
                        </CardTitle>
                        <CardDescription>Volumen de ingreso vs. Cierres exitosos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dataOrigen} margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                    <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} cursor={{fill: '#f1f5f9'}} />
                                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '12px'}}/>
                                    <Bar dataKey="ingresado" name="Ingresado" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="cumplido" name="Venta Cerrada" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Mix de Prepagas <InfoTooltip text="Participación de cada prepaga en el total de ventas ingresadas (excluye rechazados)."/>
                        </CardTitle>
                        <CardDescription>Distribución del volumen de ventas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={dataPrepagas} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" onClick={(data) => handleFilter('prepaga', data.name)} className="cursor-pointer">
                                        {dataPrepagas.map((entry:any, index:any) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', fontWeight: 'bold', color: '#475569'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 2: PLANES Y CUELLOS DE BOTELLA --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Top Planes <InfoTooltip text="Los planes que más ventas CUMPLIDAS generaron. Ordenados por cantidad de cierres, no por ingresos."/>
                        </CardTitle>
                        <CardDescription>Ranking de efectividad por producto.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {topPlanes.length === 0 && <p className="text-xs text-slate-400 italic">No hay ventas registradas en este período.</p>}
                            {topPlanes.map((item, i) => (
                                <div key={i} className="group cursor-pointer" onClick={() => handleFilter('plan', item.plan)}>
                                    <div className="flex justify-between items-end mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-slate-500 font-bold border-slate-200">{i+1}</Badge>
                                            <span className="font-bold text-slate-700 text-sm">{item.prepaga} <span className="text-blue-600">{item.plan}</span></span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-black text-slate-800">{item.ventas} ingresos</span>
                                            <span className="block text-[10px] text-green-600 font-bold">{item.efectividad}% efectividad</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-slate-800" style={{width: `${(item.ventas / (topPlanes[0]?.ventas || 1)) * 100}%`}}></div>
                                    </div>
                                    <div className="mt-0.5 h-1 w-full bg-transparent rounded-full overflow-hidden flex">
                                         <div className="h-full bg-green-500 opacity-50" style={{width: `${item.efectividad}%`}}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 bg-slate-50/50">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Cuellos de Botella <InfoTooltip text="Muestra en qué etapa se están trabando las ventas. Ideal para detectar si faltan operadores en Médicas o Legajo."/>
                        </CardTitle>
                        <CardDescription>Stock actual por etapa.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full mt-4">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bottleneckData} layout="vertical" margin={{top: 0, right: 30, left: 20, bottom: 5}}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                    <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px'}}/>
                                    <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 4, 4, 0] as any} barSize={24} background={{ fill: 'transparent' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 3: RANKING + AGING --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* RANKING */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Trophy className="text-yellow-500" size={20}/> Top Vendedores <InfoTooltip text="Ranking de vendedores basado en cantidad de ventas CERRADAS, no solo ingresadas."/>
                        </CardTitle>
                        <CardDescription>Ranking en el período seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {sellerData.length === 0 && <p className="text-xs text-slate-400 italic">No hay ventas en este rango.</p>}
                            {sellerData.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer" onClick={() => handleFilter('seller', s.name)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs ${i===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {i+1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{s.name}</p>
                                            <p className="text-[10px] text-slate-400">{s.total} Ingresos</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-800">{s.ok} OK</p>
                                        <p className={`text-[10px] font-bold ${Number(s.rate) > 50 ? 'text-green-600' : 'text-orange-500'}`}>{s.rate}% Cierre</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* AGING & VELOCIDAD */}
                <div className="flex flex-col gap-6">
                    <Card className="shadow-sm border-slate-200 flex-1">
                        <CardHeader>
                            <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="text-orange-500" size={20}/> Aging de Stock <InfoTooltip text="Muestra hace cuánto tiempo están las ventas 'estancadas' en el sistema. Más de 30 días es alerta roja."/>
                            </CardTitle>
                            <CardDescription>Antigüedad de casos activos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dataAging} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                        <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} cursor={{fill: 'transparent'}}/>
                                        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} barSize={40}>
                                            {dataAging.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200 bg-blue-50 border-blue-100">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1 flex items-center">
                                    Velocidad de Cierre <InfoTooltip text="Promedio de días que tarda una venta desde que entra hasta que sale cumplida."/>
                                </p>
                                <h3 className="text-3xl font-black text-blue-900">{velocidadPromedio} días</h3>
                                <p className="text-[10px] text-blue-400">Tiempo de ciclo promedio</p>
                            </div>
                            <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-blue-700"/>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}