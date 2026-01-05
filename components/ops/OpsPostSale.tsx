"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase" // Conexión Real
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Search, AlertTriangle, Cake, MessageCircle, HeartHandshake, MapPin, Filter, Save, Pencil, LayoutList, Users, RefreshCw, Trash2, Undo2 } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

// --- HELPERS COLORES ---
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

export function OpsPostSale() {
    const supabase = createClient()
    const [clients, setClients] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    
    // --- ESTADO PARA EDICIÓN (MODAL) ---
    const [editingClient, setEditingClient] = useState<any>(null)
    
    // --- ESTADO PARA ELIMINAR DE CARTERA ---
    const [clientToRemove, setClientToRemove] = useState<any>(null)

    // --- FILTROS AVANZADOS ---
    const [filters, setFilters] = useState({
        seller: "all",
        prepaga: "all",
        mora: "all",
        action: "all",
        province: "all"
    })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    
    // --- 1. CARGA DE DATOS REALES (FILTRO CORREGIDO) ---
    const fetchPortfolio = async () => {
        setLoading(true)
        // AHORA FILTRAMOS POR 'cumplidas' Y ADEMÁS QUE HAYA PASADO POR FACTURACIÓN
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'cumplidas') // Solo los aprobados por Ops
            .eq('billing_approved', true) // Y aprobados por Facturación
            .order('created_at', { ascending: false })

        if (data) {
            const mappedClients = data.map((c: any) => ({
                id: c.id,
                name: c.name || "Sin Nombre",
                dni: c.dni || "-",
                dob: c.dob || "2000-01-01", 
                prepaga: c.prepaga || c.quoted_prepaga || "Sin Asignar",
                plan: c.plan || c.quoted_plan || "-",
                price: c.price || c.quoted_price || 0,
                seller: c.agent_name || "Desconocido",
                saleDate: new Date(c.created_at).toISOString().split('T')[0],
                activationDate: c.activation_date || "-", 
                financialStatus: c.financial_status || "SIN MORA",
                actionStatus: c.action_status || "OK",
                province: c.province || "Sin Datos",
                zip: c.zip || "-",
                observations: c.notes || "",
                condicionLaboral: c.labor_condition || "Monotributo", 
                hijos: [] 
            }))
            setClients(mappedClients)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchPortfolio()
    }, [])

    // --- ACTUALIZAR EN BASE DE DATOS ---
    const updateClientInDb = async (id: string, updates: any) => {
        setClients(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
        
        const dbUpdates: any = {}
        if (updates.financialStatus) dbUpdates.financial_status = updates.financialStatus
        if (updates.actionStatus) dbUpdates.action_status = updates.actionStatus
        if (updates.name) dbUpdates.name = updates.name
        if (updates.dni) dbUpdates.dni = updates.dni
        if (updates.prepaga) dbUpdates.prepaga = updates.prepaga
        if (updates.plan) dbUpdates.plan = updates.plan
        if (updates.price) dbUpdates.price = updates.price
        if (updates.activationDate) dbUpdates.activation_date = updates.activationDate
        if (updates.province) dbUpdates.province = updates.province
        if (updates.zip) dbUpdates.zip = updates.zip
        if (updates.observations) dbUpdates.notes = updates.observations 

        await supabase.from('leads').update(dbUpdates).eq('id', id)
    }

    // --- ELIMINAR DE CARTERA (Volver a Demoras) ---
    const handleRemoveFromPortfolio = async () => {
        if (!clientToRemove) return
        
        // Lo sacamos de 'billing_approved' y lo devolvemos a 'demoras'
        await supabase.from('leads').update({ 
            status: 'demoras',
            billing_approved: false, // Importante: invalidar la aprobación de facturación
            notes: (clientToRemove.observations || "") + "\n[SISTEMA]: Sacado de cartera postventa."
        }).eq('id', clientToRemove.id)
        
        setClients(prev => prev.filter(c => c.id !== clientToRemove.id))
        setClientToRemove(null)
    }

    // HANDLERS
    const handleSaveClient = () => {
        if (!editingClient) return
        updateClientInDb(editingClient.id, editingClient)
        setEditingClient(null)
    }

    const updateClientField = (id: string, field: string, value: any) => {
        updateClientInDb(id, { [field]: value })
    }

    // --- LÓGICA DE FECHAS ---
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

    // LISTAS DE CUMPLEAÑOS
    const todaysBirthdays = useMemo(() => clients.filter(c => isBirthdayToday(c.dob)), [clients])
    const upcomingBirthdays = useMemo(() => {
        return clients
            .filter(c => isBirthdayThisMonth(c.dob) && !isBirthdayToday(c.dob) && parseInt(c.dob.split('-')[2]) > currentDay)
            .sort((a, b) => parseInt(a.dob.split('-')[2]) - parseInt(b.dob.split('-')[2]))
            .slice(0, 3)
    }, [clients])

    // --- FILTRADO MAESTRO ---
    const filteredClients = useMemo(() => {
        return clients.filter(c => {
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.dni.includes(searchTerm) || 
                                  c.prepaga.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.province.toLowerCase().includes(searchTerm.toLowerCase())
            
            if (!matchesSearch) return false

            if (filters.seller !== "all" && c.seller !== filters.seller) return false
            if (filters.prepaga !== "all" && c.prepaga !== filters.prepaga) return false
            if (filters.mora !== "all" && c.financialStatus !== filters.mora) return false
            if (filters.action !== "all" && c.actionStatus !== filters.action) return false
            if (filters.province !== "all" && c.province !== filters.province) return false
            
            return true
        })
    }, [clients, searchTerm, filters])

    // --- DATOS PARA DROPDOWNS FILTRO ---
    const uniqueSellers = Array.from(new Set(clients.map(c => c.seller))).filter(Boolean)
    const uniquePrepagas = Array.from(new Set(clients.map(c => c.prepaga))).filter(Boolean)
    const activeFiltersCount = Object.values(filters).filter(v => v !== "all").length

    const getWhatsAppLink = (client: any) => {
        const msg = `¡Hola ${client.name.split(' ')[0]}! 🎂 Desde GML Salud te deseamos un muy feliz cumpleaños. ¡Que tengas un día excelente!`
        return `https://wa.me/549${client.dni}?text=${encodeURIComponent(msg)}` 
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden max-w-[1900px] mx-auto pb-20 bg-slate-50/30">
            
            {/* 1. HEADER & KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 shrink-0">
                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-blue-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Cartera Activa</p>
                            <div className="text-2xl font-black text-slate-800">{clients.length}</div>
                        </div>
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600"><HeartHandshake/></div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm border-l-4 border-l-red-500">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Cartera en Mora</p>
                            <div className="text-2xl font-black text-red-600">
                                {clients.filter(c => c.financialStatus !== 'SIN MORA').length}
                            </div>
                        </div>
                        <div className="h-10 w-10 bg-red-100 rounded-full flex items-center justify-center text-red-600"><AlertTriangle/></div>
                    </CardContent>
                </Card>
                
                {/* WIDGET CUMPLEAÑOS */}
                <Card className="bg-white border-slate-200 shadow-md border-l-4 border-l-pink-500 col-span-2 overflow-hidden">
                    <CardContent className="p-0 h-full flex">
                        <div className="flex-1 p-4 border-r border-slate-100 bg-pink-50/30 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="bg-pink-100 text-pink-600 p-1.5 rounded-full"><Cake size={16}/></div>
                                <span className="text-xs font-bold text-pink-600 uppercase tracking-wider">Hoy ({todaysBirthdays.length})</span>
                            </div>
                            {todaysBirthdays.length > 0 ? (
                                <div className="space-y-2">
                                    {todaysBirthdays.map(c => (
                                        <div key={c.id} className="flex items-center justify-between bg-white p-2 rounded-lg border border-pink-100 shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px] bg-pink-600 text-white font-bold">{c.name.substring(0,2)}</AvatarFallback></Avatar>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700 leading-none">{c.name}</p>
                                                    <p className="text-[9px] text-slate-400">{getAge(c.dob)} años</p>
                                                </div>
                                            </div>
                                            <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600 hover:bg-green-50 rounded-full" title="Enviar Saludo" onClick={() => window.open(getWhatsAppLink(c), '_blank')}>
                                                <MessageCircle size={14}/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic pl-1">No hay cumpleaños hoy.</p>
                            )}
                        </div>

                        <div className="flex-1 p-4 flex flex-col justify-center">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Próximos Festejos</span>
                            <div className="space-y-2">
                                {upcomingBirthdays.length > 0 ? upcomingBirthdays.map(c => (
                                    <div key={c.id} className="flex items-center justify-between text-xs border-b border-slate-50 pb-1 last:border-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-600 bg-slate-100 px-1.5 rounded text-[10px]">{c.dob.split('-')[2]}/{c.dob.split('-')[1]}</span>
                                            <span className="text-slate-600 truncate max-w-[120px]">{c.name}</span>
                                        </div>
                                        <span className="text-[10px] text-slate-400">{getAge(c.dob)} años</span>
                                    </div>
                                )) : <span className="text-xs text-slate-400 italic">No hay más este mes.</span>}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. BARRA DE HERRAMIENTAS */}
            <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-2.5 text-slate-400 h-4 w-4"/>
                    <Input 
                        placeholder="Buscar por cliente, DNI, prepaga..." 
                        className="pl-9 bg-slate-50 border-slate-200 focus:bg-white"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="h-8 w-px bg-slate-200"></div>
                
                <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                    <PopoverTrigger asChild>
                        <Button variant={activeFiltersCount > 0 ? "default" : "outline"} className="gap-2 relative shadow-sm">
                            <Filter size={16}/> Filtros Avanzados
                            {activeFiltersCount > 0 && <span className="absolute -top-2 -right-2 bg-pink-500 text-white text-[10px] h-5 w-5 rounded-full flex items-center justify-center border-2 border-white">{activeFiltersCount}</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[320px] p-4" align="end">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2"><LayoutList size={16}/> Filtrar Cartera</h4>
                                {activeFiltersCount > 0 && (
                                    <Button variant="ghost" size="sm" className="text-[10px] h-6 text-red-500 hover:text-red-600 px-2" onClick={() => setFilters({seller:"all", prepaga:"all", mora:"all", action:"all", province:"all"})}>
                                        Borrar
                                    </Button>
                                )}
                            </div>
                            <Separator/>
                            
                            <div className="space-y-3">
                                {/* FILTROS */}
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Estado Mora</label>
                                    <Select value={filters.mora} onValueChange={v => setFilters({...filters, mora: v})}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="SIN MORA">Sin Mora (Al día)</SelectItem>
                                            <SelectItem value="PRE MORA">Pre Mora</SelectItem>
                                            <SelectItem value="MORA 1">Mora 1</SelectItem>
                                            <SelectItem value="MORA 2">Mora 2</SelectItem>
                                            <SelectItem value="MORA 3">Mora 3</SelectItem>
                                            <SelectItem value="IMPAGO">Impago</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Vendedor</label>
                                    <Select value={filters.seller} onValueChange={v => setFilters({...filters, seller: v})}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            {uniqueSellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button className="w-full h-8 text-xs bg-slate-900 text-white" onClick={() => setIsFilterOpen(false)}>Aplicar Filtros</Button>
                        </div>
                    </PopoverContent>
                </Popover>
                
                <Button variant="ghost" size="icon" onClick={fetchPortfolio} title="Recargar"><RefreshCw className={`h-4 w-4 text-slate-400 ${loading ? 'animate-spin' : ''}`}/></Button>
            </div>

            {/* 3. TABLA MAESTRA */}
            <Card className="flex-1 overflow-hidden border-slate-200 shadow-md">
                <CardContent className="p-0 h-full overflow-auto">
                    <Table>
                        <TableHeader className="bg-slate-50 sticky top-0 z-10">
                            <TableRow>
                                <TableHead className="w-[280px]">Cliente / Datos</TableHead>
                                <TableHead>Ubicación</TableHead>
                                <TableHead>Prepaga & Plan</TableHead>
                                <TableHead>Vendedor</TableHead>
                                <TableHead>Fechas (Venta / Alta)</TableHead>
                                <TableHead className="w-[160px]">Estado Financiero</TableHead>
                                <TableHead className="w-[160px]">Acción Requerida</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-400">Cargando cartera...</TableCell></TableRow>
                            ) : filteredClients.length === 0 ? (
                                <TableRow><TableCell colSpan={7} className="text-center py-10 text-slate-400">No se encontraron clientes activos.</TableCell></TableRow>
                            ) : filteredClients.map((client) => (
                                <TableRow 
                                    key={client.id} 
                                    className="hover:bg-slate-50 transition-colors group cursor-pointer"
                                    onClick={() => setEditingClient(client)}
                                >
                                    <TableCell>
                                        <div className="flex items-start gap-3">
                                            <div className="relative">
                                                <Avatar className="h-9 w-9 border border-slate-200">
                                                    <AvatarFallback className="bg-slate-100 text-xs font-bold text-slate-600">{client.name.substring(0,2)}</AvatarFallback>
                                                </Avatar>
                                                {isBirthdayThisMonth(client.dob) && (
                                                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100">
                                                        <div className="bg-pink-100 p-0.5 rounded-full text-pink-500"><Cake size={10}/></div>
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                                    {client.name}
                                                    {isBirthdayToday(client.dob) && <Badge className="bg-pink-500 text-[9px] h-4 px-1 hover:bg-pink-600">Hoy!</Badge>}
                                                </div>
                                                <div className="text-[11px] font-mono text-slate-400 mt-0.5 flex gap-2">
                                                    <span>{client.dni}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <span>{client.dob} ({getAge(client.dob)})</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>

                                    <TableCell>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                            <MapPin size={14} className="text-slate-400"/>
                                            <span>{client.province}</span>
                                            <span className="text-slate-400 text-[10px] font-mono">({client.zip})</span>
                                        </div>
                                    </TableCell>
                                    
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Badge variant="outline" className="w-fit bg-white border-slate-300 text-slate-700">{client.prepaga}</Badge>
                                            <div className="text-xs font-bold text-slate-500 flex items-center gap-1">
                                                {client.plan} 
                                                <span className="text-[10px] font-normal text-slate-400">(${client.price.toLocaleString()})</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-6 w-6"><AvatarFallback className="text-[9px] bg-slate-100 text-slate-500">{client.seller.substring(0,2)}</AvatarFallback></Avatar>
                                            <span className="text-xs font-medium text-slate-600">{client.seller}</span>
                                        </div>
                                    </TableCell>
                                    
                                    <TableCell>
                                        <div className="flex flex-col gap-1.5">
                                            <div className="text-[10px] text-slate-400 flex justify-between w-[110px]">
                                                <span>Venta:</span> <span className="font-mono text-slate-600">{client.saleDate}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[10px] text-slate-400">Alta:</span>
                                                <span className="text-[10px] font-mono font-bold text-blue-600">{client.activationDate}</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    
                                    {/* ESTADOS CON ACTUALIZACIÓN A DB */}
                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Select 
                                            value={client.financialStatus} 
                                            onValueChange={(val) => updateClientField(client.id, 'financialStatus', val)}
                                        >
                                            <SelectTrigger className={`h-7 text-[10px] font-bold border-0 ring-1 ring-inset ${getFinancialColor(client.financialStatus as string)}`}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="SIN MORA">SIN MORA</SelectItem>
                                                <SelectItem value="PRE MORA">PRE MORA</SelectItem>
                                                <SelectItem value="MORA 1">MORA 1</SelectItem>
                                                <SelectItem value="MORA 2">MORA 2</SelectItem>
                                                <SelectItem value="MORA 3">MORA 3</SelectItem>
                                                <SelectItem value="IMPAGO">IMPAGO</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>

                                    <TableCell onClick={(e) => e.stopPropagation()}>
                                        <Select 
                                            value={client.actionStatus} 
                                            onValueChange={(val) => updateClientField(client.id, 'actionStatus', val)}
                                        >
                                            <SelectTrigger className={`h-7 text-[10px] font-medium border border-dashed ${getActionColor(client.actionStatus as string)}`}>
                                                <SelectValue placeholder="Acción..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="OK">Todo OK</SelectItem>
                                                <SelectItem value="PRESENTACION">PRESENTACIÓN</SelectItem>
                                                <SelectItem value="CAMBIO DE PASS">CAMBIO DE PASS</SelectItem>
                                                <SelectItem value="MENSAJE MORA">MENSAJE MORA</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </TableCell>

                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* MODAL EDICIÓN CLIENTE (CONECTADO) */}
            <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <DialogTitle className="flex items-center gap-2"><Pencil size={16} className="text-blue-600"/> Editar Ficha: {editingClient?.name}</DialogTitle>
                                <DialogDescription>Modificar datos de la póliza o agregar observaciones.</DialogDescription>
                            </div>
                            <Button variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs gap-1" onClick={() => { setClientToRemove(editingClient); setEditingClient(null); }}>
                                <Trash2 size={14} /> Sacar de Cartera
                            </Button>
                        </div>
                    </DialogHeader>
                    
                    {editingClient && (
                        <div className="grid grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                                <div className="space-y-1"><Label className="text-xs text-slate-500">Nombre Titular</Label><Input value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} /></div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">DNI</Label><Input value={editingClient.dni} onChange={e => setEditingClient({...editingClient, dni: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Prepaga</Label><Input value={editingClient.prepaga} onChange={e => setEditingClient({...editingClient, prepaga: e.target.value})} /></div>
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Plan</Label><Input value={editingClient.plan} onChange={e => setEditingClient({...editingClient, plan: e.target.value})} /></div>
                                </div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500">Fecha Nacimiento</Label><Input type="date" value={editingClient.dob} onChange={e => setEditingClient({...editingClient, dob: e.target.value})} /></div>
                            </div>

                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Fecha Venta</Label><Input type="date" value={editingClient.saleDate} disabled /></div>
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Fecha Alta</Label><Input type="date" value={editingClient.activationDate} onChange={e => setEditingClient({...editingClient, activationDate: e.target.value})} /></div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">Provincia</Label><Input value={editingClient.province} onChange={e => setEditingClient({...editingClient, province: e.target.value})} /></div>
                                    <div className="space-y-1"><Label className="text-xs text-slate-500">C.P.</Label><Input value={editingClient.zip} onChange={e => setEditingClient({...editingClient, zip: e.target.value})} /></div>
                                </div>
                                <div className="space-y-1 pt-2"><Label className="text-xs text-slate-500 flex items-center gap-1"><MessageCircle size={12}/> Observaciones</Label><Textarea className="h-24 resize-none bg-yellow-50/50 border-yellow-200 focus:border-yellow-400 text-xs" placeholder="Escribí acá cualquier nota importante..." value={editingClient.observations || ""} onChange={e => setEditingClient({...editingClient, observations: e.target.value})}/></div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
                        <Button onClick={handleSaveClient} className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><Save size={14}/> Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* MODAL CONFIRMACIÓN ELIMINAR */}
            <Dialog open={!!clientToRemove} onOpenChange={() => setClientToRemove(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-3"><Undo2 className="h-6 w-6 text-red-600"/></div>
                        <DialogTitle className="text-center text-lg font-bold">¿Sacar de Cartera?</DialogTitle>
                        <DialogDescription className="text-center">
                            El cliente <b>{clientToRemove?.name}</b> volverá al estado <b>"Demoras"</b> en la mesa de entrada de Operaciones.
                        </DialogDescription>
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