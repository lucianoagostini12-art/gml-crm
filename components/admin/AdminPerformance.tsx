"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { 
    Trophy, TrendingUp, Target, DollarSign, Users, 
    BarChart3, Filter, Medal, Timer, CheckCircle2 
} from "lucide-react"
import { Progress } from "@/components/ui/progress"

// --- TIPOS Y UTILIDADES ---

type PerformanceMetrics = {
    totalLeads: number
    totalSales: number      // Total General (Vendido + Cumplidas)
    totalCompleted: number  // Solo Cumplidas (Calidad)
    totalQuotes: number     
    conversionRate: number  // % (Ventas / Datos)
    complianceRate: number  // % (Cumplidas / Ventas)
    leadsPerSale: number    
    averageTicket: number   
    salesVolume: number     
    avgDaysToClose: number  
}

type WeeklyBreakdown = {
    w1: number // Ventas de datos del 1-7
    w2: number // Ventas de datos del 8-14
    w3: number // Ventas de datos del 15-21
    w4: number // Ventas de datos del 22-Fin
}

type OriginStat = {
    source: string
    assigned: number
    sold: number
    conversion: number
}

// Limpiar precios
const parsePrice = (price: any): number => {
    if (!price) return 0
    if (typeof price === 'number') return price
    const clean = price.toString().replace(/[^0-9]/g, '')
    return parseInt(clean) || 0
}

// ✅ GENERADOR DE AÑOS INTELIGENTE (Eterno)
const getYearOptions = () => {
    const currentYear = new Date().getFullYear()
    // Devuelve año actual y el siguiente (ej: 2025, 2026)
    return [currentYear, currentYear + 1]
}

