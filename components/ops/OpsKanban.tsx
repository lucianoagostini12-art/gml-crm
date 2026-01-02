"use client"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Phone, UserPlus, ArrowRightLeft } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// LISTA FIJA DE 5 COLUMNAS
const KANBAN_COLUMNS = ['ingresado', 'precarga', 'medicas', 'legajo', 'demoras']

export function OpsKanban({ operations, onSelectOp }: any) {
    return (
        <div className="h-full w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
            <div className="flex gap-2 min-w-max px-2 h-full items-start">
                
                {KANBAN_COLUMNS.map((status) => (
                    // W-230px es el ancho ideal para esta vista compacta
                    <div key={status} className="w-[230px] flex flex-col bg-slate-100/50 rounded-xl border border-slate-200/60 h-full shrink-0 shadow-sm">
                        
                        {/* Header Columna */}
                        <div className="p-2 border-b border-slate-200 bg-white/50 rounded-t-xl flex justify-between items-center sticky top-0 backdrop-blur-sm z-10">
                            <h3 className="font-bold text-[10px] uppercase tracking-wider text-slate-600 truncate mr-2" title={status}>
                                {status}
                            </h3>
                            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-slate-200 text-slate-700">
                                {operations.filter((o:any) => o.status === status).length}
                            </Badge>
                        </div>

                        {/* Contenido */}
                        <ScrollArea className="flex-1 w-full">
                            <div className="p-1.5 flex flex-col gap-1.5 pb-2">
                                {operations.filter((o:any) => o.status === status).map((op:any) => (
                                    // PADDING REDUCIDO: p-2
                                    <div key={op.id} onClick={() => onSelectOp(op)} className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm hover:shadow-md cursor-pointer hover:border-blue-300 transition-all group flex flex-col gap-1 relative">
                                        
                                        {/* Barra lateral de color */}
                                        <div className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${op.type === 'alta' ? 'bg-green-500' : 'bg-purple-500'}`}></div>
                                        
                                        {/* 1. HEADER: Nombre + Icono */}
                                        <div className="flex justify-between items-center gap-2 pl-2">
                                            {/* CAMBIO 1: clientName -> client_name */}
                                            <span className="font-bold text-xs text-slate-800 truncate flex-1 leading-none">{op.client_name}</span>
                                            <div className={`h-3.5 w-3.5 shrink-0 rounded flex items-center justify-center text-white ${op.type === 'alta' ? 'bg-green-500' : 'bg-purple-600'}`}>
                                                {op.type === 'alta' ? <UserPlus size={7}/> : <ArrowRightLeft size={7}/>}
                                            </div>
                                        </div>
                                        
                                        {/* 2. DATOS DE CONTACTO */}
                                        <div className="flex flex-col gap-0.5 pl-2">
                                            {/* Vendedora */}
                                            <div className="flex items-center gap-1">
                                                {/* CAMBIO 2: op.seller -> op.seller?.name (Porque viene como objeto relacionado) */}
                                                <Avatar className="h-3 w-3"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${op.seller?.name || 'X'}`}/></Avatar>
                                                <span className="text-[9px] font-bold text-slate-500 leading-none">{op.seller?.name || 'Sin Asignar'}</span>
                                            </div>
                                            
                                            {/* DNI y Teléfono */}
                                            <div className="flex items-center gap-2 text-[9px] text-slate-400">
                                                <span className="font-mono bg-slate-50 px-1 rounded border border-slate-100 leading-none">{op.dni || '-'}</span>
                                                {op.phone && <span className="flex items-center gap-0.5 leading-none"><Phone size={8}/> {op.phone.slice(-8)}</span>}
                                            </div>
                                        </div>

                                        {/* 3. FOOTER: Prepaga + Subestado */}
                                        <div className="text-[9px] pt-1 border-t border-slate-100 flex justify-between items-center mt-0.5 ml-2">
                                            <span className="font-bold text-blue-600 truncate max-w-[70px] leading-none">{op.prepaga}</span>
                                            {/* CAMBIO 3: subState -> sub_state */}
                                            <span className="font-medium text-slate-400 truncate max-w-[80px] leading-none">{op.sub_state || '-'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                ))}
            </div>
        </div>
    )
}