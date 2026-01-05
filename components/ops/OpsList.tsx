"use client"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, ArrowRightLeft, Clock, ShieldCheck, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// AGREGADO: Importamos getStatusColor para mantener consistencia con el Modal
import { getPrepagaStyles, getSubStateStyle, getStatusColor } from "./data"

export function OpsList({ operations, onSelectOp, updateOp, globalConfig }: any) {
    return (
        <div className="space-y-3">
            {operations.length === 0 ? (
                <div className="text-center py-10 text-slate-400">No hay operaciones en esta vista.</div>
            ) : operations.map((op: any) => {
                const styles = getPrepagaStyles(op.prepaga || 'Generica');
                const borderColorClass = styles.split(' ').find((c:string) => c.startsWith('border-l-')) || 'border-l-slate-400';
                const subStateOptions = globalConfig?.subStates?.[op.status] || [];
                
                // Obtenemos los colores del estado principal (Igual que en OpsModal)
                const statusStyle = getStatusColor(op.status);

                return (
                    <div 
                        key={op.id} 
                        onClick={() => onSelectOp(op)} 
                        className={`bg-white rounded-xl border border-slate-200 border-l-[6px] ${borderColorClass} p-4 hover:shadow-lg transition-all flex items-center justify-between group cursor-pointer relative overflow-hidden`}
                    >
                        {/* 1. DATOS PRINCIPALES */}
                        <div className="flex items-center gap-4 w-[40%]">
                            <div className={`h-10 w-10 rounded-lg flex items-center justify-center font-black text-white shadow-sm shrink-0 ${op.type === 'alta' ? 'bg-green-500' : 'bg-purple-600'}`}>
                                {op.type === 'alta' ? <UserPlus size={18} /> : <ArrowRightLeft size={18} />}
                            </div>
                            <div className="overflow-hidden min-w-0">
                                <h3 className="font-black text-slate-800 text-base leading-tight truncate">{op.clientName}</h3>
                                <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                                    <span className="font-mono bg-slate-50 px-1.5 rounded border border-slate-100">{op.dni}</span>
                                    <div className="w-px h-3 bg-slate-200"></div>
                                    <div className="flex items-center gap-1.5 overflow-hidden">
                                        <Avatar className="h-4 w-4 border border-slate-200">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${op.seller || 'X'}`}/>
                                            <AvatarFallback className="text-[6px]">{op.seller?.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="truncate font-medium">{op.seller || 'Sin Asignar'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. PREPAGA Y PLAN */}
                        <div className="w-[20%] flex flex-col justify-center border-l border-slate-100 pl-4">
                            <div className={`text-[10px] px-2 py-0.5 font-black uppercase mb-1 border rounded-md w-fit ${styles.replace(/border-l-\S+/g, '')}`}>
                                {op.prepaga || 'Sin Dato'}
                            </div>
                            <p className="text-xs text-slate-500 font-bold truncate">Plan: <span className="text-slate-900">{op.plan || '-'}</span></p>
                        </div>

                        {/* 3. ESTADOS Y ACCIONES (Premium Layout) */}
                        <div className="w-[40%] flex flex-col items-end gap-2 pl-4 border-l border-slate-100">
                            
                            {/* Fila Superior: Badge Estado (AHORA CON COLOR) + Operador */}
                            <div className="flex items-center justify-end gap-2 w-full">
                                {op.operator && (
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200" title={`Tomado por ${op.operator}`}>
                                        <ShieldCheck size={10} className="text-blue-600"/>
                                        <span className="truncate max-w-[100px]">{op.operator.split(' ')[0]}</span>
                                    </div>
                                )}
                                
                                {/* AQUI ESTA EL CAMBIO: Usamos statusStyle en lugar del Badge gris estático */}
                                <div className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border shadow-sm text-center min-w-[90px] ${statusStyle}`}>
                                    {op.status}
                                </div>
                            </div>

                            {/* Fila Inferior: Subestado + Antigüedad */}
                            <div className="flex items-center justify-end gap-2 w-full">
                                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400" title="Días en esta etapa">
                                    <Clock size={10}/>
                                    <span>{op.daysInStatus || 0}d</span>
                                </div>
                                <div onClick={(e) => e.stopPropagation()} className="min-w-[140px]">
                                    <Select 
                                        value={op.subState || ""} 
                                        onValueChange={(val) => updateOp({...op, subState: val})}
                                    >
                                        {/* AQUI TAMBIEN: Mantenemos getSubStateStyle pero ajustamos borde para que haga match con Modal */}
                                        <SelectTrigger className={`h-7 text-[10px] font-bold focus:ring-0 transition-all shadow-sm ${getSubStateStyle(op.subState)}`}>
                                            <SelectValue placeholder="Estado..." />
                                        </SelectTrigger>
                                        <SelectContent align="end">
                                            {subStateOptions.length > 0 ? (
                                                subStateOptions.map((sub: string) => <SelectItem key={sub} value={sub} className="text-xs">{sub}</SelectItem>)
                                            ) : (<div className="p-2 text-[10px] text-slate-400 text-center">Sin opciones</div>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}