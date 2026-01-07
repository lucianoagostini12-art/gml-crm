"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Search, RefreshCw, Filter, ArrowUpRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

// ✅ ACTUALIZADO: Aceptamos onLeadClick
export function ContactsView({ userName, onLeadClick }: { userName?: string, onLeadClick?: (id: string) => void }) {
    const supabase = createClient()
    const [contacts, setContacts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState("all")

    const CURRENT_USER = userName || "Maca"

    // --- CARGA DE DATOS ---
    const fetchContacts = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('agent_name', CURRENT_USER)
            .order('last_update', { ascending: false }) 
        
        if (data) setContacts(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchContacts()

        const channel = supabase.channel('contacts_view_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: `agent_name=eq.${CURRENT_USER}` }, (payload) => {
                fetchContacts()
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [CURRENT_USER])

    // --- LOGICA DE CAMBIO DE ESTADO ---
    const changeStatus = async (id: string, newStatus: string) => {
        // Optimistic UI update
        setContacts(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c))

        const { error } = await supabase.from('leads').update({ 
            status: newStatus,
            last_update: new Date().toISOString()
        }).eq('id', id)

        if (error) {
            alert("Error al actualizar. Refrescando...")
            fetchContacts()
        }
    }

    // --- FILTROS ---
    const filtered = contacts.filter(c => {
        const matchesSearch = c.name?.toLowerCase().includes(search.toLowerCase()) || (c.phone && c.phone.includes(search))
        
        let matchesStatus = true
        if (statusFilter !== "all") {
            if (statusFilter === 'vendido') {
                // Filtro especial: Vendido puede ser 'ingresado' (el estado real de venta) o 'vendido' (legacy)
                matchesStatus = ['ingresado', 'vendido', 'cumplidas'].includes(c.status)
            } else {
                matchesStatus = c.status === statusFilter
            }
        }
        
        return matchesSearch && matchesStatus
    })

    const getDisplayPrepaga = (c: any) => {
        if (c.prepaga && c.prepaga !== "Generica") return c.prepaga
        if (c.quoted_prepaga) return c.quoted_prepaga + " (Cotiz)"
        return "-"
    }

    // Helper de colores para badges
    const getStatusBadge = (status: string) => {
        switch(status) {
            case 'nuevo': return 'bg-slate-100 text-slate-600 border-slate-200'
            case 'contactado': return 'bg-blue-50 text-blue-600 border-blue-200'
            case 'cotizacion': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
            case 'documentacion': return 'bg-purple-50 text-purple-700 border-purple-200'
            case 'ingresado': 
            case 'vendido': 
            case 'cumplidas': return 'bg-green-100 text-green-700 border-green-200'
            case 'perdido': return 'bg-red-50 text-red-600 border-red-200'
            default: return 'bg-gray-50 text-gray-500'
        }
    }

    const getStatusLabel = (status: string) => {
        const labels: any = {
            'nuevo': 'Sin Trabajar',
            'contactado': 'En Contacto',
            'cotizacion': 'Cotización',
            'documentacion': 'Documentación',
            'ingresado': 'VENTA CERRADA',
            'vendido': 'VENTA CERRADA',
            'perdido': 'PERDIDO'
        }
        return labels[status] || status.toUpperCase()
    }

    return (
        <div className="p-6 h-full overflow-y-auto w-full bg-slate-50 dark:bg-slate-900">
            <div className="max-w-6xl mx-auto space-y-6">
                
                {/* HEADER */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            🗂️ Archivo Histórico
                        </h2>
                        <p className="text-sm text-slate-500">
                            Base de datos personal de: <span className="font-bold text-blue-600">{CURRENT_USER}</span>
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="Buscar nombre o teléfono..." 
                                className="pl-9 bg-white shadow-sm"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-[180px] bg-white shadow-sm">
                                <div className="flex items-center gap-2 text-slate-600"><Filter size={14}/> <SelectValue /></div>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos</SelectItem>
                                <div className="border-t my-1"></div>
                                <SelectItem value="nuevo">📥 Sin Trabajar</SelectItem>
                                <SelectItem value="contactado">📞 En Contacto</SelectItem>
                                <SelectItem value="cotizacion">💲 Cotización</SelectItem>
                                <SelectItem value="documentacion">📂 Documentación</SelectItem>
                                <div className="border-t my-1"></div>
                                <SelectItem value="vendido">✅ Ventas Cerradas</SelectItem>
                                <SelectItem value="perdido">❌ Perdidos</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={fetchContacts} disabled={loading}>
                            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/>
                        </Button>
                    </div>
                </div>

                {/* TABLA DE DATOS */}
                <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-bold uppercase text-xs border-b tracking-wider">
                            <tr>
                                <th className="p-4">Cliente</th>
                                <th className="p-4">Estado Actual</th>
                                <th className="p-4">Prepaga / Plan</th>
                                <th className="p-4">Notas / Último Movimiento</th>
                                <th className="p-4 text-right">Recuperar / Mover</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-10 text-center text-slate-400 italic">
                                        {loading ? "Cargando tu historial..." : "No se encontraron registros con estos filtros."}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map(contact => (
                                    <tr key={contact.id} className="hover:bg-blue-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                                        <td className="p-4">
                                            {/* ✅ Clickable para abrir detalle */}
                                            <p 
                                                className="font-bold text-slate-800 dark:text-white text-base hover:text-blue-600 cursor-pointer underline-offset-4 hover:underline"
                                                onClick={() => onLeadClick && onLeadClick(contact.id)}
                                            >
                                                {contact.name}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-xs font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{contact.phone}</span>
                                                <span className="text-[10px] text-slate-400 bg-slate-50 border px-1 rounded">{contact.source || "Base"}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge variant="outline" className={`uppercase font-bold text-[10px] tracking-wide ${getStatusBadge(contact.status)}`}>
                                                {getStatusLabel(contact.status)}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-700 dark:text-slate-300">{getDisplayPrepaga(contact)}</div>
                                            {contact.plan && <div className="text-xs text-slate-500">{contact.plan}</div>}
                                        </td>
                                        <td className="p-4 max-w-[250px]">
                                            <p className="text-slate-600 text-xs truncate font-medium" title={contact.notes}>
                                                {contact.notes || contact.loss_reason || "-"}
                                            </p>
                                            <p className="text-[10px] text-slate-400 mt-1">
                                                Act: {new Date(contact.last_update).toLocaleDateString()}
                                            </p>
                                        </td>
                                        <td className="p-4 text-right">
                                            {/* Solo permitimos mover si NO es una venta cerrada (ingresado/cumplidas) para proteger comisiones */}
                                            {!['ingresado', 'cumplidas', 'vendido'].includes(contact.status) && (
                                                <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Select onValueChange={(val) => changeStatus(contact.id, val)}>
                                                        <SelectTrigger className="w-[170px] h-8 text-xs bg-white border-slate-300 focus:ring-blue-500 shadow-sm">
                                                            <div className="flex items-center gap-2"><ArrowUpRight size={12}/> <SelectValue placeholder="Mover al Tablero" /></div>
                                                        </SelectTrigger>
                                                        <SelectContent align="end">
                                                            <SelectItem value="nuevo">📥 Sin Trabajar</SelectItem>
                                                            <SelectItem value="contactado">📞 En Contacto</SelectItem>
                                                            <SelectItem value="cotizacion">💲 Cotización</SelectItem>
                                                            <SelectItem value="documentacion">📂 Documentación</SelectItem>
                                                            <div className="border-t my-1"></div>
                                                            <SelectItem value="perdido" className="text-red-600">❌ Marcar Perdido</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}