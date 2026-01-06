"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Search, AlertTriangle, Cake, MessageCircle, HeartHandshake, MapPin, Filter, RefreshCw, Trash2, Undo2, Users, LayoutList } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

// IMPORTAMOS EL MODAL COMPLETO Y SUS HELPERS
import { OpsModal } from "./OpsModal"
import { getStatusColor, getSubStateStyle } from "./data"

// --- HELPERS COLORES POSTVENTA ---
const getFinancialColor = (status: string) => {
    switch(status) {
        case 'SIN MORA': return "bg-green-100 text-green-700 ring-green-600/20"
        case 'PRE MORA': return "bg-yellow-100 text-yellow-700 ring-yellow-600/20"
        case 'MORA 1': return "bg-orange-100 text-orange-700 ring-orange-600/20"
        case 'MORA 2': return "bg-orange-200 text-orange-800 ring-orange-700/20"
        case 'MORA 3': return "bg-red-100 text-red-700 ring-red-600/20"
        case 'IMPAGO': return "bg-red-600 text-white ring-red-600"
        default: return "bg-slate-100 text-slate-700"
    }
}

const getActionColor = (status: string) => {
    switch(status) {
        case 'PRESENTACION': return "text-blue-600 border-blue-200 bg-blue-50"
        case 'CAMBIO DE PASS': return "text-purple-600 border-purple-200 bg-purple-50"
        case 'MENSAJE MORA': return "text-red-600 border-red-200 bg-red-50"
        default: return "text-slate-500 border-slate-200 bg-white"
    }
}

