"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Database, Download, Search, FileSpreadsheet, Calendar, Trash2, Filter, X, RefreshCw, AlertTriangle, UserCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

export function AdminDatabase() {
    const supabase = createClient()
    const [loading, setLoading] = useState(true)
    const [leads, setLeads] = useState<any[]>([])
    
    // --- LISTAS DINÁMICAS (Se llenan desde DB) ---
    const [agentsList, setAgentsList] = useState<string[]>([])
    const [statusList, setStatusList] = useState<string[]>([])
    const [sourceList, setSourceList] = useState<string[]>([])
    const [lossReasonsList, setLossReasonsList] = useState<string[]>([])

    // --- FILTROS ---
    const [searchTerm, setSearchTerm] = useState("")
    const [filterAgent, setFilterAgent] = useState("all")
    const [filterStatus, setFilterStatus] = useState("all")
    const [filterSource, setFilterSource] = useState("all")
    const [filterLossReason, setFilterLossReason] = useState("all")
    
    // Filtro de Fecha (Rango)
    const [dateFrom, setDateFrom] = useState("")
    const [dateTo, setDateTo] = useState("")

    const [showFilters, setShowFilters] = useState(false)

    // --- SELECCIÓN MASIVA ---
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [targetAgent, setTargetAgent] = useState("")

    // Extras
    const [lastExport, setLastExport] = useState("Sin datos")
    const [deleteId, setDeleteId] = useState<string | null>(null)

    // 1. CARGA DE DATOS REALES + LLENADO DE FILTROS
    const fetchData = async () => {
        setLoading(true)
        
        // Query base
        let query = supabase
            .from('leads')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(2500) // Límite seguro aumentado

        // Aplicamos filtro de fecha en la query si existen
        if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
        if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

        const { data, error } = await query

        if (data) {
            setLeads(data)
            
            // --- GENERACIÓN INTELIGENTE DE FILTROS ---
            // Escanea lo que trajimos para llenar los selectores con opciones reales
            const uniqueAgents = [...new Set(data.map((l: any) => l.agent_name))].filter(Boolean) as string[]
            const uniqueStatuses = [...new Set(data.map((l: any) => l.status))].filter(Boolean) as string[]
            const uniqueSources = [...new Set(data.map((l: any) => l.source))].filter(Boolean) as string[]
            const uniqueLossReasons = [...new Set(data.map((l: any) => l.loss_reason))].filter(Boolean) as string[]
            
            setAgentsList(uniqueAgents.sort())
            setStatusList(uniqueStatuses.sort())
            setSourceList(uniqueSources.sort())
            setLossReasonsList(uniqueLossReasons.sort())
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        const channel = supabase.channel('db_realtime_v2')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
            .subscribe()

        const storedDate = localStorage.getItem('last_db_export')
        if (storedDate) setLastExport(storedDate)

        return () => { supabase.removeChannel(channel) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dateFrom, dateTo]) // Recargar si cambian las fechas

    // 2. LÓGICA DE FILTRADO LOCAL
    const filteredData = leads.filter(item => {
        const matchesSearch = 
            (item.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (item.phone?.toLowerCase() || "").includes(searchTerm.toLowerCase())
        
        const matchesAgent = filterAgent === "all" || item.agent_name === filterAgent
        const matchesStatus = filterStatus === "all" || item.status === filterStatus
        const matchesSource = filterSource === "all" || item.source === filterSource
        const matchesLoss = filterLossReason === "all" || item.loss_reason === filterLossReason

        return matchesSearch && matchesAgent && matchesStatus && matchesSource && matchesLoss
    })

    // 3. SELECCIÓN MASIVA
    const handleSelectAll = (checked: boolean) => {
        if (checked) setSelectedIds(filteredData.map(l => l.id))
        else setSelectedIds([])
    }

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) setSelectedIds(prev => [...prev, id])
        else setSelectedIds(prev => prev.filter(x => x !== id))
    }

    const executeReassign = async () => {
        if (selectedIds.length === 0 || !targetAgent) return
        
        const { error } = await supabase
            .from('leads')
            .update({ 
                agent_name: targetAgent, 
                last_update: new Date().toISOString() 
            })
            .in('id', selectedIds)

        if (!error) {
            alert(`✅ ${selectedIds.length} leads reasignados a ${targetAgent}.`)
            setSelectedIds([])
            setTargetAgent("")
            fetchData()
        } else {
            alert("Error al reasignar.")
        }
    }

    // 4. EXPORTACIÓN CSV
    const handleExport = () => {
        if (filteredData.length === 0) return alert("No hay datos visibles para exportar.")

        const headers = ["ID", "Fecha", "Nombre", "Telefono", "Fuente", "Agente", "Estado", "Motivo Perdida", "Prepaga", "Precio", "Notas"]
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
                `"${row.loss_reason || ''}"`,
                `"${row.operator || row.prepaga || ''}"`,
                row.price || 0,
                `"${(row.notes || '').replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvRows], { type: 'text/csv' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.setAttribute('href', url)
        a.setAttribute('download', `Base_Filtrada_${new Date().toISOString().split('T')[0]}.csv`)
        a.click()

        const now = new Date().toLocaleString()
        setLastExport(now)
        localStorage.setItem('last_db_export', now)
    }

    // 5. ELIMINACIÓN
    const confirmDelete = async () => {
        if (!deleteId) return
        const { error } = await supabase.from('leads').delete().eq('id', deleteId)
        if (!error) {
            fetchData() 
            setDeleteId(null)
        } else {
            alert("Error al eliminar.")
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
                    <p className="text-slate-500">Gestión inteligente de base de datos.</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3"/> Última exportación: {lastExport}
                    </p>
                    <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-md">
                        <Download className="mr-2 h-4 w-4" /> DESCARGAR FILTRADO
                    </Button>
                </div>
            </div>

            <Card className="border-t-4 border-t-slate-600 shadow-xl">
                <CardHeader className="bg-slate-50 dark:bg-slate-900/50 border-b p-4 space-y-4">
                    
                    {/* BARRA DE BÚSQUEDA Y ACCIÓN DE FILTROS */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2">
                            <FileSpreadsheet className="h-5 w-5 text-slate-500"/>
                            <span className="font-bold text-slate-700 dark:text-slate-200">
                                {filteredData.length} Registros encontrados
                            </span>
                        </div>
                        
                        <div className="flex gap-2 w-full md:w-auto">
                            <div className="relative w-full md:w-80">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                                <Input placeholder="Buscar por nombre o teléfono..." className="pl-8 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                            </div>
                            <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)} className="gap-2">
                                <Filter className="h-4 w-4"/> Filtros Avanzados
                            </Button>
                        </div>
                    </div>

                    {/* ZONA DE FILTROS AVANZADOS */}
                    {showFilters && (
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 animate-in slide-in-from-top-2 bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
                            
                            {/* FECHA INTELIGENTE */}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Rango de Fecha</Label>
                                <div className="flex gap-2">
                                    <Input type="date" className="text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                    <Input type="date" className="text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Vendedor</Label>
                                <Select value={filterAgent} onValueChange={setFilterAgent}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {agentsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Estado</Label>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {statusList.map(s => <SelectItem key={s} value={s}>{s.toUpperCase()}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs text-slate-500 font-bold uppercase">Motivo Pérdida</Label>
                                <Select value={filterLossReason} onValueChange={setFilterLossReason}>
                                    <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        {lossReasonsList.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="md:col-span-4 flex justify-end pt-2 border-t mt-2">
                                <Button variant="ghost" size="sm" onClick={() => {
                                    setFilterAgent("all"); setFilterStatus("all"); setFilterSource("all"); 
                                    setFilterLossReason("all"); setSearchTerm(""); setDateFrom(""); setDateTo("");
                                }} className="text-xs text-red-500">
                                    <X className="h-3 w-3 mr-1"/> Limpiar Todo
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* BARRA DE REASIGNACIÓN MASIVA (Solo aparece si seleccionas algo) */}
                    {selectedIds.length > 0 && (
                        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                            <span className="text-sm font-bold text-blue-800 ml-2">
                                {selectedIds.length} leads seleccionados
                            </span>
                            <div className="flex gap-2 items-center">
                                <Select value={targetAgent} onValueChange={setTargetAgent}>
                                    <SelectTrigger className="w-[200px] h-8 bg-white border-blue-200">
                                        <SelectValue placeholder="Reasignar a..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {agentsList.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={executeReassign}>
                                    <UserCheck className="h-4 w-4 mr-2"/> Aplicar
                                </Button>
                            </div>
                        </div>
                    )}
                </CardHeader>

                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[40px]">
                                        <Checkbox 
                                            checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                                            onCheckedChange={(c) => handleSelectAll(c as boolean)}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[100px]">Fecha</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Fuente</TableHead>
                                    <TableHead>Vendedor</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Detalle / Pérdida</TableHead>
                                    <TableHead className="text-right">Acción</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredData.map((row) => (
                                    <TableRow key={row.id} className="hover:bg-slate-50 transition-colors">
                                        <TableCell>
                                            <Checkbox 
                                                checked={selectedIds.includes(row.id)}
                                                onCheckedChange={(c) => handleSelectOne(row.id, c as boolean)}
                                            />
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-slate-500">{new Date(row.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="font-bold text-sm">{row.name}</div>
                                            <div className="text-xs text-slate-400 font-mono">{row.phone}</div>
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{row.source || '-'}</Badge></TableCell>
                                        <TableCell className="font-medium text-xs">{row.agent_name || 'Sin Asignar'}</TableCell>
                                        <TableCell>
                                            <Badge className={`${getStatusColor(row.status)} text-white border-0 capitalize shadow-sm`}>
                                                {row.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-500 max-w-[200px] truncate">
                                            {row.loss_reason ? <span className="text-red-500 font-bold">{row.loss_reason}</span> : (row.operator || row.prepaga || '-')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-slate-300 hover:text-red-600" onClick={() => setDeleteId(row.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredData.length === 0 && !loading && (
                                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-400">Sin resultados con los filtros actuales.</TableCell></TableRow>
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
                        <DialogDescription>¿Estás seguro? <b>Esto es irreversible.</b> El dato se borrará permanentemente.</DialogDescription>
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