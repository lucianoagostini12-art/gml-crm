"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Database, Download, Search, FileSpreadsheet, Calendar, Trash2, Filter, X, RefreshCw, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

export function AdminDatabase() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [leads, setLeads] = useState<any[]>([])
    
    // Listas Dinámicas para Filtros (Se llenan solas)
    const [agentsList, setAgentsList] = useState<string[]>([])
    const [statusList, setStatusList] = useState<string[]>([])
    const [sourceList, setSourceList] = useState<string[]>([])

    // Estados de Filtro
    const [searchTerm, setSearchTerm] = useState("")
    const [filterAgent, setFilterAgent] = useState("all")
    const [filterStatus, setFilterStatus] = useState("all")
    const [filterSource, setFilterSource] = useState("all")
    const [showFilters, setShowFilters] = useState(false)

    // Extras
    const [lastExport, setLastExport] = useState("Sin datos")
    const [deleteId, setDeleteId] = useState<string | null>(null)

    // 1. CARGA DE DATOS REALES
    const fetchData = async () => {
        setLoading(true)
        
        // Traemos TODO ordenado por fecha
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2000) // Límite de seguridad

        if (data) {
            setLeads(data)
            
            // --- GENERACIÓN DE FILTROS DINÁMICOS ---
            // Escanea la base y extrae los valores únicos que existen REALMENTE
            const uniqueAgents = [...new Set(data.map((l: any) => l.agent_name))].filter(Boolean) as string[]
            const uniqueStatuses = [...new Set(data.map((l: any) => l.status))].filter(Boolean) as string[]
            const uniqueSources = [...new Set(data.map((l: any) => l.source))].filter(Boolean) as string[]
            
            setAgentsList(uniqueAgents.sort())
            setStatusList(uniqueStatuses.sort())
            setSourceList(uniqueSources.sort())
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        // Escuchar cambios en tiempo real (si alguien edita un estado, se actualiza acá)
        const channel = supabase.channel('db_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
            .subscribe()

        const storedDate = localStorage.getItem('last_db_export')
        if (storedDate) setLastExport(storedDate)

        return () => { supabase.removeChannel(channel) }
    }, [])

    // 2. LÓGICA DE FILTRADO
    const filteredData = leads.filter(item => {
        // Búsqueda Texto
        const matchesSearch = 
            (item.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (item.phone?.toLowerCase() || "").includes(searchTerm.toLowerCase())
        
        // Selectores
        const matchesAgent = filterAgent === "all" || item.agent_name === filterAgent
        const matchesStatus = filterStatus === "all" || item.status === filterStatus
        const matchesSource = filterSource === "all" || item.source === filterSource

        return matchesSearch && matchesAgent && matchesStatus && matchesSource
    })

    // 3. EXPORTACIÓN CSV
    const handleExport = () => {
        if (filteredData.length === 0) return alert("No hay datos visibles para exportar.")

        const headers = ["ID", "Fecha", "Nombre", "Telefono", "Fuente", "Agente", "Estado", "Prepaga", "Precio", "Notas"]
        const csvRows = [
            headers.join(','),
            ...filteredData.map(row => [
                row.id,
                `"${new Date(row.created_at).toLocaleDateString()}"`,
                `"${row.name || ''}"`,
                `"${row.phone || ''}"`,
                `"${row.source || ''}"`,
                `"${row.agent_name || ''}"`,
                `"${row.status || ''}"`,
                `"${row.operator || row.prepaga || ''}"`,
                row.price || 0,
                `"${(row.notes || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvRows], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.setAttribute('href', url)
        a.setAttribute('download', `Base_Maestra_${new Date().toISOString().split('T')[0]}.csv`)
        a.click()

        const now = new Date().toLocaleString()
        setLastExport(now)
        localStorage.setItem('last_db_export', now)
    }

    // 4. ELIMINACIÓN REAL (Base de Datos)
    const confirmDelete = async () => {
        if (!deleteId) return
        
        // Borrado real en Supabase
        const { error } = await supabase.from('leads').delete().eq('id', deleteId)
        
        if (!error) {
            // Actualizamos la tabla localmente y recalculamos los filtros si es necesario
            fetchData() 
            setDeleteId(null)
        } else {
            alert("Error al eliminar el dato.")
        }
    }

    const getStatusColor = (status: string) => {
        const s = status?.toLowerCase() || ""
        if (['vendido', 'cumplidas'].includes(s)) return 'bg-green-500 hover:bg-green-600'
        if (['perdido', 'baja', 'rechazado'].includes(s)) return 'bg-red-500 hover:bg-red-600'
        if (s === 'cotizacion') return 'bg-yellow-500 hover:bg-yellow-600'
        return 'bg-blue-500 hover:bg-blue-600'
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-[1600px] mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Database className="h-8 w-8 text-slate-600" /> Base Maestra
                        {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
                    </h2>
                    <p className="text-slate-500">Repositorio total de datos históricos.</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3"/> Última exportación: {lastExport}
                    </p>
                    <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-md">
                        <Download className="mr-2 h-4 w-4" /> DESCARGAR CSV
                    </Button>
                </div>
            </div>

            <Card className="border-t-4 border-t-slate-600 shadow-xl">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b p-4 space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-slate-500"/>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                {filteredData.length} Registros
                            </span>
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                <Input placeholder="Buscar..." className="pl-8 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                            </div>
                            <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)} className="gap-2">
                                <Filter className="h-4 w-4"/> Filtros
                            </Button>
                        </div>
                    </div>

                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 animate-in slide-in-from-top-2">
                            {/* FILTRO AGENTE DINÁMICO */}
                            <Select value={filterAgent} onValueChange={setFilterAgent}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Vendedor" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Vendedores</SelectItem>
                                    {agentsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* FILTRO ESTADO DINÁMICO */}
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Estado" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Estados</SelectItem>
                                    {statusList.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {/* FILTRO ORIGEN DINÁMICO */}
                            <Select value={filterSource} onValueChange={setFilterSource}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Origen" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los Orígenes</SelectItem>
                                    {sourceList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            <Button variant="ghost" size="sm" onClick={() => {setFilterAgent("all"); setFilterStatus("all"); setFilterSource("all"); setSearchTerm("")}} className="text-xs text-red-500 md:col-span-3 w-fit ml-auto">
                                <X className="h-3 w-3 mr-1"/> Limpiar Filtros
                            </Button>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10">
                                <TableRow>
                                    <TableHead className="w-[100px]">Fecha</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Teléfono</TableHead>
                                    <TableHead>Origen</TableHead>
                                    <TableHead>Prepaga</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-slate-50">
                                        <TableCell className="font-mono text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="font-bold">{row.name}</TableCell>
                                        <TableCell className="text-xs font-mono">{row.phone}</TableCell>
                                        <TableCell><Badge variant="outline">{row.source || '-'}</Badge></TableCell>
                                        <TableCell className="text-sm">{row.operator || row.prepaga || '-'}</TableCell>
                                        <TableCell className="font-medium text-xs">{row.agent_name || 'Sin Asignar'}</TableCell>
                                        <TableCell><Badge className={`${getStatusColor(row.status)} text-white border-0 capitalize`}>{row.status}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => setDeleteId(row.id)}>
                                                <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-600" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredData.length === 0 && !loading && (
                                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-400">Base de datos vacía o sin coincidencias.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5"/> Confirmar Eliminación</DialogTitle>
                        <DialogDescription>¿Estás seguro? <b>Esto es irreversible.</b> El dato se borrará de Supabase.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={confirmDelete}>Sí, Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}