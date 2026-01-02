"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Printer, AlertCircle, Calculator } from "lucide-react"

export function AdminCommissions() {
    const [selectedMonth, setSelectedMonth] = useState("Diciembre 2025")

    const agents = [
        { name: "Maca", hours: 5, sales: { scale: 18, special: 4, totalValue: 1200000 } },
        { name: "Brenda", hours: 8, sales: { scale: 35, special: 0, totalValue: 2500000 } },
        { name: "Gonza", hours: 5, sales: { scale: 6, special: 2, totalValue: 300000 } },
    ]

    const calculateCommission = (agent: any) => {
        let commissionTotal = 0
        let breakdown = []
        const specialRevenue = agent.sales.special * 30000 * 0.10
        if (agent.sales.special > 0) {
            commissionTotal += specialRevenue
            breakdown.push(`Esp. (A1/500): ${agent.sales.special} vtas = $${specialRevenue.toLocaleString()}`)
        }
        const qty = agent.sales.scale
        const avgValue = 40000 
        let scaleRevenue = 0
        let absorbed = 0

        if (agent.hours === 5) {
            if (qty <= 8) { absorbed = qty } else {
                absorbed = 8
                let remaining = qty - 8
                let tier1 = Math.min(remaining, 6); scaleRevenue += (tier1 * avgValue * 0.15); remaining -= tier1
                if (remaining > 0) { let tier2 = Math.min(remaining, 6); scaleRevenue += (tier2 * avgValue * 0.20); remaining -= tier2 }
                if (remaining > 0) { let tier3 = Math.min(remaining, 4); scaleRevenue += (tier3 * avgValue * 0.25); remaining -= tier3 }
                if (remaining > 0) { scaleRevenue += (remaining * avgValue * 0.30) }
            }
        } else {
            if (qty <= 12) { absorbed = qty } else {
                absorbed = 12
                let remaining = qty - 12
                let tier1 = Math.min(remaining, 6); scaleRevenue += (tier1 * avgValue * 0.15); remaining -= tier1
                if (remaining > 0) { let tier2 = Math.min(remaining, 6); scaleRevenue += (tier2 * avgValue * 0.20); remaining -= tier2 }
                if (remaining > 0) { let tier3 = Math.min(remaining, 6); scaleRevenue += (tier3 * avgValue * 0.25); remaining -= tier3 }
                if (remaining > 0) { scaleRevenue += (remaining * avgValue * 0.30) }
            }
        }
        commissionTotal += scaleRevenue
        if (scaleRevenue > 0) breakdown.push(`Escala: ${qty} vtas = $${scaleRevenue.toLocaleString()}`)
        else breakdown.push(`Escala: ${qty} vtas (Absorbidas)`)

        return { total: commissionTotal, details: breakdown, absorbed }
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Calculator className="h-8 w-8 text-green-600" /> Liquidación
                    </h2>
                    <p className="text-slate-500">Cálculo automático de comisiones.</p>
                </div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[180px] font-bold"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Diciembre 2025">Diciembre 2025</SelectItem></SelectContent>
                </Select>
            </div>
            <Card className="border-t-4 border-t-green-600 shadow-lg">
                <CardHeader className="bg-slate-50 border-b pb-2"><CardTitle className="text-lg">Resumen del Mes</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader><TableRow><TableHead>Agente</TableHead><TableHead className="text-center">Jornada</TableHead><TableHead className="text-center">Ventas</TableHead><TableHead>Desglose</TableHead><TableHead className="text-right text-green-700 font-bold bg-green-50">A Pagar</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {agents.map((agent, i) => {
                                const result = calculateCommission(agent)
                                return (
                                    <TableRow key={i}>
                                        <TableCell className="font-bold text-lg">{agent.name}</TableCell>
                                        <TableCell className="text-center"><Badge variant="outline">{agent.hours} Hs</Badge></TableCell>
                                        <TableCell className="text-center"><span className="font-bold">{agent.sales.scale + agent.sales.special}</span></TableCell>
                                        <TableCell className="text-xs">{result.details.map((d, idx) => <p key={idx}>• {d}</p>)}</TableCell>
                                        <TableCell className="text-right font-black text-lg bg-green-50 text-green-700 font-mono">$ {result.total.toLocaleString()}</TableCell>
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