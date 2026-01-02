"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Flame, Snowflake, UserPlus, Trash2, RotateCcw, AlertCircle, Linkedin, Facebook, Phone, TrendingUp, Target, Archive, Users, CheckCircle2 } from "lucide-react"

// Tipos simulados
type SetterLead = {
    id: number
    name: string
    source: 'linkedin' | 'facebook' | 'llamador'
    intensity: 'hot' | 'warm' | 'cold'
    status: 'pending_assignment' | 'discarded_by_setter' | 'assigned' | 'sold'
    setterNote: string
    discardReason?: string
    date: string
}

export function AdminSetterManager() {
    // --- ESTADO DE DATOS (MOCK) ---
    const [leads, setLeads] = useState<SetterLead[]>([
        // Pendientes (Aduana)
        { id: 1, name: "Empresa ABC S.A.", source: 'linkedin', intensity: 'hot', status: 'pending_assignment', setterNote: "Buscan plan para 20 empleados. Urgente.", date: "Hoy 10:00" },
        { id: 2, name: "Juan Perez", source: 'facebook', intensity: 'warm', status: 'pending_assignment', setterNote: "Interesado en OSDE.", date: "Hoy 11:30" },
        // Descartados (Cementerio Automático)
        { id: 3, name: "Carlos Ruiz", source: 'llamador', intensity: 'cold', status: 'discarded_by_setter', setterNote: "Sin dinero.", discardReason: "caro", date: "Ayer" },
        { id: 4, name: "Ana Gomez", source: 'llamador', intensity: 'cold', status: 'discarded_by_setter', setterNote: "No atendió.", discardReason: "buzon", date: "Ayer" },
        { id: 5, name: "Pedro L.", source: 'facebook', intensity: 'cold', status: 'discarded_by_setter', setterNote: "Tiene otra obra social.", discardReason: "competencia", date: "Ayer" },
        // Historial (Para métricas)
        { id: 6, name: "Marta S.", source: 'linkedin', intensity: 'hot', status: 'sold', setterNote: "Cerrado por Gonza.", date: "Semana pasada" },
        { id: 7, name: "Luis D.", source: 'facebook', intensity: 'warm', status: 'assigned', setterNote: "En gestión con Maca.", date: "Ayer" },
    ])

    const [selectedSeller, setSelectedSeller] = useState("")
    const [auditItem, setAuditItem] = useState<SetterLead | null>(null)
    const [isAuditOpen, setIsAuditOpen] = useState(false)
    const [returnNote, setReturnNote] = useState("") 

    // Filtros visuales
    const pendingLeads = leads.filter(l => l.status === 'pending_assignment')
    const cemeteryLeads = leads.filter(l => l.status === 'discarded_by_setter')

    // --- LÓGICA DE MÉTRICAS (EMBUDO) ---
    const totalProcessed = leads.length
    // Pasados a supervisión: Todo lo que NO fue descartado por ella misma.
    const passedToSupervision = leads.filter(l => l.status !== 'discarded_by_setter').length
    // Vendidos
    const totalSold = leads.filter(l => l.status === 'sold').length

    // Tasa de Pase: (Pasados / Total Procesado)
    const passRate = totalProcessed > 0 ? Math.round((passedToSupervision / totalProcessed) * 100) : 0
    // Tasa de Cierre: (Vendidos / Pasados)
    const salesRate = passedToSupervision > 0 ? Math.round((totalSold / passedToSupervision) * 100) : 0

    const counts = {
        linkedin: leads.filter(l => l.source === 'linkedin').length,
        facebook: leads.filter(l => l.source === 'facebook').length,
        llamador: leads.filter(l => l.source === 'llamador').length
    }

    // --- ACCIONES ---
    const handleAssign = (id: number) => {
        if (!selectedSeller) return alert("Seleccioná un vendedor")
        setLeads(leads.map(l => l.id === id ? { ...l, status: 'assigned' } : l))
        alert(`Lead #${id} asignado a ${selectedSeller}`)
    }

    const handleRecycleLead = () => { // Reutilizar base
        if (!auditItem) return
        setLeads(leads.filter(l => l.id !== auditItem.id)) 
        setIsAuditOpen(false); setAuditItem(null)
    }

    const handleReturnToSetter = () => {
        if (!auditItem) return
        console.log(`Devolviendo lead ${auditItem.id} a Gestora. Nota: ${returnNote}`)
        setLeads(leads.filter(l => l.id !== auditItem.id))
        setIsAuditOpen(false); setAuditItem(null); setReturnNote("") 
    }

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

    return (
        <div className="p-6 h-full flex flex-col gap-6 bg-slate-50 overflow-hidden">
            
            {/* 1. EMBUDO DE MÉTRICAS (NO SE CORTA) */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* A: VOLUMEN */}
                <Card className="bg-white border-l-4 border-indigo-500 shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase">Procesados Total</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Users className="h-5 w-5 text-indigo-500"/>
                                <span className="text-2xl font-black text-slate-800">{totalProcessed}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-3 text-[10px] font-bold text-slate-500">
                            <span className="flex items-center gap-1"><Linkedin className="h-3 w-3 text-blue-700"/> {counts.linkedin}</span>
                            <span className="flex items-center gap-1"><Facebook className="h-3 w-3 text-blue-500"/> {counts.facebook}</span>
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-orange-500"/> {counts.llamador}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* B: TASA DE PASE (FILTRO SETTER) */}
                <Card className="bg-white border-l-4 border-blue-500 shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <p className="text-xs font-bold text-slate-400 uppercase">Pase a Supervisión</p>
                        <div className="flex items-center gap-3 mt-1">
                            <TrendingUp className="h-8 w-8 text-blue-100 p-1 bg-blue-600 rounded-lg"/>
                            <div>
                                <span className="text-2xl font-black text-slate-800">{passRate}%</span>
                                <p className="text-[10px] text-slate-400 leading-tight">{passedToSupervision} aprobados</p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 h-1 mt-3 rounded-full overflow-hidden">
                            <div className="bg-blue-600 h-full" style={{width: `${passRate}%`}}></div>
                        </div>
                    </CardContent>
                </Card>

                {/* C: TASA DE CIERRE (CALIDAD) */}
                <Card className="bg-white border-l-4 border-green-500 shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <p className="text-xs font-bold text-slate-400 uppercase">Conversión a Venta</p>
                        <div className="flex items-center gap-3 mt-1">
                            <Target className="h-8 w-8 text-green-100 p-1 bg-green-600 rounded-lg"/>
                            <div>
                                <span className="text-2xl font-black text-slate-800">{salesRate}%</span>
                                <p className="text-[10px] text-slate-400 leading-tight">{totalSold} cerrados</p>
                            </div>
                        </div>
                        <div className="w-full bg-slate-100 h-1 mt-3 rounded-full overflow-hidden">
                            <div className="bg-green-600 h-full" style={{width: `${salesRate}%`}}></div>
                        </div>
                    </CardContent>
                </Card>

                {/* D: DESCARTES (CEMENTERIO) */}
                <Card className="bg-white border-l-4 border-red-500 shadow-sm">
                    <CardContent className="p-4 flex flex-col justify-between h-full">
                        <p className="text-xs font-bold text-slate-400 uppercase">Descartes Automáticos</p>
                        <div className="flex items-center gap-3 mt-1">
                            <Archive className="h-8 w-8 text-red-100 p-1 bg-red-500 rounded-lg"/>
                            <div>
                                <span className="text-2xl font-black text-slate-800">{cemeteryLeads.length}</span>
                                <p className="text-[10px] text-slate-400 leading-tight">Congelados en base</p>
                            </div>
                        </div>
                        <div className="text-[10px] font-bold text-red-500 mt-3 text-right">
                            Revisar en auditoría →
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. ZONA OPERATIVA (TABLA PRINCIPAL) */}
            <Card className="flex-1 flex flex-col overflow-hidden shadow-md border-0 bg-white min-h-0">
                <Tabs defaultValue="aduana" className="flex-1 flex flex-col h-full">
                    <div className="px-6 pt-4 pb-2 border-b border-slate-100 flex justify-between items-center shrink-0">
                        <TabsList className="bg-slate-100">
                            <TabsTrigger value="aduana" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <UserPlus className="h-4 w-4"/> Aduana <Badge className="ml-1 bg-green-600">{pendingLeads.length}</Badge>
                            </TabsTrigger>
                            <TabsTrigger value="auditoria" className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                <Trash2 className="h-4 w-4"/> Cementerio <Badge variant="secondary" className="ml-1">{cemeteryLeads.length}</Badge>
                            </TabsTrigger>
                        </TabsList>
                        
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Asignar a:</span>
                            <Select onValueChange={setSelectedSeller}>
                                <SelectTrigger className="w-[180px] h-9 border-slate-200"><SelectValue placeholder="Seleccionar Vendedor..." /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Maca">Maca</SelectItem>
                                    <SelectItem value="Gonza">Gonza</SelectItem>
                                    <SelectItem value="Lucho">Lucho</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* TAB ADUANA */}
                    <TabsContent value="aduana" className="flex-1 min-h-0 m-0">
                        <ScrollArea className="h-full p-6 bg-slate-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                                {pendingLeads.map(lead => (
                                    <div key={lead.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start mb-3">
                                            <Badge variant="outline" className="bg-slate-50 gap-1 uppercase text-[10px] tracking-wide border-slate-200">{getSourceIcon(lead.source)} {lead.source}</Badge>
                                            <div className="bg-white rounded-full">{getIntensityIcon(lead.intensity)}</div>
                                        </div>
                                        <h3 className="font-bold text-lg text-slate-900">{lead.name}</h3>
                                        <div className="text-xs text-slate-400 mb-2">{lead.date}</div>
                                        <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 italic">"{lead.setterNote}"</p>
                                        <div className="mt-5 pt-4 border-t border-slate-100">
                                            <Button onClick={() => handleAssign(lead.id)} size="sm" className="w-full bg-slate-900 text-white font-bold h-10 hover:bg-slate-800">
                                                ASIGNAR AHORA
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {pendingLeads.length === 0 && <div className="col-span-full text-center py-20 text-slate-400">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-2 opacity-20"/>
                                    <p>No hay leads pendientes de asignación.</p>
                                </div>}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    {/* TAB CEMENTERIO */}
                    <TabsContent value="auditoria" className="flex-1 min-h-0 m-0">
                        <div className="p-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 text-slate-600 text-xs font-bold px-6 shrink-0">
                            <Archive className="h-4 w-4"/>
                            BASE DE DATOS CONGELADA: Estos leads entraron automáticamente aquí al ser descartados.
                        </div>
                        <ScrollArea className="h-full">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-4 font-bold uppercase text-xs tracking-wider">Nombre</th>
                                        <th className="p-4 font-bold uppercase text-xs tracking-wider">Origen</th>
                                        <th className="p-4 font-bold uppercase text-xs tracking-wider">Motivo</th>
                                        <th className="p-4 font-bold uppercase text-xs tracking-wider">Nota Setter</th>
                                        <th className="p-4 text-right font-bold uppercase text-xs tracking-wider">Acción</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {cemeteryLeads.map(lead => (
                                        <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="p-4 font-bold text-slate-800">{lead.name}</td>
                                            <td className="p-4 uppercase text-xs text-slate-500 flex items-center gap-2">{getSourceIcon(lead.source)} {lead.source}</td>
                                            <td className="p-4"><Badge variant="destructive" className="uppercase text-[10px]">{lead.discardReason}</Badge></td>
                                            <td className="p-4 text-slate-600 italic max-w-xs truncate">"{lead.setterNote}"</td>
                                            <td className="p-4 text-right">
                                                <Button size="sm" variant="outline" className="border-slate-300" onClick={() => {setAuditItem(lead); setIsAuditOpen(true)}}>Gestionar</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </Card>

            {/* MODAL GESTIÓN CEMENTERIO */}
            <Dialog open={isAuditOpen} onOpenChange={setIsAuditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Gestión de Lead Congelado: {auditItem?.name}</DialogTitle>
                        <DialogDescription>¿Querés reutilizar este dato o devolverlo a la setter?</DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-2 space-y-4">
                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
                            <span className="font-bold block text-slate-500 text-xs uppercase mb-1">Causa de Congelamiento:</span>
                            <p className="text-slate-800 italic">"{auditItem?.setterNote}" ({auditItem?.discardReason})</p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700 uppercase">Nota para Devolución (Opcional):</label>
                            <Textarea 
                                placeholder="Ej: Intentemos de nuevo, cambió la promo..." 
                                value={returnNote}
                                onChange={(e) => setReturnNote(e.target.value)}
                                className="text-sm resize-none h-20"
                            />
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 mt-2">
                        <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold" onClick={handleRecycleLead}>
                            <RotateCcw className="h-4 w-4 mr-2"/> Reutilizar (Reciclar)
                        </Button>
                        <Button variant="outline" className="flex-1 border-slate-300 text-slate-700 hover:bg-slate-50 font-bold" onClick={handleReturnToSetter}>
                            <RotateCcw className="h-4 w-4 mr-2"/> Devolver a Gestora
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}