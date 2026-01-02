"use client"

import { useState, useEffect } from "react"
// 1. IMPORTAMOS SUPABASE
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Layers, Recycle, Trash2, ArrowRightLeft, Filter, Lock, RefreshCw } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export function AdminLeadFactory() {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)

    // ESTADOS DE DATOS
    const [unassignedLeads, setUnassignedLeads] = useState<any[]>([])
    const [redistributionList, setRedistributionList] = useState<any[]>([])
    const [drawerLeads, setDrawerLeads] = useState<any[]>([])
    
    // SELECCIÓN
    const [selectedLeads, setSelectedLeads] = useState<string[]>([])
    const [targetAgent, setTargetAgent] = useState("")
    const [autoAssignEnabled, setAutoAssignEnabled] = useState(false)

    // LISTA DE VENDEDORES (Idealmente vendría de la tabla profiles)
    const AGENTS = ["Maca", "Gonza", "Sofi", "Lucas", "Brenda", "Cami"]

    // FILTROS REDISTRIBUCIÓN
    const [sourceAgent, setSourceAgent] = useState("")
    const [filterDateLimit, setFilterDateLimit] = useState("")
    const [filterStage, setFilterStage] = useState("all")
    const [filterSource, setFilterSource] = useState("all")

    // ESTADOS CEMENTERIO (ESTADÍSTICAS)
    const [graveyardStats, setGraveyardStats] = useState({
        fantasmas: 0,
        precio: 0,
        interes: 0,
        basural: 0
    })
    const [activeDrawer, setActiveDrawer] = useState<string | null>(null)

    // CARGA INICIAL
    useEffect(() => { 
        fetchInbox()
        fetchGraveyardStats()
    }, [])

    // --- 1. BANDEJA DE ENTRADA (SIN DUEÑO) ---
    const fetchInbox = async () => {
        setLoading(true)
        // Buscamos leads donde agent_name sea NULL o 'Sin Asignar'
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .or('agent_name.is.null,agent_name.eq.Sin Asignar')
            .order('created_at', { ascending: false })
        
        if (data) setUnassignedLeads(data)
        setLoading(false)
    }

    // --- 2. REDISTRIBUCIÓN (BUSCAR LEADS DE OTROS) ---
    const fetchRedistributionData = async () => {
        if (!sourceAgent) return
        setLoading(true)
        
        let query = supabase
            .from('leads')
            .select('*')
            .eq('agent_name', sourceAgent) // Filtro base por vendedor
        
        // Filtros opcionales
        if (filterStage !== 'all') query = query.eq('status', filterStage.toLowerCase())
        // if (filterSource !== 'all') query = query.eq('source', filterSource) // Descomentar cuando tengas col source limpia
        if (filterDateLimit) query = query.lt('created_at', `${filterDateLimit}T23:59:59`)

        const { data } = await query
        if (data) setRedistributionList(data)
        setLoading(false)
    }

    // --- 3. CEMENTERIO (ESTADÍSTICAS REALES) ---
    const fetchGraveyardStats = async () => {
        // Traemos todos los perdidos para contar
        const { data } = await supabase
            .from('leads')
            .select('loss_reason') // Asumimos que tenés esta columna, sino usará notes
            .eq('status', 'perdido')

        if (data) {
            const stats = { fantasmas: 0, precio: 0, interes: 0, basural: 0 }
            data.forEach((l: any) => {
                const reason = l.loss_reason?.toLowerCase() || ""
                if (reason.includes("no contesta") || reason.includes("fantasma")) stats.fantasmas++
                else if (reason.includes("precio") || reason.includes("caro")) stats.precio++
                else if (reason.includes("interes") || reason.includes("no quiere")) stats.interes++
                else stats.basural++
            })
            setGraveyardStats(stats)
        }
    }

    const fetchDrawerLeads = async (category: string) => {
        // Traer leads perdidos según categoría para reciclar
        let reasonFilter = ""
        if (category === 'fantasmas') reasonFilter = 'no contesta'
        if (category === 'precio') reasonFilter = 'precio'
        if (category === 'interes') reasonFilter = 'interes'

        const { data } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'perdido')
            // Filtro simple de texto en loss_reason (ajustar según tu DB real)
            // .ilike('loss_reason', `%${reasonFilter}%`) 
            .limit(50) // Traemos los últimos 50 para no explotar

        if (data) setDrawerLeads(data)
    }

    // --- ACCIONES DE ASIGNACIÓN (UPDATE REAL) ---
    const executeAssign = async (origin: 'inbox' | 'redistribucion' | 'cementerio') => {
        if (selectedLeads.length === 0 || !targetAgent) return alert("Seleccioná leads y un destino.")
        
        setLoading(true)

        // Preparamos los datos a actualizar
        const updates: any = { 
            agent_name: targetAgent, 
            last_update: new Date().toISOString() 
        }

        // Si viene del cementerio, lo "revivimos" a estado 'nuevo' o 'contactado'
        if (origin === 'cementerio') {
            updates.status = 'nuevo' 
            updates.loss_reason = null // Limpiamos motivo de pérdida
        }

        const { error } = await supabase
            .from('leads')
            .update(updates)
            .in('id', selectedLeads)

        if (!error) {
            alert(`✅ ÉXITO: Se asignaron ${selectedLeads.length} leads a ${targetAgent}.`)
            setSelectedLeads([])
            
            // Recargar la vista actual
            if (origin === 'inbox') fetchInbox()
            if (origin === 'redistribucion') fetchRedistributionData()
            if (origin === 'cementerio') { setActiveDrawer(null); fetchGraveyardStats() }
        } else {
            alert("Error al asignar.")
            console.error(error)
        }
        setLoading(false)
    }

    // --- HELPERS UI ---
    const handleSelectAll = (list: any[], checked: boolean) => { if (checked) setSelectedLeads(list.map(l => l.id)); else setSelectedLeads([]) }
    const handleSelectOne = (id: string, checked: boolean) => { if (checked) setSelectedLeads(prev => [...prev, id]); else setSelectedLeads(prev => prev.filter(l => l !== id)) }
    const openDrawer = (category: string) => { setActiveDrawer(category); fetchDrawerLeads(category) }


    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Layers className="h-8 w-8 text-orange-500" /> LEADS
                        {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
                    </h2>
                    <p className="text-slate-500">Gestión de flujo, redistribución y reciclaje.</p>
                </div>
                <div className={`flex items-center gap-4 px-6 py-3 rounded-full border-2 transition-colors ${autoAssignEnabled ? 'bg-green-50 border-green-500' : 'bg-slate-50 border-slate-300'}`}>
                    <div className="flex flex-col">
                        <Label htmlFor="auto-mode" className={`font-black text-sm uppercase ${autoAssignEnabled ? 'text-green-700' : 'text-slate-500'}`}>{autoAssignEnabled ? '⚡ Round Robin ACTIVO' : '💤 Asignación Manual'}</Label>
                        <span className="text-[10px] text-slate-500">{autoAssignEnabled ? 'El sistema reparte solo.' : 'Los leads esperan en Bandeja.'}</span>
                    </div>
                    <Switch id="auto-mode" checked={autoAssignEnabled} onCheckedChange={setAutoAssignEnabled} />
                </div>
            </div>

            <Tabs defaultValue="inbox" className="w-full">
                <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 h-12 mb-6 w-full justify-start overflow-x-auto">
                    <TabsTrigger value="inbox" className="h-10 px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-bold shrink-0">📥 Bandeja ({unassignedLeads.length})</TabsTrigger>
                    <TabsTrigger value="redistribute" className="h-10 px-6 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 font-bold shrink-0">🔄 Redistribución (Gestión)</TabsTrigger>
                    <TabsTrigger value="graveyard" className="h-10 px-6 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-700 font-bold shrink-0">⚰️ Cementerio Inteligente</TabsTrigger>
                </TabsList>

                {/* --- 1. BANDEJA DE ENTRADA --- */}
                <TabsContent value="inbox">
                    <Card>
                        <CardHeader className="pb-3 border-b bg-slate-50 flex flex-row justify-between items-center">
                            <CardTitle>Leads Frescos (Sin Dueño)</CardTitle>
                            <div className="flex gap-2">
                                <Select value={targetAgent} onValueChange={setTargetAgent}>
                                    <SelectTrigger className="w-[180px] bg-white"><SelectValue placeholder="Asignar a..." /></SelectTrigger>
                                    <SelectContent>{AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button onClick={() => executeAssign('inbox')} disabled={selectedLeads.length === 0} className="bg-blue-600">
                                    Confirmar ({selectedLeads.length})
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox checked={unassignedLeads.length > 0 && selectedLeads.length === unassignedLeads.length} onCheckedChange={(c) => handleSelectAll(unassignedLeads, c as boolean)} /></TableHead><TableHead>Fecha</TableHead><TableHead>Nombre</TableHead><TableHead>Fuente</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {unassignedLeads.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8 text-slate-400">Bandeja vacía. Todo asignado.</TableCell></TableRow> : 
                                    unassignedLeads.map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell><Checkbox checked={selectedLeads.includes(l.id)} onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)} /></TableCell>
                                            <TableCell>{new Date(l.created_at).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-bold">{l.name}</TableCell>
                                            <TableCell><Badge variant="outline">{l.source || 'N/A'}</Badge></TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- 2. REDISTRIBUCIÓN --- */}
                <TabsContent value="redistribute">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <Card className="md:col-span-1 h-fit">
                            <CardHeader><CardTitle className="text-sm">🔍 Filtros de Cartera</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2"><Label>Vendedor Origen</Label><Select value={sourceAgent} onValueChange={(v) => {setSourceAgent(v); setRedistributionList([])}}><SelectTrigger><SelectValue placeholder="Elegir..." /></SelectTrigger><SelectContent>{AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
                                <div className="space-y-2"><Label>Asignados Antes De:</Label><Input type="date" value={filterDateLimit} onChange={e => setFilterDateLimit(e.target.value)} className="text-sm" /><p className="text-[10px] text-slate-400">Para limpiar leads viejos.</p></div>
                                <div className="space-y-2"><Label>Etapa (Kanban)</Label><Select value={filterStage} onValueChange={setFilterStage}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="nuevo">Nuevo</SelectItem><SelectItem value="contactado">Contactado</SelectItem><SelectItem value="cotizacion">Cotizado</SelectItem></SelectContent></Select></div>
                                <Button className="w-full bg-purple-600 hover:bg-purple-700 mt-2" onClick={fetchRedistributionData} disabled={!sourceAgent}>Buscar Leads</Button>
                            </CardContent>
                        </Card>

                        <Card className="md:col-span-3">
                            <CardHeader className="pb-3 border-b flex flex-row justify-between items-center">
                                <div><CardTitle>Resultados</CardTitle><CardDescription>{redistributionList.length} leads encontrados</CardDescription></div>
                                <div className="flex gap-2 items-center">
                                    <span className="text-xs text-slate-500 mr-2">Mover a:</span>
                                    <Select value={targetAgent} onValueChange={setTargetAgent}>
                                        <SelectTrigger className="w-[150px]"><SelectValue placeholder="Destino" /></SelectTrigger>
                                        <SelectContent>{AGENTS.filter(a => a !== sourceAgent).map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                                    </Select>
                                    <Button size="sm" onClick={() => executeAssign('redistribucion')} disabled={selectedLeads.length === 0}>Mover</Button>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox /></TableHead><TableHead>Nombre</TableHead><TableHead>Fecha</TableHead><TableHead>Etapa</TableHead><TableHead>Origen</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {redistributionList.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400">Usá los filtros para buscar leads.</TableCell></TableRow> : 
                                        redistributionList.map(l => (
                                            <TableRow key={l.id}>
                                                <TableCell><Checkbox checked={selectedLeads.includes(l.id)} onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)} /></TableCell>
                                                <TableCell className="font-bold">{l.name}</TableCell>
                                                <TableCell className="font-mono text-xs">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                                                <TableCell><Badge variant="outline">{l.status}</Badge></TableCell>
                                                <TableCell className="text-xs">{l.source || '-'}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                
                {/* --- 3. CEMENTERIO --- */}
                <TabsContent value="graveyard" className="space-y-6">
                    {!activeDrawer ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <Card className="hover:border-blue-400 cursor-pointer group" onClick={() => openDrawer('fantasmas')}><CardHeader className="pb-2"><CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-600">Fantasmas</CardTitle></CardHeader><CardContent><div className="flex justify-between items-end"><span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.fantasmas}</span><Badge className="bg-blue-100 text-blue-700">Recuperables</Badge></div><p className="text-xs text-slate-400 mt-2">No contestan</p></CardContent></Card>
                            <Card className="hover:border-green-400 cursor-pointer group" onClick={() => openDrawer('precio')}><CardHeader className="pb-2"><CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-green-600">Precio / Fríos</CardTitle></CardHeader><CardContent><div className="flex justify-between items-end"><span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.precio}</span><Badge className="bg-green-100 text-green-700">Recuperables</Badge></div><p className="text-xs text-slate-400 mt-2">Muy caros</p></CardContent></Card>
                            <Card className="hover:border-orange-400 cursor-pointer group" onClick={() => openDrawer('interes')}><CardHeader className="pb-2"><CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-orange-600">Interés Caído</CardTitle></CardHeader><CardContent><div className="flex justify-between items-end"><span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.interes}</span><Badge className="bg-orange-100 text-orange-700">Recuperables</Badge></div><p className="text-xs text-slate-400 mt-2">Lo pensará</p></CardContent></Card>
                            <Card className="opacity-60 border-dashed border-2"><CardHeader className="pb-2"><CardTitle className="text-sm font-black text-slate-400 uppercase tracking-widest">Basural</CardTitle></CardHeader><CardContent><div className="flex justify-between items-end"><span className="text-4xl font-black text-slate-400">{graveyardStats.basural}</span><Badge variant="outline">Descarte</Badge></div><p className="text-xs text-slate-400 mt-2">Datos inválidos / Quejas</p></CardContent></Card>
                        </div>
                    ) : (
                        <Card className="border-t-4 border-t-slate-500 shadow-xl animate-in slide-in-from-bottom-4">
                            <CardHeader className="pb-3 border-b bg-slate-50 flex flex-row justify-between items-center"><div><Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-500" onClick={() => setActiveDrawer(null)}>← Volver</Button><CardTitle className="capitalize flex items-center gap-2"><Recycle className="h-5 w-5"/> Cajón: {activeDrawer}</CardTitle></div><div className="flex gap-2 items-center bg-white p-2 rounded-lg border"><span className="text-xs font-bold mr-2">Revivir y asignar a:</span><Select value={targetAgent} onValueChange={setTargetAgent}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Elegir..." /></SelectTrigger><SelectContent>{AGENTS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select><Button onClick={() => executeAssign('cementerio')} className="bg-green-600 hover:bg-green-700">Reciclar ({selectedLeads.length})</Button></div></CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader><TableRow><TableHead className="w-[50px]"><Checkbox checked={drawerLeads.length > 0 && selectedLeads.length === drawerLeads.length} onCheckedChange={(c) => handleSelectAll(drawerLeads, c as boolean)} /></TableHead><TableHead>Nombre</TableHead><TableHead>Motivo Muerte</TableHead><TableHead>Último Dueño</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {drawerLeads.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center py-8">No hay leads en este cajón.</TableCell></TableRow> :
                                        drawerLeads.map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell><Checkbox checked={selectedLeads.includes(l.id)} onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)} /></TableCell>
                                            <TableCell className="font-bold">{l.name}</TableCell>
                                            <TableCell><Badge variant="outline">{l.loss_reason || 'Desconocido'}</Badge></TableCell>
                                            <TableCell className="text-xs">{l.agent_name}</TableCell>
                                        </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}