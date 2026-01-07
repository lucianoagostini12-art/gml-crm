"use client"

import { useState, useRef, useEffect } from "react"
import { createClient } from "@/lib/supabase"
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
import { Sliders, Plus, Trash2, Clock, UserPlus, Upload, Pencil, XCircle, Save, Eye, EyeOff, ShieldAlert, Crown, Briefcase, Headset, Globe, Snowflake, Flame, MessageCircle, RefreshCw, PenLine } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"

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

    // Estados de Comisiones
    const [ranges5hs, setRanges5hs] = useState<any[]>([])
    const [ranges8hs, setRanges8hs] = useState<any[]>([])
    const [absorb5, setAbsorb5] = useState("8")
    const [absorb8, setAbsorb8] = useState("12")

    // Estado Configuración Cementerio
    const [freezeConfig, setFreezeConfig] = useState({
        fantasmas: 30, precio: 60, interes: 45, quemados: 45, basural: 365
    })

    // Estado Plantillas WhatsApp
    const [wppTemplates, setWppTemplates] = useState<any[]>([])

    // Formulario Usuario
    const [formData, setFormData] = useState({
        name: "", email: "", password: "", role: "seller", work_hours: "5", avatar: ""
    })
    
    // Estado para guardar el archivo físico antes de subirlo
    const [avatarFile, setAvatarFile] = useState<File | null>(null)
    
    const fileInputRef = useRef<HTMLInputElement>(null)

    // --- CARGA INICIAL ---
    useEffect(() => {
        fetchUsers()
        fetchLossReasons()
        fetchConfigs()
        fetchWppTemplates()
    }, [])

    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (data) {
            setUsers(data.map(u => ({
                id: u.id,
                name: u.full_name || "Sin Nombre",
                email: u.email, 
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

    const fetchWppTemplates = async () => {
        const { data } = await supabase.from('whatsapp_templates').select('*').order('created_at', { ascending: true })
        if (data) setWppTemplates(data)
    }

    const fetchConfigs = async () => {
        const { data } = await supabase.from('system_config').select('*')
        if (data) {
            const r5 = data.find(c => c.key === 'ranges_5hs')?.value
            const r8 = data.find(c => c.key === 'ranges_8hs')?.value
            const a5 = data.find(c => c.key === 'absorb_5hs')?.value
            const a8 = data.find(c => c.key === 'absorb_8hs')?.value
            const gz = data.find(c => c.key === 'graveyard_config')?.value

            if (r5) setRanges5hs(r5); else setRanges5hs([{ id: 1, min: 0, max: 999, percent: 0 }])
            if (r8) setRanges8hs(r8); else setRanges8hs([{ id: 1, min: 0, max: 999, percent: 0 }])
            if (a5) setAbsorb5(a5)
            if (a8) setAbsorb8(a8)
            if (gz) setFreezeConfig(gz)
        }
    }

    // --- GUARDAR CONFIGURACIÓN GENERAL ---
    const saveGeneralConfig = async () => {
        setLoading(true)
        const updates = [
            { key: 'ranges_5hs', value: ranges5hs },
            { key: 'ranges_8hs', value: ranges8hs },
            { key: 'absorb_5hs', value: absorb5 },
            { key: 'absorb_8hs', value: absorb8 },
            { key: 'graveyard_config', value: freezeConfig }
        ]
        const { error: errConfig } = await supabase.from('system_config').upsert(updates)
        const { error: errWpp } = await supabase.from('whatsapp_templates').upsert(wppTemplates)

        setLoading(false)
        if (errConfig || errWpp) {
            alert("❌ Error al guardar: " + (errConfig?.message || errWpp?.message))
        } else {
            alert("✅ Configuración guardada correctamente.")
            fetchWppTemplates() 
        }
    }

    // --- GESTIÓN DE TRAMOS ---
    const updateRange = (list: any[], setList: any, id: number, field: string, value: string) => {
        const val = field === 'max' && value === '+' ? 999 : parseInt(value) || 0
        const newList = list.map(item => item.id === id ? { ...item, [field]: val } : item)
        setList(newList)
    }
    const addRange = (list: any[], setList: any) => {
        const newId = list.length > 0 ? Math.max(...list.map(i => i.id)) + 1 : 1
        setList([...list, { id: newId, min: 0, max: 999, percent: 0 }])
    }
    const removeRange = (list: any[], setList: any, id: number) => {
        setList(list.filter(i => i.id !== id))
    }

    // --- GESTIÓN USUARIOS ---
    const openCreateModal = () => {
        setEditingUserId(null)
        setAvatarFile(null)
        setFormData({ name: "", email: "", password: "", role: "seller", work_hours: "5", avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` })
        setIsUserModalOpen(true)
    }

    const openEditModal = (user: any) => {
        setEditingUserId(user.id)
        setAvatarFile(null)
        setFormData({ 
            name: user.name, 
            email: user.email, 
            password: "", 
            role: user.role, 
            work_hours: user.work_hours?.toString() || "5",
            avatar: user.avatar 
        })
        setIsUserModalOpen(true)
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            setAvatarFile(file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, avatar: reader.result as string }))
            }
            reader.readAsDataURL(file)
        }
    }

    const uploadAvatar = async (userId: string, file: File) => {
        const fileExt = file.name.split('.').pop()
        const fileName = `${userId}-${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, { upsert: true })

        if (uploadError) {
            console.error('Error uploading avatar:', uploadError)
            return null
        }

        const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)
        return data.publicUrl
    }

    const handleSaveUser = async () => {
        if (!formData.name || !formData.email) return alert("Nombre y Email obligatorios.")
        setLoading(true)

        try {
            let targetUserId = editingUserId
            
            // 1. Si es NUEVO usuario: Usamos la API del servidor (Backend)
            if (!targetUserId) {
                if (!formData.password) {
                    setLoading(false)
                    return alert("Contraseña obligatoria para nuevos usuarios.")
                }

                // LLAMADA A LA API QUE CREAMOS (Backend)
                // Esto garantiza compatibilidad 100% con Supabase Auth
                const response = await fetch('/api/admin/create-user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: formData.email,
                        password: formData.password,
                        full_name: formData.name,
                        role: formData.role,
                        work_hours: parseInt(formData.work_hours)
                    })
                })

                if (!response.ok) {
                    const errorData = await response.json()
                    throw new Error(errorData.error || "Error al crear usuario en servidor")
                }

                const data = await response.json()
                targetUserId = data.id // Obtenemos el ID del usuario creado
                
                alert("Usuario creado exitosamente. ✅")

            } else {
                // 2. Si es EDICIÓN: Usamos Supabase client directo (como antes)
                const { error } = await supabase.from('profiles').update({
                    full_name: formData.name,
                    role: formData.role,
                    work_hours: parseInt(formData.work_hours),
                }).eq('id', targetUserId)

                if (error) throw error
                if (formData.password) alert("Nota: Para cambiar la contraseña, usá el panel de Supabase Auth.")
                else alert("Usuario actualizado.")
            }

            // 3. GESTIÓN DE FOTO (Igual para ambos casos)
            if (targetUserId && avatarFile) {
                const publicAvatarUrl = await uploadAvatar(targetUserId, avatarFile)
                if (publicAvatarUrl) {
                    await supabase.from('profiles')
                        .update({ avatar_url: publicAvatarUrl })
                        .eq('id', targetUserId)
                }
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
        
        // Intentamos borrar primero storage y perfiles por si acaso
        // pero principalmente borramos de auth.users si es posible desde el cliente
        // OJO: Client-side deletion de auth.users no suele estar permitido. 
        // Si falla, idealmente usaríamos también una API Route para borrar.
        // Por ahora mantenemos la lógica visual, pero ten en cuenta esto.
        
        // Opción: llamar a otra API route de borrado, pero probemos si tu RLS permite
        // borrar perfiles y si tienes el trigger "on delete cascade".
        
        const { error } = await supabase.from('profiles').delete().eq('id', id)
        
        if (error) {
             alert("No se pudo borrar el perfil. Contacta a soporte.")
        } else {
             // Si borramos el perfil y hay ON DELETE CASCADE, el usuario auth debería morir?
             // No, es al revés. Si muere Auth muere Perfil.
             // Para borrar el Auth User desde el cliente necesitas permisos especiales o usar la API.
             alert("Se borró el perfil visual. Para borrar el acceso definitivo, usa el panel de Supabase o crea una API de borrado.")
             setUsers(users.filter(u => u.id !== id))
        }
    }

    // ... (El resto de funciones auxiliares como addLossReason, templates, etc. se mantienen igual)
    const addLossReason = async () => {
        if (!newReason.trim()) return
        const { error } = await supabase.from('loss_reasons').insert({ reason: newReason })
        if (!error) { setNewReason(""); fetchLossReasons() }
    }
    const deleteLossReason = async (id: number) => {
        if (!confirm("¿Borrar?")) return
        await supabase.from('loss_reasons').delete().eq('id', id)
        fetchLossReasons()
    }
    const updateTemplate = (id: string, field: 'label' | 'message', value: string) => {
        setWppTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    }
    const addTemplate = () => {
        const newId = `tpl_${Date.now()}`
        setWppTemplates(prev => [...prev, { id: newId, label: "Nueva Plantilla", message: "" }])
    }
    const deleteTemplate = async (id: string) => {
        if(!confirm("¿Borrar?")) return
        setWppTemplates(prev => prev.filter(t => t.id !== id))
        await supabase.from('whatsapp_templates').delete().eq('id', id)
    }
    const getRoleBadge = (role: string) => {
        switch(role) {
            case 'supervisor_god': return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold border-0 shadow-sm gap-1"><Crown size={12}/> Supervisión GOD</Badge>
            case 'admin_god': return <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold border-0 shadow-sm gap-1"><ShieldAlert size={12}/> Admin GOD</Badge>
            case 'admin_common': return <Badge className="bg-pink-500 hover:bg-pink-600 text-white font-medium border-0 gap-1"><Briefcase size={12}/> Administrativa</Badge>
            case 'setter': return <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-medium border-0 gap-1"><Headset size={12}/> Gestora Leads</Badge>
            case 'seller': return <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 font-medium">Vendedora</Badge>
            default: return <Badge variant="secondary">Sin Rol</Badge>
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
                <TabsList className="grid w-full grid-cols-5 h-12 bg-slate-100 dark:bg-slate-900">
                    <TabsTrigger value="users">👥 Usuarios</TabsTrigger>
                    <TabsTrigger value="crm">⚙️ CRM & Estados</TabsTrigger>
                    <TabsTrigger value="whatsapp">💬 WhatsApp</TabsTrigger>
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
                                        <div className="flex gap-2 mb-1 flex-wrap">
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

                {/* Resto de Tabs (CRM, Whatsapp, Comisiones, Sistema) se mantienen igual */}
                <TabsContent value="crm" className="space-y-6 mt-6">
                    {/* ... Contenido CRM igual al anterior ... */}
                    <Card className="border-l-4 border-l-blue-500">
                        <CardHeader><CardTitle className="flex items-center gap-2"><Snowflake className="h-5 w-5 text-blue-500"/> Configuración de Cementerio</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="space-y-1"><Label className="text-xs text-slate-500 font-bold">Fantasmas</Label><Input type="number" value={freezeConfig.fantasmas} onChange={e => setFreezeConfig({...freezeConfig, fantasmas: parseInt(e.target.value)||0})}/></div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500 font-bold">Interés</Label><Input type="number" value={freezeConfig.interes} onChange={e => setFreezeConfig({...freezeConfig, interes: parseInt(e.target.value)||0})}/></div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500 font-bold">Precio</Label><Input type="number" value={freezeConfig.precio} onChange={e => setFreezeConfig({...freezeConfig, precio: parseInt(e.target.value)||0})}/></div>
                                <div className="space-y-1"><Label className="text-xs text-red-500 font-bold">Quemados</Label><Input type="number" className="border-red-200 bg-red-50" value={freezeConfig.quemados} onChange={e => setFreezeConfig({...freezeConfig, quemados: parseInt(e.target.value)||0})}/></div>
                                <div className="space-y-1"><Label className="text-xs text-slate-500 font-bold">Basural</Label><Input type="number" value={freezeConfig.basural} onChange={e => setFreezeConfig({...freezeConfig, basural: parseInt(e.target.value)||0})}/></div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="mt-4">
                        <CardHeader><CardTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-500"/> Motivos de Pérdida</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex gap-2"><Input placeholder="Nuevo motivo..." value={newReason} onChange={(e) => setNewReason(e.target.value)} /><Button onClick={addLossReason}><Plus className="h-4 w-4"/></Button></div>
                            <div className="space-y-2 max-h-[200px] overflow-y-auto">{lossReasons.map((r) => <div key={r.id} className="flex justify-between items-center p-2 bg-slate-50 rounded border"><span className="text-sm">{r.reason}</span><Button variant="ghost" size="sm" onClick={() => deleteLossReason(r.id)}><Trash2 className="h-3 w-3 text-red-400"/></Button></div>)}</div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="whatsapp" className="space-y-6 mt-6">
                    {/* ... Contenido Whatsapp igual al anterior ... */}
                    <Card className="border-t-4 border-t-green-500">
                        <CardHeader className="flex flex-row justify-between">
                            <div><CardTitle className="flex gap-2 text-green-700"><MessageCircle className="h-5 w-5"/> Plantillas</CardTitle><CardDescription>Mensajes y botones.</CardDescription></div>
                            <Button size="sm" variant="outline" onClick={addTemplate} className="text-green-700 border-green-200"><Plus size={14}/> Nueva</Button>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {wppTemplates.map((tpl) => (
                                <div key={tpl.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 relative group">
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100"><Button variant="ghost" size="icon" className="h-6 w-6 text-red-400" onClick={() => deleteTemplate(tpl.id)}><Trash2 size={12}/></Button></div>
                                    <div className="flex items-center gap-2 mb-2 border-b pb-2"><PenLine className="h-4 w-4 text-slate-400"/><Input value={tpl.label} onChange={(e) => updateTemplate(tpl.id, 'label', e.target.value)} className="border-none h-auto p-0 font-bold bg-transparent"/></div>
                                    <Textarea value={tpl.message} onChange={(e) => updateTemplate(tpl.id, 'message', e.target.value)} className="bg-white text-sm min-h-[80px]" placeholder="Mensaje..."/>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="commissions" className="space-y-4">
                    {/* ... Contenido Comisiones igual al anterior ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="border-t-4 border-t-blue-500">
                            <CardHeader><CardTitle className="text-blue-700">Jornada 5 Hs</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-blue-50 p-2 rounded"><span className="text-sm font-bold">Absorbibles</span><div className="flex items-center gap-1"><Input value={absorb5} onChange={e=>setAbsorb5(e.target.value)} className="w-14 text-center h-8 bg-white"/><span className="text-xs">vtas</span></div></div>
                                <div className="space-y-2">{ranges5hs.map(r => (<div key={r.id} className="flex gap-2 items-center"><Input value={r.min} onChange={e=>updateRange(ranges5hs,setRanges5hs,r.id,'min',e.target.value)} className="w-12 h-8 text-center"/><span className="text-xs">a</span><Input value={r.max} onChange={e=>updateRange(ranges5hs,setRanges5hs,r.id,'max',e.target.value)} className="w-12 h-8 text-center"/><span className="text-xs">=</span><Input value={r.percent} onChange={e=>updateRange(ranges5hs,setRanges5hs,r.id,'percent',e.target.value)} className="w-12 h-8 text-center font-bold text-green-600"/><span className="text-xs">%</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>removeRange(ranges5hs,setRanges5hs,r.id)}><Trash2 size={12}/></Button></div>))}<Button size="sm" variant="ghost" onClick={()=>addRange(ranges5hs,setRanges5hs)} className="w-full text-blue-500"><Plus size={12}/> Tramo</Button></div>
                            </CardContent>
                        </Card>
                        <Card className="border-t-4 border-t-purple-500">
                            <CardHeader><CardTitle className="text-purple-700">Jornada 8 Hs</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center bg-purple-50 p-2 rounded"><span className="text-sm font-bold">Absorbibles</span><div className="flex items-center gap-1"><Input value={absorb8} onChange={e=>setAbsorb8(e.target.value)} className="w-14 text-center h-8 bg-white"/><span className="text-xs">vtas</span></div></div>
                                <div className="space-y-2">{ranges8hs.map(r => (<div key={r.id} className="flex gap-2 items-center"><Input value={r.min} onChange={e=>updateRange(ranges8hs,setRanges8hs,r.id,'min',e.target.value)} className="w-12 h-8 text-center"/><span className="text-xs">a</span><Input value={r.max} onChange={e=>updateRange(ranges8hs,setRanges8hs,r.id,'max',e.target.value)} className="w-12 h-8 text-center"/><span className="text-xs">=</span><Input value={r.percent} onChange={e=>updateRange(ranges8hs,setRanges8hs,r.id,'percent',e.target.value)} className="w-12 h-8 text-center font-bold text-green-600"/><span className="text-xs">%</span><Button variant="ghost" size="icon" className="h-6 w-6" onClick={()=>removeRange(ranges8hs,setRanges8hs,r.id)}><Trash2 size={12}/></Button></div>))}<Button size="sm" variant="ghost" onClick={()=>addRange(ranges8hs,setRanges8hs)} className="w-full text-purple-500"><Plus size={12}/> Tramo</Button></div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                    <Card>
                        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-slate-600"/> Acceso</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between"><div className="space-y-0.5"><Label className="font-bold">Bloquear Acceso fuera de Horario</Label></div><Switch /></div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
            <div className="flex justify-end pt-4">
                <Button onClick={saveGeneralConfig} disabled={loading} className="bg-slate-900 text-white px-8 h-12 text-lg shadow-xl hover:bg-slate-800 gap-2">
                    <Save className="h-5 w-5"/> {loading ? "Guardando..." : "Guardar Configuración"}
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

                        <div className="grid gap-2"><Label>Nombre Completo</Label><Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2"><Label>Rol</Label><Select value={formData.role} onValueChange={(v) => setFormData({...formData, role: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="supervisor_god">Supervisión GOD</SelectItem><SelectItem value="admin_god">Administración GOD</SelectItem><SelectItem value="admin_common">Administración Común</SelectItem><SelectItem value="seller">Vendedora</SelectItem><SelectItem value="setter">Gestora de Leads</SelectItem></SelectContent></Select></div>
                            {formData.role === 'seller' && (<div className="grid gap-2"><Label>Jornada</Label><Select value={formData.work_hours} onValueChange={(v) => setFormData({...formData, work_hours: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">5 Horas</SelectItem><SelectItem value="8">8 Horas</SelectItem></SelectContent></Select></div>)}
                        </div>
                        <div className="grid gap-2"><Label>Email (Acceso)</Label><Input value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="nombre@gml.com" /></div>
                        <div className="grid gap-2">
                            <Label className="flex justify-between">{editingUserId ? "Nueva Contraseña" : "Contraseña"}{editingUserId && <span className="text-xs text-slate-400 font-normal">(Dejar vacío para no cambiar)</span>}</Label>
                            <div className="relative"><Input type={showPassword ? "text" : "password"} value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} placeholder={editingUserId ? "●●●●●●" : "Crear clave..."} /><Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full text-slate-400" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</Button></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveUser} disabled={loading} className="w-full">{loading ? "Guardando..." : "Guardar Usuario"}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}