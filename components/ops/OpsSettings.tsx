"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Plus, Trash2, Shield, User, Save, CreditCard, Users, BarChart, X, Globe, Lock, GitPullRequest, DollarSign, HeartHandshake, ListFilter, Camera, Upload, Mail, RefreshCw, ShieldAlert, Crown, Briefcase, Headset, Snowflake, Flame, Eye, EyeOff } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch" 
import { Separator } from "@/components/ui/separator"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog"

// CONSTANTES ESTÁTICAS (No cambian)
const STAGES = [
    { value: "ingresado", label: "Ingresado" },
    { value: "precarga", label: "Precarga" },
    { value: "medicas", label: "Médicas" },
    { value: "legajo", label: "Legajo" },
    { value: "demoras", label: "Demoras" },
    { value: "cumplidas", label: "Aprobadas" },
    { value: "rechazado", label: "Rechazadas" }
]

export function OpsSettings() {
    const supabase = createClient()
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'business' | 'users' | 'workflows' | 'permissions'>('business')

    // 1. COMERCIAL (Desde DB)
    const [prepagas, setPrepagas] = useState<any[]>([])
    const [newPrepaga, setNewPrepaga] = useState("")
    const [selectedPrepagaId, setSelectedPrepagaId] = useState<number | null>(null)
    const [newPlan, setNewPlan] = useState("")
    
    const [origins, setOrigins] = useState<string[]>([])
    const [newOrigin, setNewOrigin] = useState("")

    // 2. EQUIPO (Desde DB Profiles)
    const [users, setUsers] = useState<any[]>([])
    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    // Agregamos password al estado para creación
    const [newUser, setNewUser] = useState({ 
        name: "", email: "", role: "admin_common", avatar: "", password: "" 
    })
    const [showPassword, setShowPassword] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 3. WORKFLOWS (Desde DB)
    const [selectedStage, setSelectedStage] = useState("ingresado")
    const [subStatesByStage, setSubStatesByStage] = useState<Record<string, string[]>>({})
    const [newSubState, setNewSubState] = useState("")

    // Estado Configuración Cementerio (Freeze Times) - NUEVO EN OPS
    const [freezeConfig, setFreezeConfig] = useState({
        fantasmas: 30,
        precio: 60,
        interes: 45,
        quemados: 45,
        basural: 365
    })

    // 4. PERMISOS (Desde DB)
    const [permissions, setPermissions] = useState({
        exportData: true, editSettings: false, deleteSales: false, assignCases: true,
        accessMetrics: false, accessBilling: false, accessPostSale: true, 
    })

    // --- CARGA INICIAL ---
    useEffect(() => {
        fetchConfig()
        fetchUsers()
    }, [])

    const fetchConfig = async () => {
        setLoading(true)
        const { data } = await supabase.from('system_config').select('*')
        if (data) {
            const p = data.find(c => c.key === 'prepagas_plans')?.value
            const o = data.find(c => c.key === 'sales_origins')?.value
            const s = data.find(c => c.key === 'workflow_substates')?.value
            const perm = data.find(c => c.key === 'ops_permissions')?.value
            const gz = data.find(c => c.key === 'graveyard_config')?.value

            if (p) setPrepagas(p)
            if (o) setOrigins(o)
            if (s) setSubStatesByStage(s)
            if (perm) setPermissions(perm)
            if (gz) setFreezeConfig(gz)
        }
        setLoading(false)
    }

    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (data) {
            setUsers(data.map(u => ({
                id: u.id,
                name: u.full_name || "Sin Nombre",
                role: u.role || "seller",
                email: u.email,
                avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`
            })))
        }
    }

    // --- GUARDADO GENERAL ---
    const handleSaveAll = async () => {
        setLoading(true)
        // Guardamos todo en system_config
        await supabase.from('system_config').upsert({ key: 'prepagas_plans', value: prepagas })
        await supabase.from('system_config').upsert({ key: 'sales_origins', value: origins })
        await supabase.from('system_config').upsert({ key: 'workflow_substates', value: subStatesByStage })
        await supabase.from('system_config').upsert({ key: 'ops_permissions', value: permissions })
        await supabase.from('system_config').upsert({ key: 'graveyard_config', value: freezeConfig }) // Guardar config cementerio
        
        setLoading(false)
        alert("✅ Configuración guardada y aplicada al sistema.")
    }

    // --- HANDLERS COMERCIAL ---
    const addPrepaga = () => { if(newPrepaga) { setPrepagas([...prepagas, { id: Date.now(), name: newPrepaga, plans: [] }]); setNewPrepaga("") } }
    const deletePrepaga = (id: number) => setPrepagas(prepagas.filter(p => p.id !== id))
    const addPlan = () => { if(newPlan && selectedPrepagaId) { setPrepagas(prepagas.map(p => p.id === selectedPrepagaId ? { ...p, plans: [...p.plans, newPlan] } : p)); setNewPlan("") } }
    const deletePlan = (prepagaId: number, plan: string) => { setPrepagas(prepagas.map(p => p.id === prepagaId ? { ...p, plans: p.plans.filter((pl:string) => pl !== plan) } : p)) }
    
    const addOrigin = () => { if(newOrigin && !origins.includes(newOrigin)) { setOrigins([...origins, newOrigin]); setNewOrigin("") } }
    const deleteOrigin = (name: string) => setOrigins(origins.filter(o => o !== name))
    
    // --- HANDLERS USUARIOS (CORREGIDO PUNTO 14) ---
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => { setNewUser(prev => ({ ...prev, avatar: reader.result as string })) }
            reader.readAsDataURL(file)
        }
    }

    const handleCreateUser = async () => { 
        if(!newUser.name || !newUser.email || !newUser.password) return alert("Faltan datos (incluida contraseña)")
        
        setLoading(true)
        
        try {
            // USAMOS LA FUNCIÓN SQL QUE CREAMOS
            const { data, error } = await supabase.rpc('create_new_user', {
                email: newUser.email,
                password: newUser.password,
                full_name: newUser.name,
                role: newUser.role,
                work_hours: 5 // Default
            })

            if (error) throw error

            alert("Usuario creado exitosamente con acceso al sistema. ✅")
            fetchUsers()
            setNewUser({ name: "", email: "", role: "admin_common", avatar: "", password: "" })
            setIsUserModalOpen(false)
        } catch (e: any) {
            console.error(e)
            alert("Error creando usuario: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const deleteUser = async (id: string) => {
        if (!confirm("¿Borrar usuario?")) return
        await supabase.from('profiles').delete().eq('id', id)
        fetchUsers()
    }

    // --- HANDLERS WORKFLOWS ---
    const addSubState = () => { if(newSubState && selectedStage) { setSubStatesByStage({ ...subStatesByStage, [selectedStage]: [...(subStatesByStage[selectedStage] || []), newSubState] }); setNewSubState("") } }
    const deleteSubState = (val: string) => { setSubStatesByStage({ ...subStatesByStage, [selectedStage]: subStatesByStage[selectedStage].filter(s => s !== val) }) }

    // --- HANDLERS PERMISOS ---
    const togglePermission = (key: keyof typeof permissions) => { 
        setPermissions(prev => ({ ...prev, [key]: !prev[key] })) 
    }

    // Helper Visual Roles
    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'admin_god': return <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold border border-purple-200 uppercase">Admin GOD</span>
            case 'admin_common': return <span className="bg-pink-100 text-pink-700 px-2 py-0.5 rounded text-[10px] font-bold border border-pink-200 uppercase">Administrativa</span>
            case 'supervisor_god': return <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold border border-amber-200 uppercase">Supervisión</span>
            default: return <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200 uppercase">Vendedor</span>
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
                <Button onClick={handleSaveAll} disabled={loading} className="bg-blue-600 hover:bg-blue-700 font-bold shadow-md">
                    {loading ? <RefreshCw className="animate-spin h-4 w-4 mr-2"/> : <Save size={16} className="mr-2"/>} 
                    {loading ? "Guardando..." : "Guardar Todo"}
                </Button>
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
                                                    {p.plans && p.plans.map((plan: string) => (
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

                    {/* --- TAB USUARIOS --- */}
                    {activeTab === 'users' && (
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <div>
                                        <CardTitle>Equipo de Trabajo</CardTitle>
                                        <CardDescription>Gestión compartida con Admin Config.</CardDescription>
                                    </div>
                                    <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="bg-slate-800 text-white shadow-sm"><User size={16} className="mr-2"/> Nuevo Usuario</Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Crear Usuario</DialogTitle>
                                                <DialogDescription>Alta de nuevo integrante.</DialogDescription>
                                            </DialogHeader>
                                            <div className="space-y-4 py-4">
                                                {/* FORMULARIO USUARIO */}
                                                <div className="flex flex-col items-center gap-3 mb-2">
                                                    <Avatar className="h-20 w-20 border-4 border-slate-100 shadow-md">
                                                        <AvatarImage src={newUser.avatar} className="object-cover"/>
                                                        <AvatarFallback>NN</AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex gap-2">
                                                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
                                                        <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-8 gap-2"><Upload className="h-3 w-3"/> Subir</Button>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Nombre</Label>
                                                    <Input placeholder="Ej: Maca" value={newUser.name} onChange={e=>setNewUser({...newUser, name: e.target.value})}/>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Email</Label>
                                                    <Input placeholder="email@gml.com" value={newUser.email} onChange={e=>setNewUser({...newUser, email: e.target.value})}/>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Contraseña (Acceso)</Label>
                                                    <div className="relative">
                                                        <Input 
                                                            type={showPassword ? "text" : "password"} 
                                                            placeholder="Mínimo 6 caracteres" 
                                                            value={newUser.password} 
                                                            onChange={e=>setNewUser({...newUser, password: e.target.value})}
                                                        />
                                                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-400" onClick={() => setShowPassword(!showPassword)}>
                                                            {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label>Rol</Label>
                                                    <Select value={newUser.role} onValueChange={(v)=>setNewUser({...newUser, role: v})}>
                                                        <SelectTrigger><SelectValue placeholder="Rol" /></SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="admin_god">Administrativa GOD</SelectItem>
                                                            <SelectItem value="admin_common">Administrativa</SelectItem>
                                                            <SelectItem value="supervisor_god">Supervisión GOD</SelectItem>
                                                            <SelectItem value="seller">Vendedora</SelectItem>
                                                            <SelectItem value="setter">Setter</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleCreateUser} disabled={loading} className="w-full bg-slate-900 text-white">
                                                    {loading ? "Creando..." : "Confirmar"}
                                                </Button>
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

                    {/* --- TAB WORKFLOWS (CON CEMENTERIO) --- */}
                    {activeTab === 'workflows' && (
                        <div className="space-y-6">
                             {/* CONFIGURACIÓN CEMENTERIO (NUEVO) */}
                             <Card className="border-l-4 border-l-blue-500 shadow-sm">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2"><Snowflake className="h-5 w-5 text-blue-500"/> Configuración de Cementerio</CardTitle>
                                    <CardDescription>Días de congelamiento antes de que un lead pueda ser reciclado.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500 font-bold">Fantasmas</Label>
                                            <div className="relative">
                                                <Input type="number" className="pl-2 pr-8" value={freezeConfig.fantasmas} onChange={e => setFreezeConfig({...freezeConfig, fantasmas: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">días</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500 font-bold">Interés Caído</Label>
                                            <div className="relative">
                                                <Input type="number" className="pl-2 pr-8" value={freezeConfig.interes} onChange={e => setFreezeConfig({...freezeConfig, interes: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">días</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500 font-bold">Precio / Caro</Label>
                                            <div className="relative">
                                                <Input type="number" className="pl-2 pr-8" value={freezeConfig.precio} onChange={e => setFreezeConfig({...freezeConfig, precio: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">días</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-red-500 font-bold flex items-center gap-1"><Flame size={10}/> Quemados (+7)</Label>
                                            <div className="relative">
                                                <Input type="number" className="pl-2 pr-8 border-red-200 bg-red-50" value={freezeConfig.quemados} onChange={e => setFreezeConfig({...freezeConfig, quemados: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-3 top-2.5 text-xs text-red-400 font-bold">días</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs text-slate-500 font-bold">Basural</Label>
                                            <div className="relative">
                                                <Input type="number" className="pl-2 pr-8" value={freezeConfig.basural} onChange={e => setFreezeConfig({...freezeConfig, basural: parseInt(e.target.value) || 0})}/>
                                                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">días</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

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
                        </div>
                    )}

                    {/* --- TAB PERMISOS (Aquí se configuran los permisos para Admin Común) --- */}
                    {activeTab === 'permissions' && (
                        <div className="space-y-6">
                            <Card className="border-slate-200 shadow-sm border-l-4 border-l-pink-500">
                                <CardHeader>
                                    <CardTitle>Matriz de Permisos</CardTitle>
                                    <CardDescription>Configuración granular para el rol <span className="font-bold text-pink-600">ADMINISTRATIVA COMÚN</span>.</CardDescription>
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
                                                        <Switch checked={permissions.accessMetrics} onCheckedChange={() => togglePermission('accessMetrics')} className="data-[state=checked]:bg-orange-600"/>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-between p-4 bg-green-50 border border-green-100 rounded-lg h-full">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="bg-green-100 p-2 rounded-full text-green-600"><DollarSign size={16}/></div>
                                                        <Label className="font-bold text-green-800">Facturación</Label>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[10px] text-green-600 leading-tight pr-2">Ver dinero y liquidaciones.</p>
                                                        <Switch checked={permissions.accessBilling} onCheckedChange={() => togglePermission('accessBilling')} className="data-[state=checked]:bg-green-600"/>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg h-full">
                                                    <div className="flex items-center gap-3 mb-3">
                                                        <div className="bg-blue-100 p-2 rounded-full text-blue-600"><HeartHandshake size={16}/></div>
                                                        <Label className="font-bold text-blue-800">Posventa</Label>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-[10px] text-blue-600 leading-tight pr-2">Gestión de cartera y mora.</p>
                                                        <Switch checked={permissions.accessPostSale} onCheckedChange={() => togglePermission('accessPostSale')} className="data-[state=checked]:bg-blue-600"/>
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
                                                    <Switch checked={permissions.exportData} onCheckedChange={() => togglePermission('exportData')}/>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium text-red-600">Eliminar Ventas</Label><p className="text-[10px] text-slate-500">Borrar registros permanentemente.</p></div>
                                                    <Switch checked={permissions.deleteSales} onCheckedChange={() => togglePermission('deleteSales')}/>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium">Editar Configuración</Label><p className="text-[10px] text-slate-500">Modificar prepagas, usuarios y reglas.</p></div>
                                                    <Switch checked={permissions.editSettings} onCheckedChange={() => togglePermission('editSettings')}/>
                                                </div>
                                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                                    <div><Label className="font-medium">Asignar Casos</Label><p className="text-[10px] text-slate-500">Tomar o delegar operaciones.</p></div>
                                                    <Switch checked={permissions.assignCases} onCheckedChange={() => togglePermission('assignCases')}/>
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