export function AdminPerformance() {
    const supabase = createClient()
    
    // --- ESTADOS ---
    const [sellers, setSellers] = useState<any[]>([])
    const [allLeads, setAllLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filtros
    const [selectedSellerId, setSelectedSellerId] = useState<string>("all")
    const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString())
    
    // Inicializar año con el actual real
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())

    // --- CARGA DE DATOS ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // 1. Vendedoras
            const { data: profiles } = await supabase
                .from('profiles')
                .select('*')
                .in('role', ['seller', 'gestor']) 
            
            if (profiles) setSellers(profiles)

            // 2. Leads (Optimizados)
            const { data: leads } = await supabase
                .from('leads')
                .select('id, agent_name, status, source, created_at, quoted_price, last_update')
            
            if (leads) setAllLeads(leads)
            
            setLoading(false)
        }
        fetchData()
    }, [])

    // --- MOTOR DE CÁLCULO GENERAL ---
    const { filteredLeads, activeSeller } = useMemo(() => {
        let filtered = allLeads

        // Filtro de Tiempo (Mes/Año)
        filtered = filtered.filter(l => {
            const date = new Date(l.created_at)
            const leadMonth = date.getMonth().toString()
            const leadYear = date.getFullYear().toString()
            return leadMonth === selectedMonth && leadYear === selectedYear
        })

        // Filtro Vendedora (Solo para las tarjetas de arriba)
        let sellerData = null
        if (selectedSellerId !== "all") {
            sellerData = sellers.find(s => s.id === selectedSellerId)
            if (sellerData) {
                filtered = filtered.filter(l => l.agent_name === sellerData.full_name)
            }
        }

        return { filteredLeads: filtered, activeSeller: sellerData }
    }, [allLeads, selectedSellerId, selectedMonth, selectedYear, sellers])

    // --- CÁLCULO DE MÉTRICAS ---
    const calculateStats = (leads: any[]): PerformanceMetrics => {
        const totalLeads = leads.length
        
        // Ventas Totales (Ingresado + Cumplida)
        const sales = leads.filter(l => ['vendido', 'cumplidas'].includes(l.status?.toLowerCase()))
        
        // Solo Cumplidas
        const completed = leads.filter(l => l.status?.toLowerCase() === 'cumplidas')
        
        const quotes = leads.filter(l => l.status === 'cotizacion' || (l.quoted_price && l.status !== 'vendido'))
        
        const totalSales = sales.length
        const totalCompleted = completed.length
        const totalQuotes = quotes.length
        
        const salesVolume = sales.reduce((acc, curr) => acc + parsePrice(curr.quoted_price), 0)
        const averageTicket = totalSales > 0 ? Math.round(salesVolume / totalSales) : 0
        
        const conversionRate = totalLeads > 0 ? parseFloat(((totalSales / totalLeads) * 100).toFixed(1)) : 0
        const complianceRate = totalSales > 0 ? parseFloat(((totalCompleted / totalSales) * 100).toFixed(1)) : 0
        const leadsPerSale = totalSales > 0 ? Math.round(totalLeads / totalSales) : 0

        // Velocidad de Venta
        let totalDays = 0
        if (totalSales > 0) {
            totalDays = sales.reduce((acc, curr) => {
                const start = new Date(curr.created_at).getTime()
                const end = new Date(curr.last_update).getTime()
                const days = (end - start) / (1000 * 3600 * 24)
                return acc + (days > 0 ? days : 0)
            }, 0)
        }
        const avgDaysToClose = totalSales > 0 ? Math.round(totalDays / totalSales) : 0

        return {
            totalLeads, totalSales, totalCompleted, totalQuotes,
            conversionRate, complianceRate, leadsPerSale,
            averageTicket, salesVolume, avgDaysToClose
        }
    }

    // --- CÁLCULO SEMANAL (LÓGICA MATEMÁTICA 4 BLOQUES) ---
    const calculateWeeklyBreakdown = (leads: any[]): WeeklyBreakdown => {
        const breakdown = { w1: 0, w2: 0, w3: 0, w4: 0 }
        
        leads.forEach(l => {
            // Solo contamos VENTAS (Vendido o Cumplida)
            if (!['vendido', 'cumplidas'].includes(l.status?.toLowerCase())) return

            const day = new Date(l.created_at).getDate()
            
            // Regla de Oro: División 1-7, 8-14, 15-21, 22-Fin
            if (day <= 7) breakdown.w1++
            else if (day <= 14) breakdown.w2++
            else if (day <= 21) breakdown.w3++
            else breakdown.w4++
        })
        
        return breakdown
    }

    const currentStats = calculateStats(filteredLeads)

    // --- ORIGEN ---
    const originStats: OriginStat[] = useMemo(() => {
        const groups: Record<string, { total: number, sold: number }> = {}
        
        filteredLeads.forEach(l => {
            const src = l.source || "Desconocido"
            if (!groups[src]) groups[src] = { total: 0, sold: 0 }
            groups[src].total += 1
            if (['vendido', 'cumplidas'].includes(l.status?.toLowerCase())) {
                groups[src].sold += 1
            }
        })

        return Object.entries(groups)
            .map(([source, data]) => ({
                source,
                assigned: data.total,
                sold: data.sold,
                conversion: data.total > 0 ? (data.sold / data.total) * 100 : 0
            }))
            .sort((a, b) => b.sold - a.sold)
    }, [filteredLeads])

    // --- MATRIZ SEMANAL (GLOBAL COMPARISON) ---
    const globalMatrix = useMemo(() => {
        return sellers.map(seller => {
            // Filtramos leads de este vendedor en el MES seleccionado
            const myLeads = allLeads.filter(l => {
                const date = new Date(l.created_at)
                return date.getMonth().toString() === selectedMonth && 
                       date.getFullYear().toString() === selectedYear &&
                       l.agent_name === seller.full_name
            })
            
            return { 
                ...seller, 
                stats: calculateStats(myLeads),
                weekly: calculateWeeklyBreakdown(myLeads) // ✅ Lógica Semanal Agregada
            }
        }).sort((a, b) => b.stats.totalSales - a.stats.totalSales)
    }, [allLeads, sellers, selectedMonth, selectedYear])

    const getConversionBadge = (rate: number) => {
        if (rate >= 15) return <Badge className="bg-purple-100 text-purple-700 border-0">🔥 On Fire</Badge>
        if (rate >= 10) return <Badge className="bg-green-100 text-green-700 border-0">✅ Sólido</Badge>
        if (rate >= 5) return <Badge className="bg-blue-50 text-blue-700 border-0">⚖️ Normal</Badge>
        return <Badge className="bg-red-50 text-red-700 border-0">🐢 En Riesgo</Badge>
    }

    if (loading) return <div className="p-10 text-center text-slate-400 animate-pulse">Analizando rendimiento...</div>

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-blue-600"/> Panel de Rendimiento
                    </h2>
                    <p className="text-slate-500 text-sm">Métricas de venta, cumplimiento y eficiencia.</p>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                    <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
                        <SelectTrigger className="w-[200px] font-bold"><SelectValue placeholder="Seleccionar Vendedora"/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">🏢 Todo el Equipo</SelectItem>
                            {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>

                    {/* ✅ AÑO INTELIGENTE */}
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[90px]"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {getYearOptions().map(year => (
                                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[130px]"><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                                <SelectItem key={i} value={i.toString()}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* HERO SECTION */}
            {selectedSellerId !== "all" && activeSeller ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    
                    {/* PERFIL */}
                    <Card className="md:col-span-1 border-t-4 border-t-blue-600 shadow-md">
                        <CardContent className="pt-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <Avatar className="h-32 w-32 border-4 border-slate-100 shadow-xl">
                                    <AvatarImage src={activeSeller.avatar_url} className="object-cover" />
                                    <AvatarFallback className="text-3xl font-black bg-slate-100 text-slate-400">{activeSeller.full_name[0]}</AvatarFallback>
                                </Avatar>
                                <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-sm">
                                    {getConversionBadge(currentStats.conversionRate)}
                                </div>
                            </div>
                            <h3 className="text-xl font-black text-slate-800">{activeSeller.full_name}</h3>
                            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-4">Especialista en Ventas</p>
                            
                            <div className="w-full grid grid-cols-2 gap-2 mt-2">
                                <div className="bg-slate-50 p-2 rounded border text-xs">
                                    <span className="block font-bold text-slate-400">EMAIL</span>
                                    <span className="truncate block" title={activeSeller.email}>{activeSeller.email}</span>
                                </div>
                                <div className="bg-slate-50 p-2 rounded border text-xs">
                                    <span className="block font-bold text-slate-400">ROL</span>
                                    <span>{activeSeller.role || 'Seller'}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* METRICS GRID */}
                    <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                        
                        <Card className="shadow-sm hover:shadow-md transition-all md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0">
                            <CardContent className="p-6 flex justify-between items-center h-full">
                                <div>
                                    <p className="text-blue-200 font-bold uppercase text-xs mb-1">Ventas</p>
                                    <div className="text-5xl font-black">{currentStats.totalSales}</div>
                                    <p className="text-xs text-blue-200 mt-2">Operaciones cerradas</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-blue-200 font-bold uppercase text-xs mb-1">Cumplidas</p>
                                    <div className="text-4xl font-black text-green-300 flex items-center justify-end gap-2">
                                        <CheckCircle2 className="h-8 w-8"/> {currentStats.totalCompleted}
                                    </div>
                                    <p className="text-xs text-blue-200 mt-2">Aprobadas por ADM</p>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2"><Target className="h-4 w-4 text-blue-500"/> Efectividad</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-blue-600">{currentStats.conversionRate}%</div>
                                <Progress value={currentStats.conversionRate} className="h-1.5 mt-2 bg-blue-100" />
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2"><Users className="h-4 w-4 text-purple-500"/> Esfuerzo</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-slate-800">{currentStats.leadsPerSale}</div>
                                <p className="text-xs text-slate-500 mt-1">Datos x Venta</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-green-700 uppercase tracking-wider flex gap-2"><DollarSign className="h-4 w-4"/> Ticket Promedio</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-green-800">$ {currentStats.averageTicket.toLocaleString()}</div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2"><Timer className="h-4 w-4 text-orange-500"/> Velocidad</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-800">{currentStats.avgDaysToClose} <span className="text-sm text-slate-400 font-medium">días</span></div>
                                <p className="text-xs text-slate-500 mt-1">Tiempo de cierre</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2"><BarChart3 className="h-4 w-4 text-orange-500"/> Cotizando</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-800">{currentStats.totalQuotes}</div>
                                <p className="text-xs text-slate-500 mt-1">En proceso</p>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm hover:shadow-md transition-all">
                            <CardHeader className="pb-2"><CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2"><Filter className="h-4 w-4 text-slate-500"/> Asignados</CardTitle></CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black text-slate-800">{currentStats.totalLeads}</div>
                                <p className="text-xs text-slate-500 mt-1">Total periodo</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* ANÁLISIS POR ORIGEN */}
                    <Card className="md:col-span-4 shadow-md">
                        <CardHeader><CardTitle className="text-lg">Rendimiento por Origen de Datos</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {originStats.map((origin) => (
                                    <div key={origin.source} className="border p-4 rounded-xl hover:bg-slate-50 transition-colors">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="font-bold text-sm text-slate-700 truncate">{origin.source}</span>
                                            {origin.conversion >= 10 && <Badge className="bg-green-100 text-green-700 border-0 h-5 px-1">⭐</Badge>}
                                        </div>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-2xl font-black text-slate-800">{origin.sold}<span className="text-xs text-slate-400 font-medium">/{origin.assigned}</span></span>
                                            <span className={`text-xs font-bold ${origin.conversion > 10 ? 'text-green-600' : 'text-slate-500'}`}>
                                                {origin.conversion.toFixed(1)}% Efec.
                                            </span>
                                        </div>
                                        <Progress value={origin.conversion} max={20} className={`h-1.5 ${origin.conversion > 10 ? 'bg-green-100 [&>div]:bg-green-500' : 'bg-slate-100'}`} />
                                    </div>
                                ))}
                                {originStats.length === 0 && <div className="col-span-full text-center text-slate-400 py-4">Sin datos para analizar este mes.</div>}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            ) : (
                // VISTA GLOBAL
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
                    <Card className="md:col-span-3 bg-blue-600 text-white shadow-xl border-0 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-10 opacity-10"><Trophy size={150}/></div>
                        <CardContent className="p-8 relative z-10">
                            <h3 className="text-3xl font-black mb-2">Resumen Global del Equipo</h3>
                            <p className="text-blue-100 mb-6 max-w-xl">
                                Rendimiento consolidado de todas las vendedoras.
                                Selecciona una vendedora arriba para ver su detalle profundo.
                            </p>
                            <div className="flex gap-12">
                                <div>
                                    <span className="block text-5xl font-black">{currentStats.totalSales}</span>
                                    <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Ventas Totales</span>
                                </div>
                                <div>
                                    <span className="block text-5xl font-black text-green-300">{currentStats.totalCompleted}</span>
                                    <span className="text-sm font-bold text-green-200 uppercase tracking-widest">Cumplidas (OK)</span>
                                </div>
                                <div>
                                    <span className="block text-5xl font-black">{currentStats.conversionRate}%</span>
                                    <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Efectividad Media</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* ✅ MATRIZ SEMANAL DE DESEMPEÑO */}
            <Card className="shadow-lg border-t-4 border-t-slate-800">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Medal className="h-5 w-5 text-yellow-500"/> Matriz Semanal de Desempeño
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50 hover:bg-slate-50">
                                <TableHead className="w-[50px] text-center">#</TableHead>
                                <TableHead>Vendedora</TableHead>
                                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 1</TableHead>
                                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 2</TableHead>
                                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 3</TableHead>
                                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 4</TableHead>
                                <TableHead className="text-right font-black">TOTAL</TableHead>
                                <TableHead className="text-right text-green-600 font-black">CUMPLIDAS</TableHead>
                                <TableHead className="text-right">EFECTIVIDAD</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {globalMatrix.map((seller, index) => (
                                <TableRow key={seller.id} className={seller.id === selectedSellerId ? "bg-blue-50 hover:bg-blue-100" : ""}>
                                    <TableCell className="text-center font-bold text-slate-500">
                                        {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={seller.avatar_url} />
                                                <AvatarFallback>{seller.full_name[0]}</AvatarFallback>
                                            </Avatar>
                                            <span className="font-bold text-slate-700">{seller.full_name}</span>
                                        </div>
                                    </TableCell>
                                    
                                    {/* COLUMNAS SEMANALES */}
                                    <TableCell className="text-center text-slate-500">{seller.weekly.w1 || '-'}</TableCell>
                                    <TableCell className="text-center text-slate-500">{seller.weekly.w2 || '-'}</TableCell>
                                    <TableCell className="text-center text-slate-500">{seller.weekly.w3 || '-'}</TableCell>
                                    <TableCell className="text-center text-slate-500">{seller.weekly.w4 || '-'}</TableCell>
                                    
                                    <TableCell className="text-right font-black text-base">{seller.stats.totalSales}</TableCell>
                                    <TableCell className="text-right font-black text-green-600 text-base">{seller.stats.totalCompleted}</TableCell>
                                    
                                    <TableCell className="text-right font-medium">
                                        <span className={seller.stats.conversionRate > 10 ? "text-green-600 font-bold" : ""}>
                                            {seller.stats.conversionRate}%
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}