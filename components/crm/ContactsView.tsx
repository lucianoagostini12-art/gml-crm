"use client"

import { useState, useEffect } from "react"
// 1. CORRECCIÓN: Importamos la función correcta
import { createClient } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// 2. Aceptamos el nombre del usuario real
export function ContactsView({ userName }: { userName?: string }) {
    // 3. Iniciamos la conexión a Supabase
    const supabase = createClient()

    const [contacts, setContacts] = useState<any[]>([])
    const [search, setSearch] = useState("")

    // Usamos el nombre real (o Maca por defecto para evitar errores)
    const CURRENT_USER = userName || "Maca" 

    useEffect(() => {
        const fetchContacts = async () => {
            const { data } = await supabase
                .from('leads')
                .select('*')
                .eq('agent_name', CURRENT_USER) 
                .order('created_at', { ascending: false })
            
            if (data) setContacts(data)
        }
        fetchContacts()
    }, [CURRENT_USER])

    const filtered = contacts.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        (c.phone && c.phone.includes(search))
    )

    const changeStatus = async (id: string, newStatus: string) => {
        const confirm = window.confirm(`¿Mover este cliente a "${newStatus}"?`)
        if (!confirm) return

        await supabase.from('leads').update({ 
            status: newStatus,
            last_update: new Date().toISOString()
        }).eq('id', id)

        window.location.reload()
    }

    return (
        <div className="p-6 h-full overflow-y-auto">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col gap-2 mb-6">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Mi Archivo Histórico</h2>
                    <p className="text-sm text-slate-500">Gestionando datos de: <span className="font-bold text-blue-600">{CURRENT_USER}</span></p>
                    
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="Buscar en mis perdidos/vendidos..." 
                            className="pl-10 bg-white shadow-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-lg shadow border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-medium border-b">
                            <tr>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Estado Actual</th>
                                <th className="p-4">Prepaga</th>
                                <th className="p-4">Notas / Motivo</th>
                                <th className="p-4 text-right">Mover a...</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.map(contact => (
                                <tr key={contact.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4">
                                        <p className="font-bold text-slate-800 dark:text-white">{contact.name}</p>
                                        <p className="text-xs text-slate-500">{contact.phone}</p>
                                    </td>
                                    <td className="p-4">
                                        <Badge variant="outline" className={`
                                            ${contact.status === 'vendido' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                            ${contact.status === 'perdido' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                            ${!['vendido','perdido'].includes(contact.status) ? 'bg-blue-50 text-blue-700' : ''}
                                        `}>
                                            {contact.status.toUpperCase()}
                                        </Badge>
                                    </td>
                                    <td className="p-4 text-slate-500">{contact.prepaga}</td>
                                    <td className="p-4 text-slate-500 text-xs max-w-[200px] truncate">
                                        {contact.loss_reason ? `Perdido: ${contact.loss_reason}` : (contact.notes || '-')}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end">
                                            <Select onValueChange={(val) => changeStatus(contact.id, val)}>
                                                <SelectTrigger className="w-[140px] h-8 text-xs">
                                                    <SelectValue placeholder="Cambiar Estado" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="nuevo">📥 Sin Trabajar</SelectItem>
                                                    <SelectItem value="contactado">📞 En Contacto</SelectItem>
                                                    <SelectItem value="cotizacion">💲 Cotizando</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filtered.length === 0 && <div className="p-10 text-center text-slate-400">No tenés datos archivados con este nombre.</div>}
                </div>
            </div>
        </div>
    )
}