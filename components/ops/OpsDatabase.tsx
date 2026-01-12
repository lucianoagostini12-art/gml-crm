"use client"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Search, Download, Filter, Eye, Trash2, X, MessageSquare, StickyNote, RefreshCw, Database } from "lucide-react"
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

// Ignoramos la prop 'operations' para la data, pero mantenemos onSelectOp
export function OpsDatabase({ onSelectOp }: any) {
    const supabase = createClient()
    const [searchTerm, setSearchTerm] = useState("")
    
    // --- ESTADO DE DATOS PROPIO (GLOBAL) ---
    // Ya no dependemos de lo que venga del padre, cargamos TODO aquí.
    const [fullDatabase, setFullDatabase] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Sincronizar con Supabase directamente al montar
    const fetchFullData = async () => {
        setLoading(true)
        // Traemos TODO sin excepción
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (data) {
            // Normalizamos datos si es necesario
            setFullDatabase(data.map((l:any) => ({
                id: l.id,
                entryDate: l.created_at,
                status: l.status ? l.status.toLowerCase() : 'desconocido',
                clientName: l.client_name || l.name, // Ajuste por si usas campos distintos
                dni: l.dni,
                seller: l.agent_name,
                prepaga: l.prepaga || l.quoted_prepaga || 'Sin Dato',
                plan: l.plan || l.quoted_plan || 'General',
                origen: l.source,
                billing_period: l.billing_period,
                chat: l.chat_history || [], // Asumiendo estructura
                adminNotes: l.admin_notes || [],
                history: l.history || []
            })))
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchFullData()
    }, [])
    
    // Estados para eliminación
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [isDeleteOpen, setIsDeleteOpen] = useState(false)
    const [deleting, setDeleting] = useState(false)

    // --- FILTROS AVANZADOS ---
    const [filterStatus, setFilterStatus] = useState("all")
    const [filterSeller, setFilterSeller] = useState("all")
    const [filterPrepaga, setFilterPrepaga] = useState("all") 
    const [filterPlan, setFilterPlan] = useState("all")       
    const [filterOrigin, setFilterOrigin] = useState("all")   
    
    const [filterDateStart, setFilterDateStart] = useState("")
    const [filterDateEnd, setFilterDateEnd] = useState("")

    // --- GENERACIÓN DINÁMICA DE OPCIONES ---
    const { uniqueSellers, uniquePrepagas, uniquePlans, uniqueOrigins } = useMemo(() => {
        const sellers = new Set<string>()
        const prepagas = new Set<string>()
        const plans = new Set<string>()
        const origins = new Set<string>()

        fullDatabase.forEach((op: any) => {
            if (op.seller) sellers.add(op.seller)
            if (op.prepaga) prepagas.add(op.prepaga)
            if (op.plan) plans.add(op.plan)
            if (op.origen) origins.add(op.origen.charAt(0).toUpperCase() + op.origen.slice(1))
        })

        return {
            uniqueSellers: Array.from(sellers).sort(),
            uniquePrepagas: Array.from(prepagas).sort(),
            uniquePlans: Array.from(plans).sort(),
            uniqueOrigins: Array.from(origins).sort()
        }
    }, [fullDatabase])

    // Función de colores
    const getBadgeColor = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'nuevo': return "bg-slate-100 text-slate-600 border-slate-300" // Venta temprana
            case 'contactado': return "bg-blue-50 text-blue-600 border-blue-200" // Venta temprana
            case 'en gestion': return "bg-orange-50 text-orange-600 border-orange-200" // Venta temprana
            case 'ingresado': return "bg-slate-200 text-slate-800 border-slate-300"
            case 'precarga': return "bg-blue-100 text-blue-700 border-blue-200"
            case 'medicas': return "bg-purple-100 text-purple-700 border-purple-200"
            case 'legajo': return "bg-yellow-100 text-yellow-700 border-yellow-200"
            case 'demoras': return "bg-indigo-100 text-indigo-700 border-indigo-200"
            case 'cumplidas': return "bg-emerald-100 text-emerald-700 border-emerald-200"
            case 'rechazado': return "bg-red-100 text-red-700 border-red-200"
            case 'baja': return "bg-red-50 text-red-900 border-red-300"
            case 'vendido': return "bg-cyan-100 text-cyan-800 border-cyan-200"
            default: return "bg-slate-50 text-slate-500 border-slate-200"
        }
    }

    const formatBillingPeriod = (period: string) => {
        if (!period) return "-"
        const [year, month] = period.split('-')
        const date = new Date(parseInt(year), parseInt(month) - 1, 1)
        return date.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    }

    // --- HELPER PARA STRING SEGURO ---
    const safeStr = (val: any) => val ? String(val).toLowerCase() : ""

    // --- LÓGICA DE FILTRADO POTENCIADA ---
    const filteredOps = useMemo(() => {
        return fullDatabase.filter((op: any) => {
            // 1. FILTRO DE FECHAS (YYYY-MM-DD)
            if (filterDateStart || filterDateEnd) {
                if (!op.entryDate) return false
                const opDateYMD = new Date(op.entryDate).toISOString().split('T')[0]
                if (filterDateStart && opDateYMD < filterDateStart) return false
                if (filterDateEnd && opDateYMD > filterDateEnd) return false
            }

            // 2. FILTROS SELECT
            if (filterStatus !== "all" && op.status !== filterStatus) return false
            if (filterSeller !== "all" && op.seller !== filterSeller) return false
            if (filterPrepaga !== "all" && op.prepaga !== filterPrepaga) return false
            if (filterPlan !== "all" && op.plan !== filterPlan) return false
            if (filterOrigin !== "all") {
                const opOrigin = safeStr(op.origen)
                const filterOriginLower = safeStr(filterOrigin)
                if (opOrigin !== filterOriginLower) return false
            }

            // 3. BUSCADOR GLOBAL
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase()
                
                const chatContent = op.chat?.map((c: any) => safeStr(c.text) + " " + safeStr(c.message)).join(" ") || ""
                const notesContent = op.adminNotes?.map((n: any) => safeStr(n.text) + " " + safeStr(n.action)).join(" ") || ""
                const historyContent = op.history?.map((h: any) => safeStr(h.action) + " " + safeStr(h.details)).join(" ") || ""
                
                const fullSearchString = `
                    ${safeStr(op.id)}
                    ${safeStr(op.clientName)} 
                    ${safeStr(op.dni)} 
                    ${safeStr(op.seller)} 
                    ${safeStr(op.prepaga)} 
                    ${safeStr(op.plan)} 
                    ${safeStr(op.origen)} 
                    ${safeStr(op.status)}
                    ${chatContent} 
                    ${notesContent} 
                    ${historyContent}
                `
                
                if (!fullSearchString.includes(searchLower)) return false
            }

            return true
        })
    }, [fullDatabase, searchTerm, filterStatus, filterSeller, filterPrepaga, filterPlan, filterOrigin, filterDateStart, filterDateEnd])

    // --- EXPORTAR CSV ---
    const handleExportCSV = () => {
        if (filteredOps.length === 0) return alert("No hay datos para exportar")

        const headers = ["ID", "Fecha Ingreso", "Mes Liquidado", "Cliente", "DNI", "Estado", "Prepaga", "Plan", "Vendedor", "Origen", "Notas"]
        
        const csvRows = filteredOps.map((op: any) => [
            op.id,
            op.entryDate ? new Date(op.entryDate).toLocaleDateString() : "-",
            op.billing_period || "-", 
            `"${safeStr(op.clientName).toUpperCase()}"`,
            op.dni || "-",
            op.status,
            op.prepaga || "-",
            op.plan || "-",
            op.seller || "-",
            op.origen || "-", 
            `"${(op.history?.[0]?.action || "").replace(/"/g, '""')}"`
        ])

        const csvContent = [headers.join(","), ...csvRows.map((r: any) => r.join(","))].join("\n")
        
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.setAttribute("href", url)
        link.setAttribute("download", `base_completa_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const confirmDelete = (id: string) => {
        setDeleteId(id)
        setIsDeleteOpen(true)
    }

    const handleDelete = async () => {
        if (!deleteId) return
        setDeleting(true)
        const { error } = await supabase.from('leads').delete().eq('id', deleteId)
        if (error) {
            alert("Error al eliminar: " + error.message)
        } else {
            setFullDatabase((prev: any[]) => prev.filter(op => op.id !== deleteId))
            setIsDeleteOpen(false)
            setDeleteId(null)
        }
        setDeleting(false)
    }

    const clearFilters = () => {
        setFilterStatus('all')
        setFilterSeller('all')
        setFilterPrepaga('all')
        setFilterPlan('all')
        setFilterOrigin('all')
        setFilterDateStart('')
        setFilterDateEnd('')
        setSearchTerm('')
    }

    const hasActiveFilters = filterStatus !== 'all' || filterSeller !== 'all' || filterPrepaga !== 'all' || filterPlan !== 'all' || filterOrigin !== 'all' || filterDateStart !== '' || filterDateEnd !== ''

    return (
        <div className="flex flex-col h-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            {/* HEADER */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                            Base de Datos Global
                            <Database size={20} className="text-blue-500"/>
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">
                            {loading ? "Cargando datos completos del sistema..." : `Acceso total: ${fullDatabase.length} registros.`}
                            {!loading && filteredOps.length !== fullDatabase.length && <span className="ml-1 text-blue-600 font-bold">Filtrando {filteredOps.length} resultados.</span>}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={fetchFullData} disabled={loading} className="text-slate-500 hover:text-blue-600">
                            <RefreshCw size={16} className={`${loading ? 'animate-spin' : ''} mr-2`}/> Actualizar
                        </Button>
                        <Button variant="outline" onClick={handleExportCSV} disabled={loading} className="gap-2 text-xs font-bold border-slate-300 hover:bg-slate-100">
                            <Download size={16}/> Exportar
                        </Button>
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* BUSCADOR POTENCIADO */}
                    <div className="relative flex-1 group">
                         <div className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center pointer-events-none z-10">
                            <Search className="h-5 w-5 text-slate-400/80 group-focus-within:text-blue-500 transition-colors" strokeWidth={2}/>
                        </div>
                        <Input 
                            className="pl-10 bg-white border-slate-200 h-10 shadow-sm focus:bg-white transition-all font-medium focus:ring-2 focus:ring-blue-500/20" 
                            placeholder="Buscar en TODO el sistema: ID, Cliente, Vendedor, Notas..." 
                            value={searchTerm}
                            onChange={e=>setSearchTerm(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* FILTROS AVANZADOS */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="secondary" disabled={loading} className={`border border-slate-200 bg-white hover:bg-slate-50 font-bold text-slate-600 ${hasActiveFilters ? 'text-blue-600 border-blue-200 bg-blue-50' : ''}`}>
                                <Filter size={16} className="mr-2"/> 
                                {hasActiveFilters ? 'Filtros Activos' : 'Filtrar'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[600px] p-6" align="end">
                            <div className="space-y-6">
                                <div className="flex justify-between items-center border-b pb-2">
                                    <h4 className="font-bold text-base flex items-center gap-2"><Filter size={16}/> Filtros Avanzados</h4>
                                    {hasActiveFilters && (
                                        <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500 hover:text-red-700" onClick={clearFilters}>
                                            <X size={12} className="mr-1"/> Limpiar Todo
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Estado</Label>
                                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos (Ventas + Ops)</SelectItem>
                                                <SelectItem value="nuevo">Nuevo</SelectItem>
                                                <SelectItem value="contactado">Contactado</SelectItem>
                                                <SelectItem value="en gestion">En Gestión</SelectItem>
                                                <SelectItem value="ingresado">Ingresado</SelectItem>
                                                <SelectItem value="cumplidas">Cumplidas</SelectItem>
                                                <SelectItem value="rechazado">Rechazado</SelectItem>
                                                <SelectItem value="baja">Baja</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Vendedor</Label>
                                        <Select value={filterSeller} onValueChange={setFilterSeller}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {uniqueSellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Prepaga</Label>
                                        <Select value={filterPrepaga} onValueChange={setFilterPrepaga}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {uniquePrepagas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Plan</Label>
                                        <Select value={filterPlan} onValueChange={setFilterPlan}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {uniquePlans.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Origen</Label>
                                        <Select value={filterOrigin} onValueChange={setFilterOrigin}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {uniqueOrigins.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Desde</Label>
                                        <Input type="date" className="h-8 text-xs" value={filterDateStart} onChange={e => setFilterDateStart(e.target.value)}/>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[10px] text-slate-500 uppercase font-bold">Hasta</Label>
                                        <Input type="date" className="h-8 text-xs" value={filterDateEnd} onChange={e => setFilterDateEnd(e.target.value)}/>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {/* TABLA */}
            <div className="flex-1 overflow-hidden bg-slate-50/20">
                <ScrollArea className="h-full">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="w-[90px] font-bold text-slate-700 text-center">Acción</TableHead>
                                <TableHead className="font-bold text-slate-700">Cliente</TableHead>
                                <TableHead className="font-bold text-slate-700">DNI</TableHead>
                                <TableHead className="font-bold text-slate-700">Detalle</TableHead>
                                <TableHead className="font-bold text-slate-700">Origen</TableHead>
                                <TableHead className="font-bold text-slate-700">Estado</TableHead>
                                <TableHead className="font-bold text-slate-700 text-center">Liq.</TableHead>
                                <TableHead className="font-bold text-slate-700">Fecha</TableHead>
                                <TableHead className="font-bold text-slate-700">Vendedor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-20 text-slate-400">
                                        <RefreshCw className="animate-spin h-8 w-8 mx-auto mb-2 opacity-50"/>
                                        Cargando base completa...
                                    </TableCell>
                                </TableRow>
                            )}
                            
                            {!loading && filteredOps.map((op: any) => (
                                <TableRow key={op.id} className="hover:bg-slate-50 cursor-pointer transition-colors group border-b border-slate-100" onClick={() => onSelectOp(op)}>
                                    <TableCell className="flex gap-1 justify-center">
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50" title="Ver Detalle">
                                            <Eye size={14}/>
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50" 
                                            title="Eliminar"
                                            onClick={(e) => { e.stopPropagation(); confirmDelete(op.id); }}
                                        >
                                            <Trash2 size={14}/>
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-slate-700 text-sm">{op.clientName || "Sin Nombre"}</div>
                                        <div className="flex gap-1 mt-0.5">
                                            {op.chat?.length > 0 && <MessageSquare size={10} className="text-blue-400"/>}
                                            {op.adminNotes?.length > 0 && <StickyNote size={10} className="text-yellow-500"/>}
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-xs text-slate-500">{op.dni || "-"}</TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="bg-white border-slate-200 text-slate-600 font-medium text-[10px]">
                                            {op.prepaga || "S/D"} {op.plan && op.plan !== 'General' ? op.plan : ''}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-500 truncate max-w-[100px]" title={op.origen}>
                                        {op.origen || "-"}
                                    </TableCell>
                                    <TableCell>
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${getBadgeColor(op.status)}`}>
                                            {op.status || "Desconocido"}
                                        </span>
                                    </TableCell>
                                    
                                    <TableCell className="text-center">
                                        {op.status === 'cumplidas' && op.billing_period ? (
                                            <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200 font-bold capitalize text-[10px]">
                                                {formatBillingPeriod(op.billing_period)}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-300">-</span>
                                        )}
                                    </TableCell>

                                    <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                                        {op.entryDate ? new Date(op.entryDate).toLocaleDateString() : "-"}
                                    </TableCell>
                                    <TableCell className="text-xs font-bold text-slate-600">{op.seller || "S/A"}</TableCell>
                                </TableRow>
                            ))}
                            {!loading && filteredOps.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12">
                                        <div className="flex flex-col items-center text-slate-400">
                                            <Database size={32} className="mb-2 opacity-20"/>
                                            <p className="font-medium text-slate-500">No se encontraron resultados.</p>
                                            <p className="text-xs mb-4">Intenta ajustar los filtros o el término de búsqueda.</p>
                                            <Button variant="outline" onClick={clearFilters} className="text-blue-600 border-blue-200 hover:bg-blue-50">
                                                <RefreshCw size={14} className="mr-2"/> Limpiar Filtros
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
            
            <div className="p-2 border-t border-slate-100 bg-slate-50 text-[10px] text-center text-slate-400 font-medium">
                {loading ? "Sincronizando..." : `Visualizando ${filteredOps.length} registros de toda la base.`}
            </div>

            {/* MODAL BORRAR */}
            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 flex items-center gap-2">
                            <Trash2 size={20}/> Confirmar Eliminación Global
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Estás a punto de borrar un registro de la base de datos global.
                            <br/>Se eliminará el historial, chat y métricas asociadas.
                            <br/>Esta acción no se puede deshacer.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700 text-white">
                            {deleting ? "Eliminando..." : "Sí, Eliminar"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}