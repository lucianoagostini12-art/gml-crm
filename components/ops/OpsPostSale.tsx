"use client"

import { useState, useMemo } from "react"
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
import { Search, AlertTriangle, Cake, MessageCircle, HeartHandshake, MapPin, Filter, Save, User, Pencil, LayoutList, Users } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

// --- DATOS DEMO (CON CAMPOS EXTRAS PARA LA FUNCIONALIDAD SOLICITADA) ---
const PORTFOLIO_DATA = [
    { 
        id: "c1", name: "Juan Pérez", dni: "20.123.456", dob: "1985-05-15", 
        prepaga: "Prevención Salud", plan: "A2", price: 150000, 
        seller: "Maca", saleDate: "2024-01-10", activationDate: "2024-02-01",
        financialStatus: "SIN MORA", actionStatus: "OK",
        province: "Córdoba", zip: "5000",
        observations: "Cliente consultó por cambio de plan en junio.",
        condicionLaboral: "monotributo", // OBL
        hijos: [{name: "Juana Pérez", dni: "50.111.222"}] // 2 Cápitas total
    },
    { 
        id: "c2", name: "Maria González", dni: "27.987.654", dob: "1990-12-30", 
        prepaga: "Galeno", plan: "220", price: 200000, 
        seller: "Agus", saleDate: "2024-03-15", activationDate: "2024-04-01",
        financialStatus: "MORA 1", actionStatus: "MENSAJE MORA",
        province: "Buenos Aires", zip: "7600",
        observations: "",
        condicionLaboral: "voluntario", // VOL
        hijos: [] 
    },
    { 
        id: "c3", name: "Carlos Ruiz", dni: "20.555.666", dob: "1988-07-20", 
        prepaga: "Sancor", plan: "3000", price: 120000, 
        seller: "Lu T", saleDate: "2023-11-20", activationDate: "2023-12-01",
        financialStatus: "PRE MORA", actionStatus: "PRESENTACION",
        province: "Santa Fe", zip: "2000",
        observations: "Prometió pago para el 15.",
        condicionLaboral: "empleado", // OBL
        hijos: [{name: "Pedro Ruiz", dni: "55.666.777"}, {name: "Marta Ruiz", dni: "56.777.888"}]
    },
    { 
        id: "c4", name: "Ana Lopez", dni: "33.444.555", dob: "1995-12-31", 
        prepaga: "Swiss Medical", plan: "SMG20", price: 180000, 
        seller: "Maca", saleDate: "2024-05-05", activationDate: "2024-06-01",
        financialStatus: "SIN MORA", actionStatus: "CAMBIO DE PASS",
        province: "Mendoza", zip: "5500",
        observations: "",
        condicionLaboral: "monotributo", 
        hijos: []
    },
    { 
        id: "c5", name: "Pedro Impago", dni: "44.555.666", dob: "2000-01-10", 
        prepaga: "DoctoRed", plan: "500", price: 90000, 
        seller: "Eve", saleDate: "2024-02-20", activationDate: "2024-03-01",
        financialStatus: "IMPAGO", actionStatus: "MENSAJE MORA",
        province: "CABA", zip: "1414",
        observations: "No contesta llamados.",
        condicionLaboral: "voluntario",
        hijos: []
    },
]

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
    const [clients, setClients] = useState(PORTFOLIO_DATA)
    const [searchTerm, setSearchTerm] = useState("")
    
    // --- ESTADO PARA EDICIÓN (MODAL) ---
    const [editingClient, setEditingClient] = useState<any>(null)

    // --- FILTROS AVANZADOS (POTENTE) ---
    const [filters, setFilters] = useState({
        seller: "all",
        prepaga: "all",
        mora: "all",
        action: "all",
        province: "all"
    })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    
    // --- LÓGICA DE FECHAS ---
    const today = new Date() 
    const currentMonth = today.getMonth()
    const currentDay = today.getDate()

    const isBirthdayToday = (dobString: string) => {
        const [y, m, d] = dobString.split('-').map(Number)
        return m - 1 === currentMonth && d === currentDay
    }

    const isBirthdayThisMonth = (dobString: string) => {
        const [y, m, d] = dobString.split('-').map(Number)
        return m - 1 === currentMonth
    }

    const getAge = (dobString: string) => {
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
            // 1. Buscador Texto
            const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                  c.dni.includes(searchTerm) || 
                                  c.prepaga.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  c.province.toLowerCase().includes(searchTerm.toLowerCase())
            
            if (!matchesSearch) return false

            // 2. Filtros Avanzados
            if (filters.seller !== "all" && c.seller !== filters.seller) return false
            if (filters.prepaga !== "all" && c.prepaga !== filters.prepaga) return false
            if (filters.mora !== "all" && c.financialStatus !== filters.mora) return false
            if (filters.action !== "all" && c.actionStatus !== filters.action) return false
            if (filters.province !== "all" && c.province !== filters.province) return false
            
            return true
        })
    }, [clients, searchTerm, filters])

    // --- DATOS PARA DROPDOWNS FILTRO ---
    const uniqueSellers = Array.from(new Set(clients.map(c => c.seller)))
    const uniquePrepagas = Array.from(new Set(clients.map(c => c.prepaga)))
    const uniqueProvinces = Array.from(new Set(clients.map(c => c.province)))
    const activeFiltersCount = Object.values(filters).filter(v => v !== "all").length

    // ACTUALIZAR CLIENTE (DESDE MODAL O TABLA)
    const handleSaveClient = () => {
        if (!editingClient) return
        setClients(prev => prev.map(c => c.id === editingClient.id ? editingClient : c))
        setEditingClient(null)
    }

    const updateClientField = (id: string, field: string, value: any) => {
        setClients(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    }

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
                
                {/* WIDGET CUMPLEAÑOS (HOY Y PROXIMOS) */}
                <Card className="bg-white border-slate-200 shadow-md border-l-4 border-l-pink-500 col-span-2 overflow-hidden">
                    <CardContent className="p-0 h-full flex">
                        
                        {/* IZQUIERDA: HOY */}
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

                        {/* DERECHA: PRÓXIMOS */}
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
                
                {/* FILTRO POTENTE (POPOVER) */}
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
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Acción Pendiente</label>
                                    <Select value={filters.action} onValueChange={v => setFilters({...filters, action: v})}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            <SelectItem value="OK">Todo OK</SelectItem>
                                            <SelectItem value="PRESENTACION">Presentación</SelectItem>
                                            <SelectItem value="CAMBIO DE PASS">Cambio de Pass</SelectItem>
                                            <SelectItem value="MENSAJE MORA">Mensaje Mora</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
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
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase">Prepaga</label>
                                        <Select value={filters.prepaga} onValueChange={v => setFilters({...filters, prepaga: v})}>
                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {uniquePrepagas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase">Provincia</label>
                                    <Select value={filters.province} onValueChange={v => setFilters({...filters, province: v})}>
                                        <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas"/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todas</SelectItem>
                                            {Array.from(uniqueProvinces).map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <Button className="w-full h-8 text-xs bg-slate-900 text-white" onClick={() => setIsFilterOpen(false)}>
                                Aplicar Filtros
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
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
                            {filteredClients.map((client) => (
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
                                                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border border-slate-100" title="Cumple años este mes">
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
                                                
                                                {/* NUEVO: POPOVER DE CÁPITAS (STOP PROPAGATION) */}
                                                <div onClick={(e) => e.stopPropagation()} className="mt-1">
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 cursor-pointer hover:underline w-fit">
                                                                <Users size={10}/> {(client.hijos?.length || 0) + 1} Cápitas
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-64 p-0 shadow-xl border-slate-200">
                                                            <div className="bg-slate-50 p-2 border-b text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                                                                <div className="flex items-center gap-2"><Users size={12}/> Grupo Familiar</div>
                                                                {client.condicionLaboral?.toLowerCase().includes('voluntario') 
                                                                    ? <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] border-0">VOL</Badge> 
                                                                    : <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] border-0">OBL</Badge>
                                                                }
                                                            </div>
                                                            <div className="p-2 space-y-2">
                                                                <div className="flex justify-between text-xs">
                                                                    <span className="font-bold text-slate-700">👑 {client.name}</span>
                                                                    <span className="font-mono text-slate-400">{client.dni}</span>
                                                                </div>
                                                                {client.hijos?.map((h: any, i: number) => (
                                                                    <div key={i} className="flex justify-between text-xs pl-2 border-l-2 border-slate-100">
                                                                        <span className="text-slate-600">{h.name}</span>
                                                                        <span className="font-mono text-slate-400">{h.dni}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
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
                                    
                                    {/* ESTADOS CON STOP PROPAGATION */}
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

            {/* MODAL EDICIÓN CLIENTE */}
            <Dialog open={!!editingClient} onOpenChange={() => setEditingClient(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil size={16} className="text-blue-600"/> Editar Ficha: {editingClient?.name}
                        </DialogTitle>
                        <DialogDescription>Modificar datos de la póliza o agregar observaciones.</DialogDescription>
                    </DialogHeader>
                    
                    {editingClient && (
                        <div className="grid grid-cols-2 gap-6 py-4">
                            {/* COLUMNA 1: DATOS PERSONALES */}
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Nombre Titular</Label>
                                    <Input value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">DNI</Label>
                                    <Input value={editingClient.dni} onChange={e => setEditingClient({...editingClient, dni: e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Prepaga</Label>
                                        <Input value={editingClient.prepaga} onChange={e => setEditingClient({...editingClient, prepaga: e.target.value})} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Plan</Label>
                                        <Input value={editingClient.plan} onChange={e => setEditingClient({...editingClient, plan: e.target.value})} />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-500">Precio ($)</Label>
                                    <Input type="number" value={editingClient.price} onChange={e => setEditingClient({...editingClient, price: parseFloat(e.target.value)})} />
                                </div>
                            </div>

                            {/* COLUMNA 2: FECHAS Y UBICACION */}
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Fecha Venta</Label>
                                        <Input type="date" value={editingClient.saleDate} onChange={e => setEditingClient({...editingClient, saleDate: e.target.value})} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Fecha Alta</Label>
                                        <Input type="date" value={editingClient.activationDate} onChange={e => setEditingClient({...editingClient, activationDate: e.target.value})} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">Provincia</Label>
                                        <Input value={editingClient.province} onChange={e => setEditingClient({...editingClient, province: e.target.value})} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500">C.P.</Label>
                                        <Input value={editingClient.zip} onChange={e => setEditingClient({...editingClient, zip: e.target.value})} />
                                    </div>
                                </div>
                                
                                <div className="space-y-1 pt-2">
                                    <Label className="text-xs text-slate-500 flex items-center gap-1"><MessageCircle size={12}/> Observaciones</Label>
                                    <Textarea 
                                        className="h-24 resize-none bg-yellow-50/50 border-yellow-200 focus:border-yellow-400 text-xs" 
                                        placeholder="Escribí acá cualquier nota importante..."
                                        value={editingClient.observations || ""}
                                        onChange={e => setEditingClient({...editingClient, observations: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingClient(null)}>Cancelar</Button>
                        <Button onClick={handleSaveClient} className="bg-blue-600 hover:bg-blue-700 text-white gap-2"><Save size={14}/> Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}