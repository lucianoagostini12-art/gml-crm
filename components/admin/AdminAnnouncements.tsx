"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Megaphone, Trash2, Edit, AlertOctagon, CheckCircle2, Info } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export function AdminAnnouncements() {
    const [title, setTitle] = useState("")
    const [message, setMessage] = useState("")
    const [priority, setPriority] = useState("normal") // normal, high, critical
    const [isBlocking, setIsBlocking] = useState(false)

    const [history, setHistory] = useState([
        { id: 1, date: "17/12 09:00", title: "Aumento DoctoRed", message: "Suba del 15%.", type: "critical", isBlocking: true, read: "6/6" },
        { id: 2, date: "15/12 14:00", title: "Premios Diciembre", message: "Objetivos cargados.", type: "normal", isBlocking: false, read: "5/6" },
    ])

    const handleSend = () => {
        if (!title || !message) return
        const newAnn = {
            id: Date.now(),
            date: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([],{hour:'2-digit', minute:'2-digit'}),
            title, message,
            type: priority, isBlocking, // Guardamos la prioridad
            read: "0/6"
        }
        setHistory([newAnn, ...history])
        setTitle(""); setMessage(""); setPriority("normal"); setIsBlocking(false)
        alert("Comunicado enviado! 🚀")
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
            <div><h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2"><Megaphone className="h-8 w-8 text-pink-600" /> Comunicados</h2><p className="text-slate-500">Cartelera de novedades y avisos.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 border-t-4 border-t-pink-500 shadow-lg h-fit">
                    <CardHeader><CardTitle className="text-lg">Nuevo Mensaje</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1"><Label>Título</Label><Input placeholder="Ej: Cambio de Precios" value={title} onChange={e => setTitle(e.target.value)} /></div>
                        
                        <div className="space-y-1"><Label>Nivel de Importancia</Label>
                            <Select value={priority} onValueChange={setPriority}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="normal">🔵 Normal (Informativo)</SelectItem>
                                    <SelectItem value="high">🟠 Importante (Atención)</SelectItem>
                                    <SelectItem value="critical">🔴 Urgente (Crítico)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1"><Label>Mensaje</Label><Textarea placeholder="Escribí acá..." className="min-h-[100px]" value={message} onChange={e => setMessage(e.target.value)} /></div>
                        
                        <div className="flex items-center justify-between bg-slate-100 p-3 rounded-lg border border-slate-200">
                            <div className="flex flex-col"><Label className="text-slate-700 font-bold text-xs">Pop-up Bloqueante</Label><span className="text-[10px] text-slate-500">¿Interrumpe la pantalla?</span></div>
                            <Switch checked={isBlocking} onCheckedChange={setIsBlocking} />
                        </div>

                        <Button className="w-full bg-pink-600 hover:bg-pink-700" onClick={handleSend} disabled={!title || !message}>Enviar Ahora</Button>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2 shadow-md">
                    <CardHeader><CardTitle className="text-lg">Historial</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Asunto</TableHead><TableHead>Nivel</TableHead><TableHead>Leído</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {history.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell className="text-xs font-mono text-slate-500">{item.date}</TableCell>
                                        <TableCell><p className="font-bold text-sm">{item.title}</p><p className="text-xs text-slate-500 truncate max-w-[200px]">{item.message}</p></TableCell>
                                        <TableCell>{getBadge(item.type)}</TableCell>
                                        <TableCell className="font-mono text-xs font-bold">{item.read}</TableCell>
                                        <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8"><Edit className="h-4 w-4 text-slate-400"/></Button><Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-slate-400 hover:text-red-500"/></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}