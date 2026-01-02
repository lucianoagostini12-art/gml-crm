"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, TrendingUp, AlertCircle, Target, Users, Trophy, AlertTriangle, Clock, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"

// COLORES PARA GRAFICOS
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

// Props extendidas para aceptar función de filtro del padre
interface OpsMetricsProps {
    operations: any[];
    onApplyFilter?: (type: string, value: string) => void;
}

export function OpsMetrics({ operations, onApplyFilter }: OpsMetricsProps) {
    
    // --- 1. PROCESAMIENTO DE DATOS EXISTENTE ---
    
    const totalOps = operations.length
    const cumplidas = operations.filter((o:any) => o.status === 'cumplidas').length
    const tasaExito = totalOps > 0 ? ((cumplidas / totalOps) * 100).toFixed(1) : 0

    // A. DATOS POR ORIGEN
    const dataOrigen = [
        { name: 'Google Ads', ingresado: 45, cumplido: 20 },
        { name: 'Meta Ads', ingresado: 32, cumplido: 10 },
        { name: 'Referidos', ingresado: 15, cumplido: 12 },
        { name: 'Base Propia', ingresado: 24, cumplido: 8 },
        { name: 'Llamador', ingresado: 10, cumplido: 2 },
    ]

    // B. DATOS POR PREPAGA
    const prepagasCount: any = {}
    operations.forEach((op:any) => {
        const p = op.prepaga || 'Otros'
        prepagasCount[p] = (prepagasCount[p] || 0) + 1
    })
    const dataPrepagas = Object.keys(prepagasCount).map(key => ({
        name: key, value: prepagasCount[key]
    })).sort((a:any,b:any) => b.value - a.value)

    // C. TOP PLANES
    const topPlanes = [
        { prepaga: 'Sancor', plan: '3000', ventas: 24, efectividad: 85 },
        { prepaga: 'Swiss', plan: 'SMG20', ventas: 18, efectividad: 70 },
        { prepaga: 'Galeno', plan: '220', ventas: 15, efectividad: 90 },
        { prepaga: 'Prevencion', plan: 'A2', ventas: 12, efectividad: 60 },
        { prepaga: 'Sancor', plan: '1000', ventas: 10, efectividad: 50 },
    ]

    // D. CUELLO DE BOTELLA
    const activeStatuses = ['ingresado', 'precarga', 'medicas', 'legajo', 'demoras']
    const bottleneckData = activeStatuses.map(status => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        cantidad: operations.filter((o:any) => o.status === status).length
    }))

    // --- 2. NUEVOS DATOS CALCULADOS (SECCION PREMIUM) ---

    // E. RANKING VENDEDORES (Calculado real sobre operations)
    // Extraemos vendedores únicos
    const sellers = Array.from(new Set(operations.map((o:any) => o.seller)))
    const sellerData = sellers.map(seller => {
        const ops = operations.filter((o:any) => o.seller === seller)
        const total = ops.length
        const ok = ops.filter((o:any) => o.status === 'cumplidas').length
        const rate = total > 0 ? ((ok / total) * 100).toFixed(0) : 0
        return { name: seller, total, ok, rate }
    }).sort((a:any, b:any) => b.ok - a.ok) // Ordenar por ventas OK

    // F. AGING DE STOCK (Simulado para el ejemplo visual, idealmente usa fechas reales)
    const dataAging = [
        { name: '< 7 días', cantidad: 35, color: '#10b981' }, // Verde
        { name: '7-15 días', cantidad: 12, color: '#f59e0b' }, // Amarillo
        { name: '15-30 días', cantidad: 8, color: '#f97316' }, // Naranja
        { name: '> 30 días', cantidad: 4, color: '#ef4444' }, // Rojo
    ]

    // Helper para clicks
    const handleFilter = (type: string, val: string) => {
        if(onApplyFilter) onApplyFilter(type, val)
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            
            {/* HEADER CON FILTRO GLOBAL */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-800">Métricas Operativas</h2>
                    <p className="text-xs text-slate-500">Visión 360° del negocio.</p>
                </div>
                <Button variant="outline" size="sm" className="gap-2 text-xs font-bold border-slate-300 text-slate-600">
                    <Filter size={14}/> Filtrar fecha
                </Button>
            </div>

            {/* --- KPI CARDS EXISTENTES --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card onClick={() => handleFilter('status', 'all')} className="bg-white border-slate-200 shadow-sm cursor-pointer hover:border-blue-300 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Total Ingresos</CardTitle>
                        <Users className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{totalOps}</div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center">
                            <ArrowUpRight className="h-3 w-3 text-green-500 mr-1"/> +12% vs mes anterior
                        </p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Efectividad Global</CardTitle>
                        <Target className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{tasaExito}%</div>
                        <p className="text-xs text-slate-400 mt-1">Ratio Ingreso/Cierre</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">En Proceso</CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{operations.filter((o:any) => !['cumplidas','rechazado'].includes(o.status)).length}</div>
                        <p className="text-xs text-slate-400 mt-1">Operaciones activas</p>
                    </CardContent>
                </Card>
                <Card onClick={() => handleFilter('status', 'rechazado')} className="bg-white border-slate-200 shadow-sm cursor-pointer hover:border-red-300 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest">Rechazos</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{operations.filter((o:any) => o.status === 'rechazado').length}</div>
                        <p className="text-xs text-slate-400 mt-1">Clientes caídos</p>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 1: ORIGENES Y PREPAGAS (EXISTENTE) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800">Performance por Origen</CardTitle>
                        <CardDescription>Volumen de ingreso vs. Cierres exitosos por canal.</CardDescription>
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
                        <CardTitle className="text-lg font-black text-slate-800">Mix de Prepagas</CardTitle>
                        <CardDescription>Distribución del volumen de ventas total.</CardDescription>
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

            {/* --- SECCION 2: PLANES Y CUELLOS DE BOTELLA (EXISTENTE) --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800">Top Planes Vendidos</CardTitle>
                        <CardDescription>Los 5 productos estrella y su tasa de cumplimiento.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {topPlanes.map((item, i) => (
                                <div key={i} className="group cursor-pointer" onClick={() => handleFilter('plan', item.plan)}>
                                    <div className="flex justify-between items-end mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-slate-500 font-bold border-slate-200">{i+1}</Badge>
                                            <span className="font-bold text-slate-700 text-sm">{item.prepaga} <span className="text-blue-600">{item.plan}</span></span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-black text-slate-800">{item.ventas} ventas</span>
                                            <span className="block text-[10px] text-green-600 font-bold">{item.efectividad}% efectividad</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-slate-800" style={{width: `${(item.ventas / 30) * 100}%`}}></div>
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
                        <CardTitle className="text-lg font-black text-slate-800">Cuellos de Botella</CardTitle>
                        <CardDescription>Operaciones activas trabadas por etapa.</CardDescription>
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
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="mt-4 p-3 bg-white rounded-lg border border-slate-200">
                            <p className="text-xs text-slate-500 leading-relaxed">
                                <span className="font-bold text-indigo-600">Insight:</span> La etapa de <strong>Médicas</strong> acumula el mayor volumen. Revisar tiempos de auditoría.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 3: NUEVAS METRICAS AGREGADAS (RANKING + AGING) --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 5. RANKING DE VENDEDORES */}
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2"><Trophy className="text-yellow-500" size={20}/> Top Vendedores</CardTitle>
                        <CardDescription>Ranking por volumen y tasa de cierre efectiva.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
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
                                        <p className={`text-[10px] font-bold ${parseInt(s.rate) > 50 ? 'text-green-600' : 'text-orange-500'}`}>{s.rate}% Cierre</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* 6. AGING & VELOCIDAD (Combinado) */}
                <div className="flex flex-col gap-6">
                    {/* AGING CHART */}
                    <Card className="shadow-sm border-slate-200 flex-1">
                        <CardHeader>
                            <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2"><AlertTriangle className="text-orange-500" size={20}/> Aging de Stock</CardTitle>
                            <CardDescription>Antigüedad de operaciones sin cerrar.</CardDescription>
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
                            <div className="text-center text-[10px] text-slate-400 mt-2">
                                Casos &gt; 30 días requieren intervención urgente.
                            </div>
                        </CardContent>
                    </Card>

                    {/* VELOCIDAD CARD */}
                    <Card className="shadow-sm border-slate-200 bg-blue-50 border-blue-100">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">Velocidad de Cierre</p>
                                <h3 className="text-3xl font-black text-blue-900">4.2 días</h3>
                                <p className="text-[10px] text-blue-400">Promedio desde ingreso a éxito</p>
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