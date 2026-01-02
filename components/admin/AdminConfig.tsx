"use client"

import { useState, useRef, useEffect } from "react"
// 1. IMPORTAMOS LAS HERRAMIENTAS DE CONEXIÓN
import { createClient } from "@/lib/supabase" // Tu cliente principal
import { createClient as createSupabaseJS } from "@supabase/supabase-js" // Para el truco de creación

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sliders, Shield, PhoneCall, Globe, Briefcase, Plus, Trash2, Clock, Star, Users, UserPlus, Lock, Mail, Camera, Upload, Pencil } from "lucide-react"

export function AdminConfig() {
    // 2. INICIAMOS EL CLIENTE DE SUPABASE
    const supabase = createClient()

    // --- ESTADO TRAMOS (Configuración Local por ahora) ---
    const [ranges5hs, setRanges5hs] = useState([
        { id: 1, min: 9, max: 14, percent: 15 },
        { id: 2, min: 15, max: 20, percent: 20 },
        { id: 3, min: 21, max: 24, percent: 25 },
        { id: 4, min: 25, max: 999, percent: 30 },
    ])
    const [ranges8hs, setRanges8hs] = useState([
        { id: 1, min: 13, max: 18, percent: 15 },
        { id: 2, min: 19, max: 24, percent: 20 },
        { id: 3, min: 25, max: 30, percent: 25 },
        { id: 4, min: 31, max: 999, percent: 30 },
    ])

    // --- ESTADO PLANES ESPECIALES ---
    const [specialPlans, setSpecialPlans] = useState([
        { id: 1, name: "Plan A1 / 500", percent: 10 },
        { id: 2, name: "Plan AMPF", percent: 10 },
    ])

    // --- ESTADO GESTIÓN DE USUARIOS (CONECTADO A BD) ---
    const [users, setUsers] = useState<any[]>([])
    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [editingUserId, setEditingUserId] = useState<string | null>(null) // Cambiado a string (UUID)
    const [loading, setLoading] = useState(false)
    
    // Formulario de Usuario
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "seller",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nuevo"
    })

    const fileInputRef = useRef<HTMLInputElement>(null)

    // 3. CARGAMOS USUARIOS REALES AL INICIAR
    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (data) {
            // Mapeamos los datos de la base (full_name) a los del componente (name)
            const mappedUsers = data.map(u => ({
                id: u.id,
                name: u.full_name || "Sin Nombre",
                email: u.email,
                role: u.role || "seller",
                avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`,
                // Password no se puede leer por seguridad
            }))
            setUsers(mappedUsers)
        }
    }

    // --- MANEJADORES DE CONFIGURACIÓN (TRAMOS) ---
    const updateRange = (list: any[], setList: any, id: number, field: string, value: string) => {
        const newList = list.map(item => item.id === id ? { ...item, [field]: parseInt(value) || 0 } : item)
        setList(newList)
    }
    const updateSpecialPlan = (id: number, field: string, value: string) => {
        const newList = specialPlans.map(item => item.id === id ? { ...item, [field]: field === 'percent' ? (parseInt(value) || 0) : value } : item)
        setSpecialPlans(newList)
    }
    const addRange = (list: any[], setList: any) => {
        const newId = Math.max(...list.map(i => i.id)) + 1
        setList([...list, { id: newId, min: 0, max: 0, percent: 0 }])
    }
    const addSpecialPlan = () => {
        const newId = Math.max(...specialPlans.map(i => i.id), 0) + 1
        setSpecialPlans([...specialPlans, { id: newId, name: "", percent: 0 }])
    }
    const removeSpecialPlan = (id: number) => {
        setSpecialPlans(specialPlans.filter(p => p.id !== id))
    }

    // --- LÓGICA USUARIOS (REAL) ---

    const openCreateModal = () => {
        setEditingUserId(null)
        setFormData({ name: "", email: "", password: "", role: "seller", avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` })
        setIsUserModalOpen(true)
    }

    const openEditModal = (user: any) => {
        setEditingUserId(user.id)
        setFormData({ 
            name: user.name, 
            email: user.email, 
            password: "", // No mostramos la pass vieja
            role: user.role, 
            avatar: user.avatar 
        })
        setIsUserModalOpen(true)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const previewUrl = URL.createObjectURL(file)
            setFormData({ ...formData, avatar: previewUrl })
        }
    }

    // 4. FUNCIÓN MAESTRA: GUARDAR USUARIO (CREAR O EDITAR)
    const handleSaveUser = async () => {
        if (!formData.name || !formData.email) return alert("Nombre y Email son obligatorios")
        setLoading(true)

        try {
            if (editingUserId) {
                // --- MODO EDICIÓN (SOLO PERFIL) ---
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        full_name: formData.name,
                        role: formData.role,
                        // avatar_url: formData.avatar (Si implementás storage real)
                    })
                    .eq('id', editingUserId)

                if (error) throw error
                alert("Usuario actualizado correctamente.")

            } else {
                // --- MODO CREACIÓN (AUTH + PERFIL) ---
                if (!formData.password) {
                    alert("Para crear un usuario necesitás una contraseña.")
                    setLoading(false)
                    return
                }

                // TRUCO: Creamos un cliente "temporal" que NO guarda sesión en el navegador
                // Esto evita que se te cierre tu sesión de Admin al crear otro usuario.
                const tempSupabase = createSupabaseJS(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                    { auth: { persistSession: false } } // <--- LA CLAVE
                )

                // 1. Crear en Auth
                const { data: authData, error: authError } = await tempSupabase.auth.signUp({
                    email: formData.email,
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.name,
                            role: formData.role // Guardamos el rol en metadata también
                        }
                    }
                })

                if (authError) throw authError
                if (!authData.user) throw new Error("No se pudo crear el usuario")

                // 2. Crear/Actualizar Perfil (El trigger SQL debería hacerlo, pero nos aseguramos)
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                        id: authData.user.id,
                        email: formData.email,
                        full_name: formData.name,
                        role: formData.role,
                        avatar_url: formData.avatar
                    })
                
                if (profileError) {
                    console.error("Error perfil:", profileError)
                    // No frenamos, porque el usuario Auth ya se creó
                }

                alert(`Usuario ${formData.name} creado con éxito.`)
            }

            // Recargamos lista y cerramos
            await fetchUsers()
            setIsUserModalOpen(false)

        } catch (error: any) {
            console.error(error)
            alert("Error: " + (error.message || "Ocurrió un problema"))
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm("Esto eliminará el acceso del usuario. ¿Seguro?")) return
        
        // Solo borramos el perfil para bloquear acceso visual
        // (Borrar de Auth requiere permisos de servicio, esto es un soft-delete funcional)
        const { error } = await supabase.from('profiles').delete().eq('id', id)
        
        if (error) {
            alert("Error al eliminar")
        } else {
            setUsers(users.filter(u => u.id !== id))
        }
    }

    const generateRandomAvatar = () => {
        const seed = Math.random().toString(36).substring(7)
        setFormData({ ...formData, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}` })
    }

    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'admin_god': return <span className="bg-purple-600 text-white px-2 py-0.5 rounded text-[10px] font-bold border border-purple-700 uppercase shadow-sm">Administración GOD</span>
            case 'admin': 
            case 'manager_god': return <span className="bg-amber-500 text-white px-2 py-0.5 rounded text-[10px] font-bold border border-amber-600 uppercase shadow-sm">Supervisión (Lucho)</span>
            case 'ops': return <span className="bg-pink-500 text-white px-2 py-0.5 rounded text-[10px] font-bold border border-pink-600 uppercase shadow-sm">Operaciones (Maca)</span>
            default: return <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200 uppercase">Vendedor</span>
        }
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-6">
            <div><h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2"><Sliders className="h-8 w-8 text-slate-600" /> Configuración General</h2><p className="text-slate-500">Panel de Control Maestro (God Mode).</p></div>

            <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full grid-cols-5 h-12">
                    <TabsTrigger value="users">👥 Usuarios</TabsTrigger>
                    <TabsTrigger value="commissions">💰 Comisiones</TabsTrigger>
                    <TabsTrigger value="leads">⚡ Leads</TabsTrigger>
                    <TabsTrigger value="business">🏢 Negocio</TabsTrigger>
                    <TabsTrigger value="system">🔒 Sistema</TabsTrigger>
                </TabsList>

                {/* --- GESTIÓN DE USUARIOS CONECTADA --- */}
                <TabsContent value="users" className="space-y-6 animate-in fade-in slide-in-from-left-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">Equipo de GML</h3>
                            <p className="text-sm text-slate-500">Crear, editar y gestionar accesos.</p>
                        </div>
                        <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-md">
                            <UserPlus className="h-4 w-4" /> Crear Usuario
                        </Button>

                        <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                            <DialogContent className="max-w-md bg-white dark:bg-[#18191A] border-slate-200 dark:border-slate-800">
                                <DialogHeader>
                                    <DialogTitle className="dark:text-white">{editingUserId ? "Editar Usuario" : "Nuevo Usuario"}</DialogTitle>
                                    <DialogDescription>{editingUserId ? "Modificá los datos del perfil." : "Crear cuenta para vendedor o directivo."}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="flex flex-col items-center gap-3 mb-2">
                                        <Avatar className="h-24 w-24 border-4 border-slate-100 dark:border-slate-700 shadow-md">
                                            <AvatarImage src={formData.avatar} className="object-cover" />
                                            <AvatarFallback>NN</AvatarFallback>
                                        </Avatar>
                                        <div className="flex gap-2">
                                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
                                            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-8 gap-2">
                                                <Upload className="h-3 w-3"/> Subir Foto
                                            </Button>
                                            <Button type="button" variant="outline" size="sm" onClick={generateRandomAvatar} className="text-xs h-8 gap-2">
                                                <Camera className="h-3 w-3"/> Random
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="grid gap-2">
                                        <Label className="dark:text-slate-200">Nombre Completo</Label>
                                        <Input placeholder="Ej: Maria Gonzalez" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="dark:bg-[#242526] dark:border-slate-700 dark:text-white"/>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label className="dark:text-slate-200">Email (Usuario)</Label>
                                        <div className="relative">
                                            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                            <Input className="pl-9 dark:bg-[#242526] dark:border-slate-700 dark:text-white" placeholder="usuario@gml.com" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} disabled={!!editingUserId} />
                                        </div>
                                    </div>
                                    {!editingUserId && (
                                        <div className="grid gap-2">
                                            <Label className="dark:text-slate-200">Contraseña</Label>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                                <Input className="pl-9 dark:bg-[#242526] dark:border-slate-700 dark:text-white" type="text" placeholder="Crear contraseña" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} />
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid gap-2">
                                        <Label className="dark:text-slate-200">Rol y Permisos</Label>
                                        <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                                            <SelectTrigger className="dark:bg-[#242526] dark:border-slate-700 dark:text-white">
                                                <SelectValue placeholder="Seleccionar Rol" />
                                            </SelectTrigger>
                                            <SelectContent className="dark:bg-[#242526] dark:border-slate-700">
                                                <SelectItem value="seller">🟢 Vendedor</SelectItem>
                                                <SelectItem value="admin">🟠 Supervisión (Lucho)</SelectItem>
                                                <SelectItem value="ops">🟣 Administración (Maca)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={handleSaveUser} disabled={loading} className="w-full bg-slate-900 text-white hover:bg-slate-800">
                                        {loading ? "Procesando..." : (editingUserId ? "Guardar Cambios" : "Crear Usuario")}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map((user) => (
                            <Card key={user.id} className="overflow-hidden hover:shadow-lg transition-all border-l-4 border-l-transparent hover:border-l-blue-500 group dark:bg-[#18191A] dark:border-slate-800">
                                <CardContent className="p-4 flex items-center gap-4 relative">
                                    <Avatar className="h-14 w-14 border-2 border-slate-100 shadow-sm">
                                        <AvatarImage src={user.avatar} className="object-cover" />
                                        <AvatarFallback>{user.name.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className="font-bold text-slate-800 dark:text-white truncate text-base">{user.name}</h4>
                                        <p className="text-xs text-slate-500 truncate mb-1">{user.email}</p>
                                        <div>{getRoleBadge(user.role)}</div>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={() => openEditModal(user)}>
                                            <Pencil className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDeleteUser(user.id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* --- COMISIONES --- */}
                <TabsContent value="commissions" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-t-4 border-t-blue-500 dark:bg-[#18191A] dark:border-slate-800 dark:border-t-blue-500">
                            <CardHeader><CardTitle className="flex gap-2 text-blue-700 dark:text-blue-400"><Clock className="h-5 w-5"/> Jornada 5 Hs</CardTitle><CardDescription>Escala variable por ventas.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg"><span className="font-bold text-sm dark:text-slate-200">Ventas Absorbibles</span><div className="flex items-center gap-1"><Input defaultValue="8" className="w-16 text-center font-bold bg-white dark:bg-slate-900" /><span className="text-xs">vtas</span></div></div>
                                <Separator className="dark:bg-slate-700"/>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-slate-400 font-bold">Escala de Premios</Label>
                                    {ranges5hs.map((range) => (
                                        <div key={range.id} className="flex gap-2 items-center">
                                            <Input value={range.min} onChange={(e)=>updateRange(ranges5hs, setRanges5hs, range.id, 'min', e.target.value)} className="w-14 text-center h-8 dark:bg-slate-900" placeholder="Min" />
                                            <span className="text-xs text-slate-400">a</span>
                                            <Input value={range.max === 999 ? '+' : range.max} onChange={(e)=>updateRange(ranges5hs, setRanges5hs, range.id, 'max', e.target.value)} className="w-14 text-center h-8 dark:bg-slate-900" placeholder="Max" />
                                            <span className="text-xs text-slate-400">vtas =</span>
                                            <Input value={range.percent} onChange={(e)=>updateRange(ranges5hs, setRanges5hs, range.id, 'percent', e.target.value)} className="w-14 text-center h-8 font-bold text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" />
                                            <span className="text-xs font-bold text-green-600 dark:text-green-400">%</span>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => addRange(ranges5hs, setRanges5hs)} className="w-full text-blue-500 hover:text-blue-700 hover:bg-blue-50 mt-2"><Plus className="h-3 w-3 mr-1"/> Agregar Tramo</Button>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-t-4 border-t-purple-500 dark:bg-[#18191A] dark:border-slate-800 dark:border-t-purple-500">
                            <CardHeader><CardTitle className="flex gap-2 text-purple-700 dark:text-purple-400"><Clock className="h-5 w-5"/> Jornada 8 Hs</CardTitle><CardDescription>Escala variable por ventas.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg"><span className="font-bold text-sm dark:text-slate-200">Ventas Absorbibles</span><div className="flex items-center gap-1"><Input defaultValue="12" className="w-16 text-center font-bold bg-white dark:bg-slate-900" /><span className="text-xs">vtas</span></div></div>
                                <Separator className="dark:bg-slate-700"/>
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-slate-400 font-bold">Escala de Premios</Label>
                                    {ranges8hs.map((range) => (
                                        <div key={range.id} className="flex gap-2 items-center">
                                            <Input value={range.min} onChange={(e)=>updateRange(ranges8hs, setRanges8hs, range.id, 'min', e.target.value)} className="w-14 text-center h-8 dark:bg-slate-900" placeholder="Min" />
                                            <span className="text-xs text-slate-400">a</span>
                                            <Input value={range.max === 999 ? '+' : range.max} onChange={(e)=>updateRange(ranges8hs, setRanges8hs, range.id, 'max', e.target.value)} className="w-14 text-center h-8 dark:bg-slate-900" placeholder="Max" />
                                            <span className="text-xs text-slate-400">vtas =</span>
                                            <Input value={range.percent} onChange={(e)=>updateRange(ranges8hs, setRanges8hs, range.id, 'percent', e.target.value)} className="w-14 text-center h-8 font-bold text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400" />
                                            <span className="text-xs font-bold text-green-600 dark:text-green-400">%</span>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => addRange(ranges8hs, setRanges8hs)} className="w-full text-purple-500 hover:text-purple-700 hover:bg-purple-50 mt-2"><Plus className="h-3 w-3 mr-1"/> Agregar Tramo</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- LEADS / BUSINESS / SYSTEM (IGUAL QUE ANTES PERO DARK MODE FRIENDLY) --- */}
                <TabsContent value="leads" className="space-y-4">
                    <Card className="dark:bg-[#18191A] dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 dark:text-white"><PhoneCall className="h-5 w-5 text-blue-600"/> Semáforo de Contacto</CardTitle></CardHeader><CardContent className="space-y-6"><div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-base font-bold dark:text-slate-200">Límite de Llamados (Nuevos)</Label></div><div className="flex items-center gap-2"><Input type="number" defaultValue={7} className="w-20 text-center font-bold dark:bg-slate-900" /><span className="text-sm text-slate-500">intentos</span></div></div><Separator className="dark:bg-slate-700"/><div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-base font-bold dark:text-slate-200">Protección en "Gestión"</Label></div><Switch defaultChecked /></div></CardContent></Card>
                    <Card className="dark:bg-[#18191A] dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 dark:text-white"><Shield className="h-5 w-5 text-red-600"/> Detector de Zombies</CardTitle></CardHeader><CardContent className="space-y-6"><div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="text-base font-bold dark:text-slate-200">Alerta Zombie (Días)</Label></div><div className="flex items-center gap-2"><Input type="number" defaultValue={15} className="w-20 text-center font-bold dark:bg-slate-900" /><span className="text-sm text-slate-500">días</span></div></div></CardContent></Card>
                </TabsContent>
                <TabsContent value="business" className="space-y-4">
                    <Card className="dark:bg-[#18191A] dark:border-slate-800"><CardHeader><CardTitle className="flex gap-2 dark:text-white"><Briefcase className="h-5 w-5 text-blue-600"/> Operativo</CardTitle></CardHeader><CardContent className="space-y-6"><div className="flex justify-between items-center"><Label className="dark:text-slate-200">Horario de Atención</Label><div className="flex gap-2"><Input defaultValue="09:00" className="w-20 dark:bg-slate-900" /> <span className="dark:text-slate-400">a</span> <Input defaultValue="18:00" className="w-20 dark:bg-slate-900" /></div></div></CardContent></Card>
                </TabsContent>
                <TabsContent value="system" className="space-y-4">
                    <Card className="dark:bg-[#18191A] dark:border-slate-800"><CardHeader><CardTitle className="flex items-center gap-2 dark:text-white"><Globe className="h-5 w-5 text-slate-600"/> Acceso</CardTitle></CardHeader><CardContent className="space-y-6"><div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="font-bold dark:text-slate-200">Bloquear Acceso fuera de Horario</Label></div><Switch /></div></CardContent></Card>
                </TabsContent>
            </Tabs>
            <div className="flex justify-end pt-4"><Button className="bg-slate-900 text-white px-8 h-12 text-lg shadow-xl hover:bg-slate-800">💾 Guardar Configuración</Button></div>
        </div>
    )
}