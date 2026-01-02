"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { BookOpen, Save, Plus, FileText, Search, MessageCircle, ShieldQuestion, Loader2, Edit3, Trash2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

const supabase = createClient()

export function AdminResources() {
    const categories = [
        { id: "Guión Operativo (Paso a Paso)", name: "Guiones de Venta", icon: MessageCircle },
        { id: "Manejo de Objeciones (Escudo)", name: "Manejo de Objeciones", icon: ShieldQuestion },
        { id: "Tácticas 'Lo voy a Pensar'", name: "Tácticas de Cierre", icon: FileText },
        { id: "Reglas de Oro del Cierre", name: "Reglas de Oro", icon: BookOpen },
    ]

    const [resources, setResources] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedResource, setSelectedResource] = useState<any>(null)
    const [isEditing, setIsEditing] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    useEffect(() => {
        fetchResources()
    }, [])

    async function fetchResources() {
        setLoading(true)
        const { data } = await supabase
            .from('wiki_resources')
            .select('*')
            .order('order_index', { ascending: true })
        
        if (data) {
            setResources(data)
            if (!selectedResource) setSelectedResource(data[0])
        }
        setLoading(false)
    }

    async function handleSave() {
        if (!selectedResource.id) {
            // Es un recurso nuevo
            const { error } = await supabase.from('wiki_resources').insert([selectedResource])
            if (!error) alert("✅ Nuevo artículo creado")
        } else {
            // Es una actualización
            const { error } = await supabase
                .from('wiki_resources')
                .update({ 
                    title: selectedResource.title, 
                    content: selectedResource.content,
                    tag: selectedResource.tag 
                })
                .eq('id', selectedResource.id)
            if (!error) alert("✅ Wiki actualizada correctamente")
        }
        setIsEditing(false)
        fetchResources()
    }

    const addNew = (catId: string) => {
        const newItem = {
            title: "Nuevo Título",
            content: "Escribe el contenido aquí...",
            category: catId,
            tag: "General",
            order_index: resources.length + 1
        }
        setSelectedResource(newItem)
        setIsEditing(true)
    }

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-pink-600" /></div>

    const filteredResources = resources.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.content.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-pink-600" /> Editor de Wiki GML
                    </h2>
                    <p className="text-slate-500">Lo que edites acá aparecerá en el panel de vendedores al instante.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[700px]">
                <Card className="md:col-span-4 h-full flex flex-col border-r-4 border-r-slate-200">
                    <CardHeader className="pb-2">
                        <Input placeholder="Buscar artículo..." className="pl-4" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full px-4">
                            {categories.map((cat) => (
                                <div key={cat.id} className="mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider flex items-center gap-1"><cat.icon className="h-3 w-3"/> {cat.name}</h3>
                                        <Button variant="ghost" size="sm" onClick={() => addNew(cat.id)} className="h-6 w-6 p-0 text-slate-400 hover:text-pink-600"><Plus className="h-4 w-4"/></Button>
                                    </div>
                                    <div className="space-y-1">
                                        {filteredResources.filter(r => r.category === cat.id).map(item => (
                                            <div 
                                                key={item.id}
                                                onClick={() => { setSelectedResource(item); setIsEditing(false) }}
                                                className={`text-sm p-3 rounded-lg cursor-pointer border ${selectedResource?.id === item.id ? 'bg-pink-50 border-pink-500 text-pink-900' : 'bg-white border-transparent hover:bg-slate-50'}`}
                                            >
                                                {item.title}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="md:col-span-8 h-full flex flex-col shadow-lg">
                    {selectedResource && (
                        <>
                            <CardHeader className="border-b bg-slate-50 rounded-t-xl flex flex-row justify-between items-center">
                                <div className="space-y-1 flex-1 mr-4">
                                    {isEditing ? (
                                        <div className="space-y-2">
                                            <Input value={selectedResource.title} onChange={e => setSelectedResource({...selectedResource, title: e.target.value})} className="font-bold" />
                                            <Input value={selectedResource.tag} onChange={e => setSelectedResource({...selectedResource, tag: e.target.value})} className="h-7 text-xs w-32" placeholder="Tag (ej: Filtro)" />
                                        </div>
                                    ) : (
                                        <>
                                            <CardTitle className="text-xl font-black">{selectedResource.title}</CardTitle>
                                            <Badge variant="outline">{selectedResource.tag}</Badge>
                                        </>
                                    )}
                                </div>
                                <Button size="sm" onClick={isEditing ? handleSave : () => setIsEditing(true)} className={isEditing ? "bg-green-600 hover:bg-green-700" : "bg-slate-900"}>
                                    {isEditing ? <><Save className="mr-2 h-4 w-4"/> Guardar</> : <><Edit3 className="mr-2 h-4 w-4"/> Editar Texto</>}
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-1 p-0 bg-white">
                                {isEditing ? (
                                    <Textarea 
                                        className="h-full w-full p-6 resize-none border-none bg-slate-50 font-mono text-sm" 
                                        value={selectedResource.content} 
                                        onChange={(e) => setSelectedResource({...selectedResource, content: e.target.value})}
                                    />
                                ) : (
                                    <ScrollArea className="h-full p-8 whitespace-pre-wrap text-slate-700 leading-loose">
                                        {selectedResource.content}
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </>
                    )}
                </Card>
            </div>
        </div>
    )
}