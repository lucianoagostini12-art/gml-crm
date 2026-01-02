"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calculator, Zap, CheckCircle2, TrendingUp, AlertCircle, Filter, DollarSign, PieChart, Target, Crosshair, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export function AdminConteo() {
    const [selectedMonth, setSelectedMonth] = useState("12")
    const [selectedYear, setSelectedYear] = useState("2025")

    // DATOS DE VENDEDORAS (Con Ratio y Pass agregado)
    const agents = [
        { 
            name: "Maca", daily: 3, weekly: 12, monthly: 45, fulfilled: 40, status: "online", lastAction: "Ahora", efficiency: 88, ratio: "1:15",
            passCount: 4, // NUEVO: Cantidad de Pass
            breakdown: [
                { name: "Prevención", sold: 25, fulfilled: 24 },
                { name: "Avalian", sold: 10, fulfilled: 8 },
                { name: "DoctoRed", sold: 5, fulfilled: 5 },
                { name: "Otros", sold: 5, fulfilled: 3 }
            ]
        },
        { 
            name: "Gonza", daily: 1, weekly: 5, monthly: 18, fulfilled: 10, status: "away", lastAction: "Hace 15m", efficiency: 55, ratio: "1:65",
            passCount: 2, // NUEVO
            breakdown: [
                { name: "Galeno", sold: 10, fulfilled: 4 },
                { name: "Swiss Medical", sold: 5, fulfilled: 3 },
                { name: "Prevención", sold: 3, fulfilled: 3 }
            ]
        },
        { 
            name: "Sofi", daily: 2, weekly: 9, monthly: 32, fulfilled: 30, status: "online", lastAction: "Hace 2m", efficiency: 93, ratio: "1:20",
            passCount: 0,
            breakdown: [
                { name: "DoctoRed", sold: 20, fulfilled: 20 },
                { name: "Avalian", sold: 10, fulfilled: 9 },
                { name: "AMPF", sold: 2, fulfilled: 1 }
            ]
        },
        { 
            name: "Lucas", daily: 0, weekly: 4, monthly: 15, fulfilled: 12, status: "offline", lastAction: "Hace 1h", efficiency: 80, ratio: "1:35",
            passCount: 5, // NUEVO
            breakdown: [
                { name: "Prevención", sold: 10, fulfilled: 9 },
                { name: "Sancor", sold: 5, fulfilled: 3 }
            ]
        },
        { 
            name: "Brenda", daily: 4, weekly: 15, monthly: 50, fulfilled: 48, status: "online", lastAction: "Ahora", efficiency: 96, ratio: "1:12",
            passCount: 1,
            breakdown: [
                { name: "Prevención", sold: 30, fulfilled: 29 },
                { name: "Avalian", sold: 15, fulfilled: 14 },
                { name: "Galeno", sold: 5, fulfilled: 5 }
            ]
        },
        { 
            name: "Cami", daily: 1, weekly: 6, monthly: 22, fulfilled: 18, status: "online", lastAction: "Hace 5m", efficiency: 81, ratio: "1:40",
            passCount: 0,
            breakdown: [
                { name: "Avalian", sold: 10, fulfilled: 8 },
                { name: "DoctoRed", sold: 8, fulfilled: 7 },
                { name: "Otros", sold: 4, fulfilled: 3 }
            ]
        },
    ]

    // DATOS GLOBALES POR PREPAGA
    const prepagaStats = [
        { name: "Prevención Salud", totalSold: 68, totalFulfilled: 65, rate: 95, color: "text-pink-600" },
        { name: "DoctoRed", totalSold: 33, totalFulfilled: 32, rate: 97, color: "text-violet-600" },
        { name: "Avalian", totalSold: 45, totalFulfilled: 39, rate: 86, color: "text-green-600" },
        { name: "Galeno", totalSold: 15, totalFulfilled: 9, rate: 60, color: "text-blue-600" },
        { name: "Swiss Medical", totalSold: 5, totalFulfilled: 3, rate: 60, color: "text-red-500" },
        { name: "Sancor / AMPF", totalSold: 16, totalFulfilled: 10, rate: 62, color: "text-slate-500" },
    ]

    // Función auxiliar para color del ratio
    const getRatioColor = (ratioStr: string) => {
        const num = parseInt(ratioStr.split(':')[1])
        if (num <= 20) return "text-green-600 bg-green-50 border-green-200" // Excelente
        if (num <= 40) return "text-blue-600 bg-blue-50 border-blue-200" // Normal
        return "text-red-600 bg-red-50 border-red-200" // Malo (Quema datos)
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8 pb-20">
            
            {/* HEADER CON FILTROS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Calculator className="h-8 w-8 text-indigo-600" /> Tablero de Conteo
                    </h2>
                    <p className="text-slate-500">Auditoría de producción y cumplimiento.</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
                    <Filter className="h-4 w-4 text-slate-400 ml-2" />
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[130px] border-none shadow-none font-bold text-slate-700 dark:text-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="10">Octubre</SelectItem>
                            <SelectItem value="11">Noviembre</SelectItem>
                            <SelectItem value="12">Diciembre</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="h-6 w-[1px] bg-slate-200"></div>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[90px] border-none shadow-none font-bold text-slate-700 dark:text-slate-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="2024">2024</SelectItem>
                            <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 1. TABLA PRINCIPAL (RESUMEN ASESORAS) */}
            <Card className="shadow-xl border-t-4 border-t-indigo-500">
                <CardHeader className="bg-slate-50/50 pb-2">
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-sm font-bold uppercase text-slate-500">Resumen General - {selectedMonth}/{selectedYear}</CardTitle>
                        <div className="flex gap-2">
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                Total Mes: {agents.reduce((acc, curr) => acc + curr.monthly, 0)}
                            </Badge>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Cumplidas: {agents.reduce((acc, curr) => acc + curr.fulfilled, 0)}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[250px] pl-6 py-4">Asesora (Estado)</TableHead>
                                <TableHead className="text-center font-bold text-slate-600">Diarias</TableHead>
                                <TableHead className="text-center font-bold text-slate-600">Semanales</TableHead>
                                <TableHead className="text-center font-black text-slate-900 dark:text-white text-lg bg-blue-50/50 dark:bg-blue-900/10 border-x">Mensuales</TableHead>
                                <TableHead className="text-center font-bold text-green-700">Cumplidas</TableHead>
                                <TableHead className="text-center font-bold text-indigo-600">Ratio (Datos)</TableHead>
                                <TableHead className="text-center">Eficiencia Gral.</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {agents.map((agent) => (
                                <TableRow key={agent.name} className="hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <Avatar className="h-10 w-10 border border-slate-200">
                                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} />
                                                    <AvatarFallback>{agent.name[0]}</AvatarFallback>
                                                </Avatar>
                                                <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white 
                                                    ${agent.status === 'online' ? 'bg-green-500 animate-pulse' : 
                                                      agent.status === 'away' ? 'bg-yellow-500' : 'bg-slate-400'}`}>
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-bold text-base text-slate-800 dark:text-white">{agent.name}</p>
                                                <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                                    {agent.status === 'online' ? <Zap className="h-3 w-3 text-green-500 fill-green-500"/> : null}
                                                    {agent.status === 'online' ? 'Activa ahora' : `Visto: ${agent.lastAction}`}
                                                </p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center text-lg">{agent.daily > 0 ? <span className="font-bold text-slate-700">{agent.daily}</span> : <span className="text-slate-300">-</span>}</TableCell>
                                    <TableCell className="text-center text-lg">{agent.weekly}</TableCell>
                                    
                                    {/* --- AQUÍ ESTÁ EL CAMBIO QUE PEDISTE --- */}
                                    <TableCell className="text-center bg-blue-50/30 dark:bg-blue-900/5 border-x align-middle">
                                        <div className="flex flex-col items-center justify-center">
                                            <span className="font-black text-2xl text-blue-600 leading-none">{agent.monthly}</span>
                                            {agent.passCount > 0 && (
                                                <span className="text-[10px] font-bold text-slate-400 mt-1 flex items-center gap-1">
                                                    <RefreshCw className="h-3 w-3 text-blue-500"/> +{agent.passCount} Pass
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                    {/* -------------------------------------- */}

                                    <TableCell className="text-center">
                                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-md">
                                            <CheckCircle2 className="h-4 w-4 text-green-600"/>
                                            <span className="font-bold text-green-700 dark:text-green-400">{agent.fulfilled}</span>
                                        </div>
                                    </TableCell>
                                    
                                    <TableCell className="text-center">
                                        <Badge variant="outline" className={`${getRatioColor(agent.ratio)} font-mono`}>
                                            <Crosshair className="h-3 w-3 mr-1"/> {agent.ratio}
                                        </Badge>
                                    </TableCell>

                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className={`font-bold ${agent.efficiency >= 80 ? 'text-green-600' : agent.efficiency >= 60 ? 'text-yellow-600' : 'text-red-500'}`}>
                                                {agent.efficiency}%
                                            </span>
                                            {agent.efficiency < 60 && <AlertCircle className="h-3 w-3 text-red-400 mt-0.5" />}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 2. DETALLE POR VENDEDORA (VENDIDO vs CUMPLIDO) */}
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-600" /> Detalle de Producción (Vendido vs. Cumplido)
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map((agent) => (
                        <Card key={agent.name} className="border shadow-sm hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} /></Avatar>
                                        <span className="font-bold text-sm">{agent.name}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase">
                                        Efectividad: <span className={agent.efficiency > 80 ? "text-green-600" : "text-orange-500"}>{agent.efficiency}%</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {agent.breakdown.map((item) => (
                                        <div key={item.name} className="space-y-1">
                                            <div className="flex justify-between items-end text-xs">
                                                <span className="font-medium text-slate-600 dark:text-slate-400">{item.name}</span>
                                                <div className="flex gap-2 font-mono">
                                                    <span className="text-slate-500" title="Vendido">V:{item.sold}</span>
                                                    <span className="text-green-600 font-bold" title="Cumplido">C:{item.fulfilled}</span>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                                <div className="bg-green-500 h-full" style={{width: `${(item.fulfilled / item.sold) * 100}%`}}></div>
                                                <div className="bg-red-300 h-full" style={{width: `${100 - ((item.fulfilled / item.sold) * 100)}%`}}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* 3. REPORTE GLOBAL DE PRODUCTO (PREPAGAS) */}
            <Card className="border-t-4 border-t-purple-600 shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5 text-purple-600"/> Rendimiento por Prepaga (Global)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Prepaga</TableHead>
                                <TableHead className="text-center text-slate-500">Total Vendido</TableHead>
                                <TableHead className="text-center font-bold text-green-700 bg-green-50/50">Total Cumplido</TableHead>
                                <TableHead className="text-center">Tasa de Efectividad</TableHead>
                                <TableHead className="text-right">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {prepagaStats.map((stat) => (
                                <TableRow key={stat.name}>
                                    <TableCell className={`font-bold ${stat.color}`}>{stat.name}</TableCell>
                                    <TableCell className="text-center font-medium">{stat.totalSold}</TableCell>
                                    <TableCell className="text-center font-black text-lg text-green-700 bg-green-50/50">{stat.totalFulfilled}</TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <Progress value={stat.rate} className="w-16 h-2" />
                                            <span className="font-bold text-xs">{stat.rate}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {stat.rate >= 90 ? <Badge className="bg-green-500">Excelente</Badge> : 
                                         stat.rate >= 80 ? <Badge className="bg-blue-500">Bueno</Badge> :
                                         <Badge variant="destructive">Revisar</Badge>}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 4. FOOTER: REMUNERACIÓN ESTIMADA */}
            <div className="mt-8 bg-slate-900 text-white p-6 rounded-xl shadow-2xl flex flex-col md:flex-row justify-between items-center border border-slate-700">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-500/20 rounded-full">
                        <DollarSign className="h-8 w-8 text-green-400" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Proyección de Ingresos</h3>
                        <p className="text-slate-400 text-sm">Basado en ventas cumplidas y valor promedio de cápita.</p>
                    </div>
                </div>
                <div className="text-right mt-4 md:mt-0">
                    <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Remuneración Estimada</p>
                    <p className="text-4xl font-black text-green-400 font-mono tracking-tight">$ 4.850.000</p>
                    <div className="flex items-center justify-end gap-1 text-xs text-slate-500 mt-1">
                        <Target className="h-3 w-3" />
                        <span>Objetivo: $5.0M (97%)</span>
                    </div>
                </div>
            </div>

        </div>
    )
}