"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { BookOpen, Save, Plus, Trash2, Edit3, Folder, FileText, Search, ShieldQuestion, MessageCircle } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export function AdminResources() {
    // CATEGORÍAS DE TU NEGOCIO
    const categories = [
        { id: "scripts", name: "Guiones de Venta", icon: MessageCircle },
        { id: "objeciones", name: "Manejo de Objeciones", icon: ShieldQuestion },
        { id: "admin", name: "Procesos Admin", icon: FileText },
    ]

    // CONTENIDO "ENLAZADO" (SIMULADO)
    const [resources, setResources] = useState([
        // GUIONES
        { id: 1, title: "Apertura: Dato de Facebook (Meta)", category: "scripts", content: "Hola [Nombre], te hablo de GML Salud. \n\nTe contacto porque completaste un formulario en Facebook consultando por opciones de cobertura médica.\n\nContame, ¿actualmente tenés alguna obra social o prepaga, o estás buscando particular?" },
        { id: 2, title: "Apertura: Llamador en Frío", category: "scripts", content: "Hola [Nombre], ¿cómo estás? Te hablo de GML Salud.\nTe llamo brevemente porque estamos trabajando en tu zona con un beneficio exclusivo para monotributistas/autónomos para acceder a planes de salud privados derivando aportes..." },
        
        // OBJECIONES (LAS QUE ME PEDISTE)
        { id: 3, title: "Objeción: 'Es muy caro'", category: "objeciones", content: "Entiendo lo que decís del precio. Pero analizalo así:\nUna consulta privada hoy cuesta $25.000. Una urgencia, ni hablar.\n\nCon este plan, vos fijás el costo mensual y te olvidás de pagar copagos cada vez que te sentís mal. Es un seguro para tu tranquilidad y la de tu familia." },
        { id: 4, title: "Objeción: 'Tengo IOMA / Obra Social'", category: "objeciones", content: "Claro, te entiendo. El tema con IOMA es que muchas veces te cobran plus o los turnos demoran meses.\n\nLa idea acá no es que pagues dos veces, sino usar esos aportes que ya te descuentan para pagar una parte de un servicio privado superior (Sancor/Galeno/Prevención)." },
        { id: 5, title: "Objeción: 'Lo consulto con mi pareja'", category: "objeciones", content: "Perfecto, es una decisión importante. \n\n¿Qué te parece si les mando la info por WhatsApp a los dos y mañana los llamo a esta misma hora para sacarles las dudas juntos? Así no te quedás vos con la responsabilidad de explicar los detalles técnicos." },

        // ADMIN
        { id: 6, title: "Requisitos: Legajo Limpio", category: "admin", content: "Para que auditoría apruebe rápido:\n1. DNI: Foto frente y dorso sobre fondo blanco, sin flash.\n2. CBU: Certificado emitido por homebanking (no captura de pantalla).\n3. DDJJ Salud: Marcar TODAS las cruces. Si pone 'SÍ' en alguna, aclarar en observaciones." },
    ])

    const [selectedResource, setSelectedResource] = useState<any>(resources[0])
    const [isEditing, setIsEditing] = useState(false)
    const [searchTerm, setSearchTerm] = useState("")

    const filteredResources = resources.filter(r => 
        r.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        r.content.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleSave = () => {
        setIsEditing(false)
        alert("✅ Recurso actualizado en la base de conocimientos.")
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <BookOpen className="h-8 w-8 text-pink-600" /> Wiki de Ventas GML
                    </h2>
                    <p className="text-slate-500">Guiones, objeciones y procesos oficiales.</p>
                </div>
                <Button className="bg-slate-900 text-white"><Plus className="mr-2 h-4 w-4"/> Nuevo Artículo</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[650px]">
                
                {/* BARRA LATERAL (NAVEGADOR) */}
                <Card className="md:col-span-4 h-full flex flex-col border-r-4 border-r-slate-200">
                    <CardHeader className="pb-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400"/>
                            <Input placeholder="Buscar (ej: IOMA)..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full px-4">
                            {categories.map((cat) => {
                                const catItems = filteredResources.filter(r => r.category === cat.id)
                                if (catItems.length === 0) return null
                                return (
                                    <div key={cat.id} className="mb-6">
                                        <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1"><cat.icon className="h-3 w-3"/> {cat.name}</h3>
                                        <div className="space-y-1">
                                            {catItems.map(item => (
                                                <div 
                                                    key={item.id}
                                                    onClick={() => { setSelectedResource(item); setIsEditing(false) }}
                                                    className={`text-sm p-3 rounded-lg cursor-pointer transition-all flex items-start gap-2 border ${selectedResource.id === item.id ? 'bg-pink-50 border-pink-500 text-pink-900 shadow-sm' : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-600'}`}
                                                >
                                                    <FileText className={`h-4 w-4 mt-0.5 shrink-0 ${selectedResource.id === item.id ? 'text-pink-500' : 'text-slate-400'}`}/>
                                                    <span className="line-clamp-2 font-medium">{item.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                        </ScrollArea>
                    </CardContent>
                </Card>

                {/* VISOR DE CONTENIDO */}
                <Card className="md:col-span-8 h-full flex flex-col shadow-lg">
                    <CardHeader className="border-b pb-4 flex flex-row justify-between items-start bg-slate-50 rounded-t-xl">
                        <div className="space-y-1">
                            {isEditing ? (
                                <Input value={selectedResource.title} className="font-black text-xl h-10 w-full" />
                            ) : (
                                <CardTitle className="text-2xl font-black text-slate-800">{selectedResource.title}</CardTitle>
                            )}
                            <Badge variant="outline" className="bg-white capitalize">{categories.find(c=>c.id===selectedResource.category)?.name}</Badge>
                        </div>
                        <div className="flex gap-2">
                            {isEditing ? (
                                <Button size="sm" onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"><Save className="h-4 w-4 mr-2"/> Guardar</Button>
                            ) : (
                                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="hover:bg-blue-50 hover:text-blue-600 border-slate-300"><Edit3 className="h-4 w-4 mr-2"/> Editar</Button>
                            )}
                        </div>
                    </CardHeader>
                    
                    <CardContent className="flex-1 p-0 overflow-hidden bg-white">
                        {isEditing ? (
                            <Textarea 
                                className="h-full w-full p-6 resize-none font-mono text-sm leading-relaxed border-none focus-visible:ring-0 bg-slate-50" 
                                value={selectedResource.content} 
                                onChange={(e) => setSelectedResource({...selectedResource, content: e.target.value})}
                            />
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-8 prose prose-slate max-w-none">
                                    <div className="text-slate-700 whitespace-pre-wrap leading-loose text-base font-medium">
                                        {selectedResource.content}
                                    </div>
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}