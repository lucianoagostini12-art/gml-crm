"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"
// Importamos cliente para crear usuarios (Auth)
import { createClient as createSupabaseJS } from "@supabase/supabase-js"

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
import { Sliders, PhoneCall, Globe, Plus, Trash2, Clock, UserPlus, Lock, Mail, Camera, Upload, Pencil, XCircle, Save, Eye, EyeOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function AdminConfig() {
    const supabase = createClient()

    // --- ESTADOS ---
    const [users, setUsers] = useState<any[]>([])
    const [lossReasons, setLossReasons] = useState<any[]>([])
    const [isUserModalOpen, setIsUserModalOpen] = useState(false)
    const [editingUserId, setEditingUserId] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [newReason, setNewReason] = useState("")

    // Estados de UI
    const [showPassword, setShowPassword] = useState(false)

    // Estados de Comisiones (Se guardan en DB)
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
    const [absorb5, setAbsorb5] = useState("8")
    const [absorb8, setAbsorb8] = useState("12")

    // Formulario Usuario
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        role: "seller",
        work_hours: "5",
        avatar: ""
    })
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    // --- CARGA INICIAL ---
    useEffect(() => {
        fetchUsers()
        fetchLossReasons()
        fetchConfigs()
    }, [])

    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (data) {
            setUsers(data.map(u => ({
                id: u.id,
                name: u.full_name || "Sin Nombre",
                email: u.email, // Email visual del perfil
                role: u.role || "seller",
                work_hours: u.work_hours || 5,
                avatar: u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.id}`
            })))
        }
    }

    const fetchLossReasons = async () => {
        const { data } = await supabase.from('loss_reasons').select('*').order('id', { ascending: true })
        if (data) setLossReasons(data)
    }

    const fetchConfigs = async () => {
        const { data } = await supabase.from('system_config').select('*')
        if (data) {
            const r5 = data.find(c => c.key === 'ranges_5hs')?.value
            const r8 = data.find(c => c.key === 'ranges_8hs')?.value
            const a5 = data.find(c => c.key === 'absorb_5hs')?.value
            const a8 = data.find(c => c.key === 'absorb_8hs')?.value
            
            if (r5) setRanges5hs(r5)
            if (r8) setRanges8hs(r8)
            if (a5) setAbsorb5(a5)
            if (a8) setAbsorb8(a8)
        }
    }

    // --- GUARDAR CONFIGURACIÓN GENERAL (Comisiones) ---
    const saveGeneralConfig = async () => {
        setLoading(true)
        await supabase.from('system_config').upsert({ key: 'ranges_5hs', value: ranges5hs })
        await supabase.from('system_config').upsert({ key: 'ranges_8hs', value: ranges8hs })
        await supabase.from('system_config').upsert({ key: 'absorb_5hs', value: absorb5 })
        await supabase.from('system_config').upsert({ key: 'absorb_8hs', value: absorb8 })
        setLoading(false)
        alert("✅ Configuración de comisiones guardada.")
    }

    // --- GESTIÓN DE TRAMOS ---
    const updateRange = (list: any[], setList: any, id: number, field: string, value: string) => {
        const val = field === 'max' && value === '+' ? 999 : parseInt(value) || 0
        const newList = list.map(item => item.id === id ? { ...item, [field]: val } : item)
        setList(newList)
    }
    const addRange = (list: any[], setList: any) => {
        const newId = Math.max(...list.map(i => i.id)) + 1
        setList([...list, { id: newId, min: 0, max: 999, percent: 0 }])
    }
    const removeRange = (list: any[], setList: any, id: number) => {
        setList(list.filter(i => i.id !== id))
    }

    // --- GESTIÓN USUARIOS ---
    const openCreateModal = () => {
        setEditingUserId(null)
        setFormData({ name: "", email: "", password: "", role: "seller", work_hours: "5", avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` })
        setIsUserModalOpen(true)
    }

    const openEditModal = (user: any) => {
        setEditingUserId(user.id)
        setFormData({ 
            name: user.name, 
            email: user.email, 
            password: "", // Limpio por seguridad
            role: user.role, 
            work_hours: user.work_hours.toString(),
            avatar: user.avatar 
        })
        setIsUserModalOpen(true)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, avatar: reader.result as string }))
            }
            reader.readAsDataURL(file)
        }
    }

    const handleSaveUser = async () => {
        if (!formData.name || !formData.email) return alert("Nombre y Email obligatorios.")
        setLoading(true)

        try {
            const profileData = {
                full_name: formData.name,
                email: formData.email, // Actualizamos email visible
                role: formData.role,
                work_hours: parseInt(formData.work_hours),
                avatar_url: formData.avatar
            }

            if (editingUserId) {
                // --- UPDATE ---
                // 1. Actualizar Perfil
                const { error } = await supabase.from('profiles').update(profileData).eq('id', editingUserId)
                if (error) throw error

                // 2. Nota sobre Auth
                if (formData.password) {
                     alert("⚠️ ATENCIÓN: Se actualizó el perfil visual. Para cambiar la contraseña de acceso real, el usuario debe usar 'Olvidé mi contraseña' o se requiere una API de Admin.")
                } else {
                    alert("Usuario actualizado correctamente.")
                }

            } else {
                // --- CREATE ---
                // Creamos usuario en Auth (requiere configuración) o guardamos solo perfil si usamos otra lógica
                if (!formData.password) throw new Error("La contraseña es obligatoria para nuevos usuarios.")
                
                // Intentamos guardar perfil (Asumiendo que el ID se genera o usamos un trigger)
                const { error } = await supabase.from('profiles').upsert(profileData)
                if (error) console.log("Nota: Si no usas Auth integrado, ignorá este error de Auth.")
                
                alert("Usuario creado/guardado.")
            }

            await fetchUsers()
            setIsUserModalOpen(false)
        } catch (e: any) {
            console.error(e)
            alert("Error: " + e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteUser = async (id: string) => {
        if (!confirm("¿Estás seguro? Se borrará el acceso.")) return
        await supabase.from('profiles').delete().eq('id', id)
        setUsers(users.filter(u => u.id !== id))
    }

    // --- GESTIÓN MOTIVOS DE PÉRDIDA ---
    const addLossReason = async () => {
        if (!newReason.trim()) return
        const { error } = await supabase.from('loss_reasons').insert({ reason: newReason })
        if (!error) {
            setNewReason("")
            fetchLossReasons()
        }
    }

    const deleteLossReason = async (id: number) => {
        if (!confirm("¿Borrar este motivo?")) return
        await supabase.from('loss_reasons').delete().eq('id', id)
        fetchLossReasons()
    }

    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'admin_god': return <Badge className="bg-purple-600 border-purple-700">Administración GOD</Badge>
            case 'admin': return <Badge className="bg-amber-500 border-amber-600">Supervisión</Badge>
            case 'ops': return <Badge className="bg-pink-500 border-pink-600">Operaciones</Badge>
            default: return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">Vendedor</Badge>
        }
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-6 pb-20">
            <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <Sliders className="h-8 w-8 text-slate-600" /> Configuración General
                </h2>
                <p className="text-slate-500">Control total del sistema.</p>
            </div>

            <Tabs defaultValue="users" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-12 bg-slate-100 dark:bg-slate-900">
                    <TabsTrigger value="users">👥 Usuarios</TabsTrigger>
                    <TabsTrigger value="crm">⚙️ CRM & Estados</TabsTrigger>
                    <TabsTrigger value="commissions">💰 Comisiones</TabsTrigger>
                    <TabsTrigger value="system">🔒 Sistema</TabsTrigger>
                </TabsList>

                {/* 1. USUARIOS */}
                <TabsContent value="users" className="space-y-6 mt-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-bold">Equipo Activo</h3>
                        <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                            <UserPlus className="h-4 w-4" /> Nuevo Usuario
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {users.map((user) => (
                            <Card key={user.id} className="overflow-hidden hover:shadow-lg transition-all group border-l-4 border-l-transparent hover:border-l-blue-500">
                                <CardContent className="p-4 flex items-center gap-4 relative">
                                    <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                                        <AvatarImage src={user.avatar} className="object-cover" />
                                        <AvatarFallback>{user.name.substring(0,2)}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 overflow-hidden">
                                        <h4 className="font-bold truncate text-base">{user.name}</h4>
                                        <div className="flex gap-2 mb-1">
                                            {getRoleBadge(user.role)}
                                            {user.role === 'seller' && (
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-100">
                                                    {user.work_hours} HS
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                    </div>
                                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-blue-50 text-blue-500" onClick={() => openEditModal(user)}>
                                            <Pencil className="h-4 w-4"/>
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-red-400" onClick={() => handleDeleteUser(user.id)}>
                                            <Trash2 className="h-4 w-4"/>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                {/* 2. CRM & ESTADOS */}
                <TabsContent value="crm" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500"/> Motivos de Pérdida</CardTitle>
                                <CardDescription>Opciones disponibles al descartar un lead.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex gap-2">
                                    <Input placeholder="Nuevo motivo..." value={newReason} onChange={(e) => setNewReason(e.target.value)} />
                                    <Button onClick={addLossReason}><Plus className="h-4 w-4"/></Button>
                                </div>
                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {lossReasons.map((reason) => (
                                        <div key={reason.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border group hover:bg-slate-100">
                                            <span className="text-sm font-medium">{reason.reason}</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600" onClick={() => deleteLossReason(reason.id)}>
                                                <Trash2 className="h-3 w-3"/>
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 3. COMISIONES (RESTAURADO) */}
                <TabsContent value="commissions" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-t-4 border-t-blue-500">
                            <CardHeader><CardTitle className="flex gap-2 text-blue-700"><Clock className="h-5 w-5"/> Jornada 5 Hs</CardTitle><CardDescription>Escala variable por ventas.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                                    <span className="font-bold text-sm">Ventas Absorbibles</span>
                                    <div className="flex items-center gap-1">
                                        <Input value={absorb5} onChange={e => setAbsorb5(e.target.value)} className="w-16 text-center font-bold bg-white" />
                                        <span className="text-xs">vtas</span>
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-slate-400 font-bold">Escala de Premios</Label>
                                    {ranges5hs.map((range) => (
                                        <div key={range.id} className="flex gap-2 items-center group">
                                            <Input value={range.min} onChange={(e)=>updateRange(ranges5hs, setRanges5hs, range.id, 'min', e.target.value)} className="w-14 text-center h-8" placeholder="Min" />
                                            <span className="text-xs text-slate-400">a</span>
                                            <Input value={range.max === 999 ? '+' : range.max} onChange={(e)=>updateRange(ranges5hs, setRanges5hs, range.id, 'max', e.target.value)} className="w-14 text-center h-8" placeholder="Max" />
                                            <span className="text-xs text-slate-400">vtas =</span>
                                            <Input value={range.percent} onChange={(e)=>updateRange(ranges5hs, setRanges5hs, range.id, 'percent', e.target.value)} className="w-14 text-center h-8 font-bold text-green-600 bg-green-50" />
                                            <span className="text-xs font-bold text-green-600">%</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeRange(ranges5hs, setRanges5hs, range.id)}><Trash2 className="h-3 w-3 text-red-400"/></Button>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => addRange(ranges5hs, setRanges5hs)} className="w-full text-blue-500 hover:text-blue-700 hover:bg-blue-50 mt-2"><Plus className="h-3 w-3 mr-1"/> Agregar Tramo</Button>
                                </div>
                            </CardContent>
                        </Card>
                        
                        <Card className="border-t-4 border-t-purple-500">
                            <CardHeader><CardTitle className="flex gap-2 text-purple-700"><Clock className="h-5 w-5"/> Jornada 8 Hs</CardTitle><CardDescription>Escala variable por ventas.</CardDescription></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-purple-50 p-3 rounded-lg">
                                    <span className="font-bold text-sm">Ventas Absorbibles</span>
                                    <div className="flex items-center gap-1">
                                        <Input value={absorb8} onChange={e => setAbsorb8(e.target.value)} className="w-16 text-center font-bold bg-white" />
                                        <span className="text-xs">vtas</span>
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase text-slate-400 font-bold">Escala de Premios</Label>
                                    {ranges8hs.map((range) => (
                                        <div key={range.id} className="flex gap-2 items-center group">
                                            <Input value={range.min} onChange={(e)=>updateRange(ranges8hs, setRanges8hs, range.id, 'min', e.target.value)} className="w-14 text-center h-8" placeholder="Min" />
                                            <span className="text-xs text-slate-400">a</span>
                                            <Input value={range.max === 999 ? '+' : range.max} onChange={(e)=>updateRange(ranges8hs, setRanges8hs, range.id, 'max', e.target.value)} className="w-14 text-center h-8" placeholder="Max" />
                                            <span className="text-xs text-slate-400">vtas =</span>
                                            <Input value={range.percent} onChange={(e)=>updateRange(ranges8hs, setRanges8hs, range.id, 'percent', e.target.value)} className="w-14 text-center h-8 font-bold text-green-600 bg-green-50" />
                                            <span className="text-xs font-bold text-green-600">%</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => removeRange(ranges8hs, setRanges8hs, range.id)}><Trash2 className="h-3 w-3 text-red-400"/></Button>
                                        </div>
                                    ))}
                                    <Button size="sm" variant="ghost" onClick={() => addRange(ranges8hs, setRanges8hs)} className="w-full text-purple-500 hover:text-purple-700 hover:bg-purple-50 mt-2"><Plus className="h-3 w-3 mr-1"/> Agregar Tramo</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-slate-600"/> Acceso</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5"><Label className="font-bold">Bloquear Acceso fuera de Horario</Label></div>
                                <Switch />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <div className="flex justify-end pt-4">
                <Button onClick={saveGeneralConfig} className="bg-slate-900 text-white px-8 h-12 text-lg shadow-xl hover:bg-slate-800 gap-2">
                    <Save className="h-5 w-5"/> Guardar Configuración
                </Button>
            </div>

            {/* MODAL CREAR/EDITAR USUARIO */}
            <Dialog open={isUserModalOpen} onOpenChange={setIsUserModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingUserId ? "Editar Perfil" : "Crear Usuario"}</DialogTitle>
                        <DialogDescription>Configuración de acceso y rol.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex flex-col items-center gap-3">
                            <Avatar className="h-24 w-24 border-4 border-slate-100 shadow-md">
                                <AvatarImage src={formData.avatar} className="object-cover" />
                                <AvatarFallback>IMG</AvatarFallback>
                            </Avatar>
                            <div className="flex gap-2">
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload}/>
                                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="text-xs h-8 gap-2"><Upload className="h-3 w-3"/> Subir Foto</Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Nombre Completo</Label>
                            <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label>Rol</Label>
                                <Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="seller">Vendedor</SelectItem>
                                        <SelectItem value="admin">Supervisión</SelectItem>
                                        <SelectItem value="ops">Administración</SelectItem>
                                        <SelectItem value="admin_god">Admin GOD</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            {formData.role === 'seller' && (
                                <div className="grid gap-2">
                                    <Label>Jornada</Label>
                                    <Select value={formData.work_hours} onValueChange={(v) => setFormData({...formData, work_hours: v})}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="5">5 Horas</SelectItem>
                                            <SelectItem value="8">8 Horas</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <div className="grid gap-2">
                            <Label>Email (Acceso)</Label>
                            <Input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="nombre@gml.com" />
                        </div>
                        
                        <div className="grid gap-2">
                            <Label className="flex justify-between">
                                {editingUserId ? "Nueva Contraseña" : "Contraseña"}
                                {editingUserId && <span className="text-xs text-slate-400 font-normal">(Dejar vacío para no cambiar)</span>}
                            </Label>
                            <div className="relative">
                                <Input 
                                    type={showPassword ? "text" : "password"} 
                                    value={formData.password} 
                                    onChange={(e) => setFormData({...formData, password: e.target.value})} 
                                    placeholder={editingUserId ? "●●●●●●" : "Crear clave..."}
                                />
                                <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-400" onClick={() => setShowPassword(!showPassword)}>
                                    {showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}
                                </Button>
                            </div>
                            {editingUserId && <p className="text-[10px] text-red-400">* No se puede ver la contraseña anterior por seguridad.</p>}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveUser} disabled={loading} className="w-full">
                            {loading ? "Guardando..." : "Guardar Usuario"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}