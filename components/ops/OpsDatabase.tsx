"use client"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Filter, Eye } from "lucide-react"

export function OpsDatabase({ operations, onSelectOp }: any) {
    const [searchTerm, setSearchTerm] = useState("")
    
    // Función de colores idéntica a OpsList y Dashboard
    const getBadgeColor = (status: string) => {
        switch (status) {
            case 'ingresado': return "bg-slate-200 text-slate-800 border-slate-300"
            case 'precarga': return "bg-blue-100 text-blue-700 border-blue-200"
            case 'medicas': return "bg-purple-100 text-purple-700 border-purple-200"
            case 'legajo': return "bg-yellow-100 text-yellow-700 border-yellow-200"
            case 'demoras': return "bg-indigo-100 text-indigo-700 border-indigo-200"
            case 'cumplidas': return "bg-emerald-100 text-emerald-700 border-emerald-200"
            case 'rechazado': return "bg-red-100 text-red-700 border-red-200"
            default: return "bg-slate-100 text-slate-600"
        }
    }

    const filteredOps = operations.filter((op: any) => {
        if (!searchTerm) return true
        const searchLower = searchTerm.toLowerCase()
        const opString = JSON.stringify(op).toLowerCase()
        return opString.includes(searchLower)
    })

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* HEADER BASE DE DATOS */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Ventas Totales</h2>
                        <p className="text-xs text-slate-500">Base de datos histórica completa.</p>
                    </div>
                    <Button variant="outline" className="gap-2 text-xs font-bold border-slate-300">
                        <Download size={16}/> Exportar CSV
                    </Button>
                </div>

                <div className="flex gap-3">
                    {/* BUSCADOR POTENTE (DISEÑO UNIFICADO) */}
                    <div className="relative flex-1 group">
                         <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10">
                            <Search className="h-5 w-5 text-slate-400/80 group-focus-within:text-blue-500 transition-colors" strokeWidth={2}/>
                        </div>
                        <Input 
                            className="pl-10 bg-white border-slate-200 h-10 shadow-sm focus:bg-white transition-all font-medium" 
                            placeholder="Buscador Potente: Nombre, DNI, Notas, Observaciones, Vendedor..." 
                            value={searchTerm}
                            onChange={e=>setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button variant="secondary" className="border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-600">
                        <Filter size={16} className="mr-2"/> Filtros
                    </Button>
                </div>
            </div>

            {/* TABLA */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[50px] font-bold text-slate-700">Ver</TableHead>
                                <TableHead className="font-bold text-slate-700">Cliente</TableHead>
                                <TableHead className="font-bold text-slate-700">DNI / CUIT</TableHead>
                                <TableHead className="font-bold text-slate-700">Plan</TableHead>
                                <TableHead className="font-bold text-slate-700">Estado</TableHead>
                                <TableHead className="font-bold text-slate-700">Ingreso</TableHead>
                                <TableHead className="font-bold text-slate-700">Vendedor</TableHead>
                                <TableHead className="font-bold text-slate-700">Admin</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredOps.map((op: any) => (
                                <TableRow key={op.id} className="hover:bg-slate-50 cursor-pointer transition-colors group" onClick={() => onSelectOp(op)}>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 group-hover:text-blue-500">
                                            <Eye size={16}/>
                                        </Button>
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-700">{op.clientName}</TableCell>
                                    <TableCell className="font-mono text-xs text-slate-500">{op.dni}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 font-medium">
                                            {op.prepaga} {op.plan}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {/* ESTADO CON COLORES CORREGIDOS */}
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${getBadgeColor(op.status)}`}>
                                            {op.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500">{op.entryDate}</TableCell>
                                    <TableCell className="text-xs font-bold text-slate-600">{op.seller}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{op.operator || '-'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <div className="p-2 border-t border-slate-100 bg-slate-50 text-xs text-center text-slate-400 font-medium">
                Mostrando {filteredOps.length} registros
            </div>
        </div>
    )
}