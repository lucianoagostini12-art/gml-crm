"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase" // Conexión Real
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Megaphone, Pin, AlertOctagon, Info, CheckCircle2, UserCircle, Trash2, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function OpsAnnouncements() {
    const supabase = createClient()
    
    // --- ESTADO ---
    const [title, setTitle] = useState("")
    const [message, setMessage] = useState("")
    const [priority, setPriority] = useState("normal")
    const [isBlocking, setIsBlocking] = useState(false)
    
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // --- 1. CARGA DE DATOS REALES (Misma tabla que Admin) ---
    const fetchData = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false })

        if (data) {
            setAnnouncements(data)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        
        // Suscripción Realtime (Si el Admin crea uno, Ops lo ve al toque)
        const channel = supabase.channel('ops_announcements_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    // --- 2. FUNCION DE ENVIO REAL ---
    const handleSend = async () => {
        if (!title || !message) return

        const { error } = await supabase.from('announcements').insert({
            title,
            message,
            priority,
            is_blocking: isBlocking,
            // author_id se maneja solo si querés, o podés agregar un campo 'author_role' en la tabla
        })

        if (!error) {
            setTitle(""); setMessage(""); setPriority("normal"); setIsBlocking(false)
            alert("Comunicado publicado exitosamente 📢")
            fetchData() // Recargar para verlo ya
        } else {
            alert("Error al publicar")
        }
    }

    // --- 3. FUNCION BORRAR REAL ---
    const handleDelete = async (id: number) => {
        if(!confirm("¿Borrar este comunicado para todos?")) return
        
        const { error } = await supabase.from('announcements').delete().eq('id', id)
        if (!error) {
            fetchData()
        }
    }

    // --- HELPER PARA BADGES ---
    const getBadge = (type: string) => {
        switch(type) {
            case 'critical': return <Badge variant="destructive" className="gap-1"><AlertOctagon size={12}/> URGENTE</Badge>
            case 'high': return <Badge className="bg-orange-500 hover:bg-orange-600 gap-1"><Info size={12}/> Importante</Badge>
            default: return <Badge variant="secondary" className="gap-1"><CheckCircle2 size={12}/> Normal</Badge>
        }
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-8">
            
            {/* HEADER */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                        <Megaphone className="h-8 w-8 text-blue-600" /> Comunicados
                    </h2>
                    <p className="text-slate-500">Gestión compartida de novedades (Admin/Ops).</p>
                </div>
                {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. MOTOR DE CREACIÓN */}
                <Card className="lg:col-span-1 border-t-4 border-t-blue-600 shadow-lg h-fit bg-white">
                    <CardHeader className="bg-slate-50/50 pb-4 border-b">
                        <CardTitle className="text-lg font-bold text-slate-800">Redactar Mensaje</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        <div className="space-y-1.5">
                            <Label className="font-bold text-slate-600">Título</Label>
                            <Input placeholder="Ej: Cambio de Precios..." value={title} onChange={e => setTitle(e.target.value)} className="font-semibold"/>
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label className="font-bold text-slate-600">Nivel de Importancia</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">🔵 Normal (Informativo)</SelectItem>
                                    <SelectItem value="high">🟠 Importante (Atención)</SelectItem>
                                    <SelectItem value="critical">🔴 Urgente (Crítico)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="font-bold text-slate-600">Mensaje</Label>
                            <Textarea placeholder="Escribí el contenido..." className="min-h-[120px] resize-none" value={message} onChange={e => setMessage(e.target.value)} />
                        </div>
                        
                        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                            <div className="flex flex-col">
                                <Label className="text-slate-700 font-bold text-xs">Pop-up Bloqueante</Label>
                                <span className="text-[10px] text-slate-500">¿Interrumpe la pantalla del vendedor?</span>
                            </div>
                            <Switch checked={isBlocking} onCheckedChange={setIsBlocking} />
                        </div>

                        <Button className="w-full bg-blue-600 hover:bg-blue-700 font-bold shadow-md h-10" onClick={handleSend} disabled={!title || !message || loading}>
                            {loading ? "Enviando..." : "Publicar Anuncio"}
                        </Button>
                    </CardContent>
                </Card>

                {/* 2. VISTA DE CARTELERA REAL */}
                <Card className="lg:col-span-2 shadow-md border-slate-200 bg-slate-50/30">
                    <CardHeader className="bg-white border-b border-slate-100">
                        <CardTitle className="text-lg font-bold flex justify-between items-center">
                            <span>Cartelera Activa</span>
                            <Badge variant="outline" className="font-mono">{announcements.length} Publicados</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5 overflow-y-auto max-h-[600px]">
                        {announcements.length === 0 && !loading ? (
                            <div className="text-center py-10 text-slate-400">No hay comunicados activos.</div>
                        ) : (
                            announcements.map((ann) => (
                                <Card key={ann.id} className={`border-l-4 shadow-sm bg-white group hover:shadow-md transition-all ${ann.priority === 'critical' ? 'border-l-red-500' : ann.priority === 'high' ? 'border-l-orange-500' : 'border-l-blue-500'}`}>
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex items-center gap-2">
                                                <Pin className={`h-4 w-4 transform rotate-45 ${ann.priority === 'critical' ? 'text-red-500' : 'text-blue-500'}`} />
                                                <h3 className="font-bold text-lg text-slate-800">{ann.title}</h3>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {getBadge(ann.priority)}
                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDelete(ann.id)}>
                                                    <Trash2 size={14}/>
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap mb-4 pl-6 border-l-2 border-slate-100 ml-1">
                                            {ann.message}
                                        </p>

                                        <div className="flex justify-between items-center text-[10px] text-slate-400 border-t pt-3 mt-2">
                                            <div className="flex items-center gap-1.5">
                                                <UserCircle size={12}/>
                                                {/* Podés mostrar el autor si lo guardaste, o un genérico */}
                                                <span>Por: <strong className="text-slate-600">Gerencia</strong></span>
                                            </div>
                                            <span className="font-mono bg-slate-100 px-2 py-0.5 rounded">
                                                {format(new Date(ann.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                            </span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}