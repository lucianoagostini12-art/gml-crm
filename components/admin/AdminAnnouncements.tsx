"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Megaphone, Trash2, Edit, AlertOctagon, CheckCircle2, Info, RefreshCw } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function AdminAnnouncements() {
    const supabase = createClient()
    
    // Formulario
    const [title, setTitle] = useState("")
    const [message, setMessage] = useState("")
    const [priority, setPriority] = useState("normal")
    const [isBlocking, setIsBlocking] = useState(false)
    
    // Datos
    const [announcements, setAnnouncements] = useState<any[]>([])
    const [totalUsers, setTotalUsers] = useState(0)
    const [loading, setLoading] = useState(true)

    // --- CARGAR DATOS ---
    const fetchData = async () => {
        setLoading(true)
        
        // 1. Obtener total de usuarios activos (para calcular el "6/6")
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
        setTotalUsers(count || 0)

        // 2. Obtener anuncios con conteo de lecturas
        const { data, error } = await supabase
            .from('announcements')
            .select(`
                *,
                read_count:announcement_reads(count)
            `)
            .order('created_at', { ascending: false })

        if (data) {
            // Mapeamos para limpiar la estructura del count
            const formatted = data.map((item: any) => ({
                ...item,
                reads: item.read_count?.[0]?.count || 0
            }))
            setAnnouncements(formatted)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        
        // Suscripción Realtime para ver si alguien lo lee en vivo o si se crea uno nuevo
        const channel = supabase.channel('announcements_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'announcement_reads' }, () => fetchData())
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [])

    // --- CREAR COMUNICADO ---
    const handleSend = async () => {
        if (!title || !message) return

        const { error } = await supabase.from('announcements').insert({
            title,
            message,
            priority,
            is_blocking: isBlocking,
            // author_id: usuario actual (opcional, supabase lo puede manejar con auth.uid())
        })

        if (!error) {
            setTitle(""); setMessage(""); setPriority("normal"); setIsBlocking(false)
            alert("Comunicado publicado con éxito 🚀")
            fetchData()
        } else {
            alert("Error al enviar")
        }
    }

    // --- BORRAR COMUNICADO ---
    const handleDelete = async (id: number) => {
        if (!confirm("¿Borrar este comunicado?")) return
        await supabase.from('announcements').delete().eq('id', id)
        fetchData()
    }

    const getBadge = (type: string) => {
        switch(type) {
            case 'critical': return <Badge variant="destructive" className="flex w-fit gap-1"><AlertOctagon className="h-3 w-3"/> URGENTE</Badge>
            case 'high': return <Badge className="bg-orange-500 hover:bg-orange-600 flex w-fit gap-1"><Info className="h-3 w-3"/> Importante</Badge>
            default: return <Badge variant="secondary" className="flex w-fit gap-1"><CheckCircle2 className="h-3 w-3"/> Normal</Badge>
        }
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Megaphone className="h-8 w-8 text-pink-600" /> Comunicados
                    </h2>
                    <p className="text-slate-500">Cartelera de novedades y avisos.</p>
                </div>
                {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* FORMULARIO DE ENVÍO */}
                <Card className="md:col-span-1 border-t-4 border-t-pink-500 shadow-lg h-fit">
                    <CardHeader><CardTitle className="text-lg">Nuevo Mensaje</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1">
                            <Label>Título</Label>
                            <Input placeholder="Ej: Cambio de Precios" value={title} onChange={e => setTitle(e.target.value)} />
                        </div>
                        
                        <div className="space-y-1">
                            <Label>Nivel de Importancia</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">🔵 Normal (Informativo)</SelectItem>
                                    <SelectItem value="high">🟠 Importante (Atención)</SelectItem>
                                    <SelectItem value="critical">🔴 Urgente (Crítico)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1">
                            <Label>Mensaje</Label>
                            <Textarea placeholder="Escribí acá..." className="min-h-[100px]" value={message} onChange={e => setMessage(e.target.value)} />
                        </div>
                        
                        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                            <div className="flex flex-col">
                                <Label className="text-slate-700 font-bold text-xs">Pop-up Bloqueante</Label>
                                <span className="text-[10px] text-slate-500">¿Interrumpe la pantalla?</span>
                            </div>
                            <Switch checked={isBlocking} onCheckedChange={setIsBlocking} />
                        </div>

                        <Button className="w-full bg-pink-600 hover:bg-pink-700" onClick={handleSend} disabled={!title || !message || loading}>
                            {loading ? "Enviando..." : "Enviar Ahora"}
                        </Button>
                    </CardContent>
                </Card>

                {/* HISTORIAL REAL */}
                <Card className="md:col-span-2 shadow-md">
                    <CardHeader><CardTitle className="text-lg">Historial</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Asunto</TableHead>
                                    <TableHead>Nivel</TableHead>
                                    <TableHead>Leído</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {announcements.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-xs font-mono text-slate-500">
                                            {format(new Date(item.created_at), "dd/MM HH:mm", { locale: es })}
                                        </TableCell>
                                        <TableCell>
                                            <p className="font-bold text-sm">{item.title}</p>
                                            <p className="text-xs text-slate-500 truncate max-w-[200px]">{item.message}</p>
                                        </TableCell>
                                        <TableCell>{getBadge(item.priority)}</TableCell>
                                        <TableCell className="font-mono text-xs font-bold">
                                            {/* Cálculo Real: Lecturas / Total Usuarios */}
                                            {item.reads}/{totalUsers}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 disabled:opacity-50" disabled>
                                                    <Edit className="h-4 w-4 text-slate-400"/>
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500"/>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {announcements.length === 0 && !loading && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-slate-400 py-8">
                                            No hay comunicados activos.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}