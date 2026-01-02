"use client"

import { useState, useEffect } from "react"
// IMPORTANTE: Import corregido según tu estructura de carpetas
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calculator, Loader2, RefreshCw } from "lucide-react"

export function AdminCommissions() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [agentsData, setAgentsData] = useState<any[]>([])
    
    // Filtros de tiempo (por defecto mes actual)
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedYear, setSelectedYear] = useState("2025")

    const fetchCommissions = async () => {
        setLoading(true)
        
        // Rango de fechas para el cálculo
        const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString()
        const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0, 23, 59, 59).toISOString()

        // Traemos solo ventas CUMPLIDAS (las que se pagan)
        const { data: leads } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'cumplidas')
            .gte('created_at', startDate)
            .lte('created_at', endDate)

        if (leads) {
            // Definición de agentes y sus jornadas (Esto podrías tenerlo en una tabla 'users' luego)
            const staff = [
                { name: "Maca", hours: 5 },
                { name: "Brenda", hours: 8 },
                { name: "Gonza", hours: 5 },
                { name: "Sofi", hours: 8 },
                { name: "Lucas", hours: 5 },
                { name: "Cami", hours: 5 }
            ]

            const processed = staff.map(member => {
                const agentLeads = leads.filter(l => l.agent_name === member.name)
                
                // Separamos ventas especiales (Ej: Planes caros o específicos) 
                // Asumimos que si el 'price' es > 500000 o según tu lógica de 'operator'
                const special = agentLeads.filter(l => l.operator?.includes("A1") || l.operator?.includes("500")).length
                const scale = agentLeads.length - special

                return {
                    ...member,
                    sales: { scale, special }
                }
            })
            setAgentsData(processed)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchCommissions()
        // Realtime para que si Admin Ops aprueba una venta, la liquidación suba en vivo
        const channel = supabase.channel('commissions_live')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchCommissions())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [selectedMonth, selectedYear])

    // TU LÓGICA DE CÁLCULO ORIGINAL (Mantenida exactamente igual)
    const calculateCommission = (agent: any) => {
        let commissionTotal = 0
        let breakdown = []
        const avgValue = 40000 
        
        // Comisión Especial
        const specialRevenue = agent.sales.special * 30000 * 0.10
        if (agent.sales.special > 0) {
            commissionTotal += specialRevenue
            breakdown.push(`Esp. (A1/500): ${agent.sales.special} vtas = $${specialRevenue.toLocaleString()}`)
        }

        const qty = agent.sales.scale
        let scaleRevenue = 0
        let absorbed = agent.hours === 5 ? 8 : 12

        if (qty > absorbed) {
            let remaining = qty - absorbed
            // Tier 1
            let tier1 = Math.min(remaining, 6); scaleRevenue += (tier1 * avgValue * 0.15); remaining -= tier1
            // Tier 2
            if (remaining > 0) { let tier2 = Math.min(remaining, 6); scaleRevenue += (tier2 * avgValue * 0.20); remaining -= tier2 }
            // Tier 3
            if (remaining > 0) { let tier3 = Math.min(remaining, 6); scaleRevenue += (tier3 * avgValue * 0.25); remaining -= tier3 }
            // Tier 4 (Excedente)
            if (remaining > 0) { scaleRevenue += (remaining * avgValue * 0.30) }
        }

        commissionTotal += scaleRevenue
        if (scaleRevenue > 0) breakdown.push(`Escala: ${qty} vtas = $${scaleRevenue.toLocaleString()}`)
        else breakdown.push(`Escala: ${qty} vtas (Absorbidas por jornada)`)

        return { total: commissionTotal, details: breakdown }
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                        <Calculator className="h-8 w-8 text-green-600" /> Liquidación Real
                    </h2>
                    <p className="text-slate-500">Comisiones basadas en ventas cumplidas.</p>
                </div>
                
                <div className="flex gap-2">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[140px] font-bold">
                            <SelectValue placeholder="Mes" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">Enero</SelectItem>
                            <SelectItem value="12">Diciembre</SelectItem>
                        </SelectContent>
                    </Select>
                    {loading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400 mt-3"/>}
                </div>
            </div>

            <Card className="border-t-4 border-t-green-600 shadow-lg">
                <CardHeader className="bg-slate-50/50 border-b pb-2">
                    <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">
                        Periodo de Liquidación: {selectedMonth}/{selectedYear}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">Agente</TableHead>
                                <TableHead className="text-center">Jornada</TableHead>
                                <TableHead className="text-center">Ventas Cumplidas</TableHead>
                                <TableHead>Desglose de Escala</TableHead>
                                <TableHead className="text-right text-green-700 font-bold bg-green-50/50 pr-6">A Pagar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agentsData.map((agent, i) => {
                                const result = calculateCommission(agent)
                                return (
                                    <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="font-bold text-lg pl-6">{agent.name}</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline" className="font-bold">{agent.hours} Hs</Badge></TableCell>
                                        <TableCell className="text-center font-bold text-lg">{agent.sales.scale + agent.sales.special}</TableCell>
                                        <TableCell className="text-[11px] leading-tight font-medium text-slate-500">
                                            {result.details.map((d, idx) => <p key={idx}>• {d}</p>)}
                                        </TableCell>
                                        <TableCell className="text-right font-black text-xl bg-green-50/30 text-green-700 font-mono pr-6">
                                            $ {result.total.toLocaleString('es-AR')}
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    )
}