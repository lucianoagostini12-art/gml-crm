"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, BookOpen, MessageCircle, ShieldAlert, Zap, BrainCircuit, AlertTriangle, Fingerprint, Loader2 } from "lucide-react"

const supabase = createClient()

export function WikiView() {
    const [search, setSearch] = useState("")
    const [wikiSections, setWikiSections] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Iconos mapeados por nombre de categoría para mantener tu diseño
    const iconMap: any = {
        "Guión Operativo (Paso a Paso)": <Fingerprint className="h-5 w-5 text-blue-500"/>,
        "Manejo de Objeciones (Escudo)": <ShieldAlert className="h-5 w-5 text-red-500"/>,
        "Tácticas 'Lo voy a Pensar'": <BrainCircuit className="h-5 w-5 text-purple-500"/>,
        "Reglas de Oro del Cierre": <Zap className="h-5 w-5 text-yellow-500"/>
    }

    useEffect(() => {
        async function loadWiki() {
            const { data } = await supabase
                .from('wiki_resources')
                .select('*')
                .order('order_index', { ascending: true })

            if (data) {
                // Agrupamos los datos por categoría como tenías antes
                const grouped = data.reduce((acc: any[], item: any) => {
                    const section = acc.find(s => s.category === item.category)
                    if (section) {
                        section.items.push(item)
                    } else {
                        acc.push({
                            category: item.category,
                            icon: iconMap[item.category] || <BookOpen className="h-5 w-5" />,
                            items: [item]
                        })
                    }
                    return acc;
                }, [])
                setWikiSections(grouped)
            }
            setLoading(false)
        }
        loadWiki()
    }, [])

    const filteredData = wikiSections.map(section => ({
        ...section,
        items: section.items.filter((item: any) => 
            item.title.toLowerCase().includes(search.toLowerCase()) || 
            item.content.toLowerCase().includes(search.toLowerCase()) ||
            (item.tag && item.tag.toLowerCase().includes(search.toLowerCase()))
        )
    })).filter(section => section.items.length > 0)

    if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-blue-600" /></div>

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto text-slate-900 dark:text-slate-100 pb-20">
            <div className="mb-8">
                <h2 className="text-2xl font-black mb-2 flex items-center gap-2 tracking-tight">
                    <BookOpen className="h-7 w-7 text-blue-600" /> Wiki de Ventas GML
                </h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">Tu manual interactivo para rebatir objeciones y cerrar más ventas.</p>
                <div className="relative group">
                    <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <Input 
                        placeholder="Escribí acá lo que dice el cliente (ej: 'caro', 'ioma')..." 
                        className="pl-10 h-12 text-lg shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-10">
                {filteredData.map((section, idx) => (
                    <div key={idx}>
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-700 border-b pb-2">
                            {section.icon} {section.category}
                        </h3>
                        <div className="grid gap-4">
                            {section.items.map((item: any, i: number) => (
                                <Card key={i} className="group hover:border-blue-400 transition-all">
                                    <CardHeader className="py-3 px-5 cursor-pointer bg-slate-50/50 rounded-t-lg">
                                        <CardTitle className="text-base font-bold flex justify-between items-center">
                                            {item.title}
                                           {item.tag && <Badge variant="secondary" className="font-normal text-slate-500">{item.tag}</Badge>}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="px-5 pb-5 pt-4 text-[15px] text-slate-600 leading-relaxed whitespace-pre-line border-l-4 border-blue-500/30">
                                        {item.content}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}