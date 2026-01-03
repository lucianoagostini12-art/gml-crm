"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Sprout, Target, ThermometerSun, AlertOctagon, TrendingUp, Send, Trash, Filter, RefreshCw, Calendar, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function AdminPipelineHealth() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    
    // --- FILTROS PARA EL RATIO DE VENTAS ---
    const currentYear = new Date().getFullYear()
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedYear, setSelectedYear] = useState(currentYear.toString())
    const years = Array.from({ length: (currentYear + 1) - 2024 + 1 }, (_, i) => (2024 + i).toString())

    // ESTADOS
    const [stats, setStats] = useState({
        freshZombies: 0,
        warnedZombies: 0,
        totalZombies: 0,
        coverage: 0,
        agentsRatio: [] as any[]
    })

    const fetchData = async () => {
        setLoading(true)
        
        // 1. TRAER CARTERA ACTIVA (SNAPSHOT ACTUAL)
        // Traemos TODO lo que no esté muerto para ver quién tiene leads en mano.
        // Sin filtro de fecha de creación, para que aparezcan vendedores con leads viejos.
        const { data: activeLeads, error: errorActive } = await supabase
            .from('leads')
            .select('*')
            .not('status', 'in', '("perdido","rechazado","baja","vendido","cumplidas")') // Solo stock vivo

        // 2. TRAER VENTAS DEL MES SELECCIONADO (PARA EL RATIO)
        const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString()
        const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0, 23, 59, 59).toISOString()
        
        const { data: salesInMonth, error: errorSales } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'cumplidas') // Solo ventas
            .gte('last_update', startDate) // En este mes
            .lte('last_update', endDate)

        if (activeLeads && salesInMonth) {
            const now = new Date()
            
            // --- A. CÁLCULO DE ZOMBIES (SOBRE CARTERA ACTIVA) ---
            const zombies = activeLeads.filter(l => {
                const lastUp = new Date(l.last_update || l.created_at)
                const diffHours = (now.getTime() - lastUp.getTime()) / (1000 * 60 * 60)
                return diffHours > 72 // +3 días sin tocar
            })

            const fresh = zombies.filter(z => !z.warning_sent).length
            const warned = zombies.filter(z => z.warning_sent).length

            // --- B. LISTA UNIFICADA DE VENDEDORES ---
            // Unimos los que tienen stock activo + los que vendieron algo este mes
            const agentsWithStock = activeLeads.map(l => l.agent_name).filter(Boolean)
            const agentsWithSales = salesInMonth.map(l => l.agent_name).filter(Boolean)
            
            // Set único de nombres (normalizado)
            const allAgents = [...new Set([...agentsWithStock, ...agentsWithSales])]

            // --- C. CÁLCULO DE RATIOS ---
            const ratios = allAgents.map(agent => {
                // Stock que tiene hoy en la mano
                const currentStock = activeLeads.filter(l => l.agent_name === agent).length
                // Ventas que cerró este mes
                const monthSales = salesInMonth.filter(l => l.agent_name === agent).length
                
                // Ratio: (Stock Actual + Ventas) / Ventas
                // Si tiene 50 en mano y vendió 5, gestionó 55. Ratio = 11.
                const totalManaged = currentStock + monthSales
                const ratioVal = monthSales > 0 ? Math.round(totalManaged / monthSales) : totalManaged
                
                let color = "bg-blue-500"
                let status = "Normal"
                
                if (monthSales === 0) {
                    if (currentStock > 0) { color = "bg-red-500"; status = "Sin Cierre" }
                    else { color = "bg-slate-300"; status = "Sin Stock" }
                } else if (ratioVal <= 15) { 
                    color = "bg-green-500"; status = "Excelente" 
                } else if (ratioVal > 30) { 
                    color = "bg-orange-500"; status = "Revisar" 
                }

                return { 
                    name: agent, 
                    ratio: ratioVal, 
                    color, 
                    status, 
                    stock: currentStock, 
                    sales: monthSales 
                }
            }).sort((a, b) => b.stock - a.stock) // Ordenar por volumen de cartera

            // --- D. NIVEL DE SIEMBRA ---
            const coverage = Math.min(100, Math.round((activeLeads.length / 200) * 100)) // Meta: 200 leads activos globales

            setStats({
                freshZombies: fresh,
                warnedZombies: warned,
                totalZombies: fresh + warned,
                coverage,
                agentsRatio: ratios
            })
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
    }, [selectedMonth, selectedYear])

    // --- ACCIONES DB ---
    const handleSendWarning = async () => {
        if (!confirm("¿Avisar a vendedoras sobre leads estancados?")) return
        const limitDate = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
        
        await supabase.from('leads')
            .update({ warning_sent: true, warning_date: new Date().toISOString() })
            .lt('last_update', limitDate)
            .not('status', 'in', '("cumplidas","vendido","perdido","rechazado","baja")')
            .is('warning_sent', false)
        
        fetchData()
    }

    const handleExecuteKill = async () => {
        if (!confirm("¿Mover leads avisados a RECUPERO?")) return
        
        await supabase.from('leads')
            .update({ agent_name: 'Recupero', status: 'nuevo', warning_sent: false, notes: 'Recuperado AdminPipeline' })
            .eq('warning_sent', true)
        
        fetchData()
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-8 pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <ThermometerSun className="h-8 w-8 text-orange-500" /> Salud del Tubo
                        {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
                    </h2>
                    <p className="text-slate-500 font-medium">Estado real de la cartera activa.</p>
                </div>
                
                <div className="flex gap-2 bg-white p-2 rounded-xl border shadow-sm items-center">
                    <Filter className="h-4 w-4 text-slate-400 ml-1" />
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[120px] font-bold border-none h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                                <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[90px] font-bold border-none h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 1. NIVEL DE SIEMBRA */}
            <Card className="border-t-4 border-t-green-500 shadow-lg">
                <CardHeader><CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Sprout className="h-5 w-5 text-green-600" /> Nivel de Siembra (Stock Activo)</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex justify-between items-end mb-2">
                        <div><p className="text-4xl font-black text-slate-800 dark:text-white">{stats.coverage}%</p><p className="text-xs text-slate-400 uppercase font-bold">Ocupación Cartera Global</p></div>
                        <Badge variant="outline" className={stats.coverage > 80 ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>{stats.coverage >= 100 ? 'Cartera Llena' : 'Espacio Disponible'}</Badge>
                    </div>
                    <Progress value={stats.coverage} className="h-4 bg-slate-100" />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2. ZOMBIES (CARTERA ACTIVA) */}
                <Card className="border-t-4 border-t-red-500 shadow-lg">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><AlertTriangle className="h-5 w-5 text-red-500" /> Gestión de Zombies</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-red-100 rounded-full"><AlertOctagon className="h-8 w-8 text-red-600" /></div>
                            <div>
                                <p className="text-3xl font-black text-red-600">{stats.totalZombies}</p>
                                <p className="text-xs font-bold text-slate-500 uppercase">Leads Estancados &gt;72hs</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1 border-yellow-200 bg-yellow-50 hover:bg-yellow-100 text-yellow-800" onClick={handleSendWarning} disabled={stats.freshZombies === 0}>
                                <span className="flex items-center gap-2 font-bold"><Send className="h-4 w-4"/> Avisar ({stats.freshZombies})</span>
                            </Button>
                            <Button variant="outline" className="h-auto py-3 flex flex-col gap-1 border-red-200 bg-red-50 hover:bg-red-100 text-red-800" onClick={handleExecuteKill} disabled={stats.warnedZombies === 0}>
                                <span className="flex items-center gap-2 font-bold"><Trash className="h-4 w-4"/> Recuperar ({stats.warnedZombies})</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. RATIO DE TIRO (TODOS LOS AGENTES) */}
                <Card className="border-t-4 border-t-blue-500 shadow-lg">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Target className="h-5 w-5 text-blue-500" /> Eficiencia de Cartera (Mes)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center mb-4"><p className="text-xs text-slate-500">Leads gestionados para <b>1 venta</b>.</p><span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Obj: &lt; 25</span></div>
                        <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                            {stats.agentsRatio.length > 0 ? stats.agentsRatio.map((agent: any) => (
                                <div key={agent.name} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg transition-colors">
                                    <Avatar className="h-8 w-8 border border-slate-200"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} /><AvatarFallback>{agent.name[0]}</AvatarFallback></Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-xs items-center">
                                            <div>
                                                <span className="font-bold text-slate-700 block">{agent.name}</span>
                                                <span className="text-[9px] text-slate-400 uppercase font-bold">Stock: {agent.stock} | Ventas: {agent.sales}</span>
                                            </div>
                                            <Badge variant="outline" className={`${agent.sales === 0 ? "border-red-200 text-red-600 bg-red-50" : "border-green-200 text-green-700 bg-green-50"}`}>
                                                {agent.sales === 0 ? "0 Vtas" : `1:${agent.ratio}`}
                                            </Badge>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                            <div className={`h-full ${agent.color}`} style={{width: `${agent.sales === 0 ? 100 : Math.min((agent.ratio / 50) * 100, 100)}%`}}></div>
                                        </div>
                                    </div>
                                </div>
                            )) : <div className="flex flex-col items-center py-8 text-slate-400"><Users className="h-8 w-8 mb-2 opacity-50"/><p className="text-xs">Sin agentes con stock activo.</p></div>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}