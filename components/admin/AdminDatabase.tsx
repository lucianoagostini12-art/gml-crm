"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Database, Download, Search, FileSpreadsheet, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function AdminDatabase() {
    const [searchTerm, setSearchTerm] = useState("")
    const [lastExport, setLastExport] = useState("16/12/2025 14:30") 

    const allData = [
        { id: 1, created: "01/12/2025", name: "Juan Perez", source: "Meta Ads", prepagaInterest: "Prevención", agent: "Maca", status: "Vendido", updated: "15/12/2025", phone: "2235..." },
        { id: 2, created: "02/12/2025", name: "Ana Gomez", source: "Google Ads", prepagaInterest: "Galeno", agent: "Gonza", status: "Nuevo", updated: "02/12/2025", phone: "2236..." },
        { id: 3, created: "03/12/2025", name: "Luis Real", source: "Referido", prepagaInterest: "DoctoRed", agent: "Brenda", status: "Perdido", updated: "10/12/2025", phone: "1140..." },
        { id: 4, created: "05/12/2025", name: "Carlos T.", source: "Llamador", prepagaInterest: "Avalian", agent: "Lucas", status: "Cotizado", updated: "17/12/2025", phone: "2235..." },
    ]

    const handleExport = () => {
        setLastExport(new Date().toLocaleString())
        alert(`✅ Base de datos exportada.`)
    }

    const filteredData = allData.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.prepagaInterest.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2"><Database className="h-8 w-8 text-slate-600" /> Base Maestra</h2>
                    <p className="text-slate-500">Repositorio total de datos históricos.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-slate-400 mb-1 flex items-center justify-end gap-1"><Calendar className="h-3 w-3"/> Última exportación: {lastExport}</p>
                    <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold"><Download className="mr-2 h-4 w-4" /> DESCARGAR CSV</Button>
                </div>
            </div>
            <Card className="border-t-4 border-t-slate-600 shadow-lg">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b flex flex-col md:flex-row justify-between items-center p-4 gap-4">
                    <div className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-slate-500"/><span className="font-bold text-slate-700 dark:text-slate-200">Registros: {allData.length}</span></div>
                    <div className="relative w-full md:w-96"><Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" /><Input placeholder="Buscar..." className="pl-8 bg-white dark:bg-slate-950" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white dark:bg-slate-900 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Origen</TableHead><TableHead>Prepaga</TableHead><TableHead>Vendedor</TableHead><TableHead>Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-mono text-xs">{row.created}</TableCell>
                                        <TableCell className="font-bold">{row.name}</TableCell>
                                        <TableCell><Badge variant="outline">{row.source}</Badge></TableCell>
                                        <TableCell>{row.prepagaInterest}</TableCell>
                                        <TableCell>{row.agent}</TableCell>
                                        <TableCell><Badge className={row.status==='Vendido'?'bg-green-500':row.status==='Perdido'?'bg-red-500':'bg-blue-500'}>{row.status}</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}