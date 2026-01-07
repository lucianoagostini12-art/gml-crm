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

    // Estados de Comisiones (Se guardan en DB)
    const [ranges5hs, setRanges5hs] = useState<any[]>([])
    const [ranges8hs, setRanges8hs] = useState<any[]>([])
    const [absorb5, setAbsorb5] = useState("8")
    const [absorb8, setAbsorb8] = useState("12")

    // Estado Configuración Cementerio (Freeze Times)
    const [freezeConfig, setFreezeConfig] = useState({
        fantasmas: 30, precio: 60, interes: 45, quemados: 45, basural: 365
    })

    // Estado Plantillas WhatsApp
    const [wppTemplates, setWppTemplates] = useState<any[]>([])

    // Formulario Usuario
    const [formData, setFormData] = useState({
        name: "", email: "", password: "", role: "seller", work_hours: "5", avatar: ""
    })
    
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
        
        // 1. Guardar Configs Generales
        const updates = [
            { key: 'ranges_5hs', value: ranges5hs },
            { key: 'ranges_8hs', value: ranges8hs },
            { key: 'absorb_5hs', value: absorb5 },
            { key: 'absorb_8hs', value: absorb8 },
            { key: 'graveyard_config', value: freezeConfig }
        ]
        const { error: errConfig } = await supabase.from('system_config').upsert(updates)

        // 2. Guardar Plantillas WhatsApp (Upsert masivo)
        const { error: errWpp } = await supabase.from('whatsapp_templates').upsert(wppTemplates)

        setLoading(false)
        if (errConfig || errWpp) {
            alert("❌ Error al guardar: " + (errConfig?.message || errWpp?.message))
        } else {
            alert("✅ Configuración guardada correctamente.")
            fetchWppTemplates() // Refrescar para tener los IDs limpios si hubo nuevos
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
        setFormData({ name: "", email: "", password: "", role: "seller", work_hours: "5", avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}` })
        setIsUserModalOpen(true)
    }

    const openEditModal = (user: any) => {
        setEditingUserId(user.id)
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
            if (editingUserId) {
                const { error } = await supabase.from('profiles').update({
                    full_name: formData.name,
                    role: formData.role,
                    work_hours: parseInt(formData.work_hours),
                    avatar_url: formData.avatar
                }).eq('id', editingUserId)

                if (error) throw error
                if (formData.password) alert("Nota: Para cambiar la contraseña, usá el panel de Supabase Auth.")
                else alert("Usuario actualizado.")

            } else {
                if (!formData.password) {
                    setLoading(false)
                    return alert("Contraseña obligatoria para nuevos usuarios.")
                }
                const { error } = await supabase.rpc('create_new_user', {
                    email: formData.email,
                    password: formData.password,
                    full_name: formData.name,
                    role: formData.role,
                    work_hours: parseInt(formData.work_hours)
                })
                if (error) throw error
                else alert("Usuario creado exitosamente. ✅")
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

    // --- GESTIÓN WPP TEMPLATES (DINÁMICO) ---
    const updateTemplate = (id: string, field: 'label' | 'message', value: string) => {
        setWppTemplates(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t))
    }

    const addTemplate = () => {
        const newId = `tpl_${Date.now()}`
        // Crea una plantilla vacía localmente
        setWppTemplates(prev => [...prev, { id: newId, label: "Nueva Plantilla", message: "" }])
    }

    const deleteTemplate = async (id: string) => {
        if(!confirm("¿Borrar plantilla?")) return
        setWppTemplates(prev => prev.filter(t => t.id !== id))
        // Borrar de DB si ya existía
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

                {/* 2. CRM & ESTADOS */}
                <TabsContent value="crm" className="space-y-6 mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        <Card className="md:col-span-2 border-l-4 border-l-blue-500">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2"><Snowflake className="h-5 w-5 text-blue-500"/> Configuración de Cementerio</CardTitle>
                                <CardDescription>Días de congelamiento antes de que un lead pueda ser reciclado.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500 font-bold">Fantasmas (No contesta)</Label>
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
                                            {/* --- AQUÍ ESTABA EL ERROR CORREGIDO --- */}
                                            <Input type="number" className="pl-2 pr-8 border-red-200 bg-red-50" value={freezeConfig.quemados} onChange={e => setFreezeConfig({...freezeConfig, quemados: parseInt(e.target.value) || 0})}/>
                                            <span className="absolute right-3 top-2.5 text-xs text-red-400 font-bold">días</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs text-slate-500 font-bold">Basural (Inválidos)</Label>
                                        <div className="relative">
                                            <Input type="number" className="pl-2 pr-8" value={freezeConfig.basural} onChange={e => setFreezeConfig({...freezeConfig, basural: parseInt(e.target.value) || 0})}/>
                                            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-bold">días</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

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

                {/* 3. WHATSAPP TEMPLATES (CON BOTÓN DE CREAR NUEVO) */}
                <TabsContent value="whatsapp" className="space-y-6 mt-6">
                    <Card className="border-t-4 border-t-green-500">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="flex items-center gap-2 text-green-700">
                                    <MessageCircle className="h-5 w-5" /> Plantillas de Mensajes
                                </CardTitle>
                                <CardDescription>Personaliza los mensajes y los nombres de los botones para las vendedoras.</CardDescription>
                            </div>
                            <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50 gap-2" onClick={addTemplate}>
                                <Plus size={14}/> Nueva Plantilla
                            </Button>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {wppTemplates.length === 0 && (
                                <div className="col-span-2 text-center py-8 text-slate-400 flex flex-col items-center">
                                    <RefreshCw className="h-8 w-8 mb-2 animate-spin opacity-50"/>
                                    <p>Cargando plantillas...</p>
                                </div>
                            )}
                            {wppTemplates.map((tpl) => (
                                <div key={tpl.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 group hover:border-green-300 transition-colors relative">
                                    
                                    {/* Botón Borrar */}
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500" onClick={() => deleteTemplate(tpl.id)}>
                                            <Trash2 size={12}/>
                                        </Button>
                                    </div>

                                    <div className="flex justify-between items-center border-b pb-2 border-slate-200 pr-8">
                                        <div className="flex items-center gap-2 w-full">
                                            <PenLine className="h-4 w-4 text-slate-400 shrink-0" />
                                            {/* INPUT PARA EDITAR EL NOMBRE DEL BOTÓN */}
                                            <Input 
                                                value={tpl.label} 
                                                onChange={(e) => updateTemplate(tpl.id, 'label', e.target.value)} 
                                                className="font-bold text-slate-700 border-none shadow-none focus-visible:ring-0 p-0 h-auto bg-transparent hover:underline decoration-dashed decoration-slate-300 underline-offset-4 w-full"
                                                title="Click para editar nombre del botón"
                                                placeholder="Nombre del Botón"
                                            />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <Textarea 
                                            className="bg-white min-h-[100px] text-sm resize-none focus-visible:ring-green-500 border-slate-200"
                                            value={tpl.message}
                                            onChange={(e) => updateTemplate(tpl.id, 'message', e.target.value)}
                                            placeholder="Dejar vacío para abrir chat sin texto..."
                                        />
                                        {!tpl.message && (
                                            <span className="absolute top-3 left-3 text-xs text-slate-400 pointer-events-none italic">
                                                (Mensaje vacío: solo abre el chat)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 4. COMISIONES */}
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

                {/* 5. SISTEMA */}
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
                                        <SelectItem value="supervisor_god">Supervisión GOD</SelectItem>
                                        <SelectItem value="admin_god">Administración GOD</SelectItem>
                                        <SelectItem value="admin_common">Administración Común</SelectItem>
                                        <SelectItem value="seller">Vendedora</SelectItem>
                                        <SelectItem value="setter">Gestora de Leads</SelectItem>
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