// --- HELPER PARA COLORES DE PREPAGA (TU PEDIDO) ---
const getPrepagaBadgeColor = (prepaga: string) => {
    const p = prepaga || ""
    if (p.includes("Prevención")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
    if (p.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
    if (p.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
    if (p.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
    if (p.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
    if (p.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"
    
    return "bg-slate-50 border-slate-100 text-slate-800"
}

export function OpsPostSale() {
    const supabase = createClient()
    const [clients, setClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    
    // --- ESTADO PARA MODAL COMPLETO ---
    const [selectedOp, setSelectedOp] = useState<any>(null)
    
    // --- ESTADO PARA ELIMINAR DE CARTERA ---
    const [clientToRemove, setClientToRemove] = useState<any>(null)

    // --- CONFIG GLOBAL (Necesaria para el Modal) ---
    const [globalConfig, setGlobalConfig] = useState<{prepagas: any[], subStates: any}>({
        prepagas: [], 
        subStates: {}
    })

    // --- FILTROS AVANZADOS ---
    const [filters, setFilters] = useState({
        seller: "all",
        prepaga: "all",
        mora: "all",
        action: "all",
        province: "all"
    })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    
    // --- 1. CARGA DE DATOS ---
    const fetchPortfolio = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'cumplidas') 
            .eq('billing_approved', true) 
            .order('created_at', { ascending: false })

        if (data) {
            const mappedClients = data.map((c: any) => ({
                // Mapeamos todo lo necesario para OpsModal y la Tabla
                ...c, 
                id: c.id,
                clientName: c.name || "Sin Nombre", 
                name: c.name || "Sin Nombre",
                dni: c.dni || "-",
                dob: c.dob || "2000-01-01", 
                prepaga: c.prepaga || c.quoted_prepaga || "Sin Asignar",
                plan: c.plan || c.quoted_plan || "-",
                price: c.price || c.quoted_price || 0,
                seller: c.agent_name || "Desconocido",
                status: c.status,
                saleDate: new Date(c.created_at).toISOString().split('T')[0],
                activationDate: c.fecha_alta || "-", 
                financialStatus: c.financial_status || "SIN MORA",
                actionStatus: c.action_status || "OK",
                province: c.province || "Sin Datos",
                zip: c.address_zip || "-",
                observations: c.notes || "",
                // DATOS FAMILIARES
                capitas: c.capitas || 1,
                familia: c.family_members || c.hijos || [],
                // Agregados para que OpsModal no falle
                chat: [], 
                reminders: [],
                history: []
            }))
            setClients(mappedClients)
        }
        setLoading(false)
    }

    const fetchConfig = async () => {
        const { data } = await supabase.from('system_config').select('*')
        if (data) {
            const p = data.find(c => c.key === 'prepagas_plans')?.value || []
            const s = data.find(c => c.key === 'workflow_substates')?.value || {}
            setGlobalConfig({ prepagas: p, subStates: s })
        }
    }

    useEffect(() => {
        fetchPortfolio()
        fetchConfig()
    }, [])

    // --- ACTUALIZAR CLIENTE (Financiero/Acción) ---
    const updateClientField = async (id: string, field: string, value: any) => {
        // Actualización Optimista
        setClients(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
        
        // Update DB (snake_case y nombres corregidos)
        const dbUpdates: any = {}
        
        if (field === 'financialStatus') dbUpdates.financial_status = value
        else if (field === 'actionStatus') dbUpdates.action_status = value
        else dbUpdates[field] = value
        
        await supabase.from('leads').update(dbUpdates).eq('id', id)
    }

    // --- ELIMINAR DE CARTERA ---
    const handleRemoveFromPortfolio = async () => {
        if (!clientToRemove) return
        await supabase.from('leads').update({ 
            status: 'demoras',
            billing_approved: false,
            notes: (clientToRemove.observations || "") + "\n[SISTEMA]: Sacado de cartera postventa."
        }).eq('id', clientToRemove.id)
        
        setClients(prev => prev.filter(c => c.id !== clientToRemove.id))
        setClientToRemove(null)
    }

    // --- CUMPLEAÑOS ---
    const today = new Date() 
    const currentMonth = today.getMonth()
    const currentDay = today.getDate()

    const isBirthdayToday = (dobString: string) => {
        if(!dobString) return false
        const [y, m, d] = dobString.split('-').map(Number)
        return m - 1 === currentMonth && d === currentDay
    }

    const isBirthdayThisMonth = (dobString: string) => {
        if(!dobString) return false
        const [y, m, d] = dobString.split('-').map(Number)
        return m - 1 === currentMonth
    }

    const getAge = (dobString: string) => {
        if(!dobString) return 0
        const birth = new Date(dobString)
        let age = today.getFullYear() - birth.getFullYear()
        const m = today.getMonth() - birth.getMonth()
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
        return age
    }

    const todaysBirthdays = useMemo(() => clients.filter(c => isBirthdayToday(c.dob)), [clients])
    const upcomingBirthdays = useMemo(() => {
        return clients
            .filter(c => isBirthdayThisMonth(c.dob) && !isBirthdayToday(c.dob) && parseInt(c.dob.split('-')[2]) > currentDay)
            .sort((a, b) => parseInt(a.dob.split('-')[2]) - parseInt(b.dob.split('-')[2]))
            .slice(0, 3)
    }, [clients])

    // --- FILTRADO ---
    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.dni.includes(searchTerm) || 
                                  c.prepaga.toLowerCase().includes(searchTerm.toLowerCase())
            
            if (!matchesSearch) return false
            if (filters.seller !== "all" && c.seller !== filters.seller) return false
            if (filters.prepaga !== "all" && c.prepaga !== filters.prepaga) return false
            if (filters.mora !== "all" && c.financialStatus !== filters.mora) return false
            if (filters.action !== "all" && c.actionStatus !== filters.action) return false
            if (filters.province !== "all" && c.province !== filters.province) return false
            
            return true
        })
    }, [clients, searchTerm, filters])

    const uniqueSellers = Array.from(new Set(clients.map(c => c.seller))).filter(Boolean)
    const activeFiltersCount = Object.values(filters).filter(v => v !== "all").length

    const getWhatsAppLink = (client: any) => {
        const msg = `¡Hola ${client.name.split(' ')[0]}! 🎂 Desde GML Salud te deseamos un muy feliz cumpleaños. ¡Que tengas un día excelente!`
        return `https://wa.me/549${client.dni}?text=${encodeURIComponent(msg)}` 
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden max-w-[1900px] mx-auto pb-20 bg-slate-50/30">
            
            {/* KPIS & CUMPLES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div><p className="text-xs font-bold text-slate-400 uppercase">Cartera Activa</p><div className="text-2xl font-black text-slate-800">{clients.length}</div></div>
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><HeartHandshake/></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-red-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div><p className="text-xs font-bold text-slate-400 uppercase">Cartera en Mora</p><div className="text-2xl font-black text-red-600">{clients.filter(c => c.financialStatus !== 'SIN MORA').length}</div></div>
                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center text-red-600"><AlertTriangle/></div>
                    </CardContent>
                </Card>
                
                <Card className="bg-white border-slate-200 shadow-md border-l-4 border-l-pink-500 col-span-2 overflow-hidden">
                    <CardContent className="p-0 h-full flex">
                        <div className="flex-1 p-4 border-r border-slate-100 bg-pink-50/30 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3"><div className="bg-pink-100 text-pink-600 p-1.5 rounded-full"><Cake size={16}/></div><span className="text-xs font-bold text-pink-600 uppercase tracking-wider">Hoy ({todaysBirthdays.length})</span></div>
                            {todaysBirthdays.length > 0 ? (
                                <div className="space-y-2">{todaysBirthdays.map(c => (<div key={c.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-pink-100 shadow-sm"><div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarFallback className="text-[9px] bg-pink-600 text-white font-bold">{c.name.substring(0,2)}</AvatarFallback></Avatar><div><p className="text-xs font-bold text-slate-700 leading-none">{c.name}</p><p className="text-[9px] text-slate-400">{getAge(c.dob)} años</p></div></div><Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50 rounded-full" onClick={() => window.open(getWhatsAppLink(c), '_blank')}><MessageCircle size={14}/></Button></div>))}</div>
                            ) : <p className="text-xs text-slate-400 italic pl-1">No hay cumpleaños hoy.</p>}
                        </div>
                        <div className="flex-1 p-4 flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Próximos Festejos</span>
                            <div className="space-y-2">{upcomingBirthdays.length > 0 ? upcomingBirthdays.map(c => (<div key={c.id} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1 last:border-0"><div className="flex items-center gap-2"><span className="font-bold text-slate-600 bg-slate-100 px-1.5 rounded text-[10px]">{c.dob.split('-')[2]}/{c.dob.split('-')[1]}</span><span className="text-slate-600 truncate max-w-[120px]">{c.name}</span></div><span className="text-[10px] text-slate-400">{getAge(c.dob)} años</span></div>)) : <span className="text-xs text-slate-400 italic">No hay más este mes.</span>}</div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* TOOLBAR & FILTROS */}
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 max-w-md"><Search className="absolute left-3 top-2.5 text-slate-400 h-4 w-4"/><Input placeholder="Buscar cliente..." className="pl-9 bg-slate-50 border-slate-200" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
                <div className="h-8 w-px bg-slate-200"></div>
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild><Button variant={activeFiltersCount>0?"default":"outline"} className="gap-2 relative"><Filter size={16}/> Filtros {activeFiltersCount>0 && <span className="bg-pink-500 text-white text-[10px] h-5 w-5 rounded-full flex items-center justify-center absolute -top-2 -right-2">{activeFiltersCount}</span>}</Button></PopoverTrigger>
                    <PopoverContent className="w-[320px] p-4" align="end">
                        <div className="space-y-4">
                            <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2"><LayoutList size={16}/> Filtrar Cartera</h4>
                            <Separator/>
                            <div className="space-y-3">
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Estado Mora</label><Select value={filters.mora} onValueChange={v => setFilters({...filters, mora: v})}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="SIN MORA">Sin Mora</SelectItem><SelectItem value="PRE MORA">Pre Mora</SelectItem><SelectItem value="MORA 1">Mora 1</SelectItem><SelectItem value="MORA 2">Mora 2</SelectItem><SelectItem value="MORA 3">Mora 3</SelectItem><SelectItem value="IMPAGO">Impago</SelectItem></SelectContent></Select></div>
                                <div className="space-y-1"><label className="text-[10px] font-bold text-slate-500 uppercase">Vendedor</label><Select value={filters.seller} onValueChange={v => setFilters({...filters, seller: v})}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos"/></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{uniqueSellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                            </div>
                            <Button className="w-full h-8 text-xs bg-slate-900 text-white" onClick={() => setIsFilterOpen(false)}>Aplicar</Button>
                        </div>
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" onClick={fetchPortfolio}><RefreshCw className={`h-4 w-4 text-slate-400 ${loading?'animate-spin':''}`}/></Button>
            </div>

            {/* TABLA */}
            <Card className="flex-1 overflow-hidden border-slate-200 shadow-md">
                <CardContent className="p-0 h-full overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10"><TableRow><TableHead>Cliente</TableHead><TableHead>Ubicación</TableHead><TableHead>Plan & Familia</TableHead><TableHead>Vendedor</TableHead><TableHead>Fechas</TableHead><TableHead>Estado</TableHead><TableHead>Acción</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                            {loading ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-400">Cargando...</TableCell></TableRow> : 
                             filteredClients.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-400">Sin resultados.</TableCell></TableRow> : 
                             filteredClients.map((client) => (
                                <TableRow key={client.id} className="hover:bg-slate-50 cursor-pointer group" onClick={() => setSelectedOp(client)}>
                                    <TableCell>
                                        <div className="flex items-start gap-3">
                                            <div className="relative"><Avatar className="h-9 w-9 border border-slate-200"><AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">{client.name.substring(0,2)}</AvatarFallback></Avatar>{isBirthdayThisMonth(client.dob) && <div className="absolute -top-1 -right-1 bg-pink-100 p-0.5 rounded-full text-pink-500"><Cake size={10}/></div>}</div>
                                            <div><div className="font-bold text-slate-800 text-sm flex items-center gap-2">{client.name}{isBirthdayToday(client.dob) && <Badge className="bg-pink-500 text-[9px] h-4 px-1">Hoy!</Badge>}</div><div className="text-[11px] font-mono text-slate-400 mt-0.5">{client.dni}</div></div>
                                        </div>
                                    </TableCell>
                                    <TableCell><div className="flex items-center gap-1 text-xs text-slate-600"><MapPin size={12} className="text-slate-400"/> {client.province}</div></TableCell>
                                    
                                    {/* COLUMNA PLAN & FAMILIA CON POPOVER (SOLUCIÓN HOVERCARD) */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <div className="flex flex-col items-start gap-1">
                                            {/* Badge con Color Personalizado */}
                                            <Badge variant="outline" className={`w-fit border ${getPrepagaBadgeColor(client.prepaga)}`}>
                                                {client.prepaga} - {client.plan}
                                            </Badge>
                                            
                                            {/* Reemplazo de HoverCard por Popover (Click para ver) */}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 cursor-help hover:bg-blue-100 transition-colors">
                                                        <Users size={10} className="text-blue-500"/>
                                                        <span className="text-[10px] font-bold text-blue-700">{client.capitas} Cápitas</span>
                                                    </div>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-60 p-3 bg-white border-slate-200 shadow-xl">
                                                    <h4 className="text-xs font-black text-slate-600 uppercase mb-2 border-b pb-1">Grupo Familiar</h4>
                                                    <div className="space-y-2">
                                                        <div className="text-xs">
                                                            <span className="font-bold text-slate-800 block">{client.name}</span>
                                                            <span className="text-[10px] text-slate-400">Titular</span>
                                                        </div>
                                                        {client.familia && client.familia.length > 0 ? client.familia.map((f: any, i: number) => (
                                                            <div key={i} className="text-xs border-t border-slate-50 pt-1 mt-1">
                                                                <span className="font-medium text-slate-700 block">{f.nombre}</span>
                                                                <div className="flex justify-between">
                                                                    <span className="text-[10px] text-slate-400">{f.dni}</span>
                                                                    <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 uppercase">{f.rol || 'Familiar'}</span>
                                                                </div>
                                                            </div>
                                                        )) : (
                                                            client.capitas > 1 ? <p className="text-[10px] text-red-400 italic">No hay datos de familiares cargados.</p> : null
                                                        )}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </TableCell>

                                    <TableCell><span className="text-xs font-medium text-slate-600">{client.seller}</span></TableCell>
                                    <TableCell><div className="flex flex-col gap-1 text-[10px] text-slate-400"><span>V: {client.saleDate}</span><span className="font-bold text-blue-600">A: {client.activationDate}</span></div></TableCell>
                                    
                                    {/* DROPDOWNS CLICK STOP PROPAGATION */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Select value={client.financialStatus} onValueChange={(val) => updateClientField(client.id, 'financialStatus', val)}>
                                            <SelectTrigger className={`h-7 text-[10px] font-bold border-0 ring-1 ring-inset ${getFinancialColor(client.financialStatus)}`}><SelectValue /></SelectTrigger>
                                            <SelectContent><SelectItem value="SIN MORA">SIN MORA</SelectItem><SelectItem value="PRE MORA">PRE MORA</SelectItem><SelectItem value="MORA 1">MORA 1</SelectItem><SelectItem value="MORA 2">Mora 2</SelectItem><SelectItem value="MORA 3">Mora 3</SelectItem><SelectItem value="IMPAGO">IMPAGO</SelectItem></SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Select value={client.actionStatus} onValueChange={(val) => updateClientField(client.id, 'actionStatus', val)}>
                                            <SelectTrigger className={`h-7 text-[10px] font-medium border border-dashed ${getActionColor(client.actionStatus)}`}><SelectValue placeholder="-" /></SelectTrigger>
                                            <SelectContent><SelectItem value="OK">Todo OK</SelectItem><SelectItem value="PRESENTACION">PRESENTACIÓN</SelectItem><SelectItem value="CAMBIO DE PASS">CAMBIO DE PASS</SelectItem><SelectItem value="MENSAJE MORA">MENSAJE MORA</SelectItem></SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={() => setClientToRemove(client)}><Trash2 size={14}/></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* --- MODAL COMPLETO --- */}
            <OpsModal 
                op={selectedOp} 
                isOpen={!!selectedOp} 
                onClose={() => setSelectedOp(null)} 
                onUpdateOp={() => fetchPortfolio()} 
                currentUser={"Administración"} 
                role={"admin_god"} 
                onStatusChange={()=>{}} onRelease={()=>{}} requestAdvance={()=>{}} requestBack={()=>{}} onPick={()=>{}} onSubStateChange={()=>{}} 
                onAddNote={async (note: string) => {
                    const newNote = `POSTVENTA|${new Date().toLocaleString()}|Admin|${note}`
                    const currentNotes = selectedOp.notes ? selectedOp.notes + "|||" + newNote : newNote
                    await supabase.from('leads').update({ notes: currentNotes }).eq('id', selectedOp.id)
                }}
                onSendChat={()=>{}} onAddReminder={()=>{}} 
                getStatusColor={getStatusColor} 
                getSubStateStyle={getSubStateStyle}
                globalConfig={globalConfig}
            />

            {/* MODAL CONFIRMACIÓN RETIRO */}
            <Dialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-3"><Undo2 className="h-6 w-6 text-red-600"/></div>
                        <DialogTitle className="text-center text-lg font-bold">¿Sacar de Cartera?</DialogTitle>
                        <DialogDescription className="text-center">El cliente <b>{clientToRemove?.name}</b> volverá a "Demoras".</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2">
                        <Button variant="ghost" onClick={() => setClientToRemove(null)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleRemoveFromPortfolio}>Confirmar Retiro</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}