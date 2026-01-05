"use client"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Filter, Eye, Trash2, X } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Label } from "@/components/ui/label"

export function OpsDatabase({ operations, onSelectOp }: any) {
    const supabase = createClient()
    const [searchTerm, setSearchTerm] = useState("")
    
    // Estado local para manejo optimista de borrado
    const [localOperations, setLocalOperations] = useState(operations)

    // Sincronizar con props del padre
    useEffect(() => {
        setLocalOperations(operations)
    }, [operations])
    
    // Estados para eliminación
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // Estados para Filtros Avanzados
    const [filterStatus, setFilterStatus] = useState("all")
    const [filterDateStart, setFilterDateStart] = useState("")
    const [filterDateEnd, setFilterDateEnd] = useState("")

    // Función de colores
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

    // --- LÓGICA DE FILTRADO ---
    const filteredOps = localOperations.filter((op: any) => {
        // 1. Buscador Potente (Texto libre)
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase()
            // Creamos un string con toda la data importante para buscar ahí
            const opString = JSON.stringify({
                ...op,
                // Agregamos campos específicos para asegurar búsqueda fácil
                search_date: op.entryDate,
                search_seller: op.seller,
                search_notes: op.history?.map((h:any) => h.action).join(" ")
            }).toLowerCase()
            
            if (!opString.includes(searchLower)) return false
        }

        // 2. Filtro de Estado Exacto
        if (filterStatus !== "all" && op.status !== filterStatus) return false

        // 3. Filtro de Fechas
        if (filterDateStart && op.entryDate < filterDateStart) return false
        if (filterDateEnd && op.entryDate > filterDateEnd) return false

        return true
    })

    // --- LÓGICA EXPORTAR CSV ---
    const handleExportCSV = () => {
        if (filteredOps.length === 0) return alert("No hay datos para exportar")

        // Definir cabeceras
        const headers = ["ID", "Fecha Ingreso", "Cliente", "DNI", "Estado", "Prepaga", "Plan", "Vendedor", "Admin", "Notas"]
        
        // Convertir datos a CSV
        const csvRows = filteredOps.map((op: any) => [
            op.id,
            op.entryDate,
            `"${op.clientName}"`, // Comillas para evitar errores con comas en nombres
            op.dni,
            op.status,
            op.prepaga,
            op.plan,
            op.seller,
            op.operator || "Sin asignar",
            `"${(op.history?.[0]?.action || "").replace(/"/g, '""')}"` // Escapar comillas en notas
        ])

        const csvContent = [headers.join(","), ...csvRows.map((r: any) => r.join(","))].join("\n")
        
        // Crear blob y descargar
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `ventas_export_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    // --- LÓGICA BORRAR VENTA ---
    const confirmDelete = (id: string) => {
        setDeleteId(id)
        setIsDeleteOpen(true)
    }

    const handleDelete = async () => {
        if (!deleteId) return
        setDeleting(true)
        
        // Borrar de Supabase
        const { error } = await supabase.from('leads').delete().eq('id', deleteId)
        
        if (error) {
            alert("Error al eliminar: " + error.message)
        } else {
            // Actualización Optimista: Lo sacamos de la lista visual YA mismo
            setLocalOperations((prev: any[]) => prev.filter(op => op.id !== deleteId))
            
            setIsDeleteOpen(false)
            setDeleteId(null)
        }
        setDeleting(false)
    }

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* HEADER BASE DE DATOS */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">Ventas Totales</h2>
                        <p className="text-xs text-slate-500">Base de datos histórica ({localOperations.length} registros).</p>
                    </div>
                    <Button variant="outline" onClick={handleExportCSV} className="gap-2 text-xs font-bold border-slate-300 hover:bg-slate-100">
                        <Download size={16}/> Exportar CSV
                    </Button>
                </div>

                <div className="flex gap-3">
                    {/* BUSCADOR POTENTE */}
                    <div className="relative flex-1 group">
                         <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10">
                            <Search className="h-5 w-5 text-slate-400/80 group-focus-within:text-blue-500 transition-colors" strokeWidth={2}/>
                        </div>
                        <Input 
                            className="pl-10 bg-white border-slate-200 h-10 shadow-sm focus:bg-white transition-all font-medium" 
                            placeholder="Buscador Universal: Nombre, DNI, Notas, Vendedor..." 
                            value={searchTerm}
                            onChange={e=>setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* FILTROS POPOVER */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="secondary" className={`border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-600 ${(filterStatus !== 'all' || filterDateStart) ? 'text-blue-600 border-blue-200 bg-blue-50' : ''}`}>
                                <Filter size={16} className="mr-2"/> Filtros
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4" align="end">
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h4 className="font-bold text-sm">Filtrar Vista</h4>
                                    {(filterStatus !== 'all' || filterDateStart) && (
                                        <Button variant="ghost" size="sm" className="h-6 text-[10px] text-red-500" onClick={() => {setFilterStatus('all'); setFilterDateStart(''); setFilterDateEnd('')}}>
                                            Limpiar
                                        </Button>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 uppercase font-bold">Estado</Label>
                                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            {['ingresado','precarga','medicas','legajo','demoras','cumplidas','rechazado'].map(s => (
                                                <SelectItem key={s} value={s} className="uppercase">{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 uppercase font-bold">Fecha Desde</Label>
                                    <Input type="date" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}/>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500 uppercase font-bold">Fecha Hasta</Label>
                                    <Input type="date" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}/>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* TABLA */}
            <div className="flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[100px] font-bold text-slate-700 text-center">Acciones</TableHead>
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
                                    <TableCell className="flex gap-1 justify-center">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-blue-600 hover:bg-blue-50" title="Ver Detalle">
                                            <Eye size={16}/>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-8 w-8 text-slate-300 hover:text-red-600 hover:bg-red-50" 
                                            title="Eliminar Venta"
                                            onClick={(e) => { e.stopPropagation(); confirmDelete(op.id); }}
                                        >
                                            <Trash2 size={16}/>
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
                                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${getBadgeColor(op.status)}`}>
                                            {op.status}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500">{op.entryDate}</TableCell>
                                    <TableCell className="text-xs font-bold text-slate-600">{op.seller}</TableCell>
                                    <TableCell className="text-xs text-slate-500">{op.operator || '-'}</TableCell>
                                </TableRow>
                            ))}
                            {filteredOps.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-10 text-slate-400">
                                        No se encontraron resultados con los filtros actuales.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            <div className="p-2 border-t border-slate-100 bg-slate-50 text-xs text-center text-slate-400 font-medium">
                Mostrando {filteredOps.length} registros de {localOperations.length} totales.
            </div>

            {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 size={20}/> Confirmar Eliminación
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            ¿Estás seguro que querés eliminar esta venta de la base de datos? <br/>
                            <span className="font-bold text-slate-800">Esta acción no se puede deshacer.</span>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                            {deleting ? "Eliminando..." : "Sí, Eliminar Venta"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}