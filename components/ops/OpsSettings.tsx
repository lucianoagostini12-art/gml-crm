"use client"

import { useState, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Trash2, Shield, User, Save, CreditCard, Users, BarChart, X, Globe, Lock, GitPullRequest, DollarSign, HeartHandshake, ListFilter, Camera, Upload, Mail } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch" 
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog"

// CONSTANTES DE ETAPAS
const STAGES = [
    { value: "ingresado", label: "Ingresado" },
    { value: "precarga", label: "Precarga" },
    { value: "medicas", label: "Médicas" },
    { value: "legajo", label: "Legajo" },
    { value: "demoras", label: "Demoras" },
    { value: "cumplidas", label: "Aprobadas (Cumplidas)" },
    { value: "rechazado", label: "Rechazadas" }
]

// MOCK DATA INICIAL
const INITIAL_USERS = [
    { id: 1, name: "Lucho God", role: "ADMIN_GOD", email: "lucho@gml.com", avatar: "https://github.com/shadcn.png" },
    { id: 2, name: "Maca", role: "ADMIN_OPS", email: "maca@gml.com", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maca" },
    { id: 3, name: "Iara", role: "ADMIN_OPS", email: "iara@gml.com", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Iara" },
]

export function OpsSettings() {
    const [activeTab, setActiveTab] = useState<'business' | 'users' | 'workflows' | 'permissions'>('business')

    // 1. COMERCIAL
    const [prepagas, setPrepagas] = useState([
        { id: 1, name: "Swiss Medical", plans: ["SMG20", "SMG50", "SMG70"] },
        { id: 2, name: "Galeno", plans: ["220", "330", "440", "550"] },
        { id: 3, name: "Prevención Salud", plans: ["A1", "A2", "A4", "A6"] },
        { id: 4, name: "Omint", plans: ["Global", "Clásico", "Premium"] }
    ])
    const [newPrepaga, setNewPrepaga] = useState("")
    const [selectedPrepagaId, setSelectedPrepagaId] = useState<number | null>(null)
    const [newPlan, setNewPlan] = useState("")
    const [origins, setOrigins] = useState(["Google Ads", "Meta Ads", "Referidos", "Base Propia", "Llamador"])
    const [newOrigin, setNewOrigin] = useState("")

    // 2. EQUIPO (CON MODAL Y FOTOS)
    const [users, setUsers] = useState(INITIAL_USERS)
    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [newUser, setNewUser] = useState({ 
        name: "", 
        email: "", 
        role: "ADMIN_OPS", 
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nuevo" 
    })
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 3. WORKFLOWS
    const [selectedStage, setSelectedStage] = useState("ingresado")
    const [subStatesByStage, setSubStatesByStage] = useState<Record<string, string[]>>({
        ingresado: ["Carga de Datos", "Falta DNI", "Validando"],
        precarga: ["En Cola", "Cargando Web", "Error de Carga"],
        medicas: ["Auditoría Médica", "Solicitud Estudios", "Aprobado Condicional"],
        legajo: ["Firma Pendiente", "Validación Teléfonica", "Falta Foto"],
        demoras: ["Espera Cliente", "Problema Sistema", "Aporte No Impacta"],
        cumplidas: ["Finalizado", "Liquidado", "Enviado"],
        rechazado: ["Por Perfil", "Por Zona", "Rechazo Médico", "Cliente Desiste"]
    })
    const [newSubState, setNewSubState] = useState("")
    const [postSaleFinancial, setPostSaleFinancial] = useState(["SIN MORA", "PRE MORA", "MORA 1", "MORA 2", "MORA 3", "IMPAGO"])
    const [newPSFinancial, setNewPSFinancial] = useState("")
    const [postSaleActions, setPostSaleActions] = useState(["PRESENTACION", "CAMBIO DE PASS", "MENSAJE MORA", "RECUPERO", "BAJA"])
    const [newPSAction, setNewPSAction] = useState("")

    // 4. PERMISOS
    const [permissions, setPermissions] = useState({
        ops: {
            exportData: true, editSettings: false, deleteSales: false, assignCases: true,
            accessMetrics: false, accessBilling: false, accessPostSale: true, 
        }
    })

    // --- HANDLERS COMERCIAL ---
    const addPrepaga = () => { if(newPrepaga) { setPrepagas([...prepagas, { id: Date.now(), name: newPrepaga, plans: [] }]); setNewPrepaga("") } }
    const deletePrepaga = (id: number) => setPrepagas(prepagas.filter(p => p.id !== id))
    const addPlan = () => { if(newPlan && selectedPrepagaId) { setPrepagas(prepagas.map(p => p.id === selectedPrepagaId ? { ...p, plans: [...p.plans, newPlan] } : p)); setNewPlan("") } }
    const deletePlan = (prepagaId: number, plan: string) => { setPrepagas(prepagas.map(p => p.id === prepagaId ? { ...p, plans: p.plans.filter(pl => pl !== plan) } : p)) }
    const addOrigin = () => { if(newOrigin && !origins.includes(newOrigin)) { setOrigins([...origins, newOrigin]); setNewOrigin("") } }
    const deleteOrigin = (name: string) => setOrigins(origins.filter(o => o !== name))
    
    // --- HANDLERS USUARIOS ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const previewUrl = URL.createObjectURL(file)
            setNewUser({ ...newUser, avatar: previewUrl })
        }
    }
    const generateRandomAvatar = () => {
        const seed = Math.random().toString(36).substring(7)
        setNewUser({ ...newUser, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` })
    }
    const handleCreateUser = () => { 
        if(newUser.name && newUser.email) { 
            setUsers([...users, { id: Date.now(), ...newUser }])
            setNewUser({ name: "", email: "", role: "ADMIN_OPS", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nuevo" })
            setIsUserModalOpen(false)
        } 
    }
    const deleteUser = (id: number) => setUsers(users.filter(u => u.id !== id))

    // --- HANDLERS WORKFLOWS ---
    const addSubState = () => { if(newSubState && selectedStage) { setSubStatesByStage({ ...subStatesByStage, [selectedStage]: [...(subStatesByStage[selectedStage] || []), newSubState] }); setNewSubState("") } }
    const deleteSubState = (val: string) => { setSubStatesByStage({ ...subStatesByStage, [selectedStage]: subStatesByStage[selectedStage].filter(s => s !== val) }) }
    const addPSFinancial = () => { if(newPSFinancial) { setPostSaleFinancial([...postSaleFinancial, newPSFinancial.toUpperCase()]); setNewPSFinancial("") } }
    const deletePSFinancial = (val: string) => setPostSaleFinancial(postSaleFinancial.filter(s => s !== val))
    const addPSAction = () => { if(newPSAction) { setPostSaleActions([...postSaleActions, newPSAction.toUpperCase()]); setNewPSAction("") } }
    const deletePSAction = (val: string) => setPostSaleActions(postSaleActions.filter(s => s !== val))

    const togglePermission = (key: keyof typeof permissions.ops) => { setPermissions({ ...permissions, ops: { ...permissions.ops, [key]: !permissions.ops[key] } }) }

    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'ADMIN_GOD': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200 uppercase">Admin GOD</span>
            case 'ADMIN_OPS': return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200 uppercase">Admin Ops</span>
            default: return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200 uppercase">Vendedor</span>
        }
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
            
            {/* HEADER */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black text-slate-800">Configuración</h2>
                    <p className="text-slate-500">Administración general del sistema GML OPS.</p>
                </div>
                <Button className="bg-blue-600 hover:bg-blue-700 font-bold shadow-md"><Save size={16} className="mr-2"/> Guardar Todo</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                
                {/* SIDEBAR */}
                <div className="space-y-2">
                    <button onClick={() => setActiveTab('business')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${activeTab === 'business' ? 'bg-white shadow-md text-blue-600 ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <CreditCard size={18}/> Comercial
                    </button>
                    <button onClick={() => setActiveTab('users')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${activeTab === 'users' ? 'bg-white shadow-md text-blue-600 ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <Users size={18}/> Usuarios
                    </button>
                    <button onClick={() => setActiveTab('workflows')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${activeTab === 'workflows' ? 'bg-white shadow-md text-blue-600 ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <GitPullRequest size={18}/> Procesos & Estados
                    </button>
                    <button onClick={() => setActiveTab('permissions')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold ${activeTab === 'permissions' ? 'bg-white shadow-md text-blue-600 ring-1 ring-blue-100' : 'text-slate-500 hover:bg-slate-100'}`}>
                        <Lock size={18}/> Permisos
                    </button>
                </div>

                {/* CONTENIDO PRINCIPAL */}
                <div className="md:col-span-3 space-y-6">

                    {/* --- TAB COMERCIAL --- */}
                    {activeTab === 'business' && (
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Prepagas y Planes</CardTitle>
                                    <CardDescription>Gestioná las marcas disponibles para la venta.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-4 mb-6">
                                        <Input placeholder="Nueva Prepaga..." value={newPrepaga} onChange={e=>setNewPrepaga(e.target.value)}/>
                                        <Button onClick={addPrepaga} variant="secondary"><Plus size={16}/> Agregar</Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {prepagas.map(p => (
                                            <div key={p.id} className={`border rounded-xl p-4 transition-all ${selectedPrepagaId === p.id ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white'}`}>
                                                <div className="flex justify-between items-center mb-3">
                                                    <h4 className="font-bold text-slate-800 cursor-pointer hover:text-blue-600" onClick={() => setSelectedPrepagaId(p.id)}>{p.name}</h4>
                                                    <Button variant="ghost" size="icon" onClick={() => deletePrepaga(p.id)} className="text-slate-400 hover:text-red-500 h-8 w-8"><Trash2 size={16}/></Button>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {p.plans.map(plan => (
                                                        <Badge key={plan} variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-red-100 hover:text-red-600 cursor-pointer group" onClick={() => deletePlan(p.id, plan)}>
                                                            {plan} <X size={10} className="ml-1 opacity-0 group-hover:opacity-100"/>
                                                        </Badge>
                                                    ))}
                                                    {selectedPrepagaId === p.id && (
                                                        <div className="flex items-center gap-1 mt-2 w-full">
                                                            <Input className="h-7 text-xs" placeholder="Nuevo plan..." value={newPlan} onChange={e=>setNewPlan(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPlan()}/>
                                                            <Button size="icon" className="h-7 w-7" onClick={addPlan}><Plus size={14}/></Button>
                                                        </div>
                                                    )}
                                                </div>
                                                {selectedPrepagaId !== p.id && <p className="text-[10px] text-slate-400 mt-2 text-center cursor-pointer hover:text-blue-500" onClick={() => setSelectedPrepagaId(p.id)}>Editar planes</p>}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Orígenes de Venta</CardTitle>
                                    <CardDescription>Fuentes de leads permitidas.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex gap-4 mb-4">
                                        <div className="relative w-full">
                                            <Globe className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                                            <Input className="pl-9" placeholder="Nuevo origen (Ej: TikTok)..." value={newOrigin} onChange={e=>setNewOrigin(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addOrigin()}/>
                                        </div>
                                        <Button onClick={addOrigin} variant="secondary">Agregar</Button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {origins.map(origin => (
                                            <Badge key={origin} variant="outline" className="px-3 py-1 text-sm bg-slate-50 hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer transition-colors group" onClick={() => deleteOrigin(origin)}>
                                                {origin} <X size={12} className="ml-2 text-slate-400 group-hover:text-red-500"/>
                                            </Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* --- TAB USUARIOS (MEJORADO) --- */}
                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Equipo de Trabajo</CardTitle>
                                        <CardDescription>Crear y gestionar usuarios del sistema.</CardDescription>
                                    </div>
                                    <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="bg-slate-800 text-white shadow-sm"><User size={16} className="mr-2"/> Nuevo Usuario</Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Crear Usuario</DialogTitle>
                                                <DialogDescription>Alta de nuevo integrante del equipo.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                
                                                {/* FOTO DE PERFIL */}
                                                <div className="flex flex-col items-center gap-3 mb-2">
                                                    <Avatar className="h-20 w-20 border-4 border-slate-100 shadow-md">
                                                        <AvatarImage src={newUser.avatar} className="object-cover"/>
                                                        <AvatarFallback>NN</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex gap-2">
                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-8 gap-2"><Upload className="h-3 w-3"/> Subir</Button>
                                                        <Button type="button" variant="outline" size="sm" onClick={generateRandomAvatar} className="text-xs h-8 gap-2"><Camera className="h-3 w-3"/> Random</Button>
                                                    </div>
                                                </div>

                                                <div className="grid gap-2">
                                                    <Label>Nombre Completo</Label>
                                                    <Input placeholder="Ej: Macarena Lopez" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})}/>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Email</Label>
                                                    <div className="relative">
                                                        <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/>
                                                        <Input className="pl-9" placeholder="email@gml.com" value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})}/>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Rol</Label>
                                                    <Select value={newUser.role} onValueChange={(v)=>setNewUser({...newUser, role: v})}>
                                                        <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="ADMIN_GOD">Administración GOD</SelectItem>
                                                            <SelectItem value="ADMIN_OPS">Administrativa Ops</SelectItem>
                                                            <SelectItem value="SELLER">Vendedor</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleCreateUser} className="w-full bg-slate-900 text-white">Confirmar Creación</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {users.map(u => (
                                            <div key={u.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-xl hover:shadow-sm transition-shadow group">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-10 w-10 border border-slate-200">
                                                        <AvatarImage src={u.avatar} className="object-cover"/>
                                                        <AvatarFallback className="font-bold text-slate-600">{u.name.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800">{u.name}</h4>
                                                        <p className="text-xs text-slate-400">{u.email}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    {getRoleBadge(u.role)}
                                                    <Button variant="ghost" size="icon" onClick={() => deleteUser(u.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={16}/></Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* --- TAB WORKFLOWS --- */}
                    {activeTab === 'workflows' && (
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle>Sub-Estados por Etapa</CardTitle>
                                            <CardDescription>Definí qué opciones aparecen en cada paso del proceso.</CardDescription>
                                        </div>
                                        <div className="w-[200px]">
                                            <Select value={selectedStage} onValueChange={setSelectedStage}>
                                                <SelectTrigger className="font-bold border-blue-200 bg-blue-50 text-blue-700"><SelectValue/></SelectTrigger>
                                                <SelectContent>
                                                    {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                            <ListFilter size={14}/> Sub-Estados para: <span className="text-blue-600">{STAGES.find(s=>s.value===selectedStage)?.label}</span>
                                        </h4>
                                        <div className="flex gap-4 mb-4">
                                            <Input className="w-full bg-white" placeholder={`Nuevo sub-estado para ${selectedStage}...`} value={newSubState} onChange={e=>setNewSubState(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addSubState()}/>
                                            <Button onClick={addSubState} variant="secondary">Agregar</Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {(subStatesByStage[selectedStage] || []).map(state => (
                                                <Badge key={state} variant="outline" className="px-3 py-1.5 bg-white text-slate-700 border-slate-300 hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer group transition-colors shadow-sm" onClick={() => deleteSubState(state)}>
                                                    {state} <X size={12} className="ml-2 opacity-50 group-hover:opacity-100"/>
                                                </Badge>
                                            ))}
                                            {(!subStatesByStage[selectedStage] || subStatesByStage[selectedStage].length === 0) && (
                                                <span className="text-xs text-slate-400 italic">No hay sub-estados definidos.</span>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card className="border-slate-200 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-base">Posventa: Estados Financieros</CardTitle>
                                        <CardDescription>Opciones para Mora.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-2 mb-3">
                                            <Input className="h-8 text-xs" placeholder="Ej: MORA 4" value={newPSFinancial} onChange={e=>setNewPSFinancial(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPSFinancial()}/>
                                            <Button size="sm" onClick={addPSFinancial} variant="outline"><Plus size={14}/></Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {postSaleFinancial.map(s => (
                                                <Badge key={s} variant="secondary" className="bg-slate-100 text-xs cursor-pointer hover:bg-red-100" onClick={() => deletePSFinancial(s)}>{s}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="border-slate-200 shadow-sm">
                                    <CardHeader>
                                        <CardTitle className="text-base">Posventa: Acciones</CardTitle>
                                        <CardDescription>Gestión con cliente.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="flex gap-2 mb-3">
                                            <Input className="h-8 text-xs" placeholder="Ej: RECORDATORIO" value={newPSAction} onChange={e=>setNewPSAction(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addPSAction()}/>
                                            <Button size="sm" onClick={addPSAction} variant="outline"><Plus size={14}/></Button>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {postSaleActions.map(s => (
                                                <Badge key={s} variant="secondary" className="bg-purple-50 text-purple-700 text-xs cursor-pointer hover:bg-red-100" onClick={() => deletePSAction(s)}>{s}</Badge>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {/* --- TAB PERMISOS --- */}
                    {activeTab === 'permissions' && (
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader>
                                    <CardTitle>Matriz de Permisos</CardTitle>
                                    <CardDescription>Configuración granular para el rol <span className="font-bold text-blue-600">ADMIN OPS</span>.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-8">
                                        
                                        {/* ACCESO A MÓDULOS */}
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2"><Lock size={16}/> Acceso a Módulos</h4>
                                            <Separator/>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div className="flex flex-col justify-between p-4 bg-orange-50 border border-orange-100 rounded-lg h-full">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="bg-orange-100 p-2 rounded-full text-orange-600"><BarChart size={16}/></div>
                                                        <Label className="font-bold text-orange-800">Métricas</Label>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[10px] text-orange-600 leading-tight pr-2">Ver Dashboard global.</p>
                                                        <Switch checked={permissions.ops.accessMetrics} onCheckedChange={() => togglePermission('accessMetrics')} className="data-[state=checked]:bg-orange-600"/>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-between p-4 bg-green-50 border border-green-100 rounded-lg h-full">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="bg-green-100 p-2 rounded-full text-green-600"><DollarSign size={16}/></div>
                                                        <Label className="font-bold text-green-800">Facturación</Label>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[10px] text-green-600 leading-tight pr-2">Ver dinero y liquidaciones.</p>
                                                        <Switch checked={permissions.ops.accessBilling} onCheckedChange={() => togglePermission('accessBilling')} className="data-[state=checked]:bg-green-600"/>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg h-full">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="bg-blue-100 p-2 rounded-full text-blue-600"><HeartHandshake size={16}/></div>
                                                        <Label className="font-bold text-blue-800">Posventa</Label>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[10px] text-blue-600 leading-tight pr-2">Gestión de cartera y mora.</p>
                                                        <Switch checked={permissions.ops.accessPostSale} onCheckedChange={() => togglePermission('accessPostSale')} className="data-[state=checked]:bg-blue-600"/>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ACCIONES OPERATIVAS */}
                                        <div className="space-y-4">
                                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2"><GitPullRequest size={16}/> Acciones Operativas</h4>
                                            <Separator/>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium">Exportar Data</Label><p className="text-[10px] text-slate-500">Descargar Excel/CSV masivos.</p></div>
                                                    <Switch checked={permissions.ops.exportData} onCheckedChange={() => togglePermission('exportData')}/>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium text-red-600">Eliminar Ventas</Label><p className="text-[10px] text-slate-500">Borrar registros permanentemente.</p></div>
                                                    <Switch checked={permissions.ops.deleteSales} onCheckedChange={() => togglePermission('deleteSales')}/>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium">Editar Configuración</Label><p className="text-[10px] text-slate-500">Modificar prepagas, usuarios y reglas.</p></div>
                                                    <Switch checked={permissions.ops.editSettings} onCheckedChange={() => togglePermission('editSettings')}/>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium">Asignar Casos</Label><p className="text-[10px] text-slate-500">Tomar o delegar operaciones.</p></div>
                                                    <Switch checked={permissions.ops.assignCases} onCheckedChange={() => togglePermission('assignCases')}/>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}