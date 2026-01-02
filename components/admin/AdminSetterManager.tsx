"use client"

import { useState, useEffect } from "react"
// IMPORTANTE: Ruta de importación verificada según tu VS Code
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Flame, Snowflake, UserPlus, Trash2, RotateCcw, Linkedin, Facebook, Phone, TrendingUp, Target, Archive, Users, CheckCircle2, Loader2, X, ArrowRight } from "lucide-react"

export function AdminSetterManager() {
    const supabase = createClient()
    const [leads, setLeads] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedSeller, setSelectedSeller] = useState("")
    const [auditItem, setAuditItem] = useState<any | null>(null)
    const [isAuditOpen, setIsAuditOpen] = useState(false)
    const [returnNote, setReturnNote] = useState("") 

    // 1. CARGA INICIAL Y REALTIME
    const fetchSetterLeads = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('setter_leads')
            .select('*')
            .order('created_at', { ascending: false })
        if (data) setLeads(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchSetterLeads()
        const channel = supabase.channel('setter_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'setter_leads' }, () => fetchSetterLeads())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    // 2. LÓGICA DE ASIGNACIÓN (Pasa a la tabla de vendedores)
    const handleAssign = async (id: string) => {
        if (!selectedSeller) return alert("Por favor, seleccioná un vendedor de la lista.")
        
        const leadToMove = leads.find(l => l.id === id)
        
        // Actualizamos estado en la tabla Setter
        const { error: err1 } = await supabase
            .from('setter_leads')
            .update({ status: 'assigned', assigned_to: selectedSeller })
            .eq('id', id)

        // Insertamos en la tabla Leads (la que ven Maca/Gonza)
        const { error: err2 } = await supabase.from('leads').insert([{
            name: leadToMove.name,
            source: leadToMove.source,
            agent_name: selectedSeller,
            status: 'nuevo',
            operator: 'Pendiente',
            last_update: new Date()
        }])

        if (!err1 && !err2) alert(`✅ Lead asignado a ${selectedSeller}`)
        fetchSetterLeads()
    }

    // 3. RECICLAR LEAD (Sacarlo del cementerio y volverlo a la aduana)
    const handleRecycleLead = async () => {
        if (!auditItem) return
        await supabase
            .from('setter_leads')
                .update({ status: 'pending_assignment', discard_reason: null })
                .eq('id', auditItem.id)
        setIsAuditOpen(false)
        setAuditItem(null)
        alert("Lead reciclado con éxito.")
    }

    // 4. CÁLCULOS DE EMBUDO
    const pendingLeads = leads.filter(l => l.status === 'pending_assignment')
    const cemeteryLeads = leads.filter(l => l.status === 'discarded_by_setter')
    const totalProcessed = leads.length
    const passedToSupervision = leads.filter(l => l.status !== 'discarded_by_setter').length
    const totalSold = leads.filter(l => l.status === 'sold').length
    const passRate = totalProcessed > 0 ? Math.round((passedToSupervision / totalProcessed) * 100) : 0
    const salesRate = passedToSupervision > 0 ? Math.round((totalSold / passedToSupervision) * 100) : 0

    // HELPER ICONS
    const getIntensityIcon = (i: string) => {
        if (i === 'hot') return <Flame className="h-6 w-6 text-red-500 fill-red-500 animate-pulse" /> 
        if (i === 'warm') return <Flame className="h-6 w-6 text-yellow-500" />
        return <Snowflake className="h-6 w-6 text-blue-400" />
    }

    const getSourceIcon = (s: string) => {
        if (s === 'linkedin') return <Linkedin className="h-3 w-3" />
        if (s === 'facebook') return <Facebook className="h-3 w-3" />
        return <Phone className="h-3 w-3" />
    }

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-indigo-600"/></div>

    return (
        <div className="p-6 h-full flex flex-col gap-6 bg-slate-50 overflow-hidden">
            
            {/* 1. EMBUDO DE MÉTRICAS */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white border-l-4 border-indigo-500 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Procesados Setter</p>
                        <div className="flex items-center gap-2 mt-1">
                            <Users className="h-5 w-5 text-indigo-500"/><span className="text-2xl font-black">{totalProcessed}</span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-blue-500 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Pase a Supervisión</p>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-2xl font-black">{passRate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1 mt-3 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full" style={{width: `${passRate}%`}}></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-green-500 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Conversión Real</p>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-2xl font-black">{salesRate}%</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1 mt-3 rounded-full overflow-hidden">
                            <div className="bg-green-600 h-full" style={{width: `${salesRate}%`}}></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-red-500 shadow-sm">
                    <CardContent className="p-4">
                        <p className="text-xs font-bold text-slate-400 uppercase">Cementerio</p>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="text-2xl font-black">{cemeteryLeads.length}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. ZONA OPERATIVA */}
            <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-0 bg-white min-h-0">
                <Tabs defaultValue="aduana" className="flex-1 flex flex-col h-full">
                    <div className="px-6 pt-4 pb-2 border-b flex justify-between items-center shrink-0">
                        <TabsList className="bg-slate-100">
                            <TabsTrigger value="aduana" className="gap-2">Aduana <Badge className="ml-1 bg-green-600">{pendingLeads.length}</Badge></TabsTrigger>
                            <TabsTrigger value="auditoria" className="gap-2">Cementerio <Badge variant="secondary" className="ml-1">{cemeteryLeads.length}</Badge></TabsTrigger>
                        </TabsList>
                        
                        <div className="flex items-center gap-2">
                            <Select onValueChange={setSelectedSeller}>
                                <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Asignar a..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Maca">Maca</SelectItem>
                                    <SelectItem value="Gonza">Gonza</SelectItem>
                                    <SelectItem value="Brenda">Brenda</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <TabsContent value="aduana" className="flex-1 min-h-0 m-0">
                        <ScrollArea className="h-full p-6 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                                {pendingLeads.map(lead => (
                                    <div key={lead.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <Badge variant="outline" className="bg-slate-50 uppercase text-[10px]">{getSourceIcon(lead.source)} {lead.source}</Badge>
                                            {getIntensityIcon(lead.intensity)}
                                        </div>
                                        <h3 className="font-bold text-lg">{lead.name}</h3>
                                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border italic mt-2">"{lead.setter_note}"</p>
                                        <Button onClick={() => handleAssign(lead.id)} size="sm" className="w-full bg-slate-900 text-white font-bold h-10 mt-4">ASIGNAR AHORA</Button>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="auditoria" className="flex-1 min-h-0 m-0">
                        <ScrollArea className="h-full">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b sticky top-0">
                                    <tr>
                                        <th className="p-4">Nombre</th>
                                        <th className="p-4">Motivo</th>
                                        <th className="p-4">Nota Setter</th>
                                        <th className="p-4 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {cemeteryLeads.map(lead => (
                                        <tr key={lead.id} className="hover:bg-slate-50">
                                            <td className="p-4 font-bold">{lead.name}</td>
                                            <td className="p-4"><Badge variant="destructive">{lead.discard_reason}</Badge></td>
                                            <td className="p-4 italic">"{lead.setter_note}"</td>
                                            <td className="p-4 text-right">
                                                <Button size="sm" variant="outline" onClick={() => {setAuditItem(lead); setIsAuditOpen(true)}}>Gestionar</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </Card>

            {/* DIALOG DE GESTIÓN (Cementerio) */}
            <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Auditoría de Lead: {auditItem?.name}</DialogTitle>
                        <DialogDescription>¿Querés reciclar este dato o dejarlo congelado?</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-slate-50 p-3 rounded border italic text-sm">"{auditItem?.setter_note}"</div>
                        <Textarea placeholder="Nota de auditoría..." value={returnNote} onChange={e => setReturnNote(e.target.value)} className="h-20" />
                    </div>
                    <DialogFooter>
                        <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleRecycleLead}>
                            <RotateCcw className="mr-2 h-4 w-4"/> RECICLAR Y VOLVER A ADUANA
